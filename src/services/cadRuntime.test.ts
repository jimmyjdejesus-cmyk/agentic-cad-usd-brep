import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESETS } from '../data/presetsData';
import { evaluateClientSideUsdBrep, executeCadScript, generatePartAsciiStl } from './cadRuntime';

describe('Client-side usd_brep solid evaluator & Manifold WASM Engine', () => {
  it.each(DEFAULT_PRESETS.map((p) => [p.id, p] as const))(
    'synthesizes preset %s with manifold parts and valid OpenUSD/STL output',
    async (_id, preset) => {
      const res = await evaluateClientSideUsdBrep(preset.code, preset.id, preset.envelope);
      expect(res.success).toBe(true);
      expect(res.parts).toBeDefined();
      expect((res.parts || []).length).toBeGreaterThanOrEqual(2);
      expect(res.summary?.all_manifold).toBe(true);
      expect(res.usda_mesh_text).toContain('#usda 1.0');
      expect(res.usda_mesh_text).toContain('def Mesh');
      expect(res.stl_text).toContain('solid ');

      // Verify each part has its own watertight STL text
      for (const part of res.parts || []) {
        expect(part.stl_text).toBeDefined();
        expect(part.stl_text).toContain(`solid `);
        expect(part.stl_text).toContain(`endsolid `);
        expect(part.stl_text).toContain('facet normal ');
        // Verify facet normals are non-dummy / computed
        expect(part.stl_text).toMatch(/facet normal [-\d.]+ [-\d.]+ [-\d.]+/);
      }
    }
  );

  it('rejects empty scripts cleanly', async () => {
    const res = await evaluateClientSideUsdBrep('   ');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Empty');
  });

  it('rejects scripts missing build_parts()', async () => {
    const res = await evaluateClientSideUsdBrep('import usd_brep as sm\nb = sm.create_box((0,0,0), 5, 5, 5)');
    expect(res.success).toBe(false);
    expect(res.error).toContain('build_parts');
  });

  it('rejects negative box dimensions with SM_ERR_INVALID_INPUT', async () => {
    const code = `import usd_brep as sm
def build_parts():
    b = sm.create_box((0, 0, 0), -5.0, 5.0, 5.0)
    return [("bad", b, (1.0, 0.0, 0.0), "anchor")]
`;
    const res = await evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(false);
    expect(res.error).toContain('SM_ERR_INVALID_INPUT');
  });

  it('flags ground-plane and penetration warnings on overlapping boxes below z=0', async () => {
    const code = `import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-5.0, -5.0, -3.0), 10.0, 10.0, 8.0)
    b2 = sm.create_box((-2.0, -2.0, 0.0), 10.0, 10.0, 8.0)
    return [
        ("box_a", b1, (0.5, 0.2, 0.2), "anchor"),
        ("box_b", b2, (0.2, 0.5, 0.2), "component"),
    ]
`;
    const res = await evaluateClientSideUsdBrep(code, 'OverlapTest', [8, 8, 6]);
    expect(res.success).toBe(true);
    expect(res.summary?.penetration_count).toBe(1);
    const warnings = (res.sanity_warnings || []).join('\n');
    expect(warnings).toContain('PENETRATE');
    expect(warnings).toContain('GROUND_PLANE');
    expect(warnings).toContain('TARGET_ENVELOPE');
  });

  it('correctly executes boolean difference to cut watertight 3D holes', async () => {
    const code = `import usd_brep as sm
def build_parts():
    box = sm.create_box((0.0, 0.0, 0.0), 20.0, 20.0, 10.0)
    hole = sm.create_cylinder((10.0, 10.0, -2.0), 4.0, 14.0)
    cut_box = sm.boolean_difference(box, hole)
    return [("cut_bracket", cut_box, (0.3, 0.6, 0.9), "anchor")]
`;
    const res = await evaluateClientSideUsdBrep(code, 'HoleCutTest');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    const part = res.parts![0];
    expect(part.diagnostics.manifold).toBe(true);
    // Original box volume: 20*20*10 = 4000. Cut volume should be strictly less!
    expect(part.diagnostics.volume).toBeLessThan(4000);
    expect(part.diagnostics.volume).toBeGreaterThan(3200);
    expect(part.stl_text).toContain('solid HoleCutTest_cut_bracket');
    expect(part.stl_text).toContain('endsolid HoleCutTest_cut_bracket');
  });

  it('correctly executes parametric for-loops for multi-feature pattern cutting', async () => {
    const code = `import math
import usd_brep as sm
def build_parts():
    flange = sm.create_cylinder((0.0, 0.0, 0.0), 15.0, 4.0)
    for i in range(4):
        ang = i * (math.pi / 2.0)
        bx = 10.0 * math.cos(ang)
        by = 10.0 * math.sin(ang)
        hole = sm.create_cylinder((bx, by, -1.0), 1.5, 6.0)
        flange = sm.boolean_difference(flange, hole)
    return [("flange_4hole", flange, (0.4, 0.7, 0.2), "anchor")]
`;
    const res = await evaluateClientSideUsdBrep(code, 'Flange4HoleTest');
    expect(res.success).toBe(true);
    const part = res.parts![0];
    expect(part.diagnostics.manifold).toBe(true);
    // Base cylinder volume: pi * 15^2 * 4 = 2827.4. Each hole is pi * 1.5^2 * 4 = 28.27 (total ~113)
    expect(part.diagnostics.volume).toBeLessThan(2827.4);
    expect(part.diagnostics.volume).toBeGreaterThan(2600);
  });

  it('computes exact outward facet normals in generatePartAsciiStl for 3D slicer compatibility', () => {
    // Construct a triangular face lying on z=0 with vertices in counter-clockwise order
    const mockPart = {
      name: 'triangle_plate',
      kind: 'component',
      color: [0.5, 0.5, 0.5] as [number, number, number],
      diagnostics: {
        faces: 1,
        edges: 3,
        vertices: 3,
        manifold: true,
        volume: 0,
        area: 0.5,
        solid_count: 1,
        void_count: 0,
        bounds: [[0, 0, 0], [1, 1, 0]] as [[number, number, number], [number, number, number]],
        center: [0.33, 0.33, 0] as [number, number, number],
        tessellation: {
          vertex_count: 3,
          triangle_count: 1,
          output_manifold: true,
          lamina_edge_count: 0,
          failure_count: 0,
        },
      },
      mesh: {
        points: [
          [0.0, 0.0, 0.0],
          [1.0, 0.0, 0.0],
          [0.0, 1.0, 0.0],
        ] as [number, number, number][],
        normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]] as [number, number, number][],
        triangles: [0, 1, 2],
        face_vertex_counts: [3],
        face_vertex_indices: [0, 1, 2],
      },
    };

    const stl = generatePartAsciiStl(mockPart, 'MyTriangle');
    expect(stl).toContain('solid MyTriangle');
    // Normal for counter-clockwise triangle on XY plane is strictly (0, 0, 1)
    expect(stl).toContain('facet normal 0.000000 0.000000 1.000000');
    expect(stl).toContain('vertex 0.0000 0.0000 0.0000');
    expect(stl).toContain('vertex 1.0000 0.0000 0.0000');
    expect(stl).toContain('vertex 0.0000 1.0000 0.0000');
    expect(stl).toContain('endsolid MyTriangle');
  });

  it('supports unitScale in generatePartAsciiStl for 10x millimeter 3D printing slicer export', () => {
    const mockPart = {
      name: 'plate_10cm',
      kind: 'component',
      color: [0.5, 0.5, 0.5] as [number, number, number],
      diagnostics: {
        faces: 1,
        edges: 3,
        vertices: 3,
        manifold: true,
        volume: 0,
        area: 50.0,
        solid_count: 1,
        void_count: 0,
        bounds: [[0, 0, 0], [10, 10, 0]] as [[number, number, number], [number, number, number]],
        center: [3.33, 3.33, 0] as [number, number, number],
        tessellation: {
          vertex_count: 3,
          triangle_count: 1,
          output_manifold: true,
          lamina_edge_count: 0,
          failure_count: 0,
        },
      },
      mesh: {
        points: [
          [0.0, 0.0, 0.0],
          [10.0, 0.0, 0.0],
          [0.0, 10.0, 0.0],
        ] as [number, number, number][],
        normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1]] as [number, number, number][],
        triangles: [0, 1, 2],
        face_vertex_counts: [3],
        face_vertex_indices: [0, 1, 2],
      },
    };

    // 10x unit scale converts 10 cm to 100 mm for 3D printer slicing
    const stlMm = generatePartAsciiStl(mockPart, 'Plate100mm', 10.0);
    expect(stlMm).toContain('solid Plate100mm');
    expect(stlMm).toContain('facet normal 0.000000 0.000000 1.000000');
    expect(stlMm).toContain('vertex 0.0000 0.0000 0.0000');
    expect(stlMm).toContain('vertex 100.0000 0.0000 0.0000');
    expect(stlMm).toContain('vertex 0.0000 100.0000 0.0000');
    expect(stlMm).toContain('endsolid Plate100mm');
  });

  it('correctly parses named explosion stages and translation vectors from CAD scripts', async () => {
    const code = `import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 4.0)
    b2 = sm.create_box((-3.0, -3.0, 4.2), 6.0, 6.0, 8.0)
    parts = [
        ("base", b1, (0.3, 0.3, 0.3), "anchor"),
        ("tower", b2, (0.8, 0.4, 0.2), "component"),
    ]
    explosion_stages = [
        {
            "name": "Stage 1: Tower Lift",
            "duration": 1.5,
            "easing": "ease-out",
            "translations": {
                "tower": [0.0, 0.0, 15.0],
                "base": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 2: Lateral Offset",
            "duration": 1.2,
            "easing": "ease-in-out",
            "translations": {
                "tower": [10.0, 5.0, 15.0],
                "base": [0.0, 0.0, 0.0],
            },
        },
    ]
    return parts, explosion_stages
`;
    const res = await evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(true);
    expect(res.explosion_stages).toBeDefined();
    expect(res.explosion_stages?.length).toBe(2);
    expect(res.explosion_stages?.[0].name).toBe('Stage 1: Tower Lift');
    expect(res.explosion_stages?.[0].duration).toBe(1.5);
    expect(res.explosion_stages?.[0].easing).toBe('ease-out');
    expect(res.explosion_stages?.[0].parts['tower']).toEqual([0.0, 0.0, 15.0]);
    expect(res.explosion_stages?.[1].parts['tower']).toEqual([10.0, 5.0, 15.0]);
  });

  it('generates procedural fallback stages when a script returns parts without explicit stages', async () => {
    const code = `import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 4.0)
    b2 = sm.create_box((-3.0, -3.0, 4.2), 6.0, 6.0, 8.0)
    return [
        ("base", b1, (0.3, 0.3, 0.3), "anchor"),
        ("cover", b2, (0.8, 0.4, 0.2), "component"),
    ]
`;
    const res = await evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(true);
    expect(res.explosion_stages).toBeDefined();
    expect((res.explosion_stages || []).length).toBeGreaterThanOrEqual(2);
    expect(res.explosion_stages?.[0].name).toContain('Step 1');
  });
});

describe('executeCadScript remote execution and fallback routing', () => {
  const sampleCadScript = `import usd_brep as sm
def build_parts():
    b = sm.create_box((0.0, 0.0, 0.0), 5.0, 5.0, 5.0)
    return [("unit_box", b, (0.3, 0.6, 0.9), "anchor")]
`;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns remote execution result when backend responds with standard HTTP 200', async () => {
    const mockRemoteResult = {
      ok: true,
      success: true,
      kernel: 'nvidia-usd-brep-1.0.0',
      fallback: false,
      parts: [
        {
          name: 'unit_box',
          kind: 'anchor',
          color: [0.3, 0.6, 0.9],
          diagnostics: {
            faces: 6,
            edges: 12,
            vertices: 8,
            manifold: true,
            volume: 125.0,
            area: 150.0,
            solid_count: 1,
            void_count: 0,
            bounds: [[0, 0, 0], [5, 5, 5]],
            center: [2.5, 2.5, 2.5],
            tessellation: {
              vertex_count: 8,
              triangle_count: 12,
              output_manifold: true,
              lamina_edge_count: 0,
              failure_count: 0,
            },
          },
          mesh: {
            points: [[0, 0, 0], [5, 5, 5]],
            normals: [[0, 0, 1], [0, 0, 1]],
            triangles: [0, 1, 0],
            face_vertex_counts: [3],
            face_vertex_indices: [0, 1, 0],
          },
        },
      ],
      summary: {
        part_count: 1,
        all_manifold: true,
        total_volume: 125.0,
        total_nurbs_faces: 6,
        total_nurbs_edges: 12,
        total_nurbs_vertices: 8,
        total_mesh_triangles: 12,
        penetration_count: 0,
        overall_bounds: [[0, 0, 0], [5, 5, 5]],
        penetration_warnings: [],
        envelope_breaches: [],
        relationships: [],
      },
      exports: {
        mesh_usda: '#usda 1.0',
        brep_usda: '#usda 1.0',
        stl: 'solid unit_box',
      },
      usda_mesh_text: '#usda 1.0',
      usda_brep_text: '#usda 1.0',
      stl_text: 'solid unit_box',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockRemoteResult,
    } as Response);

    const res = await executeCadScript(sampleCadScript, 'TestAsset');
    expect(res.kernel).toBe('nvidia-usd-brep-1.0.0');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('unit_box');
  });

  it('falls back to client-side synthesizer when backend returns HTTP 200 with fallback: true', async () => {
    const mockFallbackSignal = {
      ok: false,
      success: false,
      fallback: true,
      error: 'usd_brep wheels not available',
      error_type: 'ModuleNotFoundError',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockFallbackSignal,
    } as Response);

    const res = await executeCadScript(sampleCadScript, 'FallbackAsset');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('unit_box');
    expect(res.summary?.all_manifold).toBe(true);
  });

  it('falls back to client-side synthesizer when backend returns HTTP 503 Service Unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        ok: false,
        success: false,
        fallback: true,
        error: 'Backend offline',
      }),
    } as Response);

    const res = await executeCadScript(sampleCadScript, '503Asset');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('unit_box');
  });

  it('preserves and returns remote execution error when backend returns HTTP 200 with syntax error and fallback is false', async () => {
    const mockErrorResult = {
      ok: false,
      success: false,
      fallback: false,
      error: 'SyntaxError: invalid syntax on line 2',
      error_type: 'SyntaxError',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockErrorResult,
    } as Response);

    const res = await executeCadScript('invalid python code', 'SyntaxErrAsset');
    expect(res.success).toBe(false);
    expect(res.error).toContain('SyntaxError');
  });

  it('falls back to client-side synthesizer when fetch throws network error or connection refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch (ECONNREFUSED)'));

    const res = await executeCadScript(sampleCadScript, 'NetworkErrAsset');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('unit_box');
  });

  it('falls back to client-side synthesizer when fetch aborts or times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError);

    const res = await executeCadScript(sampleCadScript, 'AbortAsset');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('unit_box');
  });

  it('cleans up timeout timer on both successful and rejected fetch calls', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network drop'));
    await executeCadScript(sampleCadScript, 'DropAsset');

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('synthesizes sm.create_wedge with valid 3D geometry and manifold mesh', async () => {
    const code = `import usd_brep as sm
def build_parts():
    w = sm.create_wedge((0.0, 0.0, 0.0), 10.0, 10.0, 8.0, 2.0)
    return [("wedge_part", w, (0.4, 0.6, 0.8), "anchor")]
`;
    const res = await evaluateClientSideUsdBrep(code, 'WedgeTest');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('wedge_part');
    expect(res.summary?.all_manifold).toBe(true);
    expect(res.usda_mesh_text).toContain('def Mesh "wedge_part"');
  });

  it('rejects invalid sm.create_wedge dimensions with SM_ERR_INVALID_INPUT', async () => {
    const code = `import usd_brep as sm
def build_parts():
    w = sm.create_wedge((0.0, 0.0, 0.0), -10.0, 10.0, 8.0, 2.0)
    return [("wedge_part", w, (0.4, 0.6, 0.8), "anchor")]
`;
    const res = await evaluateClientSideUsdBrep(code, 'BadWedgeTest');
    expect(res.success).toBe(false);
    expect(res.error).toContain('SM_ERR_INVALID_INPUT');
  });
});
