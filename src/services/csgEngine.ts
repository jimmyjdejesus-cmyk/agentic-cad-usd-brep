/**
 * ApexCAD CSG & 3D Solid Modeling Engine
 * 
 * Provides interactive client-side 3D modeling primitives and boolean operations
 * (Union, Subtract/Difference, Intersect) synchronized with Python usd_brep scripts.
 */

export interface PrimitiveOption {
  id: string;
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  paramLabels: Record<string, string>;
  category: 'Primitives' | 'Mechanical' | 'Holes & Fasteners';
}

export const PRIMITIVE_CATALOG: PrimitiveOption[] = [
  {
    id: 'box',
    name: 'Solid Box / Plate',
    description: 'Rectangular block with configurable width (X), depth (Y), and height (Z).',
    defaultParams: { width: 10.0, depth: 8.0, height: 4.0 },
    paramLabels: { width: 'Width X (cm)', depth: 'Depth Y (cm)', height: 'Height Z (cm)' },
    category: 'Primitives',
  },
  {
    id: 'cylinder',
    name: 'Cylinder / Boss',
    description: 'Vertical round cylinder ideal for shafts, bosses, and pins.',
    defaultParams: { radius: 4.0, height: 8.0 },
    paramLabels: { radius: 'Radius (cm)', height: 'Height Z (cm)' },
    category: 'Primitives',
  },
  {
    id: 'sphere',
    name: 'Solid Sphere',
    description: 'Spherical solid for knobs, ball joints, or rounded caps.',
    defaultParams: { radius: 5.0 },
    paramLabels: { radius: 'Radius (cm)' },
    category: 'Primitives',
  },
  {
    id: 'cone',
    name: 'Tapered Cone',
    description: 'Frustum or pointed cone with base and top radii.',
    defaultParams: { radiusBase: 5.0, radiusTop: 2.0, height: 6.0 },
    paramLabels: { radiusBase: 'Base Radius (cm)', radiusTop: 'Top Radius (cm)', height: 'Height Z (cm)' },
    category: 'Primitives',
  },
  {
    id: 'wedge',
    name: 'Inclined Wedge / Chamfer',
    description: 'Triangular ramp wedge for structural gussets or ramps.',
    defaultParams: { width: 6.0, depth: 6.0, height: 4.0 },
    paramLabels: { width: 'Width X (cm)', depth: 'Depth Y (cm)', height: 'Height Z (cm)' },
    category: 'Mechanical',
  },
  {
    id: 'torus',
    name: 'Torus / O-Ring',
    description: 'Donut-shaped ring solid for seals and round grips.',
    defaultParams: { majorRadius: 6.0, minorRadius: 1.5 },
    paramLabels: { majorRadius: 'Major Radius (cm)', minorRadius: 'Cross-section Radius (cm)' },
    category: 'Mechanical',
  },
  {
    id: 'bore_hole',
    name: 'Counterbore Tool',
    description: 'Negative cylinder tool for cutting standard clearance bolt holes.',
    defaultParams: { radius: 1.5, height: 12.0 },
    paramLabels: { radius: 'Bore Radius (cm)', height: 'Bore Depth (cm)' },
    category: 'Holes & Fasteners',
  },
];

export interface InsertPrimitiveConfig {
  type: string;
  name?: string;
  params: Record<string, number>;
  position: [number, number, number];
  color?: [number, number, number];
  kind?: 'anchor' | 'component' | 'fastener';
}

/**
 * Generates Python usd_brep code snippet for creating a geometric primitive
 */
export function generatePrimitiveCodeSnippet(config: InsertPrimitiveConfig, varName: string): string {
  const [px, py, pz] = config.position;
  const pStr = `(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`;

  switch (config.type) {
    case 'box': {
      const w = config.params.width ?? 10.0;
      const d = config.params.depth ?? 8.0;
      const h = config.params.height ?? 4.0;
      // Centered XY box resting at pz
      return `    ${varName} = sm.create_box((${px - w / 2}, ${py - d / 2}, ${pz}), ${w}, ${d}, ${h})`;
    }
    case 'cylinder':
    case 'bore_hole': {
      const r = config.params.radius ?? 4.0;
      const h = config.params.height ?? 8.0;
      return `    ${varName} = sm.create_cylinder(${pStr}, ${r}, ${h})`;
    }
    case 'sphere': {
      const r = config.params.radius ?? 5.0;
      return `    ${varName} = sm.create_sphere(${pStr}, ${r})`;
    }
    case 'cone': {
      const rb = config.params.radiusBase ?? 5.0;
      const rt = config.params.radiusTop ?? 2.0;
      const h = config.params.height ?? 6.0;
      return `    ${varName} = sm.create_cone(${pStr}, radius_base=${rb}, radius_top=${rt}, height=${h})`;
    }
    case 'wedge': {
      const w = config.params.width ?? 6.0;
      const d = config.params.depth ?? 6.0;
      const h = config.params.height ?? 4.0;
      return `    ${varName} = sm.create_wedge((${px - w / 2}, ${py - d / 2}, ${pz}), ${w}, ${d}, ${h})`;
    }
    case 'torus': {
      const rMaj = config.params.majorRadius ?? 6.0;
      const rMin = config.params.minorRadius ?? 1.5;
      return `    ${varName} = sm.create_torus(${pStr}, ${rMaj}, ${rMin})`;
    }
    default: {
      return `    ${varName} = sm.create_box((${px - 5}, ${py - 5}, ${pz}), 10.0, 10.0, 5.0)`;
    }
  }
}

/**
 * Appends a new primitive to the existing Python CAD script
 */
export function insertPrimitiveIntoScript(config: InsertPrimitiveConfig, currentCode: string): string {
  const safeName = (config.name || `${config.type}_${Date.now().toString(36).slice(-4)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const varName = safeName;
  const color = config.color || [0.35, 0.65, 0.95];
  const kind = config.kind || 'component';

  const colorStr = `(${color[0].toFixed(2)}, ${color[1].toFixed(2)}, ${color[2].toFixed(2)})`;
  const snippet = generatePrimitiveCodeSnippet(config, varName);

  if (!currentCode || !currentCode.includes('def build_parts():')) {
    return `import usd_brep as sm

def build_parts():
    """Parametric solid assembly generated via interactive modeling."""
${snippet}
    return [("${safeName}", ${varName}, ${colorStr}, "${kind}")]
`;
  }

  // Find return statement inside build_parts()
  const returnMatch = currentCode.match(/(\s+)return\s*\[(.*?)\]/s);
  if (returnMatch) {
    const indent = returnMatch[1];
    const existingReturnContents = returnMatch[2].trim();
    const newEntry = `("${safeName}", ${varName}, ${colorStr}, "${kind}")`;
    const updatedReturn = existingReturnContents
      ? `${existingReturnContents}, ${newEntry}`
      : newEntry;

    const codeBeforeReturn = currentCode.slice(0, returnMatch.index);
    const codeAfterReturn = currentCode.slice(returnMatch.index! + returnMatch[0].length);

    return `${codeBeforeReturn}${snippet}\n${indent}return [${updatedReturn}]${codeAfterReturn}`;
  }

  // Fallback: append at the end of build_parts
  return currentCode + `\n${snippet}\n`;
}

export type CsgBooleanOperation = 'union' | 'difference' | 'intersection';

/**
 * Executes a Boolean CSG operation between two existing parts in the Python code
 */
export function applyCsgBooleanToScript(
  operation: CsgBooleanOperation,
  targetPartName: string,
  toolPartName: string,
  currentCode: string
): { updatedCode: string; resultPartName: string } {
  const opFunc =
    operation === 'union'
      ? 'sm.boolean_union'
      : operation === 'difference'
      ? 'sm.boolean_difference'
      : 'sm.boolean_intersection';

  const opSuffix = operation === 'union' ? 'union' : operation === 'difference' ? 'cut' : 'inter';
  const resultPartName = `${targetPartName}_${opSuffix}`;
  const resultVar = resultPartName;

  // Locate the return statement
  const returnRegex = /(\s+)return\s*\[(.*?)\]/s;
  const match = currentCode.match(returnRegex);

  if (!match) {
    return { updatedCode: currentCode, resultPartName: targetPartName };
  }

  const indent = match[1];
  const returnBody = match[2];

  // Pattern to find tuples: ("partName", var_name, (r, g, b), "kind")
  const partTupleRegex = /\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_]+)\s*,\s*(\([^)]+\))\s*,\s*["']([^"']+)["']\s*\)/g;
  let partAInfo: { varName: string; color: string; kind: string } | null = null;
  let partBInfo: { varName: string; color: string; kind: string } | null = null;

  let m;
  while ((m = partTupleRegex.exec(returnBody)) !== null) {
    const name = m[1];
    if (name === targetPartName) {
      partAInfo = { varName: m[2], color: m[3], kind: m[4] };
    }
    if (name === toolPartName) {
      partBInfo = { varName: m[2], color: m[3], kind: m[4] };
    }
  }

  // Fallback var names if not explicitly matched in return tuple
  const varA = partAInfo ? partAInfo.varName : targetPartName;
  const varB = partBInfo ? partBInfo.varName : toolPartName;
  const outColor = partAInfo ? partAInfo.color : '(0.35, 0.65, 0.95)';
  const outKind = partAInfo ? partAInfo.kind : 'component';

  const booleanStatement = `${indent}${resultVar} = ${opFunc}(${varA}, ${varB})`;

  // Build the updated return array:
  // Remove part A and part B, and add the resultPartName
  const elements: string[] = [];
  partTupleRegex.lastIndex = 0;
  let tMatch;
  while ((tMatch = partTupleRegex.exec(returnBody)) !== null) {
    const name = tMatch[1];
    if (name !== targetPartName && name !== toolPartName) {
      elements.push(tMatch[0]);
    }
  }

  elements.push(`("${resultPartName}", ${resultVar}, ${outColor}, "${outKind}")`);
  // Join with a newline and proper indentation for multi-line tuples
  const separator = elements.length > 2 || returnBody.includes('\n') ? `,\n${indent}    ` : ', ';
  const updatedReturnContents = returnBody.includes('\n')
    ? `\n${indent}    ${elements.join(separator)}\n${indent}`
    : elements.join(separator);

  const codeBeforeReturn = currentCode.slice(0, match.index);
  const codeAfterReturn = currentCode.slice(match.index! + match[0].length);

  const updatedCode = `${codeBeforeReturn}${booleanStatement}\n${indent}return [${updatedReturnContents}]${codeAfterReturn}`;

  return { updatedCode, resultPartName };
}
