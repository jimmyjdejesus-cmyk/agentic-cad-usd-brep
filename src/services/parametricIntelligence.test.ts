import { describe, it, expect } from 'vitest';
import {
  parseParametricIntent,
  applyParametricEdit,
  intelligentParametricSynthesize,
  attemptAutoRepair,
} from './parametricIntelligence';

describe('parametricIntelligence', () => {
  const starterCylinderCode = `import usd_brep as sm

def build_parts():
    """Parametric Cylinder Solid."""
    cylinder = sm.create_cylinder((0.0, 0.0, 0.0), 5.0, 10.0)
    return [
        ("cylinder", cylinder, (0.30, 0.75, 0.60), "anchor"),
    ]
`;

  const multiPartCode = `import usd_brep as sm

def build_parts():
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 4.0)
    shaft = sm.create_cylinder((0.0, 0.0, 4.0), 2.5, 12.0)
    cap = sm.create_sphere((0.0, 0.0, 16.0), 3.0)
    return [
        ("base_plate", base, (0.3, 0.3, 0.4), "anchor"),
        ("center_shaft", shaft, (0.8, 0.5, 0.2), "component"),
        ("retaining_cap", cap, (0.9, 0.2, 0.2), "component"),
    ]
`;

  describe('parseParametricIntent', () => {
    it('detects dimensional edit intent for height increase', () => {
      const intents = parseParametricIntent('make cylinder 5cm taller', starterCylinderCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('dimensional_edit');
      expect(intents[0].parameter).toBe('height');
      expect(intents[0].value).toBe(5);
    });

    it('detects dimensional edit intent for radius change', () => {
      const intents = parseParametricIntent('change radius to 8', starterCylinderCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('dimensional_edit');
      expect(intents[0].parameter).toBe('radius');
      expect(intents[0].value).toBe(8);
    });

    it('detects part removal intent', () => {
      const intents = parseParametricIntent('remove the cap', multiPartCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('remove_part');
      expect(intents[0].targetPart).toBe('retaining_cap');
    });

    it('detects hole/bore subtractive intent', () => {
      const intents = parseParametricIntent('drill a 3cm hole in the center', starterCylinderCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('boolean_op');
      expect(intents[0].operation).toBe('difference');
      expect(intents[0].value).toBe(3);
    });

    it('detects rotation transform intent', () => {
      const intents = parseParametricIntent('rotate 90 degrees around Y', starterCylinderCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('transform');
      expect(intents[0].operation).toBe('rotate');
      expect(intents[0].axis).toBe('Y');
      expect(intents[0].value).toBe(90);
    });

    it('detects primitive addition intent', () => {
      const intents = parseParametricIntent('add a sphere', starterCylinderCode);
      expect(intents.length).toBeGreaterThan(0);
      expect(intents[0].type).toBe('add_primitive');
      expect(intents[0].primitive).toBe('sphere');
    });
  });

  describe('applyParametricEdit', () => {
    it('modifies height in Python code', () => {
      const intents = parseParametricIntent('make cylinder 5cm taller', starterCylinderCode);
      const res = applyParametricEdit(intents, starterCylinderCode);
      expect(res.code).toContain('sm.create_cylinder((0.0, 0.0, 0.0), 5.0, 15.0)');
      expect(res.explanation).toContain('height');
    });

    it('modifies radius in Python code', () => {
      const intents = parseParametricIntent('change radius to 8', starterCylinderCode);
      const res = applyParametricEdit(intents, starterCylinderCode);
      expect(res.code).toContain('sm.create_cylinder((0.0, 0.0, 0.0), 8.0, 10.0)');
      expect(res.explanation).toContain('radius');
    });

    it('removes part from multi-part return tuple list', () => {
      const intents = parseParametricIntent('remove the cap', multiPartCode);
      const res = applyParametricEdit(intents, multiPartCode);
      expect(res.code).not.toContain('retaining_cap');
      expect(res.code).toContain('base_plate');
      expect(res.code).toContain('center_shaft');
    });

    it('injects central bore with boolean_difference', () => {
      const intents = parseParametricIntent('drill a 2.5cm hole in the center', starterCylinderCode);
      const res = applyParametricEdit(intents, starterCylinderCode);
      expect(res.code).toContain('sm.boolean_difference');
      expect(res.code).toContain('central_bore');
      expect(res.code).toContain('2.5');
    });

    it('injects rotation transform', () => {
      const intents = parseParametricIntent('rotate 45 degrees around Z', starterCylinderCode);
      const res = applyParametricEdit(intents, starterCylinderCode);
      expect(res.code).toContain('sm.rotate');
      expect(res.code).toContain('angle_deg=45');
    });

    it('appends a new primitive part without breaking existing parts', () => {
      const intents = parseParametricIntent('add a box', starterCylinderCode);
      const res = applyParametricEdit(intents, starterCylinderCode);
      expect(res.code).toContain('sm.create_box');
      expect(res.code).toContain('box_part');
      expect(res.code).toContain('("cylinder", cylinder');
    });
  });

  describe('intelligentParametricSynthesize', () => {
    it('synthesizes complete end-to-end parametric edit', () => {
      const result = intelligentParametricSynthesize('make it 20cm tall', starterCylinderCode);
      expect(result.code).toContain('20.0');
      expect(result.explanation.length).toBeGreaterThan(10);
    });
  });

  describe('attemptAutoRepair', () => {
    it('repairs penetration warnings by bumping vertical separation', () => {
      const fakePenetrationResult: any = {
        success: true,
        sanity_warnings: ['Penetration detected: overlap volume 4.2 between base and shaft'],
      };
      const repair = attemptAutoRepair(starterCylinderCode, fakePenetrationResult);
      expect(repair).not.toBeNull();
      expect(repair?.success).toBe(true);
      expect(repair?.reason).toContain('clearance');
    });

    it('repairs multi-part penetration by elevating upper parts while keeping ground base at z=0', () => {
      const fakePenetrationResult: any = {
        success: true,
        sanity_warnings: ['Penetration detected: overlap volume 2.1 between base and shaft'],
      };
      const repair = attemptAutoRepair(multiPartCode, fakePenetrationResult);
      expect(repair).not.toBeNull();
      expect(repair?.success).toBe(true);
      // Base plate coordinate tuple at z=0 must be preserved
      expect(repair?.code).toContain('sm.create_box((-5.0, -5.0, 0.0)');
      // Upper stacked parts must be elevated
      expect(repair?.code).toContain('sm.create_cylinder((0.0, 0.0, 4.30)');
      expect(repair?.reason).toContain('ground alignment');
    });

    it('repairs non-positive invalid dimensions while preserving origin coordinates', () => {
      const badCode = `cylinder = sm.create_cylinder((0.0, 0.0, 0.0), -5.0, 0.0)`;
      const fakeErrorResult: any = {
        success: false,
        error: 'SM_ERR_INVALID_INPUT: dimension <= 0',
      };
      const repair = attemptAutoRepair(badCode, fakeErrorResult);
      expect(repair).not.toBeNull();
      expect(repair?.success).toBe(true);
      expect(repair?.code).toContain('1.0');
      // Coordinate tuple must be preserved exactly
      expect(repair?.code).toContain('(0.0, 0.0, 0.0)');
    });

    it('preserves centered negative origin coordinates when repairing non-positive dimensions', () => {
      const badBoxCode = `box = sm.create_box((-5.0, -5.0, 0.0), -10.0, 0.0, 4.0)`;
      const fakeErrorResult: any = {
        success: false,
        error: 'SM_ERR_INVALID_INPUT: dimension <= 0',
      };
      const repair = attemptAutoRepair(badBoxCode, fakeErrorResult);
      expect(repair).not.toBeNull();
      expect(repair?.success).toBe(true);
      // Coordinate tuple must be preserved exactly
      expect(repair?.code).toContain('(-5.0, -5.0, 0.0)');
      // Negative/zero dimensions must be clamped to 1.0
      expect(repair?.code).toContain('1.0');
    });
  });
});
