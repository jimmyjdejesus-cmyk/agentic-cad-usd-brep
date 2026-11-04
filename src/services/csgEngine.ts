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
  {
    id: 'clearance_hole',
    name: 'Metric Clearance Hole',
    description: 'Standard metric clearance hole (M2-M8).',
    defaultParams: { mSize: 3.0, height: 10.0 },
    paramLabels: { mSize: 'Metric Size (M)', height: 'Depth Z (cm)' },
    category: 'Holes & Fasteners',
  },
  {
    id: 'tap_hole',
    name: 'Metric Tap Hole',
    description: 'Standard metric tap hole for threading (M2-M8).',
    defaultParams: { mSize: 3.0, height: 10.0 },
    paramLabels: { mSize: 'Metric Size (M)', height: 'Depth Z (cm)' },
    category: 'Holes & Fasteners',
  },
  {
    id: 'iso4762_counterbore',
    name: 'ISO 4762 Counterbore',
    description: 'Standard socket head cap screw counterbore (M2-M8).',
    defaultParams: { mSize: 3.0, height: 10.0 },
    paramLabels: { mSize: 'Metric Size (M)', height: 'Total Depth Z (cm)' },
    category: 'Holes & Fasteners',
  },
  {
    id: 'countersink_90',
    name: '90° Countersink',
    description: '90-degree countersink hole (M2-M8).',
    defaultParams: { mSize: 3.0, height: 10.0 },
    paramLabels: { mSize: 'Metric Size (M)', height: 'Total Depth Z (cm)' },
    category: 'Holes & Fasteners',
  },
  {
    id: 'heat_set_insert',
    name: 'Heat-Set Insert Hole',
    description: 'Hole for standard brass heat-set inserts (M2-M8).',
    defaultParams: { mSize: 3.0 },
    paramLabels: { mSize: 'Metric Size (M)' },
    category: 'Holes & Fasteners',
  },
];

// --- Parametric Hole Generators ---

export function getClearanceHoleRadius(mSize: number): number {
  const map: Record<number, number> = { 2: 2.4, 2.5: 2.9, 3: 3.4, 4: 4.5, 5: 5.5, 6: 6.6, 8: 9.0 };
  return ((map[mSize] || mSize * 1.1) / 2) / 10;
}

export function getTapHoleRadius(mSize: number): number {
  const map: Record<number, number> = { 2: 1.6, 2.5: 2.05, 3: 2.5, 4: 3.3, 5: 4.2, 6: 5.0, 8: 6.8 };
  return ((map[mSize] || mSize * 0.8) / 2) / 10;
}

export function getIso4762Counterbore(mSize: number): { cbRadius: number; cbDepth: number; holeRadius: number } {
  const headDia: Record<number, number> = { 2: 3.8, 2.5: 4.5, 3: 5.5, 4: 7.0, 5: 8.5, 6: 10.0, 8: 13.0 };
  const headDepth: Record<number, number> = { 2: 2.0, 2.5: 2.5, 3: 3.0, 4: 4.0, 5: 5.0, 6: 6.0, 8: 8.0 };
  return {
    cbRadius: ((headDia[mSize] || mSize * 1.5) / 2) / 10,
    cbDepth: (headDepth[mSize] || mSize) / 10,
    holeRadius: getClearanceHoleRadius(mSize),
  };
}

export function getCountersink90(mSize: number): { headRadius: number; holeRadius: number } {
  const headDia: Record<number, number> = { 2: 4.4, 2.5: 5.5, 3: 6.3, 4: 8.3, 5: 10.4, 6: 12.4, 8: 16.5 };
  return {
    headRadius: ((headDia[mSize] || mSize * 2) / 2) / 10,
    holeRadius: getClearanceHoleRadius(mSize),
  };
}

export function getHeatSetInsert(mSize: number): { insertRadius: number; insertDepth: number } {
  const holeDia: Record<number, number> = { 2: 3.2, 2.5: 3.8, 3: 4.0, 4: 5.6, 5: 7.1, 6: 8.5, 8: 11.0 };
  const depth: Record<number, number> = { 2: 4.0, 2.5: 4.0, 3: 4.0, 4: 6.0, 5: 8.0, 6: 9.5, 8: 13.0 };
  return {
    insertRadius: ((holeDia[mSize] || mSize * 1.4) / 2) / 10,
    insertDepth: (depth[mSize] || mSize * 1.5) / 10,
  };
}

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
    case 'clearance_hole': {
      const mSize = config.params.mSize ?? 3.0;
      const h = config.params.height ?? 10.0;
      const r = getClearanceHoleRadius(mSize);
      return `    ${varName} = sm.create_cylinder(${pStr}, ${r}, ${h})`;
    }
    case 'tap_hole': {
      const mSize = config.params.mSize ?? 3.0;
      const h = config.params.height ?? 10.0;
      const r = getTapHoleRadius(mSize);
      return `    ${varName} = sm.create_cylinder(${pStr}, ${r}, ${h})`;
    }
    case 'iso4762_counterbore': {
      const mSize = config.params.mSize ?? 3.0;
      const h = config.params.height ?? 10.0;
      const cb = getIso4762Counterbore(mSize);
      // Create head bore and shaft bore, then union
      return `    ${varName}_cb = sm.create_cylinder((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz + h - cb.cbDepth).toFixed(2)}), ${cb.cbRadius}, ${cb.cbDepth})
    ${varName}_shaft = sm.create_cylinder(${pStr}, ${cb.holeRadius}, ${h - cb.cbDepth})
    ${varName} = sm.boolean_union(${varName}_cb, ${varName}_shaft)`;
    }
    case 'countersink_90': {
      const mSize = config.params.mSize ?? 3.0;
      const h = config.params.height ?? 10.0;
      const cs = getCountersink90(mSize);
      // Head depth matches headRadius - holeRadius for 90 degrees (45 deg angle)
      const headDepth = cs.headRadius - cs.holeRadius;
      return `    ${varName}_cs = sm.create_cone((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz + h - headDepth).toFixed(2)}), radius_base=${cs.holeRadius}, radius_top=${cs.headRadius}, height=${headDepth})
    ${varName}_shaft = sm.create_cylinder(${pStr}, ${cs.holeRadius}, ${h - headDepth})
    ${varName} = sm.boolean_union(${varName}_cs, ${varName}_shaft)`;
    }
    case 'heat_set_insert': {
      const mSize = config.params.mSize ?? 3.0;
      const insert = getHeatSetInsert(mSize);
      // Z is at pz - insertDepth because we're sinking it in, or we just create it at pz going up.
      // Usually used as a subtraction tool, so starting at pz and going down insertDepth.
      return `    ${varName} = sm.create_cylinder((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz - insert.insertDepth).toFixed(2)}), ${insert.insertRadius}, ${insert.insertDepth})`;
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

export type PrimitiveType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'wedge';

export interface PartParametricProperties {
  partName: string;
  varName: string;
  primitiveType: PrimitiveType;
  position: [number, number, number]; // [X, Y, Z] in cm
  dimensions: {
    width?: number;        // Box width (X) / Wedge dx
    depth?: number;        // Box depth (Y) / Wedge dy
    height?: number;       // Box/Cylinder/Cone/Wedge height (Z)
    radius?: number;       // Cylinder / Sphere radius
    radiusBase?: number;   // Cone base radius
    radiusTop?: number;    // Cone top radius
    majorRadius?: number;  // Torus major radius
    minorRadius?: number;  // Torus minor radius
  };
  rawCall?: string;
}

/**
 * Parses Python usd_brep script to extract parametric dimensions and origin transform
 * of a specific part defined in build_parts().
 */
export function parsePartParametricProperties(
  code: string,
  partName: string
): PartParametricProperties | null {
  if (!code || !partName) return null;

  // 1. Find variable name bound to partName in return [...]
  const returnRegex = /return\s*\[(.*?)\]/s;
  const returnMatch = code.match(returnRegex);
  let targetVar: string = partName;

  if (returnMatch) {
    const returnBody = returnMatch[1];
    const tupleRegex = /\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_]+)\s*,/g;
    let tm;
    while ((tm = tupleRegex.exec(returnBody)) !== null) {
      if (tm[1] === partName) {
        targetVar = tm[2];
        break;
      }
    }
  }

  // 2. Locate the definition statement: targetVar = sm.create_*(...)
  // Match the line: targetVar = sm.create_<type>(...); allow nested parens on the line
  const defRegex = new RegExp(
    `^\\s*${targetVar}\\s*=\\s*sm\\.create_(box|cylinder|sphere|cone|torus|wedge)\\s*\\((.*)\\)\\s*$`,
    'm'
  );
  const defMatch = code.match(defRegex);
  if (!defMatch) {
    return null;
  }

  const primType = defMatch[1] as PrimitiveType;
  const rawArgs = defMatch[2].trim();

  // Helper to parse coordinate tuple (x, y, z)
  const coordMatch = rawArgs.match(/^\s*\(\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\)/);
  if (!coordMatch) {
    return null;
  }

  const px = parseFloat(coordMatch[1]);
  const py = parseFloat(coordMatch[2]);
  const pz = parseFloat(coordMatch[3]);
  const position: [number, number, number] = [px, py, pz];

  const remainingArgsStr = rawArgs.slice(coordMatch[0].length).replace(/^[\s,]+/, '');

  switch (primType) {
    case 'box': {
      // sm.create_box((ox, oy, oz), width, depth, height)
      const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
      if (numMatches && numMatches.length >= 3) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'box',
          position,
          dimensions: {
            width: parseFloat(numMatches[0]),
            depth: parseFloat(numMatches[1]),
            height: parseFloat(numMatches[2]),
          },
          rawCall: defMatch[0].trim(),
        };
      }
      break;
    }
    case 'cylinder': {
      // sm.create_cylinder((cx, cy, z0), radius, height)
      const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
      if (numMatches && numMatches.length >= 2) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'cylinder',
          position,
          dimensions: {
            radius: parseFloat(numMatches[0]),
            height: parseFloat(numMatches[1]),
          },
          rawCall: defMatch[0].trim(),
        };
      }
      break;
    }
    case 'sphere': {
      // sm.create_sphere((cx, cy, cz), radius)
      const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
      if (numMatches && numMatches.length >= 1) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'sphere',
          position,
          dimensions: {
            radius: parseFloat(numMatches[0]),
          },
          rawCall: defMatch[0].trim(),
        };
      }
      break;
    }
    case 'cone': {
      // sm.create_cone((cx, cy, z0), radius_base=..., radius_top=..., height=...) or positional
      const rBaseMatch = remainingArgsStr.match(/radius_base\s*=\s*(-?[0-9.]+)/);
      const rTopMatch = remainingArgsStr.match(/radius_top\s*=\s*(-?[0-9.]+)/);
      const hMatch = remainingArgsStr.match(/height\s*=\s*(-?[0-9.]+)/);

      if (rBaseMatch && rTopMatch && hMatch) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'cone',
          position,
          dimensions: {
            radiusBase: parseFloat(rBaseMatch[1]),
            radiusTop: parseFloat(rTopMatch[1]),
            height: parseFloat(hMatch[1]),
          },
          rawCall: defMatch[0].trim(),
        };
      } else {
        const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
        if (numMatches && numMatches.length >= 3) {
          return {
            partName,
            varName: targetVar,
            primitiveType: 'cone',
            position,
            dimensions: {
              radiusBase: parseFloat(numMatches[0]),
              radiusTop: parseFloat(numMatches[1]),
              height: parseFloat(numMatches[2]),
            },
            rawCall: defMatch[0].trim(),
          };
        }
      }
      break;
    }
    case 'torus': {
      // sm.create_torus((cx, cy, cz), r_maj, r_min)
      const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
      if (numMatches && numMatches.length >= 2) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'torus',
          position,
          dimensions: {
            majorRadius: parseFloat(numMatches[0]),
            minorRadius: parseFloat(numMatches[1]),
          },
          rawCall: defMatch[0].trim(),
        };
      }
      break;
    }
    case 'wedge': {
      // sm.create_wedge((ox, oy, oz), width, depth, height)
      const numMatches = remainingArgsStr.match(/-?[0-9.]+/g);
      if (numMatches && numMatches.length >= 3) {
        return {
          partName,
          varName: targetVar,
          primitiveType: 'wedge',
          position,
          dimensions: {
            width: parseFloat(numMatches[0]),
            depth: parseFloat(numMatches[1]),
            height: parseFloat(numMatches[2]),
          },
          rawCall: defMatch[0].trim(),
        };
      }
      break;
    }
  }

  return null;
}

/**
 * Updates parametric dimensions and/or [X, Y, Z] position of a specific part in Python code.
 * Preserves surrounding formatting, comments, and other part definitions.
 */
export function updatePartParametricProperties(
  code: string,
  partName: string,
  updates: {
    position?: [number, number, number];
    dimensions?: Partial<PartParametricProperties['dimensions']>;
  }
): { updatedCode: string; success: boolean } {
  const current = parsePartParametricProperties(code, partName);
  if (!current) {
    return { updatedCode: code, success: false };
  }

  const targetVar = current.varName;
  const newPos = updates.position ?? current.position;
  const newDims = { ...current.dimensions, ...updates.dimensions };

  const [px, py, pz] = newPos;
  const pStr = `(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`;

  let newCall = '';
  switch (current.primitiveType) {
    case 'box': {
      const w = (newDims.width ?? 10.0).toFixed(2);
      const d = (newDims.depth ?? 10.0).toFixed(2);
      const h = (newDims.height ?? 5.0).toFixed(2);
      newCall = `${targetVar} = sm.create_box(${pStr}, ${w}, ${d}, ${h})`;
      break;
    }
    case 'cylinder': {
      const r = (newDims.radius ?? 4.0).toFixed(2);
      const h = (newDims.height ?? 8.0).toFixed(2);
      newCall = `${targetVar} = sm.create_cylinder(${pStr}, ${r}, ${h})`;
      break;
    }
    case 'sphere': {
      const r = (newDims.radius ?? 5.0).toFixed(2);
      newCall = `${targetVar} = sm.create_sphere(${pStr}, ${r})`;
      break;
    }
    case 'cone': {
      const rb = (newDims.radiusBase ?? 5.0).toFixed(2);
      const rt = (newDims.radiusTop ?? 0.0).toFixed(2);
      const h = (newDims.height ?? 10.0).toFixed(2);
      newCall = `${targetVar} = sm.create_cone(${pStr}, radius_base=${rb}, radius_top=${rt}, height=${h})`;
      break;
    }
    case 'torus': {
      const rMaj = (newDims.majorRadius ?? 6.0).toFixed(2);
      const rMin = (newDims.minorRadius ?? 1.5).toFixed(2);
      newCall = `${targetVar} = sm.create_torus(${pStr}, ${rMaj}, ${rMin})`;
      break;
    }
    case 'wedge': {
      const w = (newDims.width ?? 6.0).toFixed(2);
      const d = (newDims.depth ?? 6.0).toFixed(2);
      const h = (newDims.height ?? 4.0).toFixed(2);
      newCall = `${targetVar} = sm.create_wedge(${pStr}, ${w}, ${d}, ${h})`;
      break;
    }
    default:
      return { updatedCode: code, success: false };
  }

  // Regex to replace only the specific assignment statement for targetVar
  const lineRegex = new RegExp(
    `^(\\s*)${targetVar}\\s*=\\s*sm\\.create_${current.primitiveType}\\s*\\(.*\\)\\s*$`,
    'm'
  );

  const match = code.match(lineRegex);
  if (!match) {
    return { updatedCode: code, success: false };
  }

  const indent = match[1];
  const updatedCode = code.replace(lineRegex, `${indent}${newCall}`);
  return { updatedCode, success: true };
}

export interface GizmoTransformDelta {
  translation?: [number, number, number]; // [dx, dy, dz] in cm
  rotation?: [number, number, number];    // [rx, ry, rz] Euler angles in degrees
  scale?: [number, number, number];       // [sx, sy, sz] scale factors
}

/**
 * Commits interactive 3D gizmo transforms (translation, rotation, scale) back into the Python CAD script.
 *
 * Strategy:
 * 1. If translation is provided and the part is defined directly via an origin-supporting primitive
 *    (and without prior sm.rotate/sm.translate chained after it), updates its origin coordinate tuple directly.
 * 2. If rotation or scale is present, or if direct origin editing cannot be applied, injects or appends
 *    `sm.translate(...)`, `sm.rotate(...)`, or `sm.scale(...)` on the part's variable immediately before
 *    the `return [...]` statement in `build_parts()`.
 */
export function applyGizmoTransformToScript(
  code: string,
  partName: string,
  transform: GizmoTransformDelta
): { updatedCode: string; success: boolean } {
  if (!code || !partName) return { updatedCode: code, success: false };

  const { translation, rotation, scale } = transform;
  const hasTrans = translation && (Math.abs(translation[0]) > 1e-4 || Math.abs(translation[1]) > 1e-4 || Math.abs(translation[2]) > 1e-4);
  const hasRot = rotation && (Math.abs(rotation[0]) > 1e-4 || Math.abs(rotation[1]) > 1e-4 || Math.abs(rotation[2]) > 1e-4);
  const hasScale = scale && (Math.abs(scale[0] - 1.0) > 1e-4 || Math.abs(scale[1] - 1.0) > 1e-4 || Math.abs(scale[2] - 1.0) > 1e-4);

  if (!hasTrans && !hasRot && !hasScale) {
    return { updatedCode: code, success: true };
  }

  // 1. Locate targetVar from partName in return [...]
  const returnRegex = /(\s+)return\s*\[(.*?)\]/s;
  const returnMatch = code.match(returnRegex);
  let targetVar = partName;

  if (returnMatch) {
    const returnBody = returnMatch[2];
    const tupleRegex = /\(\s*["']([^"']+)["']\s*,\s*([A-Za-z0-9_]+)\s*,/g;
    let tm;
    while ((tm = tupleRegex.exec(returnBody)) !== null) {
      if (tm[1] === partName) {
        targetVar = tm[2];
        break;
      }
    }
  }

  // If translation only (no rotation or scale), check if we can update the primitive origin in-place
  if (hasTrans && !hasRot && !hasScale) {
    const currentProps = parsePartParametricProperties(code, partName);
    if (currentProps) {
      // Check if code has existing sm.translate or sm.rotate on this variable
      const hasPostTransforms = new RegExp(`sm\\.(?:translate|rotate)\\(\\s*${targetVar}\\b`).test(code);
      if (!hasPostTransforms) {
        const newPos: [number, number, number] = [
          Number((currentProps.position[0] + translation![0]).toFixed(3)),
          Number((currentProps.position[1] + translation![1]).toFixed(3)),
          Number((currentProps.position[2] + translation![2]).toFixed(3)),
        ];
        const res = updatePartParametricProperties(code, partName, { position: newPos });
        if (res.success) {
          return { updatedCode: res.updatedCode, success: true };
        }
      }
    }
  }

  // If we have rotation, scale, or translation on a composite / non-primitive part,
  // inject sm.translate / sm.rotate / sm.scale calls before return [...]
  if (!returnMatch) {
    return { updatedCode: code, success: false };
  }

  const indent = returnMatch[1];
  const statements: string[] = [];

  if (hasTrans && translation) {
    const dx = Number(translation[0].toFixed(3));
    const dy = Number(translation[1].toFixed(3));
    const dz = Number(translation[2].toFixed(3));
    statements.push(`${indent}sm.translate(${targetVar}, (${dx}, ${dy}, ${dz}))`);
  }

  if (hasRot && rotation) {
    // Rotation angles around X, Y, Z
    if (Math.abs(rotation[0]) > 1e-4) {
      statements.push(`${indent}sm.rotate(${targetVar}, ref_point=(0.0, 0.0, 0.0), axis=(1.0, 0.0, 0.0), angle_deg=${Number(rotation[0].toFixed(2))})`);
    }
    if (Math.abs(rotation[1]) > 1e-4) {
      statements.push(`${indent}sm.rotate(${targetVar}, ref_point=(0.0, 0.0, 0.0), axis=(0.0, 1.0, 0.0), angle_deg=${Number(rotation[1].toFixed(2))})`);
    }
    if (Math.abs(rotation[2]) > 1e-4) {
      statements.push(`${indent}sm.rotate(${targetVar}, ref_point=(0.0, 0.0, 0.0), axis=(0.0, 0.0, 1.0), angle_deg=${Number(rotation[2].toFixed(2))})`);
    }
  }

  if (hasScale && scale) {
    const sx = Number(scale[0].toFixed(3));
    const sy = Number(scale[1].toFixed(3));
    const sz = Number(scale[2].toFixed(3));
    statements.push(`${indent}sm.scale(${targetVar}, (${sx}, ${sy}, ${sz}))`);
  }

  if (statements.length === 0) {
    return { updatedCode: code, success: true };
  }

  const codeBeforeReturn = code.slice(0, returnMatch.index);
  const codeReturnAndAfter = code.slice(returnMatch.index!);
  const updatedCode = `${codeBeforeReturn}${statements.join('\n')}\n${codeReturnAndAfter}`;

  return { updatedCode, success: true };
}
