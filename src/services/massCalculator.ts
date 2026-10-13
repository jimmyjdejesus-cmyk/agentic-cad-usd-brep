import { AssemblyMassProperties, CadPartOutput, MaterialPreset } from '../types/cad';

export const MATERIAL_PRESETS: MaterialPreset[] = [
  // --- Aluminum Alloys ---
  {
    id: 'al_6061',
    name: 'Aluminum 6061-T6 (Default)',
    density: 2.70,
    category: 'Aluminum',
    family: 'Aluminum',
    description: 'General-purpose structural alloy with good weldability and corrosion resistance.',
    typicalUse: 'Aerospace frames, robotics, bike frames, CNC machined brackets',
    tags: ['aluminum', 'al', '6061', 'metal', 'lightweight', 'aerospace'],
  },
  {
    id: 'al_7075',
    name: 'Aluminum 7075-T6 (Aircraft Spec)',
    density: 2.81,
    category: 'Aluminum',
    family: 'Aluminum',
    description: 'Ultra-high strength zinc-alloyed aluminum comparable to many steels.',
    typicalUse: 'Aircraft bulkheads, missile skins, high-stress gears',
    tags: ['aluminum', 'al', '7075', 'aircraft', 'high strength', 'aerospace'],
  },
  {
    id: 'al_2024',
    name: 'Aluminum 2024-T3',
    density: 2.78,
    category: 'Aluminum',
    family: 'Aluminum',
    description: 'High fatigue strength alloy with exceptional fracture toughness.',
    typicalUse: 'Aircraft wing tension members, shear webs, fuselage skins',
    tags: ['aluminum', 'al', '2024', 'fatigue', 'aviation'],
  },
  {
    id: 'al_5052',
    name: 'Aluminum 5052-H32',
    density: 2.68,
    category: 'Aluminum',
    family: 'Aluminum',
    description: 'Non-heat treatable magnesium-alloyed aluminum with superior saltwater resistance.',
    typicalUse: 'Sheet metal enclosures, marine hulls, fuel tanks',
    tags: ['aluminum', 'al', '5052', 'sheet metal', 'marine'],
  },
  {
    id: 'al_cast_a380',
    name: 'Cast Aluminum A380',
    density: 2.71,
    category: 'Aluminum',
    family: 'Aluminum',
    description: 'Most common die-casting aluminum with excellent fluid flow and stiffness.',
    typicalUse: 'Gearbox housings, engine brackets, power tool bodies',
    tags: ['aluminum', 'die cast', 'a380', 'housing'],
  },

  // --- Steels & Iron Alloys ---
  {
    id: 'steel_1018',
    name: 'Structural Steel 1018 (Mild Steel)',
    density: 7.85,
    category: 'Steel',
    family: 'Steel',
    description: 'Low-carbon cold-rolled mild steel with balanced ductility and strength.',
    typicalUse: 'Shafts, spindles, pins, structural weldments',
    tags: ['steel', '1018', 'mild steel', 'ferrous', 'structural'],
  },
  {
    id: 'steel_4140',
    name: 'Chromoly Steel 4140 (Alloy Steel)',
    density: 7.85,
    category: 'Steel',
    family: 'Steel',
    description: 'Chromium-molybdenum hardened alloy steel with high fatigue and impact strength.',
    typicalUse: 'Crankshafts, drive axles, high-torque gears, hydraulic machinery',
    tags: ['steel', '4140', 'chromoly', 'high strength', 'automotive'],
  },
  {
    id: 'stainless_304',
    name: 'Stainless Steel 304',
    density: 8.00,
    category: 'Steel',
    family: 'Steel',
    description: 'Austenitic 18/8 stainless steel with exceptional chemical corrosion resistance.',
    typicalUse: 'Food processing, architectural trim, fluid tubing, fasteners',
    tags: ['steel', 'stainless', '304', 'corrosion', 'hygienic'],
  },
  {
    id: 'stainless_316l',
    name: 'Stainless Steel 316L (Marine / Medical)',
    density: 8.00,
    category: 'Steel',
    family: 'Steel',
    description: 'Molybdenum-bearing austenitic stainless steel resistant to chlorides and pitting.',
    typicalUse: 'Marine hardware, surgical implants, chemical reactors',
    tags: ['steel', 'stainless', '316l', 'marine', 'medical', 'acid'],
  },
  {
    id: 'tool_steel_a2',
    name: 'Tool Steel A2 (Air-Hardening)',
    density: 7.86,
    category: 'Steel',
    family: 'Steel',
    description: 'Versatile air-hardening cold-work tool steel with great wear resistance.',
    typicalUse: 'Punches, stamping dies, shear blades, chuck jaws',
    tags: ['steel', 'tool steel', 'a2', 'die', 'wear'],
  },
  {
    id: 'gray_iron',
    name: 'Gray Cast Iron (Class 30)',
    density: 7.15,
    category: 'Steel',
    family: 'Cast Iron',
    description: 'Flake-graphite cast iron with superb vibration damping and machinability.',
    typicalUse: 'Machine tool beds, brake rotors, engine blocks',
    tags: ['iron', 'cast iron', 'gray iron', 'damping', 'lathe'],
  },

  // --- Titanium & Superalloys ---
  {
    id: 'titanium_gr5',
    name: 'Titanium Ti-6Al-4V (Grade 5)',
    density: 4.43,
    category: 'Titanium',
    family: 'Titanium',
    description: 'Alpha-beta titanium alloy offering the highest strength-to-density ratio.',
    typicalUse: 'Turbine blades, aerospace fasteners, prosthetics, racing suspension',
    tags: ['titanium', 'ti', 'grade 5', '6al4v', 'aerospace', 'lightweight'],
  },
  {
    id: 'titanium_gr2',
    name: 'Titanium Grade 2 (Commercial Pure)',
    density: 4.51,
    category: 'Titanium',
    family: 'Titanium',
    description: 'Unalloyed titanium with moderate strength and superior chemical ductility.',
    typicalUse: 'Heat exchangers, chemical piping, exhaust systems',
    tags: ['titanium', 'ti', 'grade 2', 'pure titanium', 'corrosion'],
  },
  {
    id: 'inconel_718',
    name: 'Inconel 718 (Nickel Superalloy)',
    density: 8.19,
    category: 'Superalloys',
    family: 'Nickel',
    description: 'Precipitation-hardened nickel-chromium alloy maintaining strength up to 700°C.',
    typicalUse: 'Rocket nozzles, jet engine combustors, nuclear components',
    tags: ['inconel', 'superalloy', 'nickel', '718', 'high temperature', 'rocket'],
  },
  {
    id: 'magnesium_az31b',
    name: 'Magnesium AZ31B (Ultralight)',
    density: 1.77,
    category: 'Light Alloys',
    family: 'Magnesium',
    description: 'Extremely lightweight structural metal, 35% lighter than aluminum.',
    typicalUse: 'Camera bodies, racing steering wheels, drone chassis',
    tags: ['magnesium', 'mg', 'az31b', 'ultralight', 'drone'],
  },
  {
    id: 'tungsten_alloy',
    name: 'Tungsten Heavy Alloy (W-Ni-Fe)',
    density: 18.50,
    category: 'Heavy Metals',
    family: 'Tungsten',
    description: 'Ultra-dense sintered refractory metal used for counterweights and shielding.',
    typicalUse: 'Inertial balance weights, gyroscopes, radiation shields',
    tags: ['tungsten', 'heavy', 'dense', 'ballast', 'counterweight'],
  },

  // --- Copper & Brass ---
  {
    id: 'brass_c360',
    name: 'Free-Cutting Brass C360',
    density: 8.50,
    category: 'Copper / Brass',
    family: 'Brass',
    description: 'Standard 100% machinability rating brass alloy with pleasant gold luster.',
    typicalUse: 'Bushings, clock gears, fluid couplings, valves',
    tags: ['brass', 'c360', 'copper', 'bushing', 'turned'],
  },
  {
    id: 'bronze_c510',
    name: 'Phosphor Bronze C510',
    density: 8.86,
    category: 'Copper / Brass',
    family: 'Bronze',
    description: 'High fatigue limit bronze alloy with low friction and elastic resilience.',
    typicalUse: 'Contact springs, worm gears, heavy-load sleeves',
    tags: ['bronze', 'c510', 'spring', 'bearing'],
  },
  {
    id: 'copper_c110',
    name: 'Pure Copper C110 ETP',
    density: 8.94,
    category: 'Copper / Brass',
    family: 'Copper',
    description: 'Electrolytic tough pitch copper with near-maximum thermal & electrical conductivity.',
    typicalUse: 'Liquid cold plates, bus bars, heat spreaders',
    tags: ['copper', 'c110', 'thermal', 'electrical', 'heatsink'],
  },

  // --- Engineering Plastics & Polymers (ABS, Delrin, Nylon, etc.) ---
  {
    id: 'abs_plastic',
    name: 'ABS Industrial Polymer',
    density: 1.04,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Acrylonitrile Butadiene Styrene with high impact resistance and rigidity.',
    typicalUse: 'Consumer electronics casings, automotive trim, 3D printing, pipe fittings',
    tags: ['abs', 'plastic', 'polymer', 'casing', 'injection molding', '3d print'],
  },
  {
    id: 'pla_plastic',
    name: 'PLA Thermoplastic (Polylactic Acid)',
    density: 1.24,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Renewable corn-starch derived thermoplastic with high tensile modulus.',
    typicalUse: 'Rapid prototyping, functional mockups, additive parts',
    tags: ['pla', 'plastic', 'polymer', '3d print', 'filament', 'bioplastic'],
  },
  {
    id: 'delrin_pom',
    name: 'Delrin / Acetal (POM-H)',
    density: 1.42,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'High-stiffness engineering homopolymer with natural low coefficient of friction.',
    typicalUse: 'Precision spur gears, linear slide bushings, cams, fuel senders',
    tags: ['delrin', 'pom', 'acetal', 'gear', 'low friction', 'bushing'],
  },
  {
    id: 'nylon_66',
    name: 'Nylon 6/6 (Polyamide PA66)',
    density: 1.14,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Tough semicrystalline polyamide with excellent abrasion resistance.',
    typicalUse: 'Cable ties, snap-fit joints, conveyor rollers, power tool housings',
    tags: ['nylon', 'pa66', 'polyamide', 'tough', 'abrasion'],
  },
  {
    id: 'polycarbonate_pc',
    name: 'Polycarbonate (PC)',
    density: 1.20,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Virtually unbreakable transparent thermoplastic with high glass transition temp.',
    typicalUse: 'Machine safety shields, headlight lenses, drone canopies',
    tags: ['pc', 'polycarbonate', 'impact', 'transparent', 'lens'],
  },
  {
    id: 'peek_polymer',
    name: 'PEEK (Polyetheretherketone)',
    density: 1.32,
    category: 'Plastics / ABS',
    family: 'High-Perf Polymer',
    description: 'Ultra-high temperature thermoplastic replacing metals in aerospace and medical.',
    typicalUse: 'High-vacuum isolators, spinal implants, semiconductor carriers',
    tags: ['peek', 'high temp', 'medical', 'aerospace', 'plasma'],
  },
  {
    id: 'ptfe_teflon',
    name: 'PTFE (Teflon)',
    density: 2.20,
    category: 'Plastics / ABS',
    family: 'Fluoropolymer',
    description: 'Fluorocarbon solid with the lowest friction of any solid material.',
    typicalUse: 'Chemical gaskets, non-stick slide pads, cryogenic seals',
    tags: ['ptfe', 'teflon', 'gasket', 'chemical', 'low friction'],
  },
  {
    id: 'acrylic_pmma',
    name: 'Acrylic (PMMA / Plexiglas)',
    density: 1.18,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Optically clear thermoplastic with 92% light transmittance.',
    typicalUse: 'Sight glasses, light guides, optical displays',
    tags: ['acrylic', 'pmma', 'optical', 'clear', 'window'],
  },
  {
    id: 'petg_polymer',
    name: 'PETG (Glycol-Modified PET)',
    density: 1.27,
    category: 'Plastics / ABS',
    family: 'Polymer',
    description: 'Chemical-resistant thermoplastic balancing PLA ease with ABS toughness.',
    typicalUse: 'Chemical containers, functional 3D printed mechanical brackets',
    tags: ['petg', 'filament', '3d print', 'tough'],
  },

  // --- Composites & Ceramics ---
  {
    id: 'carbon_fiber',
    name: 'Carbon Fiber Composite (CFRP 60% Fiber)',
    density: 1.55,
    category: 'Composites',
    family: 'Composite',
    description: 'Woven carbon fiber prepreg in epoxy resin offering highest specific stiffness.',
    typicalUse: 'Racing monocoques, drone arms, satellite booms',
    tags: ['carbon fiber', 'cfrp', 'composite', 'stiffness', 'racing'],
  },
  {
    id: 'fiberglass_g10',
    name: 'Fiberglass G10 / FR-4',
    density: 1.85,
    category: 'Composites',
    family: 'Composite',
    description: 'Continuous woven glass cloth impregnated with epoxy resin binder.',
    typicalUse: 'PCB substrates, electrical insulators, high-strength knife handles',
    tags: ['fiberglass', 'g10', 'fr4', 'insulator', 'circuit'],
  },
  {
    id: 'alumina_ceramic',
    name: 'Alumina Ceramic (Al2O3 99.5%)',
    density: 3.95,
    category: 'Ceramics',
    family: 'Ceramic',
    description: 'Extremely hard technical ceramic with high electrical insulation and wear resistance.',
    typicalUse: 'Laser tubes, high-voltage standoffs, wear guides, armor plates',
    tags: ['ceramic', 'alumina', 'al2o3', 'insulator', 'hard'],
  },
  {
    id: 'polyurethane_rubber',
    name: 'Polyurethane Elastomer (Shore 90A)',
    density: 1.20,
    category: 'Elastomers',
    family: 'Elastomer',
    description: 'Tough synthetic elastomer with high tear strength and shock damping.',
    typicalUse: 'Vibration dampers, bumper stops, drive belts',
    tags: ['polyurethane', 'pu', 'rubber', 'elastomer', 'damper'],
  },
];

export const DEFAULT_MATERIAL = MATERIAL_PRESETS[0];

export const MATERIAL_CATEGORIES = [
  'All',
  'Aluminum',
  'Steel',
  'Titanium',
  'Plastics / ABS',
  'Copper / Brass',
  'Superalloys',
  'Composites',
  'Ceramics',
] as const;

export function calculateAssemblyMassProperties(
  parts: CadPartOutput[],
  material: MaterialPreset = DEFAULT_MATERIAL,
  customDensity?: number
): AssemblyMassProperties {
  const density = typeof customDensity === 'number' && customDensity > 0 ? customDensity : material.density;

  if (!parts || parts.length === 0) {
    return {
      material,
      density,
      totalVolumeCm3: 0,
      totalMassGrams: 0,
      totalMassKg: 0,
      totalMassLbs: 0,
      centerOfMass: [0, 0, 0],
      boundingBox: {
        min: [0, 0, 0],
        max: [0, 0, 0],
        dimensions: [0, 0, 0],
        volumeCm3: 0,
      },
    };
  }

  let totalVolume = 0;
  let weightedCenterX = 0;
  let weightedCenterY = 0;
  let weightedCenterZ = 0;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const part of parts) {
    const vol = Math.max(0.001, part.diagnostics.volume || 0.1);
    const [cx, cy, cz] = part.diagnostics.center;
    const [pMin, pMax] = part.diagnostics.bounds;

    totalVolume += vol;
    weightedCenterX += cx * vol;
    weightedCenterY += cy * vol;
    weightedCenterZ += cz * vol;

    if (pMin[0] < minX) minX = pMin[0];
    if (pMin[1] < minY) minY = pMin[1];
    if (pMin[2] < minZ) minZ = pMin[2];
    if (pMax[0] > maxX) maxX = pMax[0];
    if (pMax[1] > maxY) maxY = pMax[1];
    if (pMax[2] > maxZ) maxZ = pMax[2];
  }

  if (!Number.isFinite(minX)) {
    minX = minY = minZ = maxX = maxY = maxZ = 0;
  }

  const comX = totalVolume > 0 ? weightedCenterX / totalVolume : 0;
  const comY = totalVolume > 0 ? weightedCenterY / totalVolume : 0;
  const comZ = totalVolume > 0 ? weightedCenterZ / totalVolume : 0;

  const dimX = Math.max(0, maxX - minX);
  const dimY = Math.max(0, maxY - minY);
  const dimZ = Math.max(0, maxZ - minZ);
  const boxVolume = dimX * dimY * dimZ;

  const totalMassGrams = totalVolume * density;
  const totalMassKg = totalMassGrams / 1000;
  const totalMassLbs = totalMassKg * 2.20462262;

  return {
    material,
    density,
    totalVolumeCm3: Number(totalVolume.toFixed(3)),
    totalMassGrams: Number(totalMassGrams.toFixed(2)),
    totalMassKg: Number(totalMassKg.toFixed(4)),
    totalMassLbs: Number(totalMassLbs.toFixed(4)),
    centerOfMass: [
      Number(comX.toFixed(3)),
      Number(comY.toFixed(3)),
      Number(comZ.toFixed(3)),
    ],
    boundingBox: {
      min: [Number(minX.toFixed(3)), Number(minY.toFixed(3)), Number(minZ.toFixed(3))],
      max: [Number(maxX.toFixed(3)), Number(maxY.toFixed(3)), Number(maxZ.toFixed(3))],
      dimensions: [Number(dimX.toFixed(3)), Number(dimY.toFixed(3)), Number(dimZ.toFixed(3))],
      volumeCm3: Number(boxVolume.toFixed(3)),
    },
  };
}
