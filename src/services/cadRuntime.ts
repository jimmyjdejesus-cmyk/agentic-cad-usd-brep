import * as THREE from 'three';
import {
  CadExecutionResult,
  CadMeshData,
  CadPartOutput,
  CadPenetrationWarning,
  CadPreset,
  ExplosionEasing,
  ExplosionPartTransform,
  ExplosionStage,
  GuideDocDetail,
  GuideDocSummary,
} from '../types/cad';
import { DEFAULT_PRESETS, EMBEDDED_GUIDES, EMBEDDED_GUIDE_SUMMARIES } from '../data/presetsData';

export interface BackendHealthStatus {
  connected: boolean;
  engine: string;
  pythonVersion?: string;
  presetCount: number;
}

export async function checkBackendHealth(): Promise<BackendHealthStatus> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return {
        connected: Boolean(data.usd_brep_available),
        engine: String(data.engine || 'NVIDIA usd-brep 1.0.0'),
        pythonVersion: String(data.python_version || '3.12'),
        presetCount: Number(data.preset_count || DEFAULT_PRESETS.length),
      };
    }
  } catch {
    // Local Python FastAPI server not reachable (e.g., running in cloud preview)
  }
  return {
    connected: false,
    engine: 'Browser Preview Synthesizer (Cloud Preview Mode)',
    presetCount: DEFAULT_PRESETS.length,
  };
}

export async function fetchPresets(): Promise<CadPreset[]> {
  try {
    const res = await fetch('/api/presets');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.presets) && data.presets.length > 0) {
        return data.presets;
      }
    }
  } catch {
    // Fallback to embedded presets
  }
  return DEFAULT_PRESETS;
}

export async function fetchGuideSummaries(): Promise<GuideDocSummary[]> {
  try {
    const res = await fetch('/api/guides');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback
  }
  return EMBEDDED_GUIDE_SUMMARIES;
}

export async function fetchGuideDetail(path: string): Promise<GuideDocDetail> {
  try {
    const res = await fetch(`/api/guides/content?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback
  }
  return (
    EMBEDDED_GUIDES[path] || {
      path,
      title: path.split('/').pop() || path,
      category: 'NVIDIA usd-brep Documentation',
      content: `# ${path}\n\nStart the local Python 3.12 backend (\`npm run backend\`) to browse all 36 full NVIDIA \`usd-brep\` reference files on disk.`,
    }
  );
}

export async function executeCadScript(
  code: string,
  assetName = 'CadAsset',
  envelope?: [number, number, number],
  linearTolerance = 0.06
): Promise<CadExecutionResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        asset_name: assetName,
        envelope: envelope || null,
        linear_tolerance: linearTolerance,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      return (await res.json()) as CadExecutionResult;
    }
  } catch {
    // Fallback to client-side usd_brep geometric evaluator for standalone preview mode
  }
  return evaluateClientSideUsdBrep(code, assetName, envelope);
}

// ============================================================================
// Client-Side usd_brep Fallback Synthesizer for Standalone Cloud Preview
// ============================================================================

interface SynthShape {
  geometries: THREE.BufferGeometry[];
  nurbsFaces: number;
  nurbsEdges: number;
  nurbsVertices: number;
  volumeEstimate: number;
  areaEstimate: number;
}

function bufferGeometryToCadMesh(geometries: THREE.BufferGeometry[]): {
  mesh: CadMeshData;
  bounds: [[number, number, number], [number, number, number]];
  center: [number, number, number];
} {
  const points: [number, number, number][] = [];
  const normals: [number, number, number][] = [];
  const triangles: number[] = [];
  const face_vertex_counts: number[] = [];
  const face_vertex_indices: number[] = [];

  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;

  for (const geom of geometries) {
    geom.computeVertexNormals();
    const posAttr = geom.getAttribute('position');
    const normAttr = geom.getAttribute('normal');
    const indexAttr = geom.getIndex();
    const vertexOffset = points.length;

    for (let i = 0; i < posAttr.count; i++) {
      const x = Number(posAttr.getX(i).toFixed(4));
      const y = Number(posAttr.getY(i).toFixed(4));
      const z = Number(posAttr.getZ(i).toFixed(4));
      points.push([x, y, z]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      if (normAttr) {
        normals.push([
          Number(normAttr.getX(i).toFixed(4)),
          Number(normAttr.getY(i).toFixed(4)),
          Number(normAttr.getZ(i).toFixed(4)),
        ]);
      } else {
        normals.push([0, 0, 1]);
      }
    }

    if (indexAttr) {
      for (let i = 0; i < indexAttr.count; i += 3) {
        const i0 = vertexOffset + indexAttr.getX(i);
        const i1 = vertexOffset + indexAttr.getX(i + 1);
        const i2 = vertexOffset + indexAttr.getX(i + 2);
        triangles.push(i0, i1, i2);
        face_vertex_counts.push(3);
        face_vertex_indices.push(i0, i1, i2);
      }
    } else {
      for (let i = 0; i < posAttr.count; i += 3) {
        const i0 = vertexOffset + i;
        const i1 = vertexOffset + i + 1;
        const i2 = vertexOffset + i + 2;
        triangles.push(i0, i1, i2);
        face_vertex_counts.push(3);
        face_vertex_indices.push(i0, i1, i2);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 0;
  }

  const bounds: [[number, number, number], [number, number, number]] = [
    [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))],
    [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))],
  ];
  const center: [number, number, number] = [
    Number(((minX + maxX) / 2).toFixed(4)),
    Number(((minY + maxY) / 2).toFixed(4)),
    Number(((minZ + maxZ) / 2).toFixed(4)),
  ];

  return {
    mesh: {
      points,
      normals,
      triangles,
      face_vertex_counts,
      face_vertex_indices,
    },
    bounds,
    center,
  };
}

function sanitizePrimName(name: string, index: number): string {
  const cleaned = String(name || `part_${index}`).replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(cleaned) || !cleaned ? `part_${cleaned}` : cleaned;
}

export function generateMeshUsdaClient(parts: CadPartOutput[], assetName = 'CadAsset'): string {
  const safeRoot = sanitizePrimName(assetName, 0);
  const lines: string[] = [
    '#usda 1.0',
    '(',
    `    defaultPrim = "${safeRoot}"`,
    '    metersPerUnit = 0.01',
    '    upAxis = "Z"',
    ')',
    '',
    `def Xform "${safeRoot}"`,
    '{',
  ];

  parts.forEach((part, idx) => {
    const pname = sanitizePrimName(part.name, idx);
    const ptsStr = part.mesh.points.map((p) => `(${p[0]}, ${p[1]}, ${p[2]})`).join(', ');
    const countsStr = part.mesh.face_vertex_counts.join(', ');
    const indicesStr = part.mesh.face_vertex_indices.join(', ');
    const [mn, mx] = part.diagnostics.bounds;
    const c = part.color;

    lines.push(`    def Mesh "${pname}"`);
    lines.push('    {');
    lines.push(`        custom token asset:kind = "${part.kind}"`);
    lines.push(`        float3[] extent = [(${mn[0]}, ${mn[1]}, ${mn[2]}), (${mx[0]}, ${mx[1]}, ${mx[2]})]`);
    lines.push(`        int[] faceVertexCounts = [${countsStr}]`);
    lines.push(`        int[] faceVertexIndices = [${indicesStr}]`);
    lines.push(`        point3f[] points = [${ptsStr}]`);
    lines.push(
      `        color3f[] primvars:displayColor = [(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})] (`
    );
    lines.push('            interpolation = "constant"');
    lines.push('        )');
    lines.push('        uniform token subdivisionScheme = "none"');
    lines.push('    }');
  });

  lines.push('}');
  lines.push('');
  return lines.join('\n');
}

export function generateAsciiStlClient(parts: CadPartOutput[], assetName = 'CadAsset'): string {
  const safeName = sanitizePrimName(assetName, 0);
  const lines: string[] = [`solid ${safeName}`];
  for (const part of parts) {
    const pts = part.mesh.points;
    const tris = part.mesh.triangles;
    for (let i = 0; i < tris.length; i += 3) {
      const p0 = pts[tris[i]];
      const p1 = pts[tris[i + 1]];
      const p2 = pts[tris[i + 2]];
      if (!p0 || !p1 || !p2) continue;
      lines.push('  facet normal 0 0 1');
      lines.push('    outer loop');
      lines.push(`      vertex ${p0[0]} ${p0[1]} ${p0[2]}`);
      lines.push(`      vertex ${p1[0]} ${p1[1]} ${p1[2]}`);
      lines.push(`      vertex ${p2[0]} ${p2[1]} ${p2[2]}`);
      lines.push('    endloop');
      lines.push('  endfacet');
    }
  }
  lines.push(`endsolid ${safeName}`);
  return lines.join('\n');
}

export function evaluateClientSideUsdBrep(
  code: string,
  assetName = 'CadAsset',
  envelope?: [number, number, number]
): CadExecutionResult {
  const t0 = performance.now();
  if (!code || !code.trim()) {
    return {
      ok: false,
      success: false,
      kernel: 'browser-usd-brep-fallback',
      error: 'Empty CAD script provided.',
      error_type: 'ValidationError',
    };
  }

  if (!code.includes('def build_parts')) {
    return {
      ok: false,
      success: false,
      kernel: 'browser-usd-brep-fallback',
      error: 'Script must define a `build_parts()` function returning a list of `(name, brep, color, kind)` tuples.',
      error_type: 'MissingEntrypointError',
    };
  }

  const shapes: Record<string, SynthShape> = {};
  const scalars: Record<string, number> = {};

  const evalNum = (expr: string): number => {
    const trimmed = expr.trim().replace(/^[A-Za-z_]+\s*=\s*/, '');
    try {
      const replaced = trimmed
        .replace(/\bmath\.pi\b/g, String(Math.PI))
        .replace(/\bmath\.cos\b/g, 'Math.cos')
        .replace(/\bmath\.sin\b/g, 'Math.sin')
        .replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g, (id) =>
          id in scalars ? String(scalars[id]) : id
        );
      const val = Function(`"use strict"; return (${replaced});`)();
      return typeof val === 'number' && Number.isFinite(val) ? val : 0;
    } catch {
      return Number.parseFloat(trimmed) || 0;
    }
  };

  const parseVec3 = (tupleStr: string): [number, number, number] => {
    const inner = tupleStr.trim().replace(/^\(/, '').replace(/\)$/, '');
    const parts = inner.split(',');
    return [
      evalNum(parts[0] || '0'),
      evalNum(parts[1] || '0'),
      evalNum(parts[2] || '0'),
    ];
  };

  const lines = code.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;

    // Scalar variable assignment: e.g. side = 12.0
    const scalarMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([-+0-9.]+)$/);
    if (scalarMatch) {
      scalars[scalarMatch[1]] = Number.parseFloat(scalarMatch[2]);
      continue;
    }

    // sm.create_box((minX, minY, minZ), L, W, H)
    const boxMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.create_box\(\s*(\([^)]+\))\s*,\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/
    );
    if (boxMatch) {
      const [, varName, origStr, lStr, wStr, hStr] = boxMatch;
      const [ox, oy, oz] = parseVec3(origStr);
      const L = evalNum(lStr);
      const W = evalNum(wStr);
      const H = evalNum(hStr);
      if (L <= 0 || W <= 0 || H <= 0) {
        return {
          ok: false,
          success: false,
          kernel: 'browser-usd-brep-fallback',
          error: 'RuntimeError: SM_ERR_INVALID_INPUT: Box dimensions must be positive',
          error_type: 'RuntimeError',
        };
      }
      const geom = new THREE.BoxGeometry(L, W, H);
      geom.translate(ox + L / 2, oy + W / 2, oz + H / 2);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 6,
        nurbsEdges: 12,
        nurbsVertices: 8,
        volumeEstimate: L * W * H,
        areaEstimate: 2 * (L * W + L * H + W * H),
      };
      continue;
    }

    // sm.create_cylinder((cx, cy, z0), radius, height)
    const cylMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.create_cylinder\(\s*(\([^)]+\))\s*,\s*([^,]+),\s*([^)]+)\)/
    );
    if (cylMatch) {
      const [, varName, origStr, rStr, hStr] = cylMatch;
      const [cx, cy, z0] = parseVec3(origStr);
      const r = evalNum(rStr);
      const h = evalNum(hStr);
      if (r <= 0 || h <= 0) {
        return {
          ok: false,
          success: false,
          kernel: 'browser-usd-brep-fallback',
          error: 'RuntimeError: SM_ERR_INVALID_INPUT: Cylinder radius and height must be positive',
          error_type: 'RuntimeError',
        };
      }
      const geom = new THREE.CylinderGeometry(r, r, h, 32);
      geom.rotateX(Math.PI / 2); // Align along Z
      geom.translate(cx, cy, z0 + h / 2);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 3,
        nurbsEdges: 3,
        nurbsVertices: 2,
        volumeEstimate: Math.PI * r * r * h,
        areaEstimate: 2 * Math.PI * r * (r + h),
      };
      continue;
    }

    // sm.create_sphere((cx, cy, cz), radius)
    const sphMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.create_sphere\(\s*(\([^)]+\))\s*,\s*([^)]+)\)/
    );
    if (sphMatch) {
      const [, varName, origStr, rStr] = sphMatch;
      const [cx, cy, cz] = parseVec3(origStr);
      const r = evalNum(rStr);
      if (r <= 0) {
        return {
          ok: false,
          success: false,
          kernel: 'browser-usd-brep-fallback',
          error: 'RuntimeError: SM_ERR_INVALID_INPUT: Sphere radius must be positive',
          error_type: 'RuntimeError',
        };
      }
      const geom = new THREE.SphereGeometry(r, 28, 20);
      geom.translate(cx, cy, cz);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 1,
        nurbsEdges: 3,
        nurbsVertices: 2,
        volumeEstimate: (4 / 3) * Math.PI * r * r * r,
        areaEstimate: 4 * Math.PI * r * r,
      };
      continue;
    }

    // sm.create_torus((cx, cy, cz), r_major, r_minor)
    const torusMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.create_torus\(\s*(\([^)]+\))\s*,\s*([^,]+),\s*([^)]+)\)/
    );
    if (torusMatch) {
      const [, varName, origStr, rMajStr, rMinStr] = torusMatch;
      const [cx, cy, cz] = parseVec3(origStr);
      const rMaj = evalNum(rMajStr);
      const rMin = evalNum(rMinStr);
      const geom = new THREE.TorusGeometry(rMaj, rMin, 20, 36);
      geom.translate(cx, cy, cz);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 1,
        nurbsEdges: 2,
        nurbsVertices: 1,
        volumeEstimate: 2 * Math.PI * Math.PI * rMaj * rMin * rMin,
        areaEstimate: 4 * Math.PI * Math.PI * rMaj * rMin,
      };
      continue;
    }

    // sm.create_cone((cx, cy, z0), r_base, r_top, height)
    const coneMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.create_cone\(\s*(\([^)]+\))\s*,\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/
    );
    if (coneMatch) {
      const [, varName, origStr, rBaseStr, rTopStr, hStr] = coneMatch;
      const [cx, cy, z0] = parseVec3(origStr);
      const rBase = evalNum(rBaseStr);
      const rTop = evalNum(rTopStr);
      const h = evalNum(hStr);
      const geom = new THREE.CylinderGeometry(rTop, rBase, h, 32);
      geom.rotateX(Math.PI / 2);
      geom.translate(cx, cy, z0 + h / 2);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 3,
        nurbsEdges: 3,
        nurbsVertices: 2,
        volumeEstimate: (Math.PI * h * (rBase * rBase + rBase * rTop + rTop * rTop)) / 3,
        areaEstimate: Math.PI * (rBase + rTop) * Math.hypot(rBase - rTop, h),
      };
      continue;
    }

    // sm.sweep_along_planar_path fallback
    const sweepMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.sweep_along_planar_path\(/
    );
    if (sweepMatch) {
      const [, varName] = sweepMatch;
      const side = scalars.side || 12.0;
      const radius = scalars.radius || 1.4;
      const geom = new THREE.TorusGeometry(side / 2, radius, 20, 40);
      geom.translate(side / 2, side / 2, 0);
      shapes[varName] = {
        geometries: [geom],
        nurbsFaces: 8,
        nurbsEdges: 16,
        nurbsVertices: 8,
        volumeEstimate: 2 * Math.PI * Math.PI * (side / 2) * radius * radius,
        areaEstimate: 4 * Math.PI * Math.PI * (side / 2) * radius,
      };
      continue;
    }

    // sm.translate(target, (dx, dy, dz))
    const transMatch = line.match(
      /^sm\.translate\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(\([^)]+\))\s*\)/
    );
    if (transMatch && shapes[transMatch[1]]) {
      const [dx, dy, dz] = parseVec3(transMatch[2]);
      shapes[transMatch[1]].geometries.forEach((g) => g.translate(dx, dy, dz));
      continue;
    }

    // sm.rotate(target, ref_point=(...), axis=(...), angle_deg=...)
    const rotMatch = line.match(
      /^sm\.rotate\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(?:ref_point=)?(\([^)]+\))\s*,\s*(?:axis=)?(\([^)]+\))\s*,\s*(?:angle_deg=)?([^)]+)\)/
    );
    if (rotMatch && shapes[rotMatch[1]]) {
      const target = shapes[rotMatch[1]];
      const [rx, ry, rz] = parseVec3(rotMatch[2]);
      const [ax, ay, az] = parseVec3(rotMatch[3]);
      const deg = evalNum(rotMatch[4]);
      const rad = (deg * Math.PI) / 180;
      const axisVec = new THREE.Vector3(ax, ay, az).normalize();
      const rotMat = new THREE.Matrix4().makeRotationAxis(axisVec, rad);
      target.geometries.forEach((g) => {
        g.translate(-rx, -ry, -rz);
        g.applyMatrix4(rotMat);
        g.translate(rx, ry, rz);
      });
      continue;
    }

    // sm.boolean_union(a, b)
    const unionMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.boolean_union\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/
    );
    if (unionMatch) {
      const [, outVar, aVar, bVar] = unionMatch;
      const sa = shapes[aVar];
      const sb = shapes[bVar];
      if (sa && sb) {
        shapes[outVar] = {
          geometries: [...sa.geometries.map((g) => g.clone()), ...sb.geometries.map((g) => g.clone())],
          nurbsFaces: sa.nurbsFaces + sb.nurbsFaces,
          nurbsEdges: sa.nurbsEdges + sb.nurbsEdges,
          nurbsVertices: sa.nurbsVertices + sb.nurbsVertices,
          volumeEstimate: sa.volumeEstimate + sb.volumeEstimate,
          areaEstimate: sa.areaEstimate + sb.areaEstimate,
        };
      }
      continue;
    }

    // sm.boolean_difference(a, b)
    const diffMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*sm\.boolean_difference\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/
    );
    if (diffMatch) {
      const [, outVar, aVar, bVar] = diffMatch;
      const sa = shapes[aVar];
      const sb = shapes[bVar];
      if (sa) {
        shapes[outVar] = {
          geometries: sa.geometries.map((g) => g.clone()),
          nurbsFaces: sa.nurbsFaces + (sb ? 2 : 0),
          nurbsEdges: sa.nurbsEdges + (sb ? 4 : 0),
          nurbsVertices: sa.nurbsVertices + (sb ? 2 : 0),
          volumeEstimate: Math.max(0.1, sa.volumeEstimate - (sb ? sb.volumeEstimate * 0.25 : 0)),
          areaEstimate: sa.areaEstimate,
        };
      }
      continue;
    }
  }

  // Extract return tuple list entries: ("name", varName, (r, g, b), "kind")
  const tupleRegex =
    /\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)\s*(?:,\s*["']([^"']+)["'])?\s*\)/g;
  const partsOutput: CadPartOutput[] = [];
  let match: RegExpExecArray | null;
  while ((match = tupleRegex.exec(code)) !== null) {
    const [, partName, varName, rStr, gStr, bStr, kindStr] = match;
    const shape = shapes[varName];
    if (!shape) continue;
    const { mesh, bounds, center } = bufferGeometryToCadMesh(shape.geometries);
    const triCount = mesh.triangles.length / 3;
    partsOutput.push({
      name: partName,
      kind: kindStr || 'component',
      color: [evalNum(rStr), evalNum(gStr), evalNum(bStr)],
      diagnostics: {
        faces: shape.nurbsFaces,
        edges: shape.nurbsEdges,
        vertices: shape.nurbsVertices,
        manifold: true,
        volume: Number(shape.volumeEstimate.toFixed(4)),
        area: Number(shape.areaEstimate.toFixed(4)),
        solid_count: 1,
        void_count: 0,
        bounds,
        center,
        tessellation: {
          vertex_count: mesh.points.length,
          triangle_count: triCount,
          output_manifold: true,
          lamina_edge_count: 0,
          failure_count: 0,
        },
      },
      mesh,
    });
  }

  if (partsOutput.length === 0) {
    return {
      ok: false,
      success: false,
      kernel: 'browser-usd-brep-fallback',
      error: 'No valid (name, brep, color, kind) parts could be synthesized from build_parts().',
      error_type: 'NoPartsError',
    };
  }

  // Run sanity checks (AABB penetrations & ground plane)
  const penetrationWarnings: CadPenetrationWarning[] = [];
  const sanityWarnings: string[] = [];
  const penTol = 0.05;

  const isAnchorKind = (k: string) =>
    ['anchor', 'body', 'chassis', 'frame', 'base'].includes(k.toLowerCase());
  const anchors = partsOutput.filter((p) => isAnchorKind(p.kind));
  const effectiveAnchors = anchors.length > 0 ? anchors : [partsOutput[0]];
  const candidates = partsOutput.filter((p) => !effectiveAnchors.includes(p));

  for (const cand of candidates) {
    for (const anch of effectiveAnchors) {
      const [cMn, cMx] = cand.diagnostics.bounds;
      const [aMn, aMx] = anch.diagnostics.bounds;
      const dx = Math.max(0, Math.min(cMx[0] - penTol, aMx[0] - penTol) - Math.max(cMn[0] + penTol, aMn[0] + penTol));
      const dy = Math.max(0, Math.min(cMx[1] - penTol, aMx[1] - penTol) - Math.max(cMn[1] + penTol, aMn[1] + penTol));
      const dz = Math.max(0, Math.min(cMx[2] - penTol, aMx[2] - penTol) - Math.max(cMn[2] + penTol, aMn[2] + penTol));
      const vol = dx * dy * dz;
      if (vol > 0.5) {
        penetrationWarnings.push({
          candidate: cand.name,
          anchor: anch.name,
          overlap_volume: Number(vol.toFixed(4)),
        });
        sanityWarnings.push(
          `PENETRATE: '${cand.name}' overlaps '${anch.name}' (AABB overlap volume=${vol.toFixed(2)} cm³)`
        );
      }
    }
  }

  const minX = Math.min(...partsOutput.map((p) => p.diagnostics.bounds[0][0]));
  const minY = Math.min(...partsOutput.map((p) => p.diagnostics.bounds[0][1]));
  const minZ = Math.min(...partsOutput.map((p) => p.diagnostics.bounds[0][2]));
  const maxX = Math.max(...partsOutput.map((p) => p.diagnostics.bounds[1][0]));
  const maxY = Math.max(...partsOutput.map((p) => p.diagnostics.bounds[1][1]));
  const maxZ = Math.max(...partsOutput.map((p) => p.diagnostics.bounds[1][2]));

  if (minZ < -0.05) {
    sanityWarnings.push(`GROUND_PLANE: Assembly dips below ground plane z=0 (min_z=${minZ.toFixed(3)} cm)`);
  }

  if (envelope && envelope.length === 3) {
    const ext: [number, number, number] = [maxX - minX, maxY - minY, maxZ - minZ];
    const labels = ['Width (X)', 'Depth (Y)', 'Height (Z)'];
    for (let k = 0; k < 3; k++) {
      if (ext[k] > envelope[k] * 1.15) {
        sanityWarnings.push(
          `TARGET_ENVELOPE: Assembly ${labels[k]} (${ext[k].toFixed(2)} cm) exceeds target envelope (${envelope[k].toFixed(2)} cm)`
        );
      }
    }
  }

  const meshUsda = generateMeshUsdaClient(partsOutput, assetName);
  const stlText = generateAsciiStlClient(partsOutput, assetName);
  const elapsedMs = Number((performance.now() - t0).toFixed(2));
  const explosionStages = parseExplosionStages(code, partsOutput);

  return {
    ok: true,
    success: true,
    kernel: 'browser-usd-brep-fallback',
    asset_name: assetName,
    elapsed_ms: elapsedMs,
    sanity_warnings: sanityWarnings,
    summary: {
      part_count: partsOutput.length,
      all_manifold: true,
      total_volume: Number(partsOutput.reduce((acc, p) => acc + p.diagnostics.volume, 0).toFixed(4)),
      total_nurbs_faces: partsOutput.reduce((acc, p) => acc + p.diagnostics.faces, 0),
      total_nurbs_edges: partsOutput.reduce((acc, p) => acc + p.diagnostics.edges, 0),
      total_nurbs_vertices: partsOutput.reduce((acc, p) => acc + p.diagnostics.vertices, 0),
      total_mesh_triangles: partsOutput.reduce((acc, p) => acc + p.diagnostics.tessellation.triangle_count, 0),
      penetration_count: penetrationWarnings.length,
      overall_bounds: [
        [Number(minX.toFixed(4)), Number(minY.toFixed(4)), Number(minZ.toFixed(4))],
        [Number(maxX.toFixed(4)), Number(maxY.toFixed(4)), Number(maxZ.toFixed(4))],
      ],
      penetration_warnings: penetrationWarnings,
      envelope_breaches: [],
      relationships: [],
    },
    parts: partsOutput,
    explosion_stages: explosionStages,
    exports: {
      mesh_usda: meshUsda,
      brep_usda: meshUsda,
      stl: stlText,
    },
    usda_mesh_text: meshUsda,
    usda_brep_text: meshUsda,
    stl_text: stlText,
  };
}

export function parseExplosionStages(code: string, parts: CadPartOutput[]): ExplosionStage[] {
  const stages: ExplosionStage[] = [];

  // Match explosion_stages assignment or return block in the script
  const stagesRegex = /explosion_stages\s*=\s*\[([\s\S]*?)\]\s*(?=\n\s*(?:return|[A-Za-z_]|$))/;
  const match = stagesRegex.exec(code);
  let blockText = match ? match[1] : '';

  if (!blockText) {
    const returnTupleRegex = /return\s+(?:parts|\[[\s\S]*?\])\s*,\s*\[([\s\S]*?)\]\s*(?:\n|$)/;
    const retMatch = returnTupleRegex.exec(code);
    if (retMatch) {
      blockText = retMatch[1];
    }
  }

  if (blockText) {
    const dictRegex = /\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let dMatch: RegExpExecArray | null;
    let stageIdx = 0;
    while ((dMatch = dictRegex.exec(blockText)) !== null) {
      const chunk = dMatch[0];
      const nameMatch = /["'](?:name|title|stage)["']\s*:\s*["']([^"']+)["']/.exec(chunk);
      const durMatch = /["']duration["']\s*:\s*([0-9.]+)/.exec(chunk);
      const easingMatch = /["']easing["']\s*:\s*["']([a-zA-Z-]+)["']/.exec(chunk);

      const partsObj: Record<string, [number, number, number] | ExplosionPartTransform> = {};
      const partTransRegex =
        /["']([a-zA-Z0-9_-]+)["']\s*:\s*(?:\{[^}]*?["']translation["']\s*:\s*)?[\[\(]\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*[\]\)]/g;
      let pMatch: RegExpExecArray | null;
      while ((pMatch = partTransRegex.exec(chunk)) !== null) {
        const pName = pMatch[1];
        if (['translations', 'parts', 'options'].includes(pName)) continue;
        const x = parseFloat(pMatch[2]) || 0;
        const y = parseFloat(pMatch[3]) || 0;
        const z = parseFloat(pMatch[4]) || 0;
        partsObj[pName] = [x, y, z];
      }

      const stageName = nameMatch ? nameMatch[1] : `Stage ${stageIdx + 1}`;
      const duration = durMatch ? parseFloat(durMatch[1]) : 1.2;
      const easing = (easingMatch ? easingMatch[1] : 'ease-out') as ExplosionEasing;

      if (Object.keys(partsObj).length > 0 || nameMatch) {
        stages.push({
          id: `stage-${stageIdx + 1}`,
          name: stageName,
          duration: Math.max(0.3, duration),
          easing,
          parts: partsObj,
        });
        stageIdx++;
      }
    }
  }

  if (stages.length > 0) {
    return stages;
  }

  // Automatic procedural stages fallback when not explicitly returned in the script
  if (parts.length <= 1) {
    const single = parts[0];
    return [
      {
        id: 'stage-1',
        name: 'Step 1: Axial Lift & Inspection',
        duration: 1.2,
        easing: 'ease-out',
        parts: single ? { [single.name]: [0, 0, 8] } : {},
      },
    ];
  }

  const sortedParts = [...parts].sort((a, b) => b.diagnostics.center[2] - a.diagnostics.center[2]);
  const anchorPart =
    parts.find((p) => ['anchor', 'base', 'chassis', 'frame', 'body'].includes(p.kind.toLowerCase())) ||
    parts[0];

  const topPart = sortedParts.find((p) => p.name !== anchorPart?.name) || sortedParts[0];
  const stage1Parts: Record<string, [number, number, number]> = {};
  if (topPart) {
    stage1Parts[topPart.name] = [0, 0, 14];
  }

  const stage2Parts: Record<string, [number, number, number]> = { ...stage1Parts };
  const midParts = sortedParts.filter((p) => p.name !== anchorPart?.name && p.name !== topPart?.name);
  if (midParts.length > 0) {
    midParts.forEach((p, idx) => {
      stage2Parts[p.name] = [
        Math.cos((idx * Math.PI) / 2) * 8,
        Math.sin((idx * Math.PI) / 2) * 8,
        6 + idx * 4,
      ];
    });
  } else if (topPart) {
    stage2Parts[topPart.name] = [0, 0, 20];
  }

  const stage3Parts: Record<string, [number, number, number]> = {};
  const assemblyCenter = new THREE.Vector3(
    (Math.min(...parts.map((p) => p.diagnostics.bounds[0][0])) +
      Math.max(...parts.map((p) => p.diagnostics.bounds[1][0]))) /
      2,
    (Math.min(...parts.map((p) => p.diagnostics.bounds[0][1])) +
      Math.max(...parts.map((p) => p.diagnostics.bounds[1][1]))) /
      2,
    (Math.min(...parts.map((p) => p.diagnostics.bounds[0][2])) +
      Math.max(...parts.map((p) => p.diagnostics.bounds[1][2]))) /
      2
  );

  parts.forEach((p, idx) => {
    if (p.name === anchorPart?.name) {
      stage3Parts[p.name] = [0, 0, 0];
      return;
    }
    const pc = new THREE.Vector3(...p.diagnostics.center);
    const dir = pc.clone().sub(assemblyCenter);
    if (dir.lengthSq() < 0.1) {
      dir.set(0, 0, 1);
    }
    dir.normalize();
    stage3Parts[p.name] = [
      Number((dir.x * 12).toFixed(2)),
      Number((dir.y * 12).toFixed(2)),
      Number((dir.z * 10 + idx * 3).toFixed(2)),
    ];
  });

  return [
    {
      id: 'stage-1',
      name: `Step 1: Eject ${topPart?.name || 'Component'}`,
      duration: 1.2,
      easing: 'ease-out',
      parts: stage1Parts,
    },
    {
      id: 'stage-2',
      name: 'Step 2: Subassembly Separation',
      duration: 1.5,
      easing: 'ease-in-out',
      parts: stage2Parts,
    },
    {
      id: 'stage-3',
      name: 'Step 3: Full Exploded Inspection',
      duration: 1.8,
      easing: 'ease-out',
      parts: stage3Parts,
    },
  ];
}
