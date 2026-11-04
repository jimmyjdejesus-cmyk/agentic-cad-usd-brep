import { describe, expect, it } from 'vitest';
import { CadPartOutput } from '../types/cad';
import { evaluateClientSideUsdBrep } from './cadRuntime';
import {
  sliceMeshAtZ,
  stitchSegmentsIntoLoops,
  generateDxfProfile,
  generateCncGcode,
  calculate3dPrintPreflight,
  offsetPolyline,
  analyzeOverhangs,
  generateSlicerLayers,
  buildSimulatedToolpath,
  validateAssemblyDfm,
  extractMultiZFeatures,
} from './camService';

describe('CAM & CNC Toolpath Generator Service', () => {
  // Mock box part: 10cm x 10cm x 4cm (100mm x 100mm x 40mm)
  const mockBoxPart: CadPartOutput = {
    name: 'milled_base_plate',
    kind: 'anchor',
    color: [0.3, 0.5, 0.8],
    diagnostics: {
      faces: 6,
      edges: 12,
      vertices: 8,
      manifold: true,
      volume: 400.0, // 400 cm3
      area: 360.0,
      solid_count: 1,
      void_count: 0,
      bounds: [
        [-5.0, -5.0, 0.0],
        [5.0, 5.0, 4.0],
      ],
      center: [0.0, 0.0, 2.0],
      tessellation: {
        vertex_count: 8,
        triangle_count: 12,
        output_manifold: true,
        lamina_edge_count: 0,
        failure_count: 0,
      },
    },
    mesh: {
      points: [
        [-5.0, -5.0, 0.0],
        [5.0, -5.0, 0.0],
        [5.0, 5.0, 0.0],
        [-5.0, 5.0, 0.0],
        [-5.0, -5.0, 4.0],
        [5.0, -5.0, 4.0],
        [5.0, 5.0, 4.0],
        [-5.0, 5.0, 4.0],
      ],
      normals: [
        [0, 0, -1],
        [0, 0, 1],
      ],
      triangles: [
        // Bottom face (Z=0)
        0, 1, 2, 0, 2, 3,
        // Top face (Z=4)
        4, 6, 5, 4, 7, 6,
        // Front face (Y=-5)
        0, 5, 1, 0, 4, 5,
        // Right face (X=5)
        1, 6, 2, 1, 5, 6,
        // Back face (Y=5)
        2, 7, 3, 2, 6, 7,
        // Left face (X=-5)
        3, 4, 0, 3, 7, 4,
      ],
      face_vertex_counts: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      face_vertex_indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
  };

  describe('Mesh Planar Slicing & Loop Stitching', () => {
    it('slices mesh at Z=20mm and produces intersecting line segments', () => {
      const segments = sliceMeshAtZ(mockBoxPart, 20.0);
      expect(segments.length).toBeGreaterThanOrEqual(4);
    });

    it('stitches planar segments into closed 2D loops', () => {
      const segments = sliceMeshAtZ(mockBoxPart, 20.0);
      const loops = stitchSegmentsIntoLoops(segments);
      expect(loops.length).toBeGreaterThanOrEqual(1);
      expect(loops[0].length).toBeGreaterThanOrEqual(3);
    });

    it('calculates outward parallel polygon offset for tool radius compensation', () => {
      const square = [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 },
      ];
      const offset = offsetPolyline(square, 1.5875); // 1/8" endmill radius
      expect(offset.length).toBe(4);
      // Corners should expand outward
      expect(offset[1].x).toBeGreaterThan(50);
      expect(offset[2].y).toBeGreaterThan(50);
    });
  });

  describe('2D DXF Export Generator', () => {
    it('generates valid AutoCAD R12 ASCII DXF header, tables, and entities', () => {
      const dxf = generateDxfProfile(mockBoxPart, 10.0);
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('HEADER');
      expect(dxf).toContain('$ACADVER');
      expect(dxf).toContain('AC1009'); // AutoCAD Release 12
      expect(dxf).toContain('$INSUNITS');
      expect(dxf).toContain('ENTITIES');
      expect(dxf).toContain('POLYLINE');
      expect(dxf).toContain('VERTEX');
      expect(dxf).toContain('SEQEND');
      expect(dxf).toContain('EOF');
    });

    it('sets metric millimeter units in DXF header', () => {
      const dxf = generateDxfProfile(mockBoxPart, 5.0);
      expect(dxf).toContain('70\n4'); // 4 = Millimeters
    });
  });

  describe('CNC G-Code Toolpath Generator', () => {
    it('generates standard metric G-code with spindle commands and multi-pass stepdowns', () => {
      const gcode = generateCncGcode(mockBoxPart, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 18000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
        addHoldingTabs: false,
      });

      // Verify essential CNC G-code instructions
      expect(gcode).toContain('G21 ; Units: Millimeters');
      expect(gcode).toContain('G90 ; Absolute Positioning');
      expect(gcode).toContain('G17 ; XY Work Plane');
      expect(gcode).toContain('M03 S18000 ; Spindle ON Clockwise');
      expect(gcode).toContain('G00 Z5.000'); // Safe retract height
      expect(gcode).toContain('F1200');      // Cutting feedrate
      expect(gcode).toContain('F300');       // Plunge feedrate
      expect(gcode).toContain('M05 ; Spindle Stop');
      expect(gcode).toContain('M30 ; Program End');
    });

    it('injects holding tabs on final depth pass to prevent part ejection', () => {
      const gcodeWithTabs = generateCncGcode(mockBoxPart, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1000,
        plungeRateMmMin: 250,
        spindleRpm: 15000,
        stepDownMm: 20.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
        addHoldingTabs: true,
        tabCount: 4,
        tabHeightMm: 1.5,
        stockThicknessMm: 20.0,
      });

      expect(gcodeWithTabs).toContain('; [Holding Tab]');
    });

    it('supports Haas industrial dialect with tool change M06', () => {
      const haasGcode = generateCncGcode(mockBoxPart, {
        machineDialect: 'haas',
        toolDiameterMm: 6.35,
        toolType: 'flat_endmill',
        feedRateMmMin: 1500,
        plungeRateMmMin: 400,
        spindleRpm: 12000,
        stepDownMm: 5.0,
        safeZMm: 10.0,
        cutOperation: 'outside_contour',
      });

      expect(haasGcode).toContain('T1 M06 ; Tool Change');
      expect(haasGcode).toContain('G54 ; Work Coordinate System');
    });
  });

  describe('3D Printing Preflight Inspection', () => {
    it('evaluates bounding dimensions, filament weight, and bed contact', () => {
      const preflight = calculate3dPrintPreflight(mockBoxPart);

      expect(preflight.isWatertight).toBe(true);
      expect(preflight.boundingBoxMm.width).toBeCloseTo(100.0, 0);
      expect(preflight.boundingBoxMm.depth).toBeCloseTo(100.0, 0);
      expect(preflight.boundingBoxMm.height).toBeCloseTo(40.0, 0);
      expect(preflight.volumeCm3).toBe(400.0);

      // Mass should be calculated for PLA, PETG, ABS, TPU
      expect(preflight.estimatedMassG.PLA).toBeGreaterThan(100);
      expect(preflight.estimatedMassG.PETG).toBeGreaterThan(100);
      expect(preflight.estimatedMassG.ABS).toBeGreaterThan(80);

      // Bed contact and temperature presets
      expect(preflight.recommendedBedTempC).toBe(60);
      expect(preflight.recommendedNozzleTempC).toBe(215);
      expect(preflight.adhesionRisk).toBeDefined();
      expect(preflight.overhangAnalysis).toBeDefined();
    });

    it('analyzes overhang angles and generates recommendations', () => {
      const analysis = analyzeOverhangs(mockBoxPart, 45);

      expect(analysis).toBeDefined();
      expect(analysis.totalFacetCount).toBe(12);
      expect(analysis.status).toBeDefined();
      expect(analysis.recommendation).toBeDefined();
    });

    it('generates continuous slicer layers with infill and perimeters', () => {
      const layers = generateSlicerLayers(mockBoxPart, 2.0, 20);

      expect(layers.length).toBeGreaterThan(0);
      const firstLayer = layers[0];
      expect(firstLayer.zMm).toBeGreaterThan(0);
      expect(firstLayer.layerHeightMm).toBe(2.0);
      expect(firstLayer.estimatedTimeSeconds).toBeGreaterThan(0);
    });
  });

  describe('3D CNC Toolpath Simulation & Motion Path Builder', () => {
    it('builds simulated toolpath motion steps with feeds, speeds, and bounds', () => {
      const sim = buildSimulatedToolpath(mockBoxPart, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 10.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
      });

      expect(sim.steps.length).toBeGreaterThanOrEqual(5);
      expect(sim.totalDistanceMm).toBeGreaterThan(0);
      expect(sim.estimatedTimeSeconds).toBeGreaterThan(0);
      expect(sim.boundsMm.minZ).toBeLessThan(0); // Cuts below Z=0
      expect(sim.boundsMm.maxZ).toBeGreaterThanOrEqual(5.0); // Retracts to safe Z
    });
  });

  describe('Multi-Z Feature Extraction for Stepped Pockets & Counterbores (ISS-501)', () => {
    it('slicing a part with a 5 mm deep blind pocket and a 10 mm deep outer profile generates distinct Z-depth toolpath stages', async () => {
      // Synthesize a real 20x20x10 mm block with a 10x10x5 mm blind pocket in the top face
      const code = `import usd_brep as sm
def build_parts():
    # 2.0 x 2.0 x 1.0 cm block = 20 x 20 x 10 mm
    block = sm.create_box((-1.0, -1.0, 0.0), 2.0, 2.0, 1.0)
    # 1.0 x 1.0 x 0.5 cm pocket starting at z = 0.5 cm = 5 mm deep blind pocket
    pocket = sm.create_box((-0.5, -0.5, 0.5), 1.0, 1.0, 0.6)
    part = sm.boolean_difference(block, pocket)
    return [("stepped_pocket_block", part, (0.3, 0.6, 0.9), "anchor")]
`;
      const res = await evaluateClientSideUsdBrep(code, 'SteppedBlockTest');
      expect(res.success).toBe(true);
      const part = res.parts![0];
      expect(part).toBeDefined();

      // 1. Inside Pocketing Multi-Z Stages
      const pocketStages = extractMultiZFeatures(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'inside_pocket',
      });

      expect(pocketStages.length).toBeGreaterThanOrEqual(1);
      const blindPocketStage = pocketStages[0];
      expect(blindPocketStage.isInternal).toBe(true);
      expect(blindPocketStage.targetDepthMm).toBeCloseTo(5.0, 1); // 5 mm blind pocket depth
      expect(blindPocketStage.featureName).toContain('Blind Pocket');
      expect(blindPocketStage.sliceZMm).toBeGreaterThanOrEqual(5.0);
      expect(blindPocketStage.sliceZMm).toBeLessThanOrEqual(10.0);

      // 2. Outside Contour Multi-Z Stages
      const contourStages = extractMultiZFeatures(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
      });

      expect(contourStages.length).toBeGreaterThanOrEqual(1);
      const outerStage = contourStages[0];
      expect(outerStage.isInternal).toBe(false);
      expect(outerStage.targetDepthMm).toBeCloseTo(10.0, 1); // 10 mm outer profile through-depth

      // 3. Generated G-code validates distinct target depths
      const pocketGcode = generateCncGcode(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'inside_pocket',
      });

      expect(pocketGcode).toContain('Target Depth: 5.00 mm');
      expect(pocketGcode).toContain('G01 Z-5.000');
      // Pocket operation must never plunge deeper than the pocket floor (-5.0 mm)
      expect(pocketGcode).not.toContain('Z-10.000');

      const contourGcode = generateCncGcode(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
      });

      expect(contourGcode).toContain('Target Depth: 10.00 mm');
      expect(contourGcode).toContain('G01 Z-10.000');
    });

    it('3D toolpath simulator accurately renders multi-depth stepdowns', async () => {
      const code = `import usd_brep as sm
def build_parts():
    block = sm.create_box((-1.0, -1.0, 0.0), 2.0, 2.0, 1.0)
    pocket = sm.create_box((-0.5, -0.5, 0.5), 1.0, 1.0, 0.6)
    part = sm.boolean_difference(block, pocket)
    return [("stepped_pocket_block", part, (0.3, 0.6, 0.9), "anchor")]
`;
      const res = await evaluateClientSideUsdBrep(code, 'SimSteppedBlockTest');
      expect(res.success).toBe(true);
      const part = res.parts![0];

      // Pocket toolpath simulation stops at -5.0 mm
      const pocketSim = buildSimulatedToolpath(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'inside_pocket',
      });

      expect(pocketSim.steps.length).toBeGreaterThanOrEqual(10);
      expect(pocketSim.boundsMm.minZ).toBeCloseTo(-5.0, 1);
      expect(pocketSim.boundsMm.maxZ).toBeGreaterThanOrEqual(5.0); // Safe Z

      // Outside contour toolpath simulation plunges full depth to -10.0 mm
      const contourSim = buildSimulatedToolpath(part, {
        machineDialect: 'grbl',
        toolDiameterMm: 3.175,
        toolType: 'flat_endmill',
        feedRateMmMin: 1200,
        plungeRateMmMin: 300,
        spindleRpm: 16000,
        stepDownMm: 2.0,
        safeZMm: 5.0,
        cutOperation: 'outside_contour',
      });

      expect(contourSim.boundsMm.minZ).toBeCloseTo(-10.0, 1);
      expect(contourSim.boundsMm.maxZ).toBeGreaterThanOrEqual(5.0);
    });
  });

  describe('Automated 3D Print & CNC DFM Validator', () => {
    it('flags minimum wall thickness violations below 1.2 mm', () => {
      const thinPart: CadPartOutput = {
        name: 'thin_shell',
        kind: 'component',
        color: [0.5, 0.5, 0.5],
        diagnostics: {
          faces: 6,
          edges: 12,
          vertices: 8,
          manifold: true,
          volume: 0.05,
          area: 20.0,
          solid_count: 1,
          void_count: 0,
          bounds: [
            [0, 0, 0],
            [10, 10, 0.08], // 0.08 cm = 0.8 mm (< 1.2 mm threshold)
          ],
          center: [5, 5, 0.04],
          tessellation: { vertex_count: 8, triangle_count: 12, output_manifold: true, lamina_edge_count: 0, failure_count: 0 },
        },
        mesh: { points: [], normals: [], triangles: [], face_vertex_counts: [], face_vertex_indices: [] },
      };

      const result = validateAssemblyDfm([thinPart]);
      expect(result.passed).toBe(false);
      expect(result.warnings.some((w) => w.includes('DFM_WALL_THICKNESS'))).toBe(true);
      expect(result.diagnostics.some((d) => d.rule === 'wall_thickness')).toBe(true);
    });

    it('flags mating clearance violations below 0.25 mm', () => {
      const partA: CadPartOutput = {
        name: 'base',
        kind: 'anchor',
        color: [0.3, 0.3, 0.3],
        diagnostics: {
          faces: 6,
          edges: 12,
          vertices: 8,
          manifold: true,
          volume: 100,
          area: 160,
          solid_count: 1,
          void_count: 0,
          bounds: [[0, 0, 0], [10, 10, 4.0]],
          center: [5, 5, 2],
          tessellation: { vertex_count: 8, triangle_count: 12, output_manifold: true, lamina_edge_count: 0, failure_count: 0 },
        },
        mesh: { points: [], normals: [], triangles: [], face_vertex_counts: [], face_vertex_indices: [] },
      };

      const partB: CadPartOutput = {
        name: 'shaft',
        kind: 'component',
        color: [0.8, 0.5, 0.2],
        diagnostics: {
          faces: 6,
          edges: 12,
          vertices: 8,
          manifold: true,
          volume: 50,
          area: 90,
          solid_count: 1,
          void_count: 0,
          bounds: [[2, 2, 4.01], [8, 8, 12]], // gap Z = 0.01 cm = 0.1 mm (< 0.25 mm threshold)
          center: [5, 5, 8],
          tessellation: { vertex_count: 8, triangle_count: 12, output_manifold: true, lamina_edge_count: 0, failure_count: 0 },
        },
        mesh: { points: [], normals: [], triangles: [], face_vertex_counts: [], face_vertex_indices: [] },
      };

      const result = validateAssemblyDfm([partA, partB]);
      expect(result.passed).toBe(false);
      expect(result.warnings.some((w) => w.includes('DFM_MATING_CLEARANCE'))).toBe(true);
      expect(result.diagnostics.some((d) => d.rule === 'mating_clearance')).toBe(true);
    });

    it('flags CNC sharp pocket corners without tool radius relief', () => {
      const cncCode = `
import usd_brep as sm
def build_parts():
    stock = sm.create_box((-10, -10, 0), 20, 20, 5)
    cutter = sm.create_box((-5, -5, 2), 10, 10, 4)
    stock = sm.boolean_difference(stock, cutter)
    return [("stock", stock, (0.5, 0.5, 0.5), "anchor")]
`;
      const result = validateAssemblyDfm([mockBoxPart], cncCode);
      expect(result.warnings.some((w) => w.includes('DFM_CNC_CORNER_RADIUS'))).toBe(true);
      expect(result.diagnostics.some((d) => d.rule === 'cnc_internal_radius')).toBe(true);
    });

    it('passes DFM validation for compliant designs with sufficient wall, clearance, and tool radius', () => {
      const compliantCode = `
import usd_brep as sm
def build_parts():
    stock = sm.create_box((-10, -10, 0), 20, 20, 5)
    cutter = sm.create_box((-5, -5, 2), 10, 10, 4)
    sm.fillet_edges(cutter, cutter.edges(), radius=0.2)
    stock = sm.boolean_difference(stock, cutter)
    return [("stock", stock, (0.5, 0.5, 0.5), "anchor")]
`;
      const result = validateAssemblyDfm([mockBoxPart], compliantCode);
      expect(result.warnings.filter((w) => w.includes('DFM_CNC_CORNER_RADIUS'))).toHaveLength(0);
    });
  });
});

