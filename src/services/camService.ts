/**
 * CAM & CNC Toolpath Generator & 3D Printing Preflight Service
 *
 * Implements native subtractive and additive digital fabrication workflows:
 * 1. 2D DXF Flat Pattern Export (AutoCAD R12 ASCII) for laser, plasma, waterjet, and CNC routing.
 * 2. CNC G-Code Generator (Grbl, Marlin, LinuxCNC, Haas, Generic) with tool radius compensation,
 *    multi-pass step-downs, safe retracts, and optional holding tabs.
 * 3. 3D Printing Preflight Diagnostics (Euler verification, bed adhesion contact, filament weight, print time).
 */

import { CadPartOutput, CncCamConfig, CncHoleFeature, MultiZToolpathStage, PrintPreflightInfo } from '../types/cad';

// 1 cm in ApexCAD / OpenUSD = 10 mm in CAM & 3D Printing standards
const CM_TO_MM = 10.0;

export const DEFAULT_CAM_CONFIG: CncCamConfig = {
  machineDialect: 'grbl',
  toolDiameterMm: 3.175, // 1/8" standard endmill
  toolType: 'flat_endmill',
  feedRateMmMin: 1200,   // 1200 mm/min standard cutting feed
  plungeRateMmMin: 300,  // 300 mm/min Z plunge feed
  spindleRpm: 16000,     // 16,000 RPM
  stepDownMm: 1.5,       // 1.5 mm per pass
  safeZMm: 5.0,          // 5.0 mm clearance above workpiece
  cutOperation: 'outside_contour',
  stepOverPercent: 45,   // 45% radial stepover for interior pocket clearing
  pocketPattern: 'concentric', // 'concentric' spiral or 'raster' zig-zag
  addDogboneRelief: false, // Optional dogbone overcut fillets on concave 90° corners (ISS-503)
  usePeckDrilling: true,  // Canned G81/G83 peck drilling for holes matching tool diameter (ISS-503)
  addHoldingTabs: true,
  tabWidthMm: 4.0,       // 4 mm holding tab width
  tabHeightMm: 1.5,      // 1.5 mm holding tab height
  tabCount: 4,           // 4 tabs per perimeter
};

export interface Point2D {
  x: number;
  y: number;
}

export interface LineSegment2D {
  p1: Point2D;
  p2: Point2D;
}

/**
 * Slices a 3D triangle mesh at a given Z plane height (in millimeters)
 * to extract exact 2D planar contour line segments.
 */
export function sliceMeshAtZ(part: CadPartOutput, sliceZMmh: number): LineSegment2D[] {
  const segments: LineSegment2D[] = [];
  const pts = part.mesh.points;
  const tris = part.mesh.triangles;

  // Scan every triangle in the index buffer
  for (let i = 0; i < tris.length; i += 3) {
    const idx0 = tris[i];
    const idx1 = tris[i + 1];
    const idx2 = tris[i + 2];

    const v0 = pts[idx0];
    const v1 = pts[idx1];
    const v2 = pts[idx2];
    if (!v0 || !v1 || !v2) continue;

    // Convert coordinates from cm to mm
    const p0 = { x: v0[0] * CM_TO_MM, y: v0[1] * CM_TO_MM, z: v0[2] * CM_TO_MM };
    const p1 = { x: v1[0] * CM_TO_MM, y: v1[1] * CM_TO_MM, z: v1[2] * CM_TO_MM };
    const p2 = { x: v2[0] * CM_TO_MM, y: v2[1] * CM_TO_MM, z: v2[2] * CM_TO_MM };

    // Check if triangle intersects the slice plane
    const zMin = Math.min(p0.z, p1.z, p2.z);
    const zMax = Math.max(p0.z, p1.z, p2.z);

    if (sliceZMmh < zMin || sliceZMmh > zMax || zMin === zMax) {
      continue;
    }

    // Find intersection points on triangle edges
    const cutPoints: Point2D[] = [];
    const edges = [
      [p0, p1],
      [p1, p2],
      [p2, p0],
    ];

    for (const [ea, eb] of edges) {
      if ((ea.z <= sliceZMmh && eb.z >= sliceZMmh) || (eb.z <= sliceZMmh && ea.z >= sliceZMmh)) {
        const dz = eb.z - ea.z;
        if (Math.abs(dz) > 1e-6) {
          const t = (sliceZMmh - ea.z) / dz;
          if (t >= 0 && t <= 1) {
            cutPoints.push({
              x: ea.x + t * (eb.x - ea.x),
              y: ea.y + t * (eb.y - ea.y),
            });
          }
        }
      }
    }

    // If triangle intersected plane, it produces exactly one line segment between two edges
    if (cutPoints.length >= 2) {
      segments.push({
        p1: cutPoints[0],
        p2: cutPoints[1],
      });
    }
  }

  return segments;
}

/**
 * Stitches unorganized line segments into ordered continuous 2D polyline loops
 */
export function stitchSegmentsIntoLoops(segments: LineSegment2D[], tolerance = 0.05): Point2D[][] {
  if (segments.length === 0) return [];

  const remaining = [...segments];
  const loops: Point2D[][] = [];

  while (remaining.length > 0) {
    const startSeg = remaining.pop()!;
    const currentLoop: Point2D[] = [startSeg.p1, startSeg.p2];

    let extended = true;
    while (extended && remaining.length > 0) {
      extended = false;
      const tail = currentLoop[currentLoop.length - 1];

      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const distP1 = Math.hypot(seg.p1.x - tail.x, seg.p1.y - tail.y);
        const distP2 = Math.hypot(seg.p2.x - tail.x, seg.p2.y - tail.y);

        if (distP1 <= tolerance) {
          currentLoop.push(seg.p2);
          remaining.splice(i, 1);
          extended = true;
          break;
        } else if (distP2 <= tolerance) {
          currentLoop.push(seg.p1);
          remaining.splice(i, 1);
          extended = true;
          break;
        }
      }
    }

    // Only keep non-trivial closed or semi-closed contours (minimum 3 points)
    if (currentLoop.length >= 3) {
      loops.push(currentLoop);
    }
  }

  return loops;
}

/**
 * Extracts a fallback 2D perimeter directly from projected bounding points
 * if planar slicing yields zero intersections (e.g. non-manifold or horizontal flat face)
 */
export function extractBoundaryFootprintPoints(part: CadPartOutput): Point2D[] {
  const pts = part.mesh.points;
  if (!pts || pts.length === 0) {
    return [
      { x: -25, y: -25 },
      { x: 25, y: -25 },
      { x: 25, y: 25 },
      { x: -25, y: 25 },
    ];
  }

  // Find min/max bounds in mm
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of pts) {
    const xMm = p[0] * CM_TO_MM;
    const yMm = p[1] * CM_TO_MM;
    if (xMm < minX) minX = xMm;
    if (xMm > maxX) maxX = xMm;
    if (yMm < minY) minY = yMm;
    if (yMm > maxY) maxY = yMm;
  }

  // Return closed rectangular footprint polygon
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/**
 * Calculates a parallel offset polygon for CNC cutter radius compensation,
 * automatically accounting for polygon winding order (CW vs CCW).
 */
export function offsetPolyline(points: Point2D[], offsetDistMm: number): Point2D[] {
  if (Math.abs(offsetDistMm) < 1e-4 || points.length < 3) return points;

  // Compute signed area using shoelace formula to determine winding order
  let signedArea = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const next = points[(i + 1) % n];
    signedArea += points[i].x * next.y - next.x * points[i].y;
  }
  // isCCW is true if vertices wind counter-clockwise
  const isCCW = signedArea > 0;

  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    // Compute incoming and outgoing edge vectors
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y) || 1;

    // Outward unit normal for edge 1
    const n1x = isCCW ? v1y / len1 : -v1y / len1;
    const n1y = isCCW ? -v1x / len1 : v1x / len1;

    // Outward unit normal for edge 2
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y) || 1;

    const n2x = isCCW ? v2y / len2 : -v2y / len2;
    const n2y = isCCW ? -v2x / len2 : v2x / len2;

    // Average normal at vertex (miter vector)
    const avgNx = (n1x + n2x) * 0.5;
    const avgNy = (n1y + n2y) * 0.5;

    // Scale offset to maintain exact perpendicular contour thickness around corners.
    // The length of avgN is cos(theta/2). Perpendicular displacement along the bisector
    // requires dividing by cos^2(theta/2) = avgLen^2.
    // Clamp to max miter expansion ratio to prevent excessive spikes on acute vertices.
    const avgLenSq = Math.max(0.2, avgNx * avgNx + avgNy * avgNy);
    const scale = offsetDistMm / avgLenSq;
    result.push({
      x: curr.x + avgNx * scale,
      y: curr.y + avgNy * scale,
    });
  }

  return result;
}

/**
 * True Concentric Pocket Clearing Toolpath Generator (ROADMAP ISS-502)
 *
 * Computes iterative inward stepover offset passes inside a closed pocket contour.
 * In accordance with CNC machining standards and acceptance criteria:
 * Generates concentric inward offset loops ordered from the pocket center OUT to
 * the final finish wall pass (climb/conventional outward spiral clearing).
 *
 * @param rawLoop The outer boundary points of the pocket in millimeters
 * @param toolDiameterMm Diameter of the cutting tool in millimeters
 * @param stepOverPercent Radial stepover (10% to 80% of tool diameter, default 45%)
 * @returns Array of closed 2D loops ordered from pocket center out to finish wall pass
 */
export function generateConcentricPocketLoops(
  rawLoop: Point2D[],
  toolDiameterMm: number,
  stepOverPercent: number = 45
): Point2D[][] {
  if (rawLoop.length < 3) return [rawLoop];

  const clampedStepOver = Math.max(10, Math.min(80, stepOverPercent));
  const toolRadius = toolDiameterMm * 0.5;
  const stepoverDistMm = (clampedStepOver / 100.0) * toolDiameterMm;

  // Compute original loop signed area and winding
  let origArea = 0;
  for (let i = 0; i < rawLoop.length; i++) {
    const next = rawLoop[(i + 1) % rawLoop.length];
    origArea += rawLoop[i].x * next.y - next.x * rawLoop[i].y;
  }
  origArea *= 0.5;
  const isCCW = origArea > 0;
  const origAbsArea = Math.abs(origArea);

  // If the pocket is smaller than a single cutter circle area, return single center pass or finish pass
  if (origAbsArea < Math.PI * toolRadius * toolRadius * 0.4) {
    return [offsetPolyline(rawLoop, -toolRadius)];
  }

  const concentricLoops: Point2D[][] = [];
  let currentOffset = -toolRadius; // Start with the finish wall pass offset
  let previousAbsArea = origAbsArea;
  const maxIterations = 50;

  for (let iter = 0; iter < maxIterations; iter++) {
    const candidate = offsetPolyline(rawLoop, currentOffset);

    // Calculate signed area of the offset loop
    let candArea = 0;
    for (let i = 0; i < candidate.length; i++) {
      const next = candidate[(i + 1) % candidate.length];
      candArea += candidate[i].x * next.y - next.x * candidate[i].y;
    }
    candArea *= 0.5;

    const candCCW = candArea > 0;
    const candAbsArea = Math.abs(candArea);

    // Stop if winding inverted, or area collapsed (< 0.5 mm^2), or didn't shrink
    if (candCCW !== isCCW || candAbsArea < 0.5 || candAbsArea >= previousAbsArea) {
      break;
    }

    // Check minimum bounding box span to prevent degenerate slivers
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pt of candidate) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const width = maxX - minX;
    const height = maxY - minY;

    if (width < toolRadius * 0.2 || height < toolRadius * 0.2) {
      break;
    }

    concentricLoops.push(candidate);
    previousAbsArea = candAbsArea;
    currentOffset -= stepoverDistMm;
  }

  // If no inward loop survived, fall back to nominal finish wall pass
  if (concentricLoops.length === 0) {
    return [offsetPolyline(rawLoop, -toolRadius)];
  }

  // Acceptance Criteria:
  // "Selecting inside_pocket generates concentric inward offset loops from the pocket center out to the final finish wall pass"
  // Reverse the array so the innermost loop (near center) is cut first, expanding outward to the finish wall pass!
  return concentricLoops.reverse();
}

/**
 * Zig-Zag Raster Pocket Clearing Toolpath Generator (ROADMAP ISS-502)
 *
 * Generates alternating parallel raster scanline passes inside a pocket contour,
 * bounded by the cutter radius, followed by the outer perimeter finish pass.
 *
 * @param rawLoop The outer boundary points of the pocket in millimeters
 * @param toolDiameterMm Diameter of the cutting tool in millimeters
 * @param stepOverPercent Radial stepover (10% to 80% of tool diameter, default 45%)
 * @returns Array of line segments/passes terminating with the finish perimeter loop
 */
export function generateRasterPocketPath(
  rawLoop: Point2D[],
  toolDiameterMm: number,
  stepOverPercent: number = 45
): Point2D[][] {
  if (rawLoop.length < 3) return [rawLoop];

  const clampedStepOver = Math.max(10, Math.min(80, stepOverPercent));
  const toolRadius = toolDiameterMm * 0.5;
  const stepoverDistMm = (clampedStepOver / 100.0) * toolDiameterMm;

  // The boundary enclosing the raster lines is offset by -toolRadius
  const finishWallLoop = offsetPolyline(rawLoop, -toolRadius);
  if (finishWallLoop.length < 3) return [finishWallLoop];

  // Bounding box of the offset pocket boundary
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of finishWallLoop) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const rasterLoops: Point2D[][] = [];
  let y = minY + stepoverDistMm * 0.5;
  let lineIdx = 0;

  while (y <= maxY - stepoverDistMm * 0.2) {
    // Intersect horizontal line Y = y with edges of finishWallLoop
    const intersections: number[] = [];
    const n = finishWallLoop.length;
    for (let i = 0; i < n; i++) {
      const p1 = finishWallLoop[i];
      const p2 = finishWallLoop[(i + 1) % n];

      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const t = (y - p1.y) / (p2.y - p1.y);
        const ix = p1.x + t * (p2.x - p1.x);
        intersections.push(ix);
      }
    }

    intersections.sort((a, b) => a - b);

    // Pairwise interior spans
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const xStart = intersections[i];
      const xEnd = intersections[i + 1];
      if (xEnd - xStart > toolRadius * 0.2) {
        if (lineIdx % 2 === 0) {
          rasterLoops.push([
            { x: xStart, y },
            { x: xEnd, y },
          ]);
        } else {
          rasterLoops.push([
            { x: xEnd, y },
            { x: xStart, y },
          ]);
        }
      }
    }

    y += stepoverDistMm;
    lineIdx++;
  }

  // Append the finish wall perimeter pass to clean up pocket walls
  rasterLoops.push(finishWallLoop);

  return rasterLoops.length > 1 ? rasterLoops : [finishWallLoop];
}

/**
 * Circular Hole Recognition & Tool Matching (ROADMAP ISS-503)
 */
export interface CircularHoleInfo {
  centerX: number;
  centerY: number;
  radiusMm: number;
  diameterMm: number;
  isMatchForTool: boolean;
}

/**
 * Detects whether a closed loop represents a circular bore/hole and determines
 * if its diameter matches the active CNC endmill or drill bit.
 */
export function detectCircularHole(loop: Point2D[], toolDiameterMm: number): CircularHoleInfo | null {
  if (loop.length < 5) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of loop) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / loop.length;
  const cy = sumY / loop.length;

  let totalR = 0;
  const radii: number[] = [];
  for (const p of loop) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    radii.push(r);
    totalR += r;
  }
  const meanR = totalR / loop.length;
  if (meanR < 0.2) return null;

  // Compute variance to verify circularity
  let variance = 0;
  for (const r of radii) {
    variance += (r - meanR) * (r - meanR);
  }
  const stdDev = Math.sqrt(variance / loop.length);

  // Points lie on a circle within 12% circularity deviation
  if (stdDev / meanR < 0.12) {
    const dia = meanR * 2.0;
    // Matches tool diameter if within 15% or 0.6 mm
    const isMatch = Math.abs(dia - toolDiameterMm) <= Math.max(0.6, toolDiameterMm * 0.15);
    return {
      centerX: Number(cx.toFixed(3)),
      centerY: Number(cy.toFixed(3)),
      radiusMm: Number(meanR.toFixed(3)),
      diameterMm: Number(dia.toFixed(3)),
      isMatchForTool: isMatch,
    };
  }

  return null;
}

/**
 * CNC Dogbone Corner Relief Generator (ROADMAP ISS-503)
 *
 * For internal (concave) ~90° corners, inserts an overcut displacement along
 * the corner bisector of length equal to the tool radius, ensuring rectangular
 * mating parts (tenons, acrylic sheets, PCBs) seat completely flush.
 *
 * @param loop Closed 2D loop of points
 * @param toolRadiusMm Radius of the CNC endmill in millimeters
 * @returns Loop with dogbone overcut points inserted at 90° concave corners
 */
export function applyDogboneRelief(loop: Point2D[], toolRadiusMm: number): Point2D[] {
  if (loop.length < 3 || toolRadiusMm <= 0.01) return loop;

  // Determine winding order using shoelace formula
  let signedArea = 0;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const next = loop[(i + 1) % n];
    signedArea += loop[i].x * next.y - next.x * loop[i].y;
  }
  const isCCW = signedArea > 0;

  const result: Point2D[] = [];

  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n];
    const curr = loop[i];
    const next = loop[(i + 1) % n];

    // Compute incoming and outgoing edge vectors
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const len1 = Math.hypot(v1x, v1y) || 1;
    const u1x = v1x / len1;
    const u1y = v1y / len1;

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y) || 1;
    const u2x = v2x / len2;
    const u2y = v2y / len2;

    // Dot product to test corner angle
    const dot = u1x * u2x + u1y * u2y;
    // Cross product to test corner turn direction
    const crossZ = u1x * u2y - u1y * u2x;

    // A ~90° corner has dot product near 0 (|dot| < 0.45, roughly 63° to 117°)
    const isNinetyDegree = Math.abs(dot) < 0.45;

    // In a pocket polygon, a turn into the corner is indicated by significant crossZ
    // (for CCW, left turns; for CW, right turns)
    const isConcave = isCCW ? crossZ > 0.3 : crossZ < -0.3;

    if (isNinetyDegree && isConcave) {
      // Outward edge normals
      const n1x = isCCW ? v1y / len1 : -v1y / len1;
      const n1y = isCCW ? -v1x / len1 : v1x / len1;

      const n2x = isCCW ? v2y / len2 : -v2y / len2;
      const n2y = isCCW ? -v2x / len2 : v2x / len2;

      // Average normal vector pointing directly into the corner
      const bisX = (n1x + n2x) * 0.5;
      const bisY = (n1y + n2y) * 0.5;
      const bisLen = Math.hypot(bisX, bisY) || 1;
      const unitBisX = bisX / bisLen;
      const unitBisY = bisY / bisLen;

      // Insert dogbone overcut: corner -> overcut along bisector -> return to corner
      const reliefX = curr.x + unitBisX * toolRadiusMm;
      const reliefY = curr.y + unitBisY * toolRadiusMm;

      result.push(curr);
      result.push({ x: Number(reliefX.toFixed(3)), y: Number(reliefY.toFixed(3)) });
      result.push({ x: curr.x, y: curr.y });
    } else {
      result.push(curr);
    }
  }

  return result;
}

// ============================================================================
// 1. 2D DXF EXPORT GENERATOR (AutoCAD R12 ASCII)
// ============================================================================

/**
 * Generates standard AutoCAD Release 12 ASCII DXF format string
 * compatible with LightBurn, LaserWeb, SheetCAM, Fusion 360, and CNC routers.
 */
export function generateDxfProfile(part: CadPartOutput, sliceZMm?: number): string {
  const bbox = part.diagnostics.bounds;
  const targetZ = sliceZMm !== undefined ? sliceZMm : (bbox ? bbox[0][2] * CM_TO_MM + 0.5 : 0.5);

  const rawSegments = sliceMeshAtZ(part, targetZ);
  let loops = stitchSegmentsIntoLoops(rawSegments);

  // If no slices captured, fall back to footprint polygon
  if (loops.length === 0) {
    loops = [extractBoundaryFootprintPoints(part)];
  }

  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009', // AutoCAD R12 standard version
    '9',
    '$INSUNITS',
    '70',
    '4', // 4 = Millimeters
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    '2',
    // Layer: CONTOUR (Color 1: Red for outside cut)
    '0',
    'LAYER',
    '2',
    'CONTOUR',
    '70',
    '0',
    '62',
    '1',
    '6',
    'CONTINUOUS',
    // Layer: INNER_CUT (Color 3: Green for pockets/holes)
    '0',
    'LAYER',
    '2',
    'INNER_CUT',
    '70',
    '0',
    '62',
    '3',
    '6',
    'CONTINUOUS',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  // Write closed polylines for each loop
  loops.forEach((loop, loopIdx) => {
    const layerName = loopIdx === 0 ? 'CONTOUR' : 'INNER_CUT';

    lines.push('0', 'POLYLINE', '8', layerName, '66', '1', '70', '1'); // 70=1 indicates closed polyline

    loop.forEach((pt) => {
      lines.push(
        '0',
        'VERTEX',
        '8',
        layerName,
        '10',
        pt.x.toFixed(4),
        '20',
        pt.y.toFixed(4),
        '30',
        '0.0000'
      );
    });

    lines.push('0', 'SEQEND');
  });

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

/**
 * Generates 2D DXF combining all parts in the assembly layout
 */
export function generateAssemblyDxf(parts: CadPartOutput[], sliceZMm?: number): string {
  if (parts.length === 0) {
    return '0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nEOF';
  }

  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009',
    '9',
    '$INSUNITS',
    '70',
    '4', // Millimeters
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  parts.forEach((part) => {
    const rawSegments = sliceMeshAtZ(part, sliceZMm || 1.0);
    let loops = stitchSegmentsIntoLoops(rawSegments);
    if (loops.length === 0) {
      loops = [extractBoundaryFootprintPoints(part)];
    }

    loops.forEach((loop) => {
      lines.push('0', 'POLYLINE', '8', part.name, '66', '1', '70', '1');
      loop.forEach((pt) => {
        lines.push(
          '0',
          'VERTEX',
          '8',
          part.name,
          '10',
          pt.x.toFixed(4),
          '20',
          pt.y.toFixed(4),
          '30',
          '0.0000'
        );
      });
      lines.push('0', 'SEQEND');
    });
  });

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

// ============================================================================
// 2. CNC G-CODE TOOLPATH GENERATOR (.nc / .gcode)
// ============================================================================

/**
 * Multi-Z Feature & Depth Extraction for 2.5D Subtractive Machining
 *
 * Scans part mesh for horizontal face transitions (flat pocket floors, stepped shoulders,
 * counterbores, through-cut bottoms) and slices at each level to generate accurate
 * per-feature toolpath stages with discrete cut depths.
 */
export function extractMultiZFeatures(
  part: CadPartOutput,
  config: CncCamConfig = DEFAULT_CAM_CONFIG
): MultiZToolpathStage[] {
  const bbox = part.diagnostics.bounds;
  const minZMm = bbox ? bbox[0][2] * CM_TO_MM : 0.0;
  const maxZMm = bbox ? bbox[1][2] * CM_TO_MM : 10.0;
  const totalHeightMm = Math.max(0.1, maxZMm - minZMm);
  const stockThicknessMm = config.stockThicknessMm || totalHeightMm;

  const pts = part.mesh?.points || [];
  const tris = part.mesh?.triangles || [];
  const horizontalZArea = new Map<number, number>();

  if (pts.length > 0 && tris.length > 0) {
    for (let i = 0; i < tris.length; i += 3) {
      const p0 = pts[tris[i]];
      const p1 = pts[tris[i + 1]];
      const p2 = pts[tris[i + 2]];
      if (!p0 || !p1 || !p2) continue;

      const z0 = p0[2] * CM_TO_MM;
      const z1 = p1[2] * CM_TO_MM;
      const z2 = p2[2] * CM_TO_MM;

      // Check if triangle is horizontal (all 3 vertices within 0.05 mm Z)
      if (Math.abs(z0 - z1) < 0.05 && Math.abs(z1 - z2) < 0.05) {
        const zMean = (z0 + z1 + z2) / 3;
        // Bucket by rounding to 0.1 mm
        const zKey = Math.round(zMean * 10) / 10;
        // Compute 2D triangle area in XY (mm^2)
        const areaMm2 =
          0.5 *
          Math.abs(
            (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
          ) *
          100;
        horizontalZArea.set(zKey, (horizontalZArea.get(zKey) || 0) + areaMm2);
      }
    }
  }

  // Collect candidate Z levels (with minZ and maxZ always present)
  const candidateZ: number[] = [minZMm, maxZMm];
  horizontalZArea.forEach((area, z) => {
    // Keep levels with >= 0.2 mm^2 horizontal area within part bounds
    if (area >= 0.2 && z >= minZMm - 0.05 && z <= maxZMm + 0.05) {
      candidateZ.push(z);
    }
  });

  candidateZ.sort((a, b) => a - b);

  // Cluster nearby Z levels within 0.3 mm
  const distinctZ: number[] = [];
  for (const z of candidateZ) {
    if (distinctZ.length === 0 || Math.abs(z - distinctZ[distinctZ.length - 1]) >= 0.3) {
      distinctZ.push(z);
    }
  }

  if (distinctZ.length < 2) {
    distinctZ.length = 0;
    distinctZ.push(minZMm, maxZMm);
  }

  const toolRadius = config.toolDiameterMm * 0.5;
  const stages: MultiZToolpathStage[] = [];
  let stageCounter = 1;

  // Analyze slicing intervals between adjacent horizontal transitions
  for (let k = distinctZ.length - 2; k >= 0; k--) {
    const zFloor = distinctZ[k];
    const zCeiling = distinctZ[k + 1];
    const span = zCeiling - zFloor;
    if (span < 0.1) continue;

    const midZ = (zFloor + zCeiling) / 2;
    const segments = sliceMeshAtZ(part, midZ);
    let loops = stitchSegmentsIntoLoops(segments);
    if (loops.length === 0) {
      loops = [extractBoundaryFootprintPoints(part)];
    }

    // Sort loops by area (largest is outer perimeter, smaller are inside cutouts/pockets)
    const loopInfos = loops.map((loop) => {
      let area = 0;
      for (let i = 0; i < loop.length; i++) {
        const next = loop[(i + 1) % loop.length];
        area += loop[i].x * next.y - next.x * loop[i].y;
      }
      return { loop, area: Math.abs(area) * 0.5 };
    });
    loopInfos.sort((a, b) => b.area - a.area);

    const outerLoop = loopInfos[0]?.loop;
    const innerLoops = loopInfos.slice(1).map((info) => info.loop);

    if (config.cutOperation === 'inside_pocket') {
      if (innerLoops.length > 0) {
        // Target depth is measured from top of part (maxZMm) down to the pocket floor (zFloor)
        const targetDepth = Math.max(0.1, maxZMm - zFloor);
        const startDepth = Math.max(0.0, maxZMm - zCeiling);

        const pocketLoops: Point2D[][] = [];
        const holeFeatures: CncHoleFeature[] = [];

        for (const rawInnerLoop of innerLoops) {
          // Check if loop represents a circular bore/hole matching the tool diameter
          const holeMatch =
            config.usePeckDrilling !== false
              ? detectCircularHole(rawInnerLoop, config.toolDiameterMm)
              : null;

          if (holeMatch && holeMatch.isMatchForTool) {
            // Emits canned drilling cycle rather than milling concentric loops
            const isPeck = targetDepth > config.toolDiameterMm * 2.5;
            holeFeatures.push({
              centerX: holeMatch.centerX,
              centerY: holeMatch.centerY,
              diameterMm: holeMatch.diameterMm,
              depthMm: Number(targetDepth.toFixed(2)),
              isPeckDrill: isPeck,
              peckIncrementMm: Number(Math.min(targetDepth, config.stepDownMm).toFixed(2)),
            });
          } else {
            // Internal pocket milling: apply optional dogbone corner relief on 90° corners
            const loopToPocket = config.addDogboneRelief
              ? applyDogboneRelief(rawInnerLoop, toolRadius)
              : rawInnerLoop;

            if (config.pocketPattern === 'raster') {
              const rasterPasses = generateRasterPocketPath(
                loopToPocket,
                config.toolDiameterMm,
                config.stepOverPercent
              );
              pocketLoops.push(...rasterPasses);
            } else {
              const concentricPasses = generateConcentricPocketLoops(
                loopToPocket,
                config.toolDiameterMm,
                config.stepOverPercent
              );
              pocketLoops.push(...concentricPasses);
            }
          }
        }

        const featureName =
          holeFeatures.length > 0 && pocketLoops.length === 0
            ? holeFeatures.some((h) => h.isPeckDrill)
              ? `Canned Peck Drilling Cycle (G83, Depth: ${targetDepth.toFixed(2)} mm)`
              : `Canned Drilling Cycle (G81, Depth: ${targetDepth.toFixed(2)} mm)`
            : targetDepth < totalHeightMm - 0.5
            ? `Blind Pocket / Counterbore (Depth: ${targetDepth.toFixed(2)} mm)`
            : `Through Pocket / Hole (Depth: ${targetDepth.toFixed(2)} mm)`;

        stages.push({
          stageIndex: stageCounter++,
          featureName,
          sliceZMm: Number(midZ.toFixed(2)),
          startDepthMm: Number(startDepth.toFixed(2)),
          targetDepthMm: Number(targetDepth.toFixed(2)),
          depthSpanMm: Number((targetDepth - startDepth).toFixed(2)),
          stepDownCount: Math.max(1, Math.ceil(targetDepth / config.stepDownMm)),
          loops: pocketLoops,
          rawLoops: innerLoops,
          isInternal: true,
          holeFeatures: holeFeatures.length > 0 ? holeFeatures : undefined,
        });
      }
    } else {
      if (outerLoop) {
        const targetDepth = Math.max(0.1, maxZMm - zFloor);
        const startDepth = Math.max(0.0, maxZMm - zCeiling);
        const offsetDist = config.cutOperation === 'outside_contour' ? toolRadius : 0.0;
        const offsetLoop = offsetPolyline(outerLoop, offsetDist);

        stages.push({
          stageIndex: stageCounter++,
          featureName:
            targetDepth < totalHeightMm - 0.5
              ? `Stepped Shoulder / Profile (Depth: ${targetDepth.toFixed(2)} mm)`
              : `Full-Depth Outer Contour (Depth: ${targetDepth.toFixed(2)} mm)`,
          sliceZMm: Number(midZ.toFixed(2)),
          startDepthMm: Number(startDepth.toFixed(2)),
          targetDepthMm: Number(targetDepth.toFixed(2)),
          depthSpanMm: Number((targetDepth - startDepth).toFixed(2)),
          stepDownCount: Math.max(1, Math.ceil(targetDepth / config.stepDownMm)),
          loops: [offsetLoop],
          rawLoops: [outerLoop],
          isInternal: false,
        });
      }
    }
  }

  // Deduplicate stages for outside contour if profile is identical
  if (config.cutOperation === 'outside_contour' && stages.length > 1) {
    const firstStage = stages[0];
    const lastStage = stages[stages.length - 1];
    const firstLen = firstStage.loops[0]?.length || 0;
    const lastLen = lastStage.loops[0]?.length || 0;
    if (firstLen === lastLen && Math.abs(firstStage.sliceZMm - lastStage.sliceZMm) > 0.5) {
      const fullDepth = Math.max(stockThicknessMm, totalHeightMm);
      return [
        {
          stageIndex: 1,
          featureName: `Full-Depth Outer Contour (Depth: ${fullDepth.toFixed(2)} mm)`,
          sliceZMm: firstStage.sliceZMm,
          startDepthMm: 0.0,
          targetDepthMm: Number(fullDepth.toFixed(2)),
          depthSpanMm: Number(fullDepth.toFixed(2)),
          stepDownCount: Math.max(1, Math.ceil(fullDepth / config.stepDownMm)),
          loops: firstStage.loops,
          rawLoops: firstStage.rawLoops,
          isInternal: false,
        },
      ];
    }
  }

  // Fallback: If no stages generated, return nominal full-depth stage
  if (stages.length === 0) {
    const rawSegments = sliceMeshAtZ(part, minZMm + 1.0);
    let loops = stitchSegmentsIntoLoops(rawSegments);
    if (loops.length === 0) {
      loops = [extractBoundaryFootprintPoints(part)];
    }
    let toolpathLoops: Point2D[][];
    if (config.cutOperation === 'inside_pocket') {
      const pocketLoops: Point2D[][] = [];
      for (const l of loops) {
        if (config.pocketPattern === 'raster') {
          pocketLoops.push(...generateRasterPocketPath(l, config.toolDiameterMm, config.stepOverPercent));
        } else {
          pocketLoops.push(...generateConcentricPocketLoops(l, config.toolDiameterMm, config.stepOverPercent));
        }
      }
      toolpathLoops = pocketLoops;
    } else {
      const offsetDistance = config.cutOperation === 'outside_contour' ? toolRadius : 0.0;
      toolpathLoops = loops.map((l) => offsetPolyline(l, offsetDistance));
    }

    stages.push({
      stageIndex: 1,
      featureName: `Nominal Contour (Depth: ${stockThicknessMm.toFixed(2)} mm)`,
      sliceZMm: Number((minZMm + 1.0).toFixed(2)),
      startDepthMm: 0.0,
      targetDepthMm: Number(stockThicknessMm.toFixed(2)),
      depthSpanMm: Number(stockThicknessMm.toFixed(2)),
      stepDownCount: Math.max(1, Math.ceil(stockThicknessMm / config.stepDownMm)),
      loops: toolpathLoops,
      rawLoops: loops,
      isInternal: config.cutOperation === 'inside_pocket',
    });
  }

  return stages;
}

/**
 * Generates production-ready CNC G-Code toolpaths for subtractive milling/routing
 */
export function generateCncGcode(part: CadPartOutput, config: CncCamConfig = DEFAULT_CAM_CONFIG): string {
  const bbox = part.diagnostics.bounds;
  const zHeightMm = bbox ? Math.abs((bbox[1][2] - bbox[0][2]) * CM_TO_MM) : 10.0;
  const targetDepthMm = config.stockThicknessMm || zHeightMm;

  // Extract multi-Z toolpath stages
  const stages = extractMultiZFeatures(part, config);

  const gcode: string[] = [
    `; ============================================================================`,
    `; ApexCAD Studio CNC Toolpath Generator (Multi-Z Stage Engine)`,
    `; Part: ${part.name} (Kind: ${part.kind})`,
    `; Tool: ${config.toolType} (Diameter: ${config.toolDiameterMm} mm)`,
    `; Cut Operation: ${config.cutOperation}`,
    `; Target Depth: ${targetDepthMm.toFixed(2)} mm (Step-down: ${config.stepDownMm} mm)`,
    `; Multi-Z Stages: ${stages.length} discrete depth zone(s)`,
    `; Feed: ${config.feedRateMmMin} mm/min | Plunge: ${config.plungeRateMmMin} mm/min | RPM: ${config.spindleRpm}`,
    `; Machine Dialect: ${config.machineDialect.toUpperCase()}`,
    `; Timestamp: ${new Date().toISOString()}`,
    `; ============================================================================`,
    ``,
  ];

  // 1. Machine Setup Header
  if (config.machineDialect === 'haas') {
    gcode.push('G00 G90 G40 G49 G80');
    gcode.push('T1 M06 ; Tool Change');
    gcode.push('G54 ; Work Coordinate System');
  } else if (config.machineDialect === 'linuxcnc') {
    gcode.push('G64 P0.05 ; Continuous mode with 0.05mm path tolerance');
  }

  gcode.push('G21 ; Units: Millimeters');
  gcode.push('G90 ; Absolute Positioning');
  gcode.push('G17 ; XY Work Plane');
  gcode.push('G94 ; Feedrate in units per minute');
  gcode.push(`G00 Z${config.safeZMm.toFixed(3)} ; Retract to safe clearance height`);
  gcode.push(`M03 S${config.spindleRpm} ; Spindle ON Clockwise`);
  gcode.push('G04 P1.5 ; Dwell 1.5s for spindle to achieve target RPM');
  gcode.push('');

  // 2. Multi-Pass Multi-Z Cutting Stages
  stages.forEach((stage) => {
    gcode.push(`; ============================================================================`);
    gcode.push(`; --- Stage ${stage.stageIndex}: ${stage.featureName} ---`);
    gcode.push(`; Sliced at Z=${stage.sliceZMm.toFixed(2)} mm | Target Depth: ${stage.targetDepthMm.toFixed(2)} mm`);
    gcode.push(`; ============================================================================`);

    const numPasses = Math.max(1, Math.ceil(stage.targetDepthMm / config.stepDownMm));

    // 2a. Canned Drilling Cycles (G81 / G83) for holes matching tool diameter (ROADMAP ISS-503)
    if (stage.holeFeatures && stage.holeFeatures.length > 0) {
      stage.holeFeatures.forEach((hole, holeIdx) => {
        gcode.push(`; --- Canned Drilling Hole ${holeIdx + 1}/${stage.holeFeatures!.length} (Ø${hole.diameterMm.toFixed(2)} mm) ---`);
        gcode.push(`G00 Z${config.safeZMm.toFixed(3)} ; Safe Clearance`);
        gcode.push(`G00 X${hole.centerX.toFixed(3)} Y${hole.centerY.toFixed(3)} ; Move to Hole Center`);

        if (hole.isPeckDrill) {
          gcode.push(
            `G83 X${hole.centerX.toFixed(3)} Y${hole.centerY.toFixed(3)} Z-${hole.depthMm.toFixed(3)} R${config.safeZMm.toFixed(3)} Q${hole.peckIncrementMm.toFixed(3)} F${config.plungeRateMmMin.toFixed(3)} ; Peck Drilling Cycle`
          );
        } else {
          gcode.push(
            `G81 X${hole.centerX.toFixed(3)} Y${hole.centerY.toFixed(3)} Z-${hole.depthMm.toFixed(3)} R${config.safeZMm.toFixed(3)} F${config.plungeRateMmMin.toFixed(3)} ; Shallow Drilling Cycle`
          );
        }
        gcode.push(`G80 ; Cancel Canned Cycle`);
        gcode.push(`G00 Z${config.safeZMm.toFixed(3)} ; Retract`);
        gcode.push('');
      });
    }

    // For multi-loop interior pocket clearing, perform Z-level clearing (cut all loops from center outward per depth pass)
    if (stage.isInternal && stage.loops.length > 1) {
      for (let pass = 1; pass <= numPasses; pass++) {
        const currentZ = -Math.min(stage.targetDepthMm, pass * config.stepDownMm);
        gcode.push(`; --- Pocket Clearing Pass ${pass}/${numPasses} -> Target Z: ${currentZ.toFixed(3)} mm ---`);

        stage.loops.forEach((loop, loopIdx) => {
          if (loop.length < 2) return;
          const startPoint = loop[0];

          // Rapid to start position above workpiece
          gcode.push(`G00 Z${config.safeZMm.toFixed(3)} ; Safe Retract`);
          gcode.push(`G00 X${startPoint.x.toFixed(3)} Y${startPoint.y.toFixed(3)} ; Move to loop ${loopIdx + 1}`);

          // Controlled plunge into stock
          gcode.push(`G01 Z${currentZ.toFixed(3)} F${config.plungeRateMmMin} ; Plunge`);

          // Mill loop points
          for (let ptIdx = 1; ptIdx < loop.length; ptIdx++) {
            const pt = loop[ptIdx];
            gcode.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} F${config.feedRateMmMin}`);
          }

          // If loop is closed, close back to start point
          if (loop.length > 2) {
            gcode.push(`G01 X${startPoint.x.toFixed(3)} Y${startPoint.y.toFixed(3)} F${config.feedRateMmMin}`);
          }
        });
      }

      // Retract above stock before next stage
      gcode.push(`G00 Z${config.safeZMm.toFixed(3)} ; Safe Retract`);
      gcode.push('');
    } else {
      stage.loops.forEach((loop, loopIdx) => {
        if (loop.length < 2) return;

        gcode.push(`; --- Perimeter Loop ${loopIdx + 1} of ${stage.loops.length} ---`);
        const startPoint = loop[0];

        // Rapid to start position above workpiece
        gcode.push(`G00 X${startPoint.x.toFixed(3)} Y${startPoint.y.toFixed(3)}`);

        for (let pass = 1; pass <= numPasses; pass++) {
          const currentZ = -Math.min(stage.targetDepthMm, pass * config.stepDownMm);
          const isFinalPass = pass === numPasses;

          gcode.push(`; Pass ${pass}/${numPasses} -> Target Z: ${currentZ.toFixed(3)} mm`);

          // Controlled plunge into stock
          gcode.push(`G01 Z${currentZ.toFixed(3)} F${config.plungeRateMmMin}`);

          // Mill perimeter contour points
          for (let ptIdx = 1; ptIdx < loop.length; ptIdx++) {
            const pt = loop[ptIdx];

            // Insert optional holding tabs on final pass
            if (
              isFinalPass &&
              config.addHoldingTabs &&
              config.tabCount &&
              ptIdx % Math.max(1, Math.floor(loop.length / config.tabCount)) === 0
            ) {
              const tabZ = currentZ + (config.tabHeightMm || 1.5);
              gcode.push(`; [Holding Tab]`);
              gcode.push(`G01 Z${tabZ.toFixed(3)} F${config.plungeRateMmMin}`);
              gcode.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} F${config.feedRateMmMin}`);
              gcode.push(`G01 Z${currentZ.toFixed(3)} F${config.plungeRateMmMin}`);
            } else {
              gcode.push(`G01 X${pt.x.toFixed(3)} Y${pt.y.toFixed(3)} F${config.feedRateMmMin}`);
            }
          }

          // Close the loop back to start point
          gcode.push(`G01 X${startPoint.x.toFixed(3)} Y${startPoint.y.toFixed(3)} F${config.feedRateMmMin}`);
        }

        // Retract above stock before next loop
        gcode.push(`G00 Z${config.safeZMm.toFixed(3)}`);
        gcode.push('');
      });
    }
  });

  // 3. Program Teardown Footer
  gcode.push('; --- Teardown & Safe Park ---');
  gcode.push('M05 ; Spindle Stop');
  gcode.push(`G00 Z${(config.safeZMm + 10).toFixed(3)} ; Elevate tool`);
  gcode.push('G00 X0.000 Y0.000 ; Return to Work Origin');
  gcode.push('M30 ; Program End and Rewind');

  return gcode.join('\n');
}

// ============================================================================
// 3. 3D PRINTING PREFLIGHT INSPECTION & SLICING HELPER
// ============================================================================

/**
 * Calculates essential 3D printing preflight diagnostics:
 * watertight solid checks, footprint bounds, filament mass estimation, and print time heuristics.
 */
export function calculate3dPrintPreflight(part: CadPartOutput): PrintPreflightInfo {
  const bbox = part.diagnostics.bounds;
  const widthMm = bbox ? Math.abs((bbox[1][0] - bbox[0][0]) * CM_TO_MM) : 20.0;
  const depthMm = bbox ? Math.abs((bbox[1][1] - bbox[0][1]) * CM_TO_MM) : 20.0;
  const heightMm = bbox ? Math.abs((bbox[1][2] - bbox[0][2]) * CM_TO_MM) : 20.0;

  const volumeCm3 = part.diagnostics.volume > 0 ? part.diagnostics.volume : (widthMm * depthMm * heightMm) / 1000;
  const surfaceAreaCm2 = part.diagnostics.area > 0 ? part.diagnostics.area : (2 * (widthMm * depthMm + depthMm * heightMm + widthMm * heightMm)) / 100;

  // Infill density assumed at 20% for mechanical parts + 3 perimeter walls
  const effectiveDensityMultiplier = 0.32; // ~20% infill + 3 solid walls + top/bottom shells

  // Filament densities in g/cm3
  const DENSITY_PLA = 1.24;
  const DENSITY_PETG = 1.27;
  const DENSITY_ABS = 1.04;
  const DENSITY_TPU = 1.21;

  const estimatedMassG: Record<string, number> = {
    PLA: parseFloat((volumeCm3 * DENSITY_PLA * effectiveDensityMultiplier).toFixed(1)),
    PETG: parseFloat((volumeCm3 * DENSITY_PETG * effectiveDensityMultiplier).toFixed(1)),
    ABS: parseFloat((volumeCm3 * DENSITY_ABS * effectiveDensityMultiplier).toFixed(1)),
    TPU: parseFloat((volumeCm3 * DENSITY_TPU * effectiveDensityMultiplier).toFixed(1)),
  };

  // Deposition rate: ~12 mm3/sec average on modern FDM printers (Bambu / Prusa / Voron)
  const totalVolumeMm3 = volumeCm3 * 1000 * effectiveDensityMultiplier;
  const printTimeSeconds = totalVolumeMm3 / 12 + (heightMm / 0.2) * 2; // deposition + layer change
  const estimatedPrintTimeMin = Math.max(12, Math.round(printTimeSeconds / 60));

  // Bed contact area evaluation
  const baseContactPoints = part.mesh.points.filter((p) => p[2] <= 0.05);
  const firstLayerContactAreaMm2 = Math.min(widthMm * depthMm, baseContactPoints.length * 8.5);

  const footprintAreaMm2 = widthMm * depthMm;
  const contactRatio = footprintAreaMm2 > 0 ? firstLayerContactAreaMm2 / footprintAreaMm2 : 0.5;

  const adhesionRisk: 'low' | 'medium' | 'high' =
    contactRatio >= 0.4 ? 'low' : contactRatio >= 0.15 ? 'medium' : 'high';

  // Run overhang analysis
  const overhangAnalysis = analyzeOverhangs(part, 45);

  return {
    partName: part.name,
    isWatertight: part.diagnostics.manifold !== false,
    boundingBoxMm: {
      width: parseFloat(widthMm.toFixed(1)),
      depth: parseFloat(depthMm.toFixed(1)),
      height: parseFloat(heightMm.toFixed(1)),
    },
    volumeCm3: parseFloat(volumeCm3.toFixed(2)),
    surfaceAreaCm2: parseFloat(surfaceAreaCm2.toFixed(2)),
    estimatedMassG,
    estimatedPrintTimeMin,
    recommendedOrientation: 'Z-up aligned to ground plane (resting on z=0)',
    adhesionRisk,
    firstLayerContactAreaMm2: parseFloat(firstLayerContactAreaMm2.toFixed(1)),
    recommendedNozzleTempC: 215, // Standard PLA
    recommendedBedTempC: 60,
    overhangAnalysis,
  };
}

// ============================================================================
// 4. OVERHANG ANALYSIS & SLICER LAYER GENERATOR
// ============================================================================

import {
  OverhangAnalysisResult,
  OverhangAnalysisZone,
  SimulatedToolpath,
  Slicer2DLine,
  Slicer2DPoint,
  SlicerLayerInfo,
  ToolpathMotionStep,
} from '../types/cad';

/**
 * Evaluates part mesh for steep overhangs exceeding the critical angle threshold
 * (standard FDM printability limit is 45 degrees from vertical).
 */
export function analyzeOverhangs(
  part: CadPartOutput,
  thresholdAngleDeg: number = 45
): OverhangAnalysisResult {
  const pts = part.mesh.points;
  const tris = part.mesh.triangles;
  let totalAreaCm2 = 0;
  let totalOverhangAreaCm2 = 0;
  let unsupportedFacetCount = 0;
  const totalFacetCount = Math.floor(tris.length / 3);

  const zonesMap = new Map<number, { minZ: number; maxZ: number; area: number; worstAngle: number }>();

  for (let i = 0; i < tris.length; i += 3) {
    const i0 = tris[i];
    const i1 = tris[i + 1];
    const i2 = tris[i + 2];
    const p0 = pts[i0];
    const p1 = pts[i1];
    const p2 = pts[i2];
    if (!p0 || !p1 || !p2) continue;

    // Triangle vectors in cm
    const ax = p1[0] - p0[0];
    const ay = p1[1] - p0[1];
    const az = p1[2] - p0[2];

    const bx = p2[0] - p0[0];
    const by = p2[1] - p0[1];
    const bz = p2[2] - p0[2];

    // Cross product -> Normal vector
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) continue;

    const areaCm2 = len * 0.5;
    totalAreaCm2 += areaCm2;

    const unitNz = nz / len;

    // If unitNz < -0.05, the normal points downward towards the build plate
    if (unitNz < -0.05) {
      // Angle from vertical axis (0 deg = vertical wall, 90 deg = horizontal ceiling)
      // cos(angle with -Z) = -unitNz
      const angleFromHorizontalDeg = Math.asin(Math.min(1.0, Math.max(0.0, -unitNz))) * (180.0 / Math.PI);
      const overhangAngleDeg = 90.0 - angleFromHorizontalDeg;

      if (overhangAngleDeg > thresholdAngleDeg) {
        totalOverhangAreaCm2 += areaCm2;
        unsupportedFacetCount++;

        const zCenterMm = ((p0[2] + p1[2] + p2[2]) / 3.0) * CM_TO_MM;
        const bucketKey = Math.floor(zCenterMm / 5.0) * 5; // 5mm vertical buckets

        const currentZone = zonesMap.get(bucketKey) || {
          minZ: bucketKey,
          maxZ: bucketKey + 5,
          area: 0,
          worstAngle: 0,
        };
        currentZone.area += areaCm2;
        currentZone.worstAngle = Math.max(currentZone.worstAngle, overhangAngleDeg);
        zonesMap.set(bucketKey, currentZone);
      }
    }
  }

  const overhangPercentage = totalAreaCm2 > 0 ? (totalOverhangAreaCm2 / totalAreaCm2) * 100 : 0;

  const zones: OverhangAnalysisZone[] = Array.from(zonesMap.values())
    .sort((a, b) => a.minZ - b.minZ)
    .map((z) => ({
      minZ: parseFloat(z.minZ.toFixed(1)),
      maxZ: parseFloat(z.maxZ.toFixed(1)),
      overhangAreaCm2: parseFloat(z.area.toFixed(2)),
      worstAngleDeg: parseFloat(z.worstAngle.toFixed(1)),
      risk: z.worstAngle > 65 || z.area > 5.0 ? 'critical' : z.worstAngle > 50 ? 'moderate' : 'mild',
    }));

  const status: 'safe' | 'warning' | 'critical' =
    totalOverhangAreaCm2 === 0
      ? 'safe'
      : overhangPercentage > 12 || zones.some((z) => z.risk === 'critical')
      ? 'critical'
      : 'warning';

  const recommendation =
    status === 'safe'
      ? 'All faces self-supporting within 45° threshold. Ready to 3D print without supports.'
      : status === 'warning'
      ? `Minor overhangs detected (${totalOverhangAreaCm2.toFixed(1)} cm²). Consider 15% tree supports or reorienting part.`
      : `Critical steep overhangs detected (${totalOverhangAreaCm2.toFixed(1)} cm², worst ${
          zones[0]?.worstAngleDeg || 75
        }°). Tree supports or 45° chamfer redesign required.`;

  return {
    totalOverhangAreaCm2: parseFloat(totalOverhangAreaCm2.toFixed(2)),
    overhangPercentage: parseFloat(overhangPercentage.toFixed(1)),
    unsupportedFacetCount,
    totalFacetCount,
    status,
    thresholdAngleDeg,
    zones,
    recommendation,
  };
}

/**
 * Generates continuous slicer layers from bottom to top for visual simulation
 */
export function generateSlicerLayers(
  part: CadPartOutput,
  layerHeightMm: number = 0.2,
  infillDensityPercent: number = 20
): SlicerLayerInfo[] {
  const bbox = part.diagnostics.bounds;
  const zMinMm = bbox ? Math.max(0, bbox[0][2] * CM_TO_MM) : 0.0;
  const zMaxMm = bbox ? Math.max(zMinMm + 1.0, bbox[1][2] * CM_TO_MM) : 20.0;

  const layers: SlicerLayerInfo[] = [];
  const totalLayers = Math.max(1, Math.floor((zMaxMm - zMinMm) / layerHeightMm));

  // Limit sampled layers to 60 max for fluid 60fps rendering in UI while retaining fidelity
  const sampleStride = totalLayers > 80 ? Math.ceil(totalLayers / 80) : 1;

  for (let l = 0; l < totalLayers; l += sampleStride) {
    const zMm = zMinMm + (l + 0.5) * layerHeightMm;
    const rawSegments = sliceMeshAtZ(part, zMm);
    const loops = stitchSegmentsIntoLoops(rawSegments);

    const outerPerimeters: Slicer2DPoint[][] = [];
    const innerPerimeters: Slicer2DPoint[][] = [];
    const infillLines: Slicer2DLine[] = [];

    let totalPerimeterLen = 0;

    loops.forEach((loop) => {
      if (loop.length < 3) return;
      outerPerimeters.push(loop);

      // Inner perimeter (0.4mm nozzle offset inward)
      const innerLoop = offsetPolyline(loop, -0.4);
      if (innerLoop.length >= 3) {
        innerPerimeters.push(innerLoop);
      }

      for (let i = 0; i < loop.length; i++) {
        const next = loop[(i + 1) % loop.length];
        totalPerimeterLen += Math.hypot(next.x - loop[i].x, next.y - loop[i].y);
      }
    });

    // Generate infill hatching within bounding box
    if (infillDensityPercent > 0 && outerPerimeters.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      outerPerimeters.forEach((loop) => {
        loop.forEach((pt) => {
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        });
      });

      if (maxX > minX && maxY > minY) {
        // Density spacing (e.g. 20% infill -> 2.5mm line spacing)
        const spacingMm = Math.max(1.2, 0.4 / (Math.max(5, infillDensityPercent) / 100));
        const width = maxX - minX;
        const height = maxY - minY;
        const isOdd = l % 2 === 1;

        // Infill grid/diagonal lines
        const stepCount = Math.min(30, Math.floor((width + height) / spacingMm));
        for (let s = 0; s < stepCount; s++) {
          const offset = s * spacingMm;
          if (isOdd) {
            // 45 degree hatch
            const x0 = minX + offset * 0.7;
            const y0 = minY;
            const x1 = minX;
            const y1 = minY + offset * 0.7;
            if (x0 <= maxX || y1 <= maxY) {
              infillLines.push({
                p1: { x: Math.min(maxX, x0), y: Math.max(minY, y0) },
                p2: { x: Math.max(minX, x1), y: Math.min(maxY, y1) },
              });
            }
          } else {
            // 135 degree cross hatch
            const x0 = minX + offset * 0.7;
            const y0 = maxY;
            const x1 = minX;
            const y1 = maxY - offset * 0.7;
            if (x0 <= maxX || y1 >= minY) {
              infillLines.push({
                p1: { x: Math.min(maxX, x0), y: Math.min(maxY, y0) },
                p2: { x: Math.max(minX, x1), y: Math.max(minY, y1) },
              });
            }
          }
        }
      }
    }

    let totalInfillLen = 0;
    infillLines.forEach((line) => {
      totalInfillLen += Math.hypot(line.p2.x - line.p1.x, line.p2.y - line.p1.y);
    });

    // 45mm/s wall speed, 75mm/s infill speed, 0.8s layer change time
    const layerTime = totalPerimeterLen / 45.0 + totalInfillLen / 75.0 + 0.8;
    // 0.4mm nozzle * 0.2mm layer height -> cross section = 0.08 mm2
    // 1.75mm filament -> cross section = 2.405 mm2
    const totalExtrusionMm = ((totalPerimeterLen * 2 + totalInfillLen) * 0.08) / 2.405;

    layers.push({
      layerIndex: l + 1,
      zMm: parseFloat(zMm.toFixed(2)),
      outerPerimeters,
      innerPerimeters,
      infillLines,
      layerHeightMm,
      estimatedTimeSeconds: parseFloat(layerTime.toFixed(1)),
      extrusionLengthMm: parseFloat(totalExtrusionMm.toFixed(1)),
    });
  }

  return layers;
}

// ============================================================================
// 5. INTERACTIVE CNC TOOLPATH SIMULATOR & MOTION PATH BUILDER
// ============================================================================

/**
 * Builds an explicit list of 3D motion steps for animating CNC cutter toolpaths
 */
export function buildSimulatedToolpath(
  part: CadPartOutput,
  config: CncCamConfig = DEFAULT_CAM_CONFIG
): SimulatedToolpath {
  // Extract multi-Z toolpath stages
  const stages = extractMultiZFeatures(part, config);
  const steps: ToolpathMotionStep[] = [];

  let currentX = 0;
  let currentY = 0;
  let currentZ = config.safeZMm;
  let lineIdx = 1;

  // Initial Safe Retract
  steps.push({
    x: 0,
    y: 0,
    z: config.safeZMm,
    isRapid: true,
    isCutting: false,
    feedRate: 3000,
    command: `G00 Z${config.safeZMm.toFixed(2)}`,
    lineIndex: lineIdx++,
    passNumber: 0,
  });

  stages.forEach((stage) => {
    const numPasses = Math.max(1, Math.ceil(stage.targetDepthMm / config.stepDownMm));

    // Simulate Canned Drilling Cycles (G81 / G83) (ROADMAP ISS-503)
    if (stage.holeFeatures && stage.holeFeatures.length > 0) {
      stage.holeFeatures.forEach((hole) => {
        // Rapid to hole center at safe clearance
        steps.push({
          x: hole.centerX,
          y: hole.centerY,
          z: config.safeZMm,
          isRapid: true,
          isCutting: false,
          feedRate: 3000,
          command: `G00 X${hole.centerX.toFixed(2)} Y${hole.centerY.toFixed(2)}`,
          lineIndex: lineIdx++,
          passNumber: 0,
        });
        currentX = hole.centerX;
        currentY = hole.centerY;

        if (hole.isPeckDrill) {
          const numPecks = Math.max(1, Math.ceil(hole.depthMm / hole.peckIncrementMm));
          for (let p = 1; p <= numPecks; p++) {
            const peckZ = -Math.min(hole.depthMm, p * hole.peckIncrementMm);
            // Controlled plunge peck
            steps.push({
              x: hole.centerX,
              y: hole.centerY,
              z: peckZ,
              isRapid: false,
              isCutting: true,
              feedRate: config.plungeRateMmMin,
              command: `G83 Z${peckZ.toFixed(2)} Q${hole.peckIncrementMm.toFixed(2)} [Peck ${p}/${numPecks}]`,
              lineIndex: lineIdx++,
              passNumber: p,
            });
            // Rapid chip-break retract to safe clearance
            steps.push({
              x: hole.centerX,
              y: hole.centerY,
              z: config.safeZMm,
              isRapid: true,
              isCutting: false,
              feedRate: 3000,
              command: `G00 Z${config.safeZMm.toFixed(2)} [Retract]`,
              lineIndex: lineIdx++,
              passNumber: p,
            });
          }
        } else {
          // Standard shallow drill
          steps.push({
            x: hole.centerX,
            y: hole.centerY,
            z: -hole.depthMm,
            isRapid: false,
            isCutting: true,
            feedRate: config.plungeRateMmMin,
            command: `G81 Z-${hole.depthMm.toFixed(2)} [Drill]`,
            lineIndex: lineIdx++,
            passNumber: 1,
          });
          // Rapid retract
          steps.push({
            x: hole.centerX,
            y: hole.centerY,
            z: config.safeZMm,
            isRapid: true,
            isCutting: false,
            feedRate: 3000,
            command: `G00 Z${config.safeZMm.toFixed(2)} [Retract]`,
            lineIndex: lineIdx++,
            passNumber: 1,
          });
        }
        currentZ = config.safeZMm;
      });
    }

    if (stage.isInternal && stage.loops.length > 1) {
      for (let pass = 1; pass <= numPasses; pass++) {
        const currentPassZ = -Math.min(stage.targetDepthMm, pass * config.stepDownMm);

        stage.loops.forEach((loop) => {
          if (loop.length < 2) return;
          const start = loop[0];

          // Rapid above loop start at safe clearance
          steps.push({
            x: start.x,
            y: start.y,
            z: config.safeZMm,
            isRapid: true,
            isCutting: false,
            feedRate: 3000,
            command: `G00 X${start.x.toFixed(2)} Y${start.y.toFixed(2)}`,
            lineIndex: lineIdx++,
            passNumber: pass,
          });
          currentX = start.x;
          currentY = start.y;

          // Controlled plunge into stock
          steps.push({
            x: currentX,
            y: currentY,
            z: currentPassZ,
            isRapid: false,
            isCutting: true,
            feedRate: config.plungeRateMmMin,
            command: `G01 Z${currentPassZ.toFixed(2)} F${config.plungeRateMmMin}`,
            lineIndex: lineIdx++,
            passNumber: pass,
          });
          currentZ = currentPassZ;

          // Mill loop points
          for (let ptIdx = 1; ptIdx < loop.length; ptIdx++) {
            const pt = loop[ptIdx];
            steps.push({
              x: pt.x,
              y: pt.y,
              z: currentPassZ,
              isRapid: false,
              isCutting: true,
              feedRate: config.feedRateMmMin,
              command: `G01 X${pt.x.toFixed(2)} Y${pt.y.toFixed(2)}`,
              lineIndex: lineIdx++,
              passNumber: pass,
            });
            currentX = pt.x;
            currentY = pt.y;
          }

          // Close loop if closed
          if (loop.length > 2) {
            steps.push({
              x: start.x,
              y: start.y,
              z: currentPassZ,
              isRapid: false,
              isCutting: true,
              feedRate: config.feedRateMmMin,
              command: `G01 X${start.x.toFixed(2)} Y${start.y.toFixed(2)}`,
              lineIndex: lineIdx++,
              passNumber: pass,
            });
            currentX = start.x;
            currentY = start.y;
          }

          // Retract above stock after loop
          steps.push({
            x: currentX,
            y: currentY,
            z: config.safeZMm,
            isRapid: true,
            isCutting: false,
            feedRate: 3000,
            command: `G00 Z${config.safeZMm.toFixed(2)}`,
            lineIndex: lineIdx++,
            passNumber: pass,
          });
          currentZ = config.safeZMm;
        });
      }
    } else {
      stage.loops.forEach((loop) => {
        if (loop.length < 2) return;
        const start = loop[0];

        // Rapid to loop start above stock
        steps.push({
          x: start.x,
          y: start.y,
          z: config.safeZMm,
          isRapid: true,
          isCutting: false,
          feedRate: 3000,
          command: `G00 X${start.x.toFixed(2)} Y${start.y.toFixed(2)}`,
          lineIndex: lineIdx++,
          passNumber: 0,
        });
        currentX = start.x;
        currentY = start.y;

        for (let pass = 1; pass <= numPasses; pass++) {
          const currentPassZ = -Math.min(stage.targetDepthMm, pass * config.stepDownMm);
          const isFinalPass = pass === numPasses;

          // Controlled Plunge
          steps.push({
            x: currentX,
            y: currentY,
            z: currentPassZ,
            isRapid: false,
            isCutting: true,
            feedRate: config.plungeRateMmMin,
            command: `G01 Z${currentPassZ.toFixed(2)} F${config.plungeRateMmMin}`,
            lineIndex: lineIdx++,
            passNumber: pass,
          });
          currentZ = currentPassZ;

          // Mill perimeter points
          for (let ptIdx = 1; ptIdx < loop.length; ptIdx++) {
            const pt = loop[ptIdx];
            if (
              isFinalPass &&
              config.addHoldingTabs &&
              config.tabCount &&
              ptIdx % Math.max(1, Math.floor(loop.length / config.tabCount)) === 0
            ) {
              const tabZ = currentPassZ + (config.tabHeightMm || 1.5);
              steps.push({
                x: pt.x,
                y: pt.y,
                z: tabZ,
                isRapid: false,
                isCutting: true,
                feedRate: config.feedRateMmMin,
                command: `G01 X${pt.x.toFixed(2)} Y${pt.y.toFixed(2)} Z${tabZ.toFixed(2)} [Tab]`,
                lineIndex: lineIdx++,
                passNumber: pass,
              });
              steps.push({
                x: pt.x,
                y: pt.y,
                z: currentPassZ,
                isRapid: false,
                isCutting: true,
                feedRate: config.plungeRateMmMin,
                command: `G01 Z${currentPassZ.toFixed(2)}`,
                lineIndex: lineIdx++,
                passNumber: pass,
              });
            } else {
              steps.push({
                x: pt.x,
                y: pt.y,
                z: currentPassZ,
                isRapid: false,
                isCutting: true,
                feedRate: config.feedRateMmMin,
                command: `G01 X${pt.x.toFixed(2)} Y${pt.y.toFixed(2)}`,
                lineIndex: lineIdx++,
                passNumber: pass,
              });
            }
            currentX = pt.x;
            currentY = pt.y;
          }

          // Close loop back to start
          steps.push({
            x: start.x,
            y: start.y,
            z: currentPassZ,
            isRapid: false,
            isCutting: true,
            feedRate: config.feedRateMmMin,
            command: `G01 X${start.x.toFixed(2)} Y${start.y.toFixed(2)}`,
            lineIndex: lineIdx++,
            passNumber: pass,
          });
          currentX = start.x;
          currentY = start.y;
        }

        // Retract after loop
        steps.push({
          x: currentX,
          y: currentY,
          z: config.safeZMm,
          isRapid: true,
          isCutting: false,
          feedRate: 3000,
          command: `G00 Z${config.safeZMm.toFixed(2)}`,
          lineIndex: lineIdx++,
          passNumber: 0,
        });
        currentZ = config.safeZMm;
      });
    }
  });

  // Final Home Return
  steps.push({
    x: 0,
    y: 0,
    z: config.safeZMm + 10,
    isRapid: true,
    isCutting: false,
    feedRate: 3000,
    command: `G00 Z${(config.safeZMm + 10).toFixed(2)} X0 Y0`,
    lineIndex: lineIdx++,
    passNumber: 0,
  });

  // Calculate distances & times
  let totalDist = 0;
  let rapidDist = 0;
  let cuttingDist = 0;
  let timeSec = 0;

  let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = config.safeZMm + 10;

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const curr = steps[i];
    const d = Math.hypot(curr.x - prev.x, curr.y - prev.y, curr.z - prev.z);
    totalDist += d;

    if (curr.isRapid) {
      rapidDist += d;
      timeSec += (d / 3000) * 60; // 3000 mm/min rapid
    } else {
      cuttingDist += d;
      timeSec += (d / Math.max(100, curr.feedRate)) * 60;
    }

    minX = Math.min(minX, curr.x);
    maxX = Math.max(maxX, curr.x);
    minY = Math.min(minY, curr.y);
    maxY = Math.max(maxY, curr.y);
    minZ = Math.min(minZ, curr.z);
    maxZ = Math.max(maxZ, curr.z);
  }

  return {
    steps,
    totalDistanceMm: parseFloat(totalDist.toFixed(1)),
    rapidDistanceMm: parseFloat(rapidDist.toFixed(1)),
    cuttingDistanceMm: parseFloat(cuttingDist.toFixed(1)),
    estimatedTimeSeconds: Math.max(10, Math.round(timeSec)),
    boundsMm: {
      minX: parseFloat(minX.toFixed(1)),
      maxX: parseFloat(maxX.toFixed(1)),
      minY: parseFloat(minY.toFixed(1)),
      maxY: parseFloat(maxY.toFixed(1)),
      minZ: parseFloat(minZ.toFixed(1)),
      maxZ: parseFloat(maxZ.toFixed(1)),
    },
  };
}

// ============================================================================
// Automated 3D Print & CNC DFM (Design for Manufacturing) Validation Rules
// ============================================================================

export interface DfmValidationRule {
  minWallThicknessMm: number; // default 1.2 mm for FDM
  minMatingClearanceMm: number; // default 0.25 mm for sliding fits
  maxOverhangAngleDeg: number; // default 45.0 degrees
  minToolRadiusMm: number; // default 1.5 mm for 1/8" standard CNC endmills
}

export const DEFAULT_DFM_RULES: DfmValidationRule = {
  minWallThicknessMm: 1.2,
  minMatingClearanceMm: 0.25,
  maxOverhangAngleDeg: 45.0,
  minToolRadiusMm: 1.5,
};

export interface DfmDiagnosticWarning {
  rule: 'wall_thickness' | 'mating_clearance' | 'overhang' | 'cnc_internal_radius';
  partName: string;
  severity: 'warning' | 'error';
  message: string;
  measuredValue: number;
  thresholdValue: number;
  unit: string;
}

/**
 * Deterministically checks 3D print and CNC digital fabrication rules across an assembly.
 */
export function validateAssemblyDfm(
  parts: CadPartOutput[],
  code: string = '',
  rules: DfmValidationRule = DEFAULT_DFM_RULES
): {
  passed: boolean;
  warnings: string[];
  diagnostics: DfmDiagnosticWarning[];
} {
  const warnings: string[] = [];
  const diagnostics: DfmDiagnosticWarning[] = [];

  const minWallThicknessCm = rules.minWallThicknessMm / 10.0;
  const minClearanceCm = rules.minMatingClearanceMm / 10.0;

  // 1. Minimum Wall Thickness Check (>= 1.2 mm for FDM)
  for (const part of parts) {
    if (!part.diagnostics?.bounds) continue;
    const [mn, mx] = part.diagnostics.bounds;
    const dx = Math.abs(mx[0] - mn[0]);
    const dy = Math.abs(mx[1] - mn[1]);
    const dz = Math.abs(mx[2] - mn[2]);
    const dims = [dx, dy, dz].filter((d) => d > 1e-4);
    const minDimCm = dims.length > 0 ? Math.min(...dims) : 1.0;

    // Check code for explicit wall_thickness or thickness declarations
    const wallParamRegex = /(?:wall_thickness|wall|thickness)\s*=\s*([0-9.]+)/i;
    const wallMatch = wallParamRegex.exec(code);
    let explicitWallCm: number | null = null;
    if (wallMatch && wallMatch[1]) {
      explicitWallCm = parseFloat(wallMatch[1]);
    }

    // Check concentric cylinder subtraction (outer radius - inner radius)
    let concentricWallCm: number | null = null;
    const cylRegex = /sm\.create_cylinder\([^,]+,\s*([0-9.]+)/g;
    const cylRadii: number[] = [];
    let cmMatch: RegExpExecArray | null;
    while ((cmMatch = cylRegex.exec(code)) !== null) {
      if (cmMatch[1]) cylRadii.push(parseFloat(cmMatch[1]));
    }
    if (cylRadii.length >= 2) {
      cylRadii.sort((a, b) => b - a);
      for (let k = 0; k < cylRadii.length - 1; k++) {
        const diff = cylRadii[k] - cylRadii[k + 1];
        if (diff > 0 && diff < minWallThicknessCm * 2) {
          concentricWallCm = diff;
          break;
        }
      }
    }

    const measuredCm =
      explicitWallCm !== null
        ? explicitWallCm
        : concentricWallCm !== null
        ? concentricWallCm
        : minDimCm;

    const measuredMm = measuredCm * 10.0;

    if (measuredCm < minWallThicknessCm) {
      const msg = `DFM_WALL_THICKNESS: Part '${part.name}' wall thickness (${measuredMm.toFixed(2)} mm) is below FDM minimum (${rules.minWallThicknessMm} mm)`;
      warnings.push(msg);
      diagnostics.push({
        rule: 'wall_thickness',
        partName: part.name,
        severity: 'warning',
        message: msg,
        measuredValue: Number(measuredMm.toFixed(2)),
        thresholdValue: rules.minWallThicknessMm,
        unit: 'mm',
      });
    }
  }

  // 2. Mating Part Clearance Check (>= 0.25 mm)
  if (parts.length >= 2) {
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const pA = parts[i];
        const pB = parts[j];
        if (!pA.diagnostics?.bounds || !pB.diagnostics?.bounds) continue;
        const [aMn, aMx] = pA.diagnostics.bounds;
        const [bMn, bMx] = pB.diagnostics.bounds;

        const gapX = Math.max(0, Math.max(aMn[0], bMn[0]) - Math.min(aMx[0], bMx[0]));
        const gapY = Math.max(0, Math.max(aMn[1], bMn[1]) - Math.min(aMx[1], bMx[1]));
        const gapZ = Math.max(0, Math.max(aMn[2], bMn[2]) - Math.min(aMx[2], bMx[2]));
        const minGapCm = Math.max(gapX, gapY, gapZ);

        const aabbOverlapX = Math.min(aMx[0], bMx[0]) - Math.max(aMn[0], bMn[0]);
        const aabbOverlapY = Math.min(aMx[1], bMx[1]) - Math.max(aMn[1], bMn[1]);
        const aabbOverlapZ = Math.min(aMx[2], bMx[2]) - Math.max(aMn[2], bMn[2]);

        const isMatingContact =
          (aabbOverlapX > 0 && aabbOverlapY > 0 && Math.abs(gapZ) < minClearanceCm) ||
          (aabbOverlapY > 0 && aabbOverlapZ > 0 && Math.abs(gapX) < minClearanceCm) ||
          (aabbOverlapX > 0 && aabbOverlapZ > 0 && Math.abs(gapY) < minClearanceCm);

        if (isMatingContact && minGapCm < minClearanceCm) {
          const gapMm = minGapCm * 10.0;
          const msg = `DFM_MATING_CLEARANCE: Parts '${pA.name}' and '${pB.name}' have mating clearance (${gapMm.toFixed(2)} mm) below minimum tolerance (${rules.minMatingClearanceMm} mm)`;
          warnings.push(msg);
          diagnostics.push({
            rule: 'mating_clearance',
            partName: `${pA.name} / ${pB.name}`,
            severity: 'warning',
            message: msg,
            measuredValue: Number(gapMm.toFixed(2)),
            thresholdValue: rules.minMatingClearanceMm,
            unit: 'mm',
          });
        }
      }
    }
  }

  // 3. Unsupported Overhang Ratio Check (> 45 deg)
  for (const part of parts) {
    if (part.mesh && part.mesh.triangles && part.mesh.triangles.length > 0) {
      const overhangResult = analyzeOverhangs(part, rules.maxOverhangAngleDeg);
      if (overhangResult.status !== 'safe' && overhangResult.unsupportedFacetCount > 0) {
        const worstAngle =
          overhangResult.zones.length > 0
            ? Math.max(...overhangResult.zones.map((z) => z.worstAngleDeg))
            : 90.0;
        const msg = `DFM_OVERHANG: Part '${part.name}' has ${overhangResult.unsupportedFacetCount} unsupported downward facets exceeding 45° overhang threshold (${worstAngle.toFixed(1)}°)`;
        warnings.push(msg);
        diagnostics.push({
          rule: 'overhang',
          partName: part.name,
          severity: 'warning',
          message: msg,
          measuredValue: Number(worstAngle.toFixed(1)),
          thresholdValue: rules.maxOverhangAngleDeg,
          unit: 'deg',
        });
      }
    }
  }

  // 4. CNC Minimum Internal Corner Radius Check (>= toolRadius, default 1.5 mm)
  const pocketDifferenceRegex = /sm\.boolean_difference\([^,]+,\s*([a-zA-Z0-9_]+)\)/g;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pocketDifferenceRegex.exec(code)) !== null) {
    const cutterVar = pMatch[1];
    const boxDefRegex = new RegExp(`${cutterVar}\\s*=\\s*sm\\.create_box`);
    const hasFilletRegex = new RegExp(`sm\\.fillet_edges\\(${cutterVar}`);
    if (boxDefRegex.test(code) && !hasFilletRegex.test(code)) {
      const msg = `DFM_CNC_CORNER_RADIUS: Cutter '${cutterVar}' produces sharp internal pocket corners without tool radius relief (minimum tool radius ${rules.minToolRadiusMm} mm required)`;
      warnings.push(msg);
      diagnostics.push({
        rule: 'cnc_internal_radius',
        partName: cutterVar,
        severity: 'warning',
        message: msg,
        measuredValue: 0.0,
        thresholdValue: rules.minToolRadiusMm,
        unit: 'mm',
      });
    }
  }

  return {
    passed: warnings.length === 0,
    warnings,
    diagnostics,
  };
}
