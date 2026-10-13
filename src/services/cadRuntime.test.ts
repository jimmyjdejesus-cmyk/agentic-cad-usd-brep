import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from '../data/presetsData';
import { evaluateClientSideUsdBrep } from './cadRuntime';

describe('Client-side usd_brep fallback evaluator (Google AI Studio Cloud Preview mode)', () => {
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
});
