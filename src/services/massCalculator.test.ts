import { describe, expect, it } from 'vitest';
import { calculateAssemblyMassProperties, MATERIAL_PRESETS } from './massCalculator';
import { CadPartOutput } from '../types/cad';

describe('Mass & Bounding Box Calculator', () => {
  const dummyParts: CadPartOutput[] = [
    {
      name: 'base_plate',
      kind: 'anchor',
      color: [0.3, 0.6, 0.9],
      diagnostics: {
        faces: 6,
        edges: 12,
        vertices: 8,
        manifold: true,
        volume: 100.0,
        area: 160.0,
        solid_count: 1,
        void_count: 0,
        bounds: [[-5, -5, 0], [5, 5, 4]],
        center: [0, 0, 2],
        tessellation: {
          vertex_count: 8,
          triangle_count: 12,
          output_manifold: true,
          lamina_edge_count: 0,
          failure_count: 0,
        },
      },
      mesh: {
        points: [[0, 0, 0]],
        normals: [[0, 0, 1]],
        triangles: [0, 0, 0],
        face_vertex_counts: [3],
        face_vertex_indices: [0, 0, 0],
      },
    },
    {
      name: 'top_cylinder',
      kind: 'component',
      color: [0.9, 0.4, 0.2],
      diagnostics: {
        faces: 3,
        edges: 3,
        vertices: 2,
        manifold: true,
        volume: 50.0,
        area: 90.0,
        solid_count: 1,
        void_count: 0,
        bounds: [[-2, -2, 4], [2, 2, 10]],
        center: [0, 0, 7],
        tessellation: {
          vertex_count: 64,
          triangle_count: 64,
          output_manifold: true,
          lamina_edge_count: 0,
          failure_count: 0,
        },
      },
      mesh: {
        points: [[0, 0, 4]],
        normals: [[0, 0, 1]],
        triangles: [0, 0, 0],
        face_vertex_counts: [3],
        face_vertex_indices: [0, 0, 0],
      },
    },
  ];

  it('calculates accurate mass assuming default aluminum density (2.70 g/cm³)', () => {
    const res = calculateAssemblyMassProperties(dummyParts, MATERIAL_PRESETS[0]);
    expect(res.totalVolumeCm3).toBe(150.0);
    // 150 cm³ * 2.70 g/cm³ = 405 g
    expect(res.totalMassGrams).toBe(405.0);
    expect(res.totalMassKg).toBe(0.405);
    expect(res.density).toBe(2.70);
  });

  it('calculates volume-weighted center of mass along Z axis', () => {
    const res = calculateAssemblyMassProperties(dummyParts, MATERIAL_PRESETS[0]);
    expect(res.centerOfMass[0]).toBe(0);
    expect(res.centerOfMass[1]).toBe(0);
    expect(res.centerOfMass[2]).toBeCloseTo(3.667, 2);
  });

  it('computes overall bounding box dimensions and volume', () => {
    const res = calculateAssemblyMassProperties(dummyParts, MATERIAL_PRESETS[0]);
    expect(res.boundingBox.min).toEqual([-5, -5, 0]);
    expect(res.boundingBox.max).toEqual([5, 5, 10]);
    expect(res.boundingBox.dimensions).toEqual([10, 10, 10]);
    expect(res.boundingBox.volumeCm3).toBe(1000.0);
  });

  it('contains verified constants for Aluminum, Steel, Titanium, and ABS', () => {
    const al = MATERIAL_PRESETS.find((m) => m.id === 'al_6061');
    const steel = MATERIAL_PRESETS.find((m) => m.id === 'steel_1018');
    const ti = MATERIAL_PRESETS.find((m) => m.id === 'titanium_gr5');
    const abs = MATERIAL_PRESETS.find((m) => m.id === 'abs_plastic');

    expect(al).toBeDefined();
    expect(al?.density).toBe(2.70);

    expect(steel).toBeDefined();
    expect(steel?.density).toBe(7.85);

    expect(ti).toBeDefined();
    expect(ti?.density).toBe(4.43);

    expect(abs).toBeDefined();
    expect(abs?.density).toBe(1.04);
  });

  it('dynamically recalculates mass when changing from Aluminum to Titanium, Steel, and ABS', () => {
    const ti = MATERIAL_PRESETS.find((m) => m.id === 'titanium_gr5')!;
    const steel = MATERIAL_PRESETS.find((m) => m.id === 'steel_1018')!;
    const abs = MATERIAL_PRESETS.find((m) => m.id === 'abs_plastic')!;

    // 150 cm³ * 4.43 g/cm³ = 664.5 g
    const tiRes = calculateAssemblyMassProperties(dummyParts, ti);
    expect(tiRes.totalMassGrams).toBe(664.5);

    // 150 cm³ * 7.85 g/cm³ = 1177.5 g
    const steelRes = calculateAssemblyMassProperties(dummyParts, steel);
    expect(steelRes.totalMassGrams).toBe(1177.5);

    // 150 cm³ * 1.04 g/cm³ = 156.0 g
    const absRes = calculateAssemblyMassProperties(dummyParts, abs);
    expect(absRes.totalMassGrams).toBe(156.0);
  });

  it('supports custom density overrides', () => {
    const res = calculateAssemblyMassProperties(dummyParts, MATERIAL_PRESETS[0], 5.50);
    expect(res.density).toBe(5.50);
    // 150 * 5.50 = 825.0 g
    expect(res.totalMassGrams).toBe(825.0);
  });
});
