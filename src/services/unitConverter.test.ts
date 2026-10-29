import { describe, expect, it } from 'vitest';
import {
  convertCmToDisplayUnit,
  convertCoordsCmToDisplayUnit,
  formatLength,
  formatCoords,
  getGridSpacingText,
} from './unitConverter';

describe('Unit Conversion Service (mm vs cm)', () => {
  describe('convertCmToDisplayUnit', () => {
    it('multiplies centimeters by 10 when target unit is mm', () => {
      expect(convertCmToDisplayUnit(1, 'mm')).toBe(10);
      expect(convertCmToDisplayUnit(2.5, 'mm')).toBe(25);
      expect(convertCmToDisplayUnit(0, 'mm')).toBe(0);
      expect(convertCmToDisplayUnit(-5, 'mm')).toBe(-50);
    });

    it('returns original value when target unit is cm', () => {
      expect(convertCmToDisplayUnit(1, 'cm')).toBe(1);
      expect(convertCmToDisplayUnit(2.5, 'cm')).toBe(2.5);
      expect(convertCmToDisplayUnit(0, 'cm')).toBe(0);
      expect(convertCmToDisplayUnit(-5, 'cm')).toBe(-5);
    });
  });

  describe('convertCoordsCmToDisplayUnit', () => {
    it('scales [x, y, z] coordinates by 10 for mm', () => {
      const coordsInCm: [number, number, number] = [2.5, -1.2, 10.0];
      const result = convertCoordsCmToDisplayUnit(coordsInCm, 'mm');
      expect(result).toEqual([25.0, -12.0, 100.0]);
    });

    it('keeps [x, y, z] coordinates unchanged for cm', () => {
      const coordsInCm: [number, number, number] = [2.5, -1.2, 10.0];
      const result = convertCoordsCmToDisplayUnit(coordsInCm, 'cm');
      expect(result).toEqual([2.5, -1.2, 10.0]);
    });
  });

  describe('formatLength', () => {
    it('formats values in mm with correct decimal places and suffix', () => {
      expect(formatLength(2.5, 'mm', 1)).toBe('25.0 mm');
      expect(formatLength(10, 'mm', 0)).toBe('100 mm');
    });

    it('formats values in cm with correct decimal places and suffix', () => {
      expect(formatLength(2.5, 'cm', 1)).toBe('2.5 cm');
      expect(formatLength(10, 'cm', 0)).toBe('10 cm');
    });
  });

  describe('formatCoords', () => {
    it('formats 3D coordinate tuples in mm', () => {
      const coords: [number, number, number] = [1.234, 5.678, -3.141];
      expect(formatCoords(coords, 'mm', 2)).toBe('(12.34, 56.78, -31.41) mm');
    });

    it('formats 3D coordinate tuples in cm', () => {
      const coords: [number, number, number] = [1.234, 5.678, -3.141];
      expect(formatCoords(coords, 'cm', 2)).toBe('(1.23, 5.68, -3.14) cm');
    });
  });

  describe('getGridSpacingText', () => {
    it('returns grid spacing description for mm display mode', () => {
      expect(getGridSpacingText('mm')).toBe('1 unit = 10 mm');
    });

    it('returns grid spacing description for cm display mode', () => {
      expect(getGridSpacingText('cm')).toBe('1 unit = 1 cm');
    });
  });
});
