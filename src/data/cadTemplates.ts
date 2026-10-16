import { CadTemplate, CadTemplateType } from '../types/cad';

export const CAD_TEMPLATES: CadTemplate[] = [
  {
    id: 'box',
    name: 'Cube / Box',
    tagline: 'Basic cuboid primitive',
    description: 'Clean solid rectangular prism (10 × 10 × 10 cm) centered at origin, ready for Copilot modification.',
    defaultName: 'basic_cube',
    envelope: [15.0, 15.0, 15.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Basic Cube primitive - ready for Copilot edits."""
    cube = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 10.0)
    return [
        ("cube", cube, (0.35, 0.65, 0.95), "anchor"),
    ]
`,
  },
  {
    id: 'cylinder',
    name: 'Cylinder',
    tagline: 'Basic cylindrical primitive',
    description: 'Clean solid cylinder (radius 5 cm, height 10 cm) standing on z=0, ready for bores, threads, or shafts.',
    defaultName: 'basic_cylinder',
    envelope: [15.0, 15.0, 15.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Basic Cylinder primitive - ready for Copilot edits."""
    cylinder = sm.create_cylinder((0.0, 0.0, 0.0), 5.0, 10.0)
    return [
        ("cylinder", cylinder, (0.30, 0.75, 0.60), "anchor"),
    ]
`,
  },
  {
    id: 'sphere',
    name: 'Sphere',
    tagline: 'Basic spherical primitive',
    description: 'Clean solid sphere (radius 5 cm) centered at (0, 0, 5) resting on the ground grid.',
    defaultName: 'basic_sphere',
    envelope: [15.0, 15.0, 15.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Basic Sphere primitive - ready for Copilot edits."""
    sphere = sm.create_sphere((0.0, 0.0, 5.0), 5.0)
    return [
        ("sphere", sphere, (0.95, 0.55, 0.25), "anchor"),
    ]
`,
  },
  {
    id: 'cone',
    name: 'Cone',
    tagline: 'Basic conical primitive',
    description: 'Clean solid cone (base radius 5 cm, top radius 0.5 cm, height 10 cm) standing on z=0.',
    defaultName: 'basic_cone',
    envelope: [15.0, 15.0, 15.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Basic Cone primitive - ready for Copilot edits."""
    cone = sm.create_cone((0.0, 0.0, 0.0), radius_base=5.0, radius_top=0.5, height=10.0)
    return [
        ("cone", cone, (0.85, 0.35, 0.75), "anchor"),
    ]
`,
  },
  {
    id: 'torus',
    name: 'Torus / Ring',
    tagline: 'Basic circular ring primitive',
    description: 'Clean solid torus (major radius 5 cm, minor radius 1.5 cm) centered at origin.',
    defaultName: 'basic_torus',
    envelope: [15.0, 15.0, 10.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Basic Torus primitive - ready for Copilot edits."""
    torus = sm.create_torus((0.0, 0.0, 1.5), 5.0, 1.5)
    return [
        ("torus", torus, (0.90, 0.80, 0.20), "anchor"),
    ]
`,
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    tagline: 'Clean slate without presets',
    description: 'Minimal valid script structure with a small starter reference block. Prompt Copilot to build your part.',
    defaultName: 'my_cad_part',
    envelope: [15.0, 15.0, 15.0],
    starterCode: `import usd_brep as sm

def build_parts():
    """Custom CAD Part. Use Prompt Copilot to design and edit geometry."""
    starter = sm.create_box((-3.0, -3.0, 0.0), 6.0, 6.0, 3.0)
    return [
        ("body", starter, (0.40, 0.60, 0.85), "anchor"),
    ]
`,
  },
];

export interface BasicShapeInsertOption {
  id: CadTemplateType;
  label: string;
  defaultPartName: string;
  copilotPrompt: string;
  generateCode: (partName: string) => string;
}

export const BASIC_SHAPE_INSERT_OPTIONS: BasicShapeInsertOption[] = [
  {
    id: 'box',
    label: 'Cube',
    defaultPartName: 'box_part',
    copilotPrompt: 'Add a new solid box/cube to the assembly at the origin with dimensions 10x10x10 cm.',
    generateCode: (partName: string) => `    ${partName} = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 10.0)`,
  },
  {
    id: 'cylinder',
    label: 'Cylinder',
    defaultPartName: 'cylinder_part',
    copilotPrompt: 'Add a new solid cylinder to the assembly standing at the origin with radius 5 cm and height 10 cm.',
    generateCode: (partName: string) => `    ${partName} = sm.create_cylinder((0.0, 0.0, 0.0), 5.0, 10.0)`,
  },
  {
    id: 'sphere',
    label: 'Sphere',
    defaultPartName: 'sphere_part',
    copilotPrompt: 'Add a new solid sphere of radius 5 cm resting on the ground plane at (0, 0, 5).',
    generateCode: (partName: string) => `    ${partName} = sm.create_sphere((0.0, 0.0, 5.0), 5.0)`,
  },
  {
    id: 'cone',
    label: 'Cone',
    defaultPartName: 'cone_part',
    copilotPrompt: 'Add a new cone primitive standing at the origin with base radius 5 cm and height 10 cm.',
    generateCode: (partName: string) => `    ${partName} = sm.create_cone((0.0, 0.0, 0.0), radius_base=5.0, radius_top=0.5, height=10.0)`,
  },
  {
    id: 'torus',
    label: 'Torus',
    defaultPartName: 'torus_part',
    copilotPrompt: 'Add a new torus ring with major radius 5 cm and tube radius 1.5 cm.',
    generateCode: (partName: string) => `    ${partName} = sm.create_torus((0.0, 0.0, 1.5), 5.0, 1.5)`,
  },
];
