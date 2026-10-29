export type DisplayUnit = 'mm' | 'cm';

/**
 * Converts a length value from internal OpenUSD centimeters (cm) to the selected display unit.
 * OpenUSD metersPerUnit = 0.01 (1 unit = 1 cm).
 *
 * @param valueInCm Length or coordinate in centimeters
 * @param unit Target display unit ('mm' | 'cm')
 * @returns Converted value in display units
 */
export function convertCmToDisplayUnit(valueInCm: number, unit: DisplayUnit): number {
  if (unit === 'mm') {
    return valueInCm * 10;
  }
  return valueInCm;
}

/**
 * Converts a 3D coordinate tuple [x, y, z] from centimeters to the target display unit.
 *
 * @param coordsInCm Tuple of [x, y, z] coordinates in centimeters
 * @param unit Target display unit ('mm' | 'cm')
 * @returns Converted [x, y, z] tuple in display units
 */
export function convertCoordsCmToDisplayUnit(
  coordsInCm: [number, number, number],
  unit: DisplayUnit
): [number, number, number] {
  const scale = unit === 'mm' ? 10 : 1;
  return [
    coordsInCm[0] * scale,
    coordsInCm[1] * scale,
    coordsInCm[2] * scale,
  ];
}

/**
 * Formats a length value with unit suffix (e.g. "100.0 mm" or "10.0 cm").
 */
export function formatLength(valueInCm: number, unit: DisplayUnit, decimals: number = 1): string {
  const converted = convertCmToDisplayUnit(valueInCm, unit);
  return `${converted.toFixed(decimals)} ${unit}`;
}

/**
 * Formats 3D coordinates into a readable string (e.g. "(100.00, 50.00, 20.00) mm").
 */
export function formatCoords(
  coordsInCm: [number, number, number],
  unit: DisplayUnit,
  decimals: number = 2
): string {
  const [x, y, z] = convertCoordsCmToDisplayUnit(coordsInCm, unit);
  return `(${x.toFixed(decimals)}, ${y.toFixed(decimals)}, ${z.toFixed(decimals)}) ${unit}`;
}

/**
 * Returns a human-readable grid spacing label for 3D viewport overlays.
 */
export function getGridSpacingText(unit: DisplayUnit): string {
  if (unit === 'mm') {
    return 'Grid: 10 mm spacing (1 unit = 10 mm)';
  }
  return 'Grid: 1 cm spacing (1 unit = 1 cm)';
}
