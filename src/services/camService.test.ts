import { describe, expect, it } from 'vitest';
import { CadPartOutput } from '../types/cad';
import {
  sliceMeshAtZ,
  stitchSegmentsIntoLoops,
  generateDxfProfile,
  generateCncGcode,
  calculate3dPrintPreflight,
  offsetPolyline,
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
    });
  });
});
