import { describe, expect, it } from 'vitest';
import {
  applyCsgBooleanToScript,
  applyGizmoTransformToScript,
  generatePrimitiveCodeSnippet,
  insertPrimitiveIntoScript,
  parsePartParametricProperties,
  PRIMITIVE_CATALOG,
  updatePartParametricProperties,
} from './csgEngine';

describe('CSG & 3D Solid Modeling Engine Suite', () => {
  it('has comprehensive primitive catalog options', () => {
    expect(PRIMITIVE_CATALOG.length).toBeGreaterThanOrEqual(11);
    const ids = PRIMITIVE_CATALOG.map((p) => p.id);
    expect(ids).toContain('box');
    expect(ids).toContain('cylinder');
    expect(ids).toContain('sphere');
    expect(ids).toContain('wedge');
    expect(ids).toContain('torus');
    expect(ids).toContain('clearance_hole');
    expect(ids).toContain('tap_hole');
    expect(ids).toContain('iso4762_counterbore');
    expect(ids).toContain('countersink_90');
    expect(ids).toContain('heat_set_insert');
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

  it('generates valid usd_brep code snippet for new fasteners', () => {
    const chSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'clearance_hole',
        params: { mSize: 3.0, height: 5.0 },
        position: [0, 0, 0],
      },
      'hole1'
    );
    expect(chSnippet).toContain('sm.create_cylinder');
    expect(chSnippet).toContain('hole1 =');

    const cbSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'iso4762_counterbore',
        params: { mSize: 4.0, height: 10.0 },
        position: [0, 0, 0],
      },
      'cb1'
    );
    expect(cbSnippet).toContain('cb1_cb = sm.create_cylinder');
    expect(cbSnippet).toContain('cb1_shaft = sm.create_cylinder');
    expect(cbSnippet).toContain('cb1 = sm.boolean_union(cb1_cb, cb1_shaft)');

    const csSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'countersink_90',
        params: { mSize: 5.0, height: 10.0 },
        position: [1, 2, 3],
      },
      'cs1'
    );
    expect(csSnippet).toContain('cs1_cs = sm.create_cone');
    expect(csSnippet).toContain('cs1_shaft = sm.create_cylinder');
    expect(csSnippet).toContain('cs1 = sm.boolean_union(cs1_cs, cs1_shaft)');

    const hsSnippet = generatePrimitiveCodeSnippet(
      {
        type: 'heat_set_insert',
        params: { mSize: 3.0 },
        position: [0, 0, 10],
      },
      'hs1'
    );
    expect(hsSnippet).toContain('hs1 = sm.create_cylinder');
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
    // Original parts should be merged out of return tuple
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
      // Check other parts are unchanged
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
      // Re-parsing updated code confirms round-trip fidelity
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

    describe('applyGizmoTransformToScript write-back', () => {
      it('translates primitive in-place when no rotation or prior transforms exist', () => {
        const res = applyGizmoTransformToScript(multiPartScript, 'center_shaft', {
          translation: [1.5, -2.0, 0.5],
        });
        expect(res.success).toBe(true);
        expect(res.updatedCode).toContain('center_shaft = sm.create_cylinder((1.50, -2.00, 4.00), 4.25, 12.00)');
      });

      it('injects sm.rotate and sm.translate when rotation is present', () => {
        const res = applyGizmoTransformToScript(multiPartScript, 'top_knob', {
          rotation: [0, 45, 90],
          translation: [0, 0, 2.0],
        });
        expect(res.success).toBe(true);
        expect(res.updatedCode).toContain('sm.translate(top_knob, (0, 0, 2))');
        expect(res.updatedCode).toContain('sm.rotate(top_knob, ref_point=(0.0, 0.0, 0.0), axis=(0.0, 1.0, 0.0), angle_deg=45)');
        expect(res.updatedCode).toContain('sm.rotate(top_knob, ref_point=(0.0, 0.0, 0.0), axis=(0.0, 0.0, 1.0), angle_deg=90)');
      });

      it('injects sm.scale when scale factor is present', () => {
        const res = applyGizmoTransformToScript(multiPartScript, 'base_plate', {
          scale: [1.2, 1.2, 1.0],
        });
        expect(res.success).toBe(true);
        expect(res.updatedCode).toContain('sm.scale(base_plate, (1.2, 1.2, 1))');
      });
    });
  });
});
