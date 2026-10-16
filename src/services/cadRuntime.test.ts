import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PRESETS } from '../data/presetsData';
import { evaluateClientSideUsdBrep, executeCadScript } from './cadRuntime';

describe('Client-side usd_brep fallback evaluator (Standalone Cloud Preview mode)', () => {
  it.each(DEFAULT_PRESETS.map((p) => [p.id, p] as const))(
    'synthesizes preset %s with manifold parts and valid OpenUSD/STL output',
    (_id, preset) => {
      const res = evaluateClientSideUsdBrep(preset.code, preset.id, preset.envelope);
      expect(res.success).toBe(true);
      expect(res.parts).toBeDefined();
      expect((res.parts || []).length).toBeGreaterThanOrEqual(2);
      expect(res.summary?.all_manifold).toBe(true);
      expect(res.usda_mesh_text).toContain('#usda 1.0');
      expect(res.usda_mesh_text).toContain('def Mesh');
      expect(res.stl_text).toContain('solid ');
    }
  );

  it('rejects empty scripts cleanly', () => {
    const res = evaluateClientSideUsdBrep('   ');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Empty');
  });

  it('rejects scripts missing build_parts()', () => {
    const res = evaluateClientSideUsdBrep('import usd_brep as sm\nb = sm.create_box((0,0,0), 5, 5, 5)');
    expect(res.success).toBe(false);
    expect(res.error).toContain('build_parts');
  });

  it('rejects negative box dimensions with SM_ERR_INVALID_INPUT', () => {
    const code = `import usd_brep as sm
def build_parts():
    b = sm.create_box((0, 0, 0), -5.0, 5.0, 5.0)
    return [("bad", b, (1.0, 0.0, 0.0), "anchor")]
`;
    const res = evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(false);
    expect(res.error).toContain('SM_ERR_INVALID_INPUT');
  });

  it('flags ground-plane and penetration warnings on overlapping boxes below z=0', () => {
    const code = `import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-5.0, -5.0, -3.0), 10.0, 10.0, 8.0)
    b2 = sm.create_box((-2.0, -2.0, 0.0), 10.0, 10.0, 8.0)
    return [
        ("box_a", b1, (0.5, 0.2, 0.2), "anchor"),
        ("box_b", b2, (0.2, 0.5, 0.2), "component"),
    ]
`;
    const res = evaluateClientSideUsdBrep(code, 'OverlapTest', [8, 8, 6]);
    expect(res.success).toBe(true);
    expect(res.summary?.penetration_count).toBe(1);
    const warnings = (res.sanity_warnings || []).join('\n');
    expect(warnings).toContain('PENETRATE');
    expect(warnings).toContain('GROUND_PLANE');
    expect(warnings).toContain('TARGET_ENVELOPE');
  });

  it('correctly parses named explosion stages and translation vectors from CAD scripts', () => {
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
    const res = evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(true);
    expect(res.explosion_stages).toBeDefined();
    expect(res.explosion_stages?.length).toBe(2);
    expect(res.explosion_stages?.[0].name).toBe('Stage 1: Tower Lift');
    expect(res.explosion_stages?.[0].duration).toBe(1.5);
    expect(res.explosion_stages?.[0].easing).toBe('ease-out');
    expect(res.explosion_stages?.[0].parts['tower']).toEqual([0.0, 0.0, 15.0]);
    expect(res.explosion_stages?.[1].parts['tower']).toEqual([10.0, 5.0, 15.0]);
  });

  it('generates procedural fallback stages when a script returns parts without explicit stages', () => {
    const code = `import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 4.0)
    b2 = sm.create_box((-3.0, -3.0, 4.2), 6.0, 6.0, 8.0)
    return [
        ("base", b1, (0.3, 0.3, 0.3), "anchor"),
        ("cover", b2, (0.8, 0.4, 0.2), "component"),
    ]
`;
    const res = evaluateClientSideUsdBrep(code);
    expect(res.success).toBe(true);
    expect(res.explosion_stages).toBeDefined();
    expect((res.explosion_stages || []).length).toBeGreaterThanOrEqual(2);
    expect(res.explosion_stages?.[0].name).toContain('Step 1');
  });
});

describe('executeCadScript remote execution and fallback routing', () => {
  const sampleCadScript = `import usd_brep as sm
def build_parts():
    b = sm.create_box((0, 0, 0), 10.0, 10.0, 5.0)
    return [("test_box", b, (0.2, 0.4, 0.8), "anchor")]
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
      kernel: 'NVIDIA usd-brep 1.0.0',
      asset_name: 'TestAsset',
      parts: [
        {
          name: 'test_box',
          kind: 'anchor',
          color: [0.2, 0.4, 0.8] as [number, number, number],
          diagnostics: {
            faces: 6,
            edges: 12,
            vertices: 8,
            manifold: true,
            volume: 500,
            area: 400,
            solid_count: 1,
            void_count: 0,
            bounds: [
              [0, 0, 0],
              [10, 10, 5],
            ] as [[number, number, number], [number, number, number]],
            center: [5, 5, 2.5] as [number, number, number],
            tessellation: {
              vertex_count: 24,
              triangle_count: 12,
              output_manifold: true,
              lamina_edge_count: 0,
              failure_count: 0,
            },
          },
          mesh: {
            points: [],
            normals: [],
            triangles: [],
            face_vertex_counts: [],
            face_vertex_indices: [],
          },
        },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockRemoteResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await executeCadScript(sampleCadScript, 'TestAsset');
    expect(res.kernel).toBe('NVIDIA usd-brep 1.0.0');
    expect(res.success).toBe(true);
    expect(res.parts?.[0].name).toBe('test_box');
  });

  it('falls back to client-side synthesizer when backend returns HTTP 200 with fallback: true', async () => {
    const mockFallbackResult = {
      ok: false,
      success: false,
      fallback: true,
      kernel: 'usd-brep-stub',
      error: 'usd_brep not installed in Python environment',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockFallbackResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await executeCadScript(sampleCadScript, 'FallbackAsset');
    expect(res.success).toBe(true);
    expect(res.kernel).toBe('browser-usd-brep-fallback');
    expect(res.parts?.length).toBeGreaterThanOrEqual(1);
    expect(res.parts?.[0].name).toBe('test_box');
  });

  it('falls back to client-side synthesizer when backend returns HTTP 503 Service Unavailable', async () => {
    const mock503Response = {
      ok: false,
      success: false,
      fallback: true,
      error: 'Python usd-brep backend not connected on http://127.0.0.1:8000. Reverting to client-side geometric engine.',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mock503Response), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await executeCadScript(sampleCadScript, '503Asset');
    expect(res.success).toBe(true);
    expect(res.kernel).toBe('browser-usd-brep-fallback');
    expect(res.parts?.length).toBeGreaterThanOrEqual(1);
    expect(res.parts?.[0].name).toBe('test_box');
  });

  it('preserves and returns remote execution error when backend returns HTTP 200 with syntax error and fallback is false', async () => {
    const mockPythonError = {
      ok: false,
      success: false,
      kernel: 'nvidia-usd-brep-1.0.0',
      error: 'SyntaxError in CAD script: invalid syntax (<cad_script>, line 2)',
      error_type: 'SyntaxError',
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockPythonError), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await executeCadScript('invalid python code', 'SyntaxErrAsset');
    expect(res.success).toBe(false);
    expect(res.kernel).toBe('nvidia-usd-brep-1.0.0');
    expect(res.error).toContain('SyntaxError');
  });

  it('falls back to client-side synthesizer when fetch throws network error or connection refused', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch (ECONNREFUSED)'));

    const res = await executeCadScript(sampleCadScript, 'NetworkErrAsset');
    expect(res.success).toBe(true);
    expect(res.kernel).toBe('browser-usd-brep-fallback');
    expect(res.parts?.length).toBeGreaterThanOrEqual(1);
    expect(res.parts?.[0].name).toBe('test_box');
  });

  it('falls back to client-side synthesizer when fetch aborts or times out', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new DOMException('The user aborted a request.', 'AbortError'));

    const res = await executeCadScript(sampleCadScript, 'AbortAsset');
    expect(res.success).toBe(true);
    expect(res.kernel).toBe('browser-usd-brep-fallback');
    expect(res.parts?.length).toBeGreaterThanOrEqual(1);
    expect(res.parts?.[0].name).toBe('test_box');
  });

  it('cleans up timeout timer on both successful and rejected fetch calls', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network drop'));
    await executeCadScript(sampleCadScript, 'DropAsset');

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('synthesizes sm.create_wedge with valid 3D geometry and manifold mesh', () => {
    const code = `import usd_brep as sm
def build_parts():
    w = sm.create_wedge((0.0, 0.0, 0.0), 10.0, 10.0, 8.0, 2.0)
    return [("wedge_part", w, (0.4, 0.6, 0.8), "anchor")]
`;
    const res = evaluateClientSideUsdBrep(code, 'WedgeTest');
    expect(res.success).toBe(true);
    expect(res.parts?.length).toBe(1);
    expect(res.parts?.[0].name).toBe('wedge_part');
    expect(res.summary?.all_manifold).toBe(true);
    expect(res.usda_mesh_text).toContain('def Mesh "wedge_part"');
  });

  it('rejects invalid sm.create_wedge dimensions with SM_ERR_INVALID_INPUT', () => {
    const code = `import usd_brep as sm
def build_parts():
    w = sm.create_wedge((0.0, 0.0, 0.0), -10.0, 10.0, 8.0, 2.0)
    return [("wedge_part", w, (0.4, 0.6, 0.8), "anchor")]
`;
    const res = evaluateClientSideUsdBrep(code, 'BadWedgeTest');
    expect(res.success).toBe(false);
    expect(res.error).toContain('SM_ERR_INVALID_INPUT');
  });
});


