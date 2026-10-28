import { describe, expect, it } from 'vitest';
import {
  applyCsgBooleanToScript,
  generatePrimitiveCodeSnippet,
  insertPrimitiveIntoScript,
  PRIMITIVE_CATALOG,
} from './csgEngine';

describe('CSG & 3D Solid Modeling Engine Suite', () => {
  it('has comprehensive primitive catalog options', () => {
    expect(PRIMITIVE_CATALOG.length).toBeGreaterThanOrEqual(6);
    const ids = PRIMITIVE_CATALOG.map((p) => p.id);
    expect(ids).toContain('box');
    expect(ids).toContain('cylinder');
    expect(ids).toContain('sphere');
    expect(ids).toContain('wedge');
    expect(ids).toContain('torus');
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
});
