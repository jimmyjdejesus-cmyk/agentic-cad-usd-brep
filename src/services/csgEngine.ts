/**
 * ApexCAD CSG & 3D Solid Modeling Engine
 * 
 * Provides interactive client-side 3D modeling primitives and boolean operations
 * (Union, Subtract/Difference, Intersect) synchronized with Python usd_brep scripts.
 */

export type MetricFastenerSize = 'M2' | 'M2.5' | 'M3' | 'M4' | 'M5' | 'M6' | 'M8';

export interface MetricFastenerSpec {
  nominalDia: number;        // Nominal screw diameter in mm
  clearanceNormalDia: number; // ISO 273 normal clearance hole diameter in mm
  clearanceCloseDia: number;  // ISO 273 close clearance hole diameter in mm
  tapDrillDia: number;       // Standard metric tap drill diameter in mm
  shcsHeadDia: number;       // ISO 4762 / DIN 912 socket head cap screw head diameter in mm
  shcsHeadHeight: number;    // ISO 4762 head height in mm
  countersinkHeadDia: number;// ISO 10642 90° countersink head diameter in mm
  countersinkAngle: number;  // 90 degrees
  heatSetHoleDia: number;    // Voron / CNC Kitchen standard hole drill diameter in mm
  heatSetHoleDepth: number;  // Recommended insert hole depth in mm
  heatSetBossOd: number;     // Recommended 3D print outer boss diameter in mm
  nutWidthAcrossFlats: number; // DIN 934 hex nut width across flats (s) in mm
  nutThickness: number;      // DIN 934 hex nut thickness (m) in mm
}

/**
 * Standard metric fastener engineering specification table (all dimensions in mm).
 * Accurate within +/- 0.05 mm of ISO 273, ISO 4762, ISO 10642, DIN 934 and Voron/CNC Kitchen specs.
 */
export const METRIC_FASTENER_SPECS: Record<MetricFastenerSize, MetricFastenerSpec> = {
  M2: {
    nominalDia: 2.0,
    clearanceNormalDia: 2.4,
    clearanceCloseDia: 2.2,
    tapDrillDia: 1.6,
    shcsHeadDia: 3.8,
    shcsHeadHeight: 2.0,
    countersinkHeadDia: 4.4,
    countersinkAngle: 90,
    heatSetHoleDia: 3.2,
    heatSetHoleDepth: 4.0,
    heatSetBossOd: 6.0,
    nutWidthAcrossFlats: 4.0,
    nutThickness: 1.6,
  },
  'M2.5': {
    nominalDia: 2.5,
    clearanceNormalDia: 2.9,
    clearanceCloseDia: 2.7,
    tapDrillDia: 2.05,
    shcsHeadDia: 4.5,
    shcsHeadHeight: 2.5,
    countersinkHeadDia: 5.5,
    countersinkAngle: 90,
    heatSetHoleDia: 3.8,
    heatSetHoleDepth: 4.8,
    heatSetBossOd: 7.0,
    nutWidthAcrossFlats: 5.0,
    nutThickness: 2.0,
  },
  M3: {
    nominalDia: 3.0,
    clearanceNormalDia: 3.4,
    clearanceCloseDia: 3.2,
    tapDrillDia: 2.5,
    shcsHeadDia: 5.5,
    shcsHeadHeight: 3.0,
    countersinkHeadDia: 6.5,
    countersinkAngle: 90,
    heatSetHoleDia: 4.6,
    heatSetHoleDepth: 5.7,
    heatSetBossOd: 8.0,
    nutWidthAcrossFlats: 5.5,
    nutThickness: 2.4,
  },
  M4: {
    nominalDia: 4.0,
    clearanceNormalDia: 4.5,
    clearanceCloseDia: 4.3,
    tapDrillDia: 3.3,
    shcsHeadDia: 7.0,
    shcsHeadHeight: 4.0,
    countersinkHeadDia: 8.5,
    countersinkAngle: 90,
    heatSetHoleDia: 6.3,
    heatSetHoleDepth: 7.0,
    heatSetBossOd: 10.0,
    nutWidthAcrossFlats: 7.0,
    nutThickness: 3.2,
  },
  M5: {
    nominalDia: 5.0,
    clearanceNormalDia: 5.5,
    clearanceCloseDia: 5.3,
    tapDrillDia: 4.2,
    shcsHeadDia: 8.5,
    shcsHeadHeight: 5.0,
    countersinkHeadDia: 10.4,
    countersinkAngle: 90,
    heatSetHoleDia: 7.1,
    heatSetHoleDepth: 9.5,
    heatSetBossOd: 12.0,
    nutWidthAcrossFlats: 8.0,
    nutThickness: 4.0,
  },
  M6: {
    nominalDia: 6.0,
    clearanceNormalDia: 6.6,
    clearanceCloseDia: 6.4,
    tapDrillDia: 5.0,
    shcsHeadDia: 10.0,
    shcsHeadHeight: 6.0,
    countersinkHeadDia: 12.4,
    countersinkAngle: 90,
    heatSetHoleDia: 8.7,
    heatSetHoleDepth: 12.7,
    heatSetBossOd: 14.5,
    nutWidthAcrossFlats: 10.0,
    nutThickness: 5.0,
  },
  M8: {
    nominalDia: 8.0,
    clearanceNormalDia: 9.0,
    clearanceCloseDia: 8.4,
    tapDrillDia: 6.8,
    shcsHeadDia: 13.0,
    shcsHeadHeight: 8.0,
    countersinkHeadDia: 16.5,
    countersinkAngle: 90,
    heatSetHoleDia: 11.2,
    heatSetHoleDepth: 16.0,
    heatSetBossOd: 18.0,
    nutWidthAcrossFlats: 13.0,
    nutThickness: 6.5,
  },
};

export interface PrimitivePresetOption {
  id: string;
  label: string;
  params: Record<string, number>;
  defaultMode?: 'positive' | 'negative';
}

export interface PrimitiveOption {
  id: string;
  name: string;
  description: string;
  defaultParams: Record<string, number>;
  paramLabels: Record<string, string>;
  category: 'Primitives' | 'Mechanical' | 'Holes & Fasteners';
  presets?: PrimitivePresetOption[];
  supportsModeToggle?: boolean; // Positive (boss/extrusion) vs Negative (cutter/pocket)
  defaultMode?: 'positive' | 'negative';
}

export const PRIMITIVE_CATALOG: PrimitiveOption[] = [
  // 1. Core Geometric Primitives
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

  // 2. Metric Fasteners & Cutters
  {
    id: 'metric_hole',
    name: 'Metric Clearance / Tap Hole',
    description: 'Parametric standard clearance or tap hole tool (M2–M8) in cm.',
    defaultParams: { radius: 0.17, height: 2.0 }, // Default M3 clearance: 3.4mm dia -> 0.17cm radius
    paramLabels: { radius: 'Hole Radius (cm)', height: 'Depth / Through Length (cm)' },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'negative',
    presets: [
      { id: 'M2', label: 'M2 Clearance (Ø2.4 mm)', params: { radius: 0.12, height: 1.5 }, defaultMode: 'negative' },
      { id: 'M2.5', label: 'M2.5 Clearance (Ø2.9 mm)', params: { radius: 0.145, height: 1.5 }, defaultMode: 'negative' },
      { id: 'M3', label: 'M3 Clearance (Ø3.4 mm)', params: { radius: 0.17, height: 2.0 }, defaultMode: 'negative' },
      { id: 'M4', label: 'M4 Clearance (Ø4.5 mm)', params: { radius: 0.225, height: 2.5 }, defaultMode: 'negative' },
      { id: 'M5', label: 'M5 Clearance (Ø5.5 mm)', params: { radius: 0.275, height: 3.0 }, defaultMode: 'negative' },
      { id: 'M6', label: 'M6 Clearance (Ø6.6 mm)', params: { radius: 0.33, height: 3.5 }, defaultMode: 'negative' },
      { id: 'M8', label: 'M8 Clearance (Ø9.0 mm)', params: { radius: 0.45, height: 4.5 }, defaultMode: 'negative' },
    ],
  },
  {
    id: 'iso4762_counterbore',
    name: 'ISO 4762 SHCS Counterbore',
    description: 'Socket head cap screw counterbore pocket tool (M2–M8) with head recess and bolt clearance.',
    defaultParams: { holeRadius: 0.17, headRadius: 0.275, headDepth: 0.30, totalDepth: 2.0 },
    paramLabels: {
      holeRadius: 'Clearance Radius (cm)',
      headRadius: 'Head Recess Radius (cm)',
      headDepth: 'Head Recess Depth (cm)',
      totalDepth: 'Total Hole Depth (cm)',
    },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'negative',
    presets: [
      { id: 'M2', label: 'M2 SHCS (Ø3.8 / 2.0 mm)', params: { holeRadius: 0.12, headRadius: 0.19, headDepth: 0.20, totalDepth: 1.5 }, defaultMode: 'negative' },
      { id: 'M2.5', label: 'M2.5 SHCS (Ø4.5 / 2.5 mm)', params: { holeRadius: 0.145, headRadius: 0.225, headDepth: 0.25, totalDepth: 1.5 }, defaultMode: 'negative' },
      { id: 'M3', label: 'M3 SHCS (Ø5.5 / 3.0 mm)', params: { holeRadius: 0.17, headRadius: 0.275, headDepth: 0.30, totalDepth: 2.0 }, defaultMode: 'negative' },
      { id: 'M4', label: 'M4 SHCS (Ø7.0 / 4.0 mm)', params: { holeRadius: 0.225, headRadius: 0.35, headDepth: 0.40, totalDepth: 2.5 }, defaultMode: 'negative' },
      { id: 'M5', label: 'M5 SHCS (Ø8.5 / 5.0 mm)', params: { holeRadius: 0.275, headRadius: 0.425, headDepth: 0.50, totalDepth: 3.0 }, defaultMode: 'negative' },
      { id: 'M6', label: 'M6 SHCS (Ø10.0 / 6.0 mm)', params: { holeRadius: 0.33, headRadius: 0.50, headDepth: 0.60, totalDepth: 3.5 }, defaultMode: 'negative' },
      { id: 'M8', label: 'M8 SHCS (Ø13.0 / 8.0 mm)', params: { holeRadius: 0.45, headRadius: 0.65, headDepth: 0.80, totalDepth: 4.5 }, defaultMode: 'negative' },
    ],
  },
  {
    id: 'countersink_90deg',
    name: '90° Flat-Head Countersink',
    description: 'ISO 10642 flush flat-head screw countersink conical cutter and clearance bore.',
    defaultParams: { holeRadius: 0.17, headRadius: 0.325, sinkHeight: 0.155, totalDepth: 2.0 },
    paramLabels: {
      holeRadius: 'Clearance Radius (cm)',
      headRadius: 'Top Bevel Radius (cm)',
      sinkHeight: 'Countersink Bevel Depth (cm)',
      totalDepth: 'Total Hole Depth (cm)',
    },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'negative',
    presets: [
      { id: 'M2', label: 'M2 90° (Ø4.4 mm)', params: { holeRadius: 0.12, headRadius: 0.22, sinkHeight: 0.10, totalDepth: 1.5 }, defaultMode: 'negative' },
      { id: 'M2.5', label: 'M2.5 90° (Ø5.5 mm)', params: { holeRadius: 0.145, headRadius: 0.275, sinkHeight: 0.13, totalDepth: 1.5 }, defaultMode: 'negative' },
      { id: 'M3', label: 'M3 90° (Ø6.5 mm)', params: { holeRadius: 0.17, headRadius: 0.325, sinkHeight: 0.155, totalDepth: 2.0 }, defaultMode: 'negative' },
      { id: 'M4', label: 'M4 90° (Ø8.5 mm)', params: { holeRadius: 0.225, headRadius: 0.425, sinkHeight: 0.20, totalDepth: 2.5 }, defaultMode: 'negative' },
      { id: 'M5', label: 'M5 90° (Ø10.4 mm)', params: { holeRadius: 0.275, headRadius: 0.52, sinkHeight: 0.245, totalDepth: 3.0 }, defaultMode: 'negative' },
      { id: 'M6', label: 'M6 90° (Ø12.4 mm)', params: { holeRadius: 0.33, headRadius: 0.62, sinkHeight: 0.29, totalDepth: 3.5 }, defaultMode: 'negative' },
      { id: 'M8', label: 'M8 90° (Ø16.5 mm)', params: { holeRadius: 0.45, headRadius: 0.825, sinkHeight: 0.375, totalDepth: 4.5 }, defaultMode: 'negative' },
    ],
  },
  {
    id: 'heat_set_boss',
    name: 'Heat-Set Insert Boss / Pocket',
    description: 'Voron / CNC Kitchen standard brass threaded heat-set insert mounting boss or pocket.',
    defaultParams: { holeRadius: 0.23, holeDepth: 0.57, bossRadius: 0.40, bossHeight: 0.80 },
    paramLabels: {
      holeRadius: 'Insert Hole Radius (cm)',
      holeDepth: 'Insert Hole Depth (cm)',
      bossRadius: 'Outer Boss Radius (cm)',
      bossHeight: 'Boss Stand Height (cm)',
    },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'positive',
    presets: [
      { id: 'M2', label: 'M2 Voron (Ø3.2 / 4.0 mm)', params: { holeRadius: 0.16, holeDepth: 0.40, bossRadius: 0.30, bossHeight: 0.60 }, defaultMode: 'positive' },
      { id: 'M2.5', label: 'M2.5 Voron (Ø3.8 / 4.8 mm)', params: { holeRadius: 0.19, holeDepth: 0.48, bossRadius: 0.35, bossHeight: 0.70 }, defaultMode: 'positive' },
      { id: 'M3', label: 'M3 Voron/CNC Kitchen (Ø4.6 / 5.7 mm)', params: { holeRadius: 0.23, holeDepth: 0.57, bossRadius: 0.40, bossHeight: 0.80 }, defaultMode: 'positive' },
      { id: 'M4', label: 'M4 CNC Kitchen (Ø6.3 / 7.0 mm)', params: { holeRadius: 0.315, holeDepth: 0.70, bossRadius: 0.50, bossHeight: 1.00 }, defaultMode: 'positive' },
      { id: 'M5', label: 'M5 CNC Kitchen (Ø7.1 / 9.5 mm)', params: { holeRadius: 0.355, holeDepth: 0.95, bossRadius: 0.60, bossHeight: 1.30 }, defaultMode: 'positive' },
      { id: 'M6', label: 'M6 CNC Kitchen (Ø8.7 / 12.7 mm)', params: { holeRadius: 0.435, holeDepth: 1.27, bossRadius: 0.725, bossHeight: 1.60 }, defaultMode: 'positive' },
      { id: 'M8', label: 'M8 CNC Kitchen (Ø11.2 / 16.0 mm)', params: { holeRadius: 0.56, holeDepth: 1.60, bossRadius: 0.90, bossHeight: 2.00 }, defaultMode: 'positive' },
    ],
  },
  {
    id: 'hex_nut_trap',
    name: 'Captive Hex Nut Trap',
    description: 'DIN 934 captive hex nut pocket cutter with bolt clearance shaft.',
    defaultParams: { widthAcrossFlats: 0.55, thickness: 0.24, clearanceRadius: 0.17, depth: 1.5 },
    paramLabels: {
      widthAcrossFlats: 'Width Across Flats (cm)',
      thickness: 'Nut Pocket Thickness (cm)',
      clearanceRadius: 'Bolt Clearance Radius (cm)',
      depth: 'Bolt Clearance Depth (cm)',
    },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'negative',
    presets: [
      { id: 'M2', label: 'M2 Hex Nut (4.0 mm / 1.6 mm)', params: { widthAcrossFlats: 0.40, thickness: 0.16, clearanceRadius: 0.12, depth: 1.2 }, defaultMode: 'negative' },
      { id: 'M2.5', label: 'M2.5 Hex Nut (5.0 mm / 2.0 mm)', params: { widthAcrossFlats: 0.50, thickness: 0.20, clearanceRadius: 0.145, depth: 1.2 }, defaultMode: 'negative' },
      { id: 'M3', label: 'M3 Hex Nut (5.5 mm / 2.4 mm)', params: { widthAcrossFlats: 0.55, thickness: 0.24, clearanceRadius: 0.17, depth: 1.5 }, defaultMode: 'negative' },
      { id: 'M4', label: 'M4 Hex Nut (7.0 mm / 3.2 mm)', params: { widthAcrossFlats: 0.70, thickness: 0.32, clearanceRadius: 0.225, depth: 2.0 }, defaultMode: 'negative' },
      { id: 'M5', label: 'M5 Hex Nut (8.0 mm / 4.0 mm)', params: { widthAcrossFlats: 0.80, thickness: 0.40, clearanceRadius: 0.275, depth: 2.5 }, defaultMode: 'negative' },
      { id: 'M6', label: 'M6 Hex Nut (10.0 mm / 5.0 mm)', params: { widthAcrossFlats: 1.00, thickness: 0.50, clearanceRadius: 0.33, depth: 3.0 }, defaultMode: 'negative' },
      { id: 'M8', label: 'M8 Hex Nut (13.0 mm / 6.5 mm)', params: { widthAcrossFlats: 1.30, thickness: 0.65, clearanceRadius: 0.45, depth: 4.0 }, defaultMode: 'negative' },
    ],
  },
  {
    id: 'vslot_2020',
    name: '2020 V-Slot Extrusion Profile',
    description: 'Standard 20x20 mm aluminum V-slot/T-slot linear structural extrusion profile.',
    defaultParams: { length: 15.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 },
    paramLabels: {
      length: 'Extrusion Length Z (cm)',
      profileWidth: 'Profile Outer Width (cm)',
      slotWidth: 'Center Slot Opening (cm)',
      slotDepth: 'Slot T-Pocket Depth (cm)',
    },
    category: 'Mechanical',
    supportsModeToggle: true,
    defaultMode: 'positive',
    presets: [
      { id: '2020_100mm', label: '2020 Profile - 100 mm', params: { length: 10.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 }, defaultMode: 'positive' },
      { id: '2020_200mm', label: '2020 Profile - 200 mm', params: { length: 20.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 }, defaultMode: 'positive' },
      { id: '2020_300mm', label: '2020 Profile - 300 mm', params: { length: 30.0, profileWidth: 2.0, slotWidth: 0.6, slotDepth: 0.6 }, defaultMode: 'positive' },
      { id: '2040_200mm', label: '2040 Profile - 200 mm', params: { length: 20.0, profileWidth: 4.0, slotWidth: 0.6, slotDepth: 0.6 }, defaultMode: 'positive' },
    ],
  },
  {
    id: 'bore_hole',
    name: 'Generic Clearance Hole',
    description: 'General cylindrical clearance bore cutter tool.',
    defaultParams: { radius: 1.5, height: 12.0 },
    paramLabels: { radius: 'Bore Radius (cm)', height: 'Bore Depth (cm)' },
    category: 'Holes & Fasteners',
    supportsModeToggle: true,
    defaultMode: 'negative',
  },
];

export interface InsertPrimitiveConfig {
  type: string;
  name?: string;
  params: Record<string, number>;
  position: [number, number, number];
  color?: [number, number, number];
  kind?: 'anchor' | 'component' | 'fastener';
  mode?: 'positive' | 'negative';
}

/**
 * Generates Python usd_brep code snippet for creating a geometric primitive or hardware feature
 */
export function generatePrimitiveCodeSnippet(config: InsertPrimitiveConfig, varName: string): string {
  const [px, py, pz] = config.position;
  const pStr = `(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})`;
  const isNegative = config.mode === 'negative' || config.kind === 'fastener';

  switch (config.type) {
    case 'box': {
      const w = config.params.width ?? 10.0;
      const d = config.params.depth ?? 8.0;
      const h = config.params.height ?? 4.0;
      return `    ${varName} = sm.create_box((${px - w / 2}, ${py - d / 2}, ${pz}), ${w}, ${d}, ${h})`;
    }
    case 'cylinder':
    case 'bore_hole':
    case 'metric_hole': {
      const r = config.params.radius ?? 0.17;
      const h = config.params.height ?? 2.0;
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
    case 'iso4762_counterbore': {
      const rHole = config.params.holeRadius ?? 0.17;
      const rHead = config.params.headRadius ?? 0.275;
      const hHead = config.params.headDepth ?? 0.30;
      const hTotal = config.params.totalDepth ?? 2.0;

      // Compound tool: clearance cylinder unioned with counterbore head cylinder
      return `    _${varName}_clearance = sm.create_cylinder(${pStr}, ${rHole}, ${hTotal})\n` +
             `    _${varName}_head = sm.create_cylinder((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz + hTotal - hHead).toFixed(2)}), ${rHead}, ${hHead})\n` +
             `    ${varName} = sm.boolean_union(_${varName}_clearance, _${varName}_head)`;
    }
    case 'countersink_90deg': {
      const rHole = config.params.holeRadius ?? 0.17;
      const rHead = config.params.headRadius ?? 0.325;
      const hSink = config.params.sinkHeight ?? 0.155;
      const hTotal = config.params.totalDepth ?? 2.0;

      // Conical 90° head cone unioned with through cylinder
      return `    _${varName}_shaft = sm.create_cylinder(${pStr}, ${rHole}, ${hTotal})\n` +
             `    _${varName}_cone = sm.create_cone((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz + hTotal - hSink).toFixed(2)}), radius_base=${rHole}, radius_top=${rHead}, height=${hSink})\n` +
             `    ${varName} = sm.boolean_union(_${varName}_shaft, _${varName}_cone)`;
    }
    case 'heat_set_boss': {
      const rHole = config.params.holeRadius ?? 0.23;
      const hHole = config.params.holeDepth ?? 0.57;
      const rBoss = config.params.bossRadius ?? 0.40;
      const hBoss = config.params.bossHeight ?? 0.80;

      if (isNegative) {
        // Negative mode: cylindrical pocket hole tool
        return `    ${varName} = sm.create_cylinder(${pStr}, ${rHole}, ${hHole})`;
      }
      // Positive mode: cylindrical boss with center insert hole pre-subtracted
      return `    _${varName}_outer = sm.create_cylinder(${pStr}, ${rBoss}, ${hBoss})\n` +
             `    _${varName}_core = sm.create_cylinder((${px.toFixed(2)}, ${py.toFixed(2)}, ${(pz + hBoss - hHole).toFixed(2)}), ${rHole}, ${hHole})\n` +
             `    ${varName} = sm.boolean_difference(_${varName}_outer, _${varName}_core)`;
    }
    case 'hex_nut_trap': {
      const s = config.params.widthAcrossFlats ?? 0.55; // width across flats
      const m = config.params.thickness ?? 0.24;         // thickness
      const rHole = config.params.clearanceRadius ?? 0.17;
      const hDepth = config.params.depth ?? 1.5;

      // Hexagonal pocket generated by union of 3 rotated boxes
      const boxW = s;
      const boxD = (s / Math.sqrt(3)).toFixed(3);
      return `    _${varName}_b1 = sm.create_box((${px - s / 2}, ${py - parseFloat(boxD) / 2}, ${pz}), ${s}, ${boxD}, ${m})\n` +
             `    _${varName}_b2 = sm.create_box((${px - s / 2}, ${py - parseFloat(boxD) / 2}, ${pz}), ${s}, ${boxD}, ${m})\n` +
             `    _${varName}_b3 = sm.create_box((${px - s / 2}, ${py - parseFloat(boxD) / 2}, ${pz}), ${s}, ${boxD}, ${m})\n` +
             `    sm.rotate(_${varName}_b2, ref_point=${pStr}, axis=(0.0, 0.0, 1.0), angle_deg=60.0)\n` +
             `    sm.rotate(_${varName}_b3, ref_point=${pStr}, axis=(0.0, 0.0, 1.0), angle_deg=120.0)\n` +
             `    _${varName}_hex = sm.boolean_union(_${varName}_b1, _${varName}_b2)\n` +
             `    _${varName}_pocket = sm.boolean_union(_${varName}_hex, _${varName}_b3)\n` +
             `    _${varName}_bolt = sm.create_cylinder(${pStr}, ${rHole}, ${hDepth})\n` +
             `    ${varName} = sm.boolean_union(_${varName}_pocket, _${varName}_bolt)`;
    }
    case 'vslot_2020': {
      const len = config.params.length ?? 15.0;
      const pw = config.params.profileWidth ?? 2.0;
      const sw = config.params.slotWidth ?? 0.6;
      const sd = config.params.slotDepth ?? 0.6;

      if (isNegative) {
        // Negative mounting slot cutter: T-slot bar
        return `    ${varName} = sm.create_box((${px - sw / 2}, ${py - sd}, ${pz}), ${sw}, ${sd * 2}, ${len})`;
      }
      // Positive 2020 profile: main square bar with 4 standard mounting slots
      return `    _${varName}_body = sm.create_box((${px - pw / 2}, ${py - pw / 2}, ${pz}), ${pw}, ${pw}, ${len})\n` +
             `    _${varName}_slot_y0 = sm.create_box((${px - sw / 2}, ${py - pw / 2}, ${pz}), ${sw}, ${sd}, ${len})\n` +
             `    _${varName}_slot_y1 = sm.create_box((${px - sw / 2}, ${py + pw / 2 - sd}, ${pz}), ${sw}, ${sd}, ${len})\n` +
             `    _${varName}_slot_x0 = sm.create_box((${px - pw / 2}, ${py - sw / 2}, ${pz}), ${sd}, ${sw}, ${len})\n` +
             `    _${varName}_slot_x1 = sm.create_box((${px + pw / 2 - sd}, ${py - sw / 2}, ${pz}), ${sd}, ${sw}, ${len})\n` +
             `    _${varName}_sub1 = sm.boolean_difference(_${varName}_body, _${varName}_slot_y0)\n` +
             `    _${varName}_sub2 = sm.boolean_difference(_${varName}_sub1, _${varName}_slot_y1)\n` +
             `    _${varName}_sub3 = sm.boolean_difference(_${varName}_sub2, _${varName}_slot_x0)\n` +
             `    ${varName} = sm.boolean_difference(_${varName}_sub3, _${varName}_slot_x1)`;
    }
    default: {
      return `    ${varName} = sm.create_box((${px - 5}, ${py - 5}, ${pz}), 10.0, 10.0, 5.0)`;
    }
  }
}

/**
 * Appends a new primitive or fastener to the existing Python CAD script
 */
export function insertPrimitiveIntoScript(config: InsertPrimitiveConfig, currentCode: string): string {
  const safeName = (config.name || `${config.type}_${Date.now().toString(36).slice(-4)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const varName = safeName;
  const isCutter = config.mode === 'negative' || config.kind === 'fastener';
  const color = config.color || (isCutter ? [0.95, 0.35, 0.25] : [0.35, 0.65, 0.95]);
  const kind = config.kind || (isCutter ? 'fastener' : 'component');

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
