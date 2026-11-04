import { describe, expect, it } from 'vitest';
import {
  applyCsgBooleanToScript,
  generatePrimitiveCodeSnippet,
  insertPrimitiveIntoScript,
  METRIC_FASTENER_SPECS,
  MetricFastenerSize,
  parsePartParametricProperties,
  PRIMITIVE_CATALOG,
  updatePartParametricProperties,
} from './csgEngine';
import { evaluateClientSideUsdBrep } from './cadRuntime';

describe('CSG & 3D Solid Modeling Engine Suite', () => {
  it('has comprehensive primitive catalog options including metric fasteners and profiles', () => {
    expect(PRIMITIVE_CATALOG.length).toBeGreaterThanOrEqual(10);
    const ids = PRIMITIVE_CATALOG.map((p) => p.id);
    expect(ids).toContain('box');
    expect(ids).toContain('cylinder');
    expect(ids).toContain('sphere');
    expect(ids).toContain('wedge');
    expect(ids).toContain('torus');
    expect(ids).toContain('metric_hole');
    expect(ids).toContain('iso4762_counterbore');
    expect(ids).toContain('countersink_90deg');
    expect(ids).toContain('heat_set_boss');
    expect(ids).toContain('hex_nut_trap');
    expect(ids).toContain('vslot_2020');
  });

  describe('Metric Fasteners & Standard Tolerances (+/- 0.05 mm)', () => {
    const metricSizes: MetricFastenerSize[] = ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8'];

    it('contains all required M2-M8 sizes in METRIC_FASTENER_SPECS', () => {
      for (const size of metricSizes) {
        expect(METRIC_FASTENER_SPECS[size]).toBeDefined();
        const spec = METRIC_FASTENER_SPECS[size];
        expect(spec.nominalDia).toBeGreaterThan(0);
        expect(spec.clearanceNormalDia).toBeGreaterThan(spec.nominalDia);
        expect(spec.shcsHeadDia).toBeGreaterThan(spec.clearanceNormalDia);
        expect(spec.shcsHeadHeight).toBeGreaterThan(0);
        expect(spec.heatSetBossOd).toBeGreaterThan(spec.heatSetHoleDia);
      }
    });

    it('matches ISO 273 and ISO 4762 metric specifications within +/- 0.05 mm', () => {
      // Verified ISO nominal values in mm:
      const isoReferenceValues: Record<MetricFastenerSize, { normalClearance: number; shcsHeadDia: number; shcsHeadH: number }> = {
        M2: { normalClearance: 2.4, shcsHeadDia: 3.8, shcsHeadH: 2.0 },
        'M2.5': { normalClearance: 2.9, shcsHeadDia: 4.5, shcsHeadH: 2.5 },
        M3: { normalClearance: 3.4, shcsHeadDia: 5.5, shcsHeadH: 3.0 },
        M4: { normalClearance: 4.5, shcsHeadDia: 7.0, shcsHeadH: 4.0 },
        M5: { normalClearance: 5.5, shcsHeadDia: 8.5, shcsHeadH: 5.0 },
        M6: { normalClearance: 6.6, shcsHeadDia: 10.0, shcsHeadH: 6.0 },
        M8: { normalClearance: 9.0, shcsHeadDia: 13.0, shcsHeadH: 8.0 },
      };

      for (const size of metricSizes) {
        const spec = METRIC_FASTENER_SPECS[size];
        const ref = isoReferenceValues[size];

        expect(Math.abs(spec.clearanceNormalDia - ref.normalClearance)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(spec.shcsHeadDia - ref.shcsHeadDia)).toBeLessThanOrEqual(0.05);
        expect(Math.abs(spec.shcsHeadHeight - ref.shcsHeadH)).toBeLessThanOrEqual(0.05);
      }
    });

    it('provides M2-M8 presets in PRIMITIVE_CATALOG for each fastener family', () => {
      const fastenerPrimIds = [
        'metric_hole',
        'iso4762_counterbore',
        'countersink_90deg',
        'heat_set_boss',
        'hex_nut_trap',
      ];

      for (const id of fastenerPrimIds) {
        const prim = PRIMITIVE_CATALOG.find((p) => p.id === id);
        expect(prim).toBeDefined();
        expect(prim?.presets).toBeDefined();
        const presetIds = prim!.presets!.map((p) => p.id);
        for (const size of metricSizes) {
          expect(presetIds).toContain(size);
        }
      }
    });

    it('verifies catalog preset dimensions match METRIC_FASTENER_SPECS within +/- 0.05 mm (0.005 cm)', () => {
      const tolCm = 0.005; // 0.05 mm = 0.005 cm

      const cbPrim = PRIMITIVE_CATALOG.find((p) => p.id === 'iso4762_counterbore')!;
      for (const size of metricSizes) {
        const preset = cbPrim.presets!.find((p) => p.id === size)!;
        const spec = METRIC_FASTENER_SPECS[size];

        // Radius in cm vs (diameter / 20 in cm)
        const expectedHoleR = spec.clearanceNormalDia / 20;
        const expectedHeadR = spec.shcsHeadDia / 20;
        const expectedHeadH = spec.shcsHeadHeight / 10;

        expect(Math.abs(preset.params.holeRadius - expectedHoleR)).toBeLessThanOrEqual(tolCm);
        expect(Math.abs(preset.params.headRadius - expectedHeadR)).toBeLessThanOrEqual(tolCm);
        expect(Math.abs(preset.params.headDepth - expectedHeadH)).toBeLessThanOrEqual(tolCm);
      }
    });
  });

  it('generates valid usd_brep code snippet for Box and Cylinder', () => {
    const boxSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'box',
        params: { width: 12.0, depth: 8.0, height: 4.0 },
        position: [0, 0, 0],
      },
      'my_box'
    );
    expect(boxSnippet).toContain('sm.create_box');
    expect(boxSnippet).toContain('my_box =');

    const cylSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'cylinder',
        params: { radius: 3.5, height: 10.0 },
        position: [2, 4, 1],
      },
      'my_cyl'
    );
    expect(cylSnippet).toContain('sm.create_cylinder');
    expect(cylSnippet).toContain('(2.00, 4.00, 1.00)');
  });

  describe('Hardware Code Snippet Generators (Positive & Negative)', () => {
    it('generates ISO 4762 SHCS counterbore cutter code snippet', () => {
      const snippet = generatePrimitiveCodeSnippet(
        {
          type: 'iso4762_counterbore',
          params: { holeRadius: 0.17, headRadius: 0.275, headDepth: 0.30, totalDepth: 2.0 },
          position: [5, 5, 0],
          mode: 'negative',
        },
        'm3_cb'
      );
      expect(snippet).toContain('_m3_cb_clearance = sm.create_cylinder((5.00, 5.00, 0.00), 0.17, 2)');
      expect(snippet).toContain('_m3_cb_head = sm.create_cylinder((5.00, 5.00, 1.70), 0.275, 0.3)');
      expect(snippet).toContain('m3_cb = sm.boolean_union(_m3_cb_clearance, _m3_cb_head)');
    });

    it('generates 90 deg flat-head countersink cutter code snippet', () => {
      const snippet = generatePrimitiveCodeSnippet(
        {
          type: 'countersink_90deg',
          params: { holeRadius: 0.17, headRadius: 0.325, sinkHeight: 0.155, totalDepth: 2.0 },
          position: [0, 0, 0],
          mode: 'negative',
        },
        'm3_sink'
      );
      expect(snippet).toContain('sm.create_cone');
      expect(snippet).toContain('sm.boolean_union');
      expect(snippet).toContain('m3_sink =');
    });

    it('generates heat-set insert boss (positive mode) and insert cutter (negative mode)', () => {
      const posSnippet = generatePrimitiveCodeSnippet(
        {
          type: 'heat_set_boss',
          params: { holeRadius: 0.23, holeDepth: 0.57, bossRadius: 0.40, bossHeight: 0.80 },
          position: [0, 0, 0],
          mode: 'positive',
        },
        'm3_boss'
      );
      expect(posSnippet).toContain('_m3_boss_outer = sm.create_cylinder');
      expect(posSnippet).toContain('_m3_boss_core = sm.create_cylinder');
      expect(posSnippet).toContain('m3_boss = sm.boolean_difference(_m3_boss_outer, _m3_boss_core)');

      const negSnippet = generatePrimitiveCodeSnippet(
        {
          type: 'heat_set_boss',
          params: { holeRadius: 0.23, holeDepth: 0.57, bossRadius: 0.40, bossHeight: 0.80 },
          position: [0, 0, 0],
          mode: 'negative',
        },
        'm3_hole'
      );
      expect(negSnippet).toContain('m3_hole = sm.create_cylinder((0.00, 0.00, 0.00), 0.23, 0.57)');
    });

    it('generates hex nut trap cutter code snippet with rotated hexagonal cavity', () => {
      const snippet = generatePrimitiveCodeSnippet(
        {
          type: 'hex_nut_trap',
          params: { widthAcrossFlats: 0.55, thickness: 0.24, clearanceRadius: 0.17, depth: 1.5 },
          position: [0, 0, 0],
          mode: 'negative',
        },
        'm3_nut'
      );
      expect(snippet).toContain('_m3_nut_b1 = sm.create_box');
      expect(snippet).toContain('sm.rotate(_m3_nut_b2');
      expect(snippet).toContain('sm.rotate(_m3_nut_b3');
      expect(snippet).toContain('m3_nut = sm.boolean_union');
    });

    it('generates 2020 V-slot extrusion profile in positive and negative cutter modes', () => {
      const posSnippet = generatePrimitiveCodeSnippet(
        {
          type: 'vslot_2020',
          params: { length: 10.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 },
          position: [0, 0, 0],
          mode: 'positive',
        },
        'beam'
      );
      expect(posSnippet).toContain('_beam_body = sm.create_box');
      expect(posSnippet).toContain('_beam_slot_y0 = sm.create_box');
      expect(posSnippet).toContain('beam = sm.boolean_difference');

      const negSnippet = generatePrimitiveCodeSnippet(
        {
          type: 'vslot_2020',
          params: { length: 10.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 },
          position: [0, 0, 0],
          mode: 'negative',
        },
        'slot_cutter'
      );
      expect(negSnippet).toContain('slot_cutter = sm.create_box');
    });
  });

  it('inserts primitive into existing build_parts() script and preserves return structure', () => {
    const initialScript = `import usd_brep as sm

def build_parts():
    """Initial base plate"""
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 2.0)
    return [("base", base, (0.3, 0.5, 0.8), "anchor")]
`;

    const updatedScript = insertPrimitiveIntoScript(
      {
        type: 'cylinder',
        name: 'boss',
        params: { radius: 3.0, height: 6.0 },
        position: [0, 0, 2.0],
        color: [0.8, 0.4, 0.2],
        kind: 'component',
      },
      initialScript
    );

    expect(updatedScript).toContain('boss = sm.create_cylinder');
    expect(updatedScript).toContain('("base", base');
    expect(updatedScript).toContain('("boss", boss');
  });

  it('applies boolean union between two existing parts', () => {
    const script = `import usd_brep as sm

def build_parts():
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 2.0)
    post = sm.create_cylinder((0.0, 0.0, 2.0), 2.5, 8.0)
    return [("base", base, (0.3, 0.5, 0.8), "anchor"), ("post", post, (0.8, 0.4, 0.2), "component")]
`;

    const { updatedCode, resultPartName } = applyCsgBooleanToScript(
      'union',
      'base',
      'post',
      script
    );

    expect(resultPartName).toBe('base_union');
    expect(updatedCode).toContain('sm.boolean_union(base, post)');
    expect(updatedCode).toContain('("base_union", base_union');
    expect(updatedCode).not.toContain('("base", base');
    expect(updatedCode).not.toContain('("post", post');
  });

  it('applies boolean difference / cut operation between two parts', () => {
    const script = `import usd_brep as sm

def build_parts():
    plate = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 4.0)
    hole = sm.create_cylinder((0.0, 0.0, -1.0), 2.0, 6.0)
    return [("plate", plate, (0.3, 0.5, 0.8), "anchor"), ("hole", hole, (0.9, 0.2, 0.2), "fastener")]
`;

    const { updatedCode, resultPartName } = applyCsgBooleanToScript(
      'difference',
      'plate',
      'hole',
      script
    );

    expect(resultPartName).toBe('plate_cut');
    expect(updatedCode).toContain('sm.boolean_difference(plate, hole)');
    expect(updatedCode).toContain('("plate_cut", plate_cut');
  });

  it('applies boolean intersection operation between two parts', () => {
    const script = `import usd_brep as sm

def build_parts():
    cube = sm.create_box((-4.0, -4.0, 0.0), 8.0, 8.0, 8.0)
    sphere = sm.create_sphere((0.0, 0.0, 4.0), 5.0)
    return [("cube", cube, (0.3, 0.5, 0.8), "anchor"), ("sphere", sphere, (0.2, 0.7, 0.3), "component")]
`;

    const { updatedCode, resultPartName } = applyCsgBooleanToScript(
      'intersection',
      'cube',
      'sphere',
      script
    );

    expect(resultPartName).toBe('cube_inter');
    expect(updatedCode).toContain('sm.boolean_intersection(cube, sphere)');
    expect(updatedCode).toContain('("cube_inter", cube_inter');
  });

  describe('End-to-End Solid Evaluator with Fasteners & Cutters', () => {
    it('synthesizes plate with M3 SHCS counterbore subtraction in browser WASM kernel', async () => {
      const code = `import usd_brep as sm

def build_parts():
    bracket = sm.create_box((-2.0, -2.0, 0.0), 4.0, 4.0, 1.0)
    _hole_clearance = sm.create_cylinder((0.0, 0.0, -0.2), 0.17, 1.4)
    _hole_head = sm.create_cylinder((0.0, 0.0, 0.7), 0.275, 0.5)
    m3_cutter = sm.boolean_union(_hole_clearance, _hole_head)
    counterbored_bracket = sm.boolean_difference(bracket, m3_cutter)
    return [("bracket_cut", counterbored_bracket, (0.3, 0.6, 0.9), "anchor")]
`;
      const res = await evaluateClientSideUsdBrep(code, 'TestCounterbore');
      expect(res.ok).toBe(true);
      expect(res.parts.length).toBe(1);
      expect(res.parts[0].diagnostics.manifold).toBe(true);
      expect(res.parts[0].diagnostics.volume).toBeGreaterThan(0);
      expect(res.parts[0].diagnostics.volume).toBeLessThan(16.0); // 4x4x1 = 16.0 cm^3 minus cutter volume
    });

    it('synthesizes Voron M3 heat-set insert boss on chassis plate', async () => {
      const code = `import usd_brep as sm

def build_parts():
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 0.3)
    _boss_outer = sm.create_cylinder((2.0, 2.0, 0.3), 0.40, 0.80)
    _boss_core = sm.create_cylinder((2.0, 2.0, 0.53), 0.23, 0.57)
    boss = sm.boolean_difference(_boss_outer, _boss_core)
    assembly = sm.boolean_union(base, boss)
    return [("chassis_boss", assembly, (0.2, 0.7, 0.4), "anchor")]
`;
      const res = await evaluateClientSideUsdBrep(code, 'TestHeatSet');
      expect(res.ok).toBe(true);
      expect(res.parts.length).toBe(1);
      expect(res.parts[0].diagnostics.manifold).toBe(true);
      expect(res.parts[0].diagnostics.volume).toBeGreaterThan(30.0 * 0.3);
    });
  });

  describe('Part Parametric Properties Parser & In-Place Mutation', () => {
    const multiPartScript = `import usd_brep as sm

def build_parts():
    """Parametric Multi-Part Assembly"""
    base_plate = sm.create_box((-10.0, -8.0, 0.0), 20.0, 16.0, 3.5)
    center_shaft = sm.create_cylinder((0.0, 0.0, 3.5), 4.25, 12.0)
    top_knob = sm.create_sphere((0.0, 0.0, 15.5), 3.0)
    retaining_ring = sm.create_torus((0.0, 0.0, 8.0), 5.5, 1.2)
    taper_pin = sm.create_cone((6.0, 0.0, 3.5), radius_base=1.5, radius_top=0.5, height=4.0)
    gusset = sm.create_wedge((-6.0, 4.0, 3.5), 4.0, 4.0, 6.0)

    return [
        ("base_plate", base_plate, (0.3, 0.5, 0.8), "anchor"),
        ("center_shaft", center_shaft, (0.7, 0.7, 0.7), "component"),
        ("top_knob", top_knob, (0.9, 0.2, 0.2), "component"),
        ("retaining_ring", retaining_ring, (0.9, 0.8, 0.1), "fastener"),
        ("taper_pin", taper_pin, (0.2, 0.8, 0.4), "component"),
        ("gusset", gusset, (0.5, 0.3, 0.7), "component"),
    ]
`;

    it('parses box properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'base_plate');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('box');
      expect(props?.varName).toBe('base_plate');
      expect(props?.position).toEqual([-10.0, -8.0, 0.0]);
      expect(props?.dimensions.width).toBe(20.0);
      expect(props?.dimensions.depth).toBe(16.0);
      expect(props?.dimensions.height).toBe(3.5);
    });

    it('parses cylinder properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'center_shaft');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('cylinder');
      expect(props?.position).toEqual([0.0, 0.0, 3.5]);
      expect(props?.dimensions.radius).toBe(4.25);
      expect(props?.dimensions.height).toBe(12.0);
    });

    it('parses sphere properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'top_knob');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('sphere');
      expect(props?.position).toEqual([0.0, 0.0, 15.5]);
      expect(props?.dimensions.radius).toBe(3.0);
    });

    it('parses torus properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'retaining_ring');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('torus');
      expect(props?.position).toEqual([0.0, 0.0, 8.0]);
      expect(props?.dimensions.majorRadius).toBe(5.5);
      expect(props?.dimensions.minorRadius).toBe(1.2);
    });

    it('parses cone properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'taper_pin');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('cone');
      expect(props?.position).toEqual([6.0, 0.0, 3.5]);
      expect(props?.dimensions.radiusBase).toBe(1.5);
      expect(props?.dimensions.radiusTop).toBe(0.5);
      expect(props?.dimensions.height).toBe(4.0);
    });

    it('parses wedge properties correctly from script', () => {
      const props = parsePartParametricProperties(multiPartScript, 'gusset');
      expect(props).not.toBeNull();
      expect(props?.primitiveType).toBe('wedge');
      expect(props?.position).toEqual([-6.0, 4.0, 3.5]);
      expect(props?.dimensions.width).toBe(4.0);
      expect(props?.dimensions.depth).toBe(4.0);
      expect(props?.dimensions.height).toBe(6.0);
    });

    it('returns null for non-existent part', () => {
      const props = parsePartParametricProperties(multiPartScript, 'non_existent_part');
      expect(props).toBeNull();
    });

    it('updates box dimensions and position without altering other parts', () => {
      const res = updatePartParametricProperties(multiPartScript, 'base_plate', {
        position: [-12.5, -9.0, 0.5],
        dimensions: { width: 25.0, depth: 18.0, height: 4.5 },
      });

      expect(res.success).toBe(true);
      expect(res.updatedCode).toContain('base_plate = sm.create_box((-12.50, -9.00, 0.50), 25.00, 18.00, 4.50)');
      expect(res.updatedCode).toContain('center_shaft = sm.create_cylinder((0.0, 0.0, 3.5), 4.25, 12.0)');
      expect(res.updatedCode).toContain('top_knob = sm.create_sphere((0.0, 0.0, 15.5), 3.0)');
    });

    it('updates cylinder radius and height in place', () => {
      const res = updatePartParametricProperties(multiPartScript, 'center_shaft', {
        position: [1.0, 2.0, 3.5],
        dimensions: { radius: 5.5, height: 16.0 },
      });

      expect(res.success).toBe(true);
      expect(res.updatedCode).toContain('center_shaft = sm.create_cylinder((1.00, 2.00, 3.50), 5.50, 16.00)');
      const reParsed = parsePartParametricProperties(res.updatedCode, 'center_shaft');
      expect(reParsed?.dimensions.radius).toBe(5.5);
      expect(reParsed?.dimensions.height).toBe(16.0);
      expect(reParsed?.position).toEqual([1.0, 2.0, 3.5]);
    });

    it('updates sphere radius and torus radii in place', () => {
      const resSphere = updatePartParametricProperties(multiPartScript, 'top_knob', {
        dimensions: { radius: 4.5 },
      });
      expect(resSphere.success).toBe(true);
      expect(resSphere.updatedCode).toContain('top_knob = sm.create_sphere((0.00, 0.00, 15.50), 4.50)');

      const resTorus = updatePartParametricProperties(multiPartScript, 'retaining_ring', {
        dimensions: { majorRadius: 7.0, minorRadius: 2.0 },
      });
      expect(resTorus.success).toBe(true);
      expect(resTorus.updatedCode).toContain('retaining_ring = sm.create_torus((0.00, 0.00, 8.00), 7.00, 2.00)');
    });
  });
});
