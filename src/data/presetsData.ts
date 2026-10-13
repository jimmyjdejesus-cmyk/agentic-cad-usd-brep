import { CadPreset, GuideDocDetail, GuideDocSummary } from '../types/cad';

export const DEFAULT_PRESETS: CadPreset[] = [
  {
    id: 'nvidia_example_asset',
    name: 'NVIDIA Reference Asset (Filleted Base + Post + Collar + Orb)',
    category: 'Official NVIDIA Examples',
    description:
      'Official example_generate_asset.py from NVIDIA-Omniverse/usd-brep demonstrating exact NURBS primitives, fillet_edges, and multi-part assembly.',
    envelope: [15.0, 15.0, 15.0],
    code: `import usd_brep as sm

def build_parts():
    """Official NVIDIA usd-brep reference asset from tools/scripts/example_generate_asset.py."""
    # Filleted base plate: origin=(-5, -5, 0), length=10, width=10, height=3
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 3.0)
    sm.fillet_edges(base, base.edges(), radius=0.5)

    # Collar torus sitting on top of the base (z=3.3 so tube r_minor=0.25 clears z=3.0)
    collar = sm.create_torus((0.0, 0.0, 3.3), 1.35, 0.25)

    # Vertical post starting above collar at z=3.60, radius=0.8, height=4.9
    post = sm.create_cylinder((0.0, 0.0, 3.60), 0.8, 4.9)

    # Decorative sphere orb perched above post at z=10.05, radius=1.5
    ball = sm.create_sphere((0.0, 0.0, 10.05), 1.5)

    return [
        ("base", base, (0.30, 0.60, 0.95), "anchor"),
        ("collar", collar, (1.00, 0.85, 0.00), "component"),
        ("post", post, (0.70, 0.70, 0.75), "component"),
        ("ball", ball, (1.00, 0.20, 0.20), "component"),
    ]
`,
  },
  {
    id: 'flanged_pipe_elbow',
    name: 'Industrial 90° Flanged Pipe Manifold',
    category: 'Mechanical CAD',
    description:
      'Hollow 90-degree industrial pipe manifold with bolted mounting flange, spherical junction hub, horizontal branch, and inspection cap.',
    envelope: [60.0, 60.0, 55.0],
    code: `import math
import usd_brep as sm

def build_parts():
    """Industrial 90-degree flanged pipe manifold using exact NURBS booleans and transforms."""
    # 1. Bottom bolted mounting flange (z = 0..4, radius = 18)
    bottom_flange = sm.create_cylinder((0.0, 0.0, 0.0), 18.0, 4.0)
    for i in range(6):
        ang = i * (2.0 * math.pi / 6.0)
        bx = 13.5 * math.cos(ang)
        by = 13.5 * math.sin(ang)
        hole = sm.create_cylinder((bx, by, -1.0), 1.8, 6.0)
        bottom_flange = sm.boolean_difference(bottom_flange, hole)
    bore_bottom = sm.create_cylinder((0.0, 0.0, -1.0), 6.5, 6.0)
    bottom_flange = sm.boolean_difference(bottom_flange, bore_bottom)

    # 2. Main 90-degree elbow body sitting at z = 4.1
    riser_outer = sm.create_cylinder((0.0, 0.0, 4.1), 9.5, 22.0)
    hub_outer = sm.create_sphere((0.0, 0.0, 26.0), 11.0)
    branch_outer = sm.create_cylinder((0.0, 0.0, 26.0), 9.0, 20.0)
    sm.rotate(branch_outer, ref_point=(0.0, 0.0, 26.0), axis=(0.0, 1.0, 0.0), angle_deg=90.0)

    body = sm.boolean_union(riser_outer, hub_outer)
    body = sm.boolean_union(body, branch_outer)

    # Hollow out internal flow passage
    bore_vert = sm.create_cylinder((0.0, 0.0, 3.5), 6.5, 23.0)
    bore_horiz = sm.create_cylinder((0.0, 0.0, 26.0), 6.0, 25.0)
    sm.rotate(bore_horiz, ref_point=(0.0, 0.0, 26.0), axis=(0.0, 1.0, 0.0), angle_deg=90.0)
    body = sm.boolean_difference(body, bore_vert)
    body = sm.boolean_difference(body, bore_horiz)

    # 3. Top pressure sensor boss & cap sitting above hub at z = 37.2
    sensor_cap = sm.create_cone((0.0, 0.0, 37.2), radius_base=5.5, radius_top=3.5, height=4.5)

    parts = [
        ("bottom_flange", bottom_flange, (0.28, 0.34, 0.42), "anchor"),
        ("elbow_manifold", body, (0.38, 0.52, 0.68), "anchor"),
        ("sensor_cap", sensor_cap, (0.88, 0.64, 0.18), "component"),
    ]

    explosion_stages = [
        {
            "name": "Stage 1: Sensor Cap Unseating",
            "duration": 1.2,
            "easing": "ease-out",
            "translations": {
                "sensor_cap": [0.0, 0.0, 14.0],
                "elbow_manifold": [0.0, 0.0, 0.0],
                "bottom_flange": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 2: Elbow Manifold Axial Lift",
            "duration": 1.5,
            "easing": "ease-in-out",
            "translations": {
                "sensor_cap": [0.0, 0.0, 22.0],
                "elbow_manifold": [0.0, 0.0, 10.0],
                "bottom_flange": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 3: Flange Separation & Lateral Inspection",
            "duration": 1.8,
            "easing": "ease-out",
            "translations": {
                "sensor_cap": [0.0, 14.0, 25.0],
                "elbow_manifold": [15.0, 0.0, 12.0],
                "bottom_flange": [0.0, 0.0, 0.0],
            },
        },
    ]

    return parts, explosion_stages
`,
  },
  {
    id: 'precision_spur_gear',
    name: 'Parametric Hubbed Spur Gear & Pedestal',
    category: 'Mechanical CAD',
    description:
      '12-tooth parametric spur gear with lightening holes, keyway bore, and stepped mounting pedestal built with usd_brep boolean operations.',
    envelope: [45.0, 45.0, 30.0],
    code: `import math
import usd_brep as sm

def build_parts():
    """Build a 12-tooth parametric spur gear with lightening holes on a stepped pedestal."""
    # 1. Base pedestal (z = 0..5, radius = 14)
    pedestal = sm.create_cylinder((0.0, 0.0, 0.0), 14.0, 5.0)
    recess = sm.create_cylinder((0.0, 0.0, 3.0), 10.0, 3.0)
    pedestal = sm.boolean_difference(pedestal, recess)

    # 2. 12-Tooth Spur Gear sitting at z = 5.2..11.2
    num_teeth = 12
    root_r = 13.5
    gear_z0 = 5.2
    gear_h = 6.0

    gear = sm.create_cylinder((0.0, 0.0, gear_z0), root_r, gear_h)
    for i in range(num_teeth):
        angle_deg = i * (360.0 / num_teeth)
        tooth = sm.create_box((root_r - 1.5, -1.5, gear_z0), 4.2, 3.0, gear_h)
        sm.rotate(tooth, ref_point=(0.0, 0.0, gear_z0), axis=(0.0, 0.0, 1.0), angle_deg=angle_deg)
        gear = sm.boolean_union(gear, tooth)

    # 4 weight-reduction pocket holes
    for i in range(4):
        ang = i * (math.pi / 2.0) + (math.pi / 4.0)
        hx = 9.2 * math.cos(ang)
        hy = 9.2 * math.sin(ang)
        pocket = sm.create_cylinder((hx, hy, gear_z0 - 1.0), 2.1, gear_h + 2.0)
        gear = sm.boolean_difference(gear, pocket)

    # Central bore (r = 4.2)
    bore = sm.create_cylinder((0.0, 0.0, gear_z0 - 1.0), 4.2, gear_h + 2.0)
    gear = sm.boolean_difference(gear, bore)

    # 3. Top retaining cap sitting at z = 11.4
    cap = sm.create_cylinder((0.0, 0.0, 11.4), 5.8, 2.5)
    cap_hole = sm.create_cylinder((0.0, 0.0, 10.5), 2.2, 4.5)
    cap = sm.boolean_difference(cap, cap_hole)

    parts = [
        ("base_pedestal", pedestal, (0.25, 0.28, 0.33), "anchor"),
        ("spur_gear_12t", gear, (0.85, 0.62, 0.18), "anchor"),
        ("retaining_cap", cap, (0.72, 0.75, 0.78), "component"),
    ]

    explosion_stages = [
        {
            "name": "Stage 1: Retaining Cap Ejection",
            "duration": 1.2,
            "easing": "ease-out",
            "translations": {
                "retaining_cap": [0.0, 0.0, 14.0],
                "spur_gear_12t": [0.0, 0.0, 0.0],
                "base_pedestal": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 2: Spur Gear Shaft Clearance",
            "duration": 1.5,
            "easing": "ease-in-out",
            "translations": {
                "retaining_cap": [0.0, 0.0, 20.0],
                "spur_gear_12t": [0.0, 0.0, 10.0],
                "base_pedestal": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 3: Full Exploded Inspection",
            "duration": 1.8,
            "easing": "ease-out",
            "translations": {
                "retaining_cap": [0.0, -12.0, 22.0],
                "spur_gear_12t": [0.0, 12.0, 12.0],
                "base_pedestal": [0.0, 0.0, 0.0],
            },
        },
    ]

    return parts, explosion_stages
`,
  },
  {
    id: 'robotic_parallel_gripper',
    name: 'Robotic Parallel Jaw Gripper Assembly',
    category: 'Robotics & Actuators',
    description:
      'Multi-body robotic end-effector with ISO mounting flange, filleted guide rail housing, dual stepped parallel gripper fingers, and calibration sphere.',
    envelope: [55.0, 35.0, 55.0],
    code: `import usd_brep as sm

def build_parts():
    """Robotic parallel jaw gripper assembly resting on z = 0."""
    # 1. ISO Mounting Flange at base (z = 0..4, radius = 15)
    mount = sm.create_cylinder((0.0, 0.0, 0.0), 15.0, 4.0)
    recess = sm.create_cylinder((0.0, 0.0, 2.0), 6.0, 3.0)
    mount = sm.boolean_difference(mount, recess)

    # 2. Actuator Housing Block (z = 4.1..21.1, 40 x 20 x 17)
    housing = sm.create_box((-20.0, -10.0, 4.1), 40.0, 20.0, 17.0)
    slot = sm.create_box((-21.0, -4.0, 17.5), 42.0, 8.0, 5.0)
    housing = sm.boolean_difference(housing, slot)
    sm.fillet_edges(housing, housing.edges(), radius=0.6)

    # 3. Left & Right Gripper Jaws (sitting at z = 21.3 to avoid penetration)
    left_base = sm.create_box((-15.0, -5.0, 21.3), 8.0, 10.0, 6.0)
    left_finger = sm.create_box((-11.0, -4.0, 26.5), 4.5, 8.0, 20.0)
    left_jaw = sm.boolean_union(left_base, left_finger)

    right_base = sm.create_box((7.0, -5.0, 21.3), 8.0, 10.0, 6.0)
    right_finger = sm.create_box((6.5, -4.0, 26.5), 4.5, 8.0, 20.0)
    right_jaw = sm.boolean_union(right_base, right_finger)

    # 4. Target Calibration Sphere held between jaws at z = 39.0
    workpiece = sm.create_sphere((0.0, 0.0, 39.0), 4.8)

    parts = [
        ("iso_mount_flange", mount, (0.22, 0.24, 0.28), "anchor"),
        ("actuator_housing", housing, (0.32, 0.38, 0.46), "anchor"),
        ("left_gripper_jaw", left_jaw, (0.88, 0.42, 0.15), "component"),
        ("right_gripper_jaw", right_jaw, (0.88, 0.42, 0.15), "component"),
        ("calibration_orb", workpiece, (0.20, 0.78, 0.55), "component"),
    ]

    explosion_stages = [
        {
            "name": "Stage 1: Calibration Orb Release",
            "duration": 1.2,
            "easing": "ease-out",
            "translations": {
                "calibration_orb": [0.0, 0.0, 18.0],
            },
        },
        {
            "name": "Stage 2: Parallel Jaws Outward Slide",
            "duration": 1.5,
            "easing": "ease-in-out",
            "translations": {
                "calibration_orb": [0.0, 0.0, 24.0],
                "left_gripper_jaw": [-14.0, 0.0, 4.0],
                "right_gripper_jaw": [14.0, 0.0, 4.0],
            },
        },
        {
            "name": "Stage 3: Actuator Housing Separation",
            "duration": 1.8,
            "easing": "ease-out",
            "translations": {
                "calibration_orb": [0.0, 0.0, 30.0],
                "left_gripper_jaw": [-20.0, 0.0, 10.0],
                "right_gripper_jaw": [20.0, 0.0, 10.0],
                "actuator_housing": [0.0, 0.0, 12.0],
                "iso_mount_flange": [0.0, 0.0, 0.0],
            },
        },
    ]

    return parts, explosion_stages
`,
  },
  {
    id: 'round_corner_pipe_sweep',
    name: 'NVIDIA Round-Corner Pipe Frame (Planar Path Sweep)',
    category: 'Official NVIDIA Examples',
    description:
      'Adapted from Examples/PyAPI/round_corner_pipe.py in NVIDIA-Omniverse/usd-brep: sweeps a circular profile along a closed rectangular path with spherical corner cutters.',
    envelope: [25.0, 25.0, 15.0],
    code: `import usd_brep as sm

def _create_round_corner_cutter(corner, incoming, outgoing, radius):
    """Create outer-corner box minus sphere cutter from NVIDIA round_corner_pipe.py."""
    turn_axis = (0.0, 0.0, 1.0)
    base = (
        corner[0] - 2.0 * radius * turn_axis[0],
        corner[1] - 2.0 * radius * turn_axis[1],
        corner[2] - 2.0 * radius * turn_axis[2],
    )
    u = incoming
    v = (-outgoing[0], -outgoing[1], -outgoing[2])
    rect = [
        base,
        (base[0] + 2.0 * radius * u[0], base[1] + 2.0 * radius * u[1], base[2]),
        (base[0] + 2.0 * radius * (u[0] + v[0]), base[1] + 2.0 * radius * (u[1] + v[1]), base[2]),
        (base[0] + 2.0 * radius * v[0], base[1] + 2.0 * radius * v[1], base[2]),
    ]
    box_profile = [sm.create_line_segment(rect[i], rect[(i + 1) % 4]) for i in range(4)]
    box = sm.linear_sweep(box_profile, turn_axis, 4.0 * radius, cap_ends=True)
    sphere = sm.create_sphere(corner, radius)
    return sm.boolean_difference(box, sphere)

def build_parts():
    """Build NVIDIA's closed round-corner pipe loop elevated above a display plinth."""
    side = 12.0
    radius = 1.4
    corners = [
        (0.0, 0.0, 0.0),
        (side, 0.0, 0.0),
        (side, side, 0.0),
        (0.0, side, 0.0),
    ]
    directions = [
        (1.0, 0.0, 0.0),
        (0.0, 1.0, 0.0),
        (-1.0, 0.0, 0.0),
        (0.0, -1.0, 0.0),
    ]
    path_curves = [sm.create_line_segment(corners[i], corners[(i + 1) % 4]) for i in range(4)]
    profile = sm.create_circle((0.0, 0.0, 0.0), radius)
    pipe = sm.sweep_along_planar_path([profile], path_curves, move_profile=True, cap_ends=sm.CapEnds.NONE)

    for i, corner in enumerate(corners):
        cutter = _create_round_corner_cutter(corner, directions[i - 1], directions[i], radius)
        pipe = sm.boolean_difference(pipe, cutter)

    # Center the pipe loop around XY=(0,0) and elevate to z=4.5
    sm.translate(pipe, (-side / 2.0, -side / 2.0, 4.5))

    # Base plinth resting on z=0
    plinth = sm.create_box((-8.5, -8.5, 0.0), 17.0, 17.0, 2.5)
    sm.fillet_edges(plinth, plinth.edges(), radius=0.4)

    parts = [
        ("display_plinth", plinth, (0.26, 0.29, 0.34), "anchor"),
        ("round_corner_pipe", pipe, (0.85, 0.48, 0.22), "component"),
    ]

    explosion_stages = [
        {
            "name": "Stage 1: Plinth Clearance Lift",
            "duration": 1.2,
            "easing": "ease-out",
            "translations": {
                "round_corner_pipe": [0.0, 0.0, 10.0],
                "display_plinth": [0.0, 0.0, 0.0],
            },
        },
        {
            "name": "Stage 2: Full Inspection Elevation",
            "duration": 1.5,
            "easing": "ease-in-out",
            "translations": {
                "round_corner_pipe": [0.0, 0.0, 20.0],
                "display_plinth": [0.0, 0.0, 0.0],
            },
        },
    ]

    return parts, explosion_stages
`,
  },
];

export const EMBEDDED_GUIDES: Record<string, GuideDocDetail> = {
  '.agents/docs/generate_asset.md': {
    path: '.agents/docs/generate_asset.md',
    title: 'generate_asset.md',
    category: 'Agent Architecture & Workflow',
    content: `# Generate 3D Assets (NVIDIA usd-brep Canonical Pipeline)

**Source:** \`NVIDIA-Omniverse/usd-brep/.agents/docs/generate_asset.md\`

## 1. The Pipeline
\`\`\`
[ SMLib / usd_brep stack ]                          [ OpenUSD ]
analytic primitives + NURBS curves/surfaces
sweep / extrude / revolve / boolean_* / fillet      build
       |
       v
  sm.tessellate(brep) -> PolyBrep                   tessellate
       |
       v
  polybrep.to_mesh_arrays()                         extract
       |
       v
  UsdGeom.Mesh (one per part) -> .usda              write
\`\`\`

## 2. Coordinate System & Stage Conventions
- **Up Axis:** \`Z\` (\`UsdGeom.Tokens.z\`)
- **Units:** \`0.01\` meters per unit (centimeters)
- **Ground Plane:** Bottom of the asset rests at \`z = 0\` (\`min_z >= 0\`), centered around \`(0, 0)\` in XY.

## 3. Core Construction Patterns
- **Primitives:**
  - \`sm.create_box((minX, minY, minZ), length, width, height)\`
  - \`sm.create_cylinder((cx, cy, z0), radius, height)\`
  - \`sm.create_sphere((cx, cy, cz), radius)\`
  - \`sm.create_cone((cx, cy, z0), radius_base, radius_top, height)\`
  - \`sm.create_torus((cx, cy, cz), radius_major, radius_minor)\`
- **Booleans:**
  - \`sm.boolean_union(a, b)\`
  - \`sm.boolean_difference(workpiece, tool)\`
  - \`sm.boolean_intersection(a, b)\`
- **Fillets & Chamfers (In-Place):**
  - \`sm.fillet_edges(brep, brep.edges(), radius=0.5)\`
  - \`sm.chamfer_edges(brep, brep.edges(), distance=0.3)\`
- **Transforms (In-Place):**
  - \`sm.translate(brep, (dx, dy, dz))\`
  - \`sm.rotate(brep, ref_point=(px, py, pz), axis=(ax, ay, az), angle_deg=90.0)\`
  - \`sm.scale(brep, (sx, sy, sz))\`
`,
  },
  '.agents/operations/primitives.md': {
    path: '.agents/operations/primitives.md',
    title: 'primitives.md',
    category: 'Operations Guides',
    content: `# Primitive Creation (NVIDIA usd-brep)

All primitives create an exact NURBS \`sm.Brep\` manifold solid:

1. **\`sm.create_box(origin, length, width, height)\`**
   - \`origin\`: \`(minX, minY, minZ)\` minimum corner (NOT center!)
   - \`length, width, height\`: positive extents along X, Y, Z

2. **\`sm.create_cylinder(origin, radius, height)\`**
   - \`origin\`: \`(cx, cy, z0)\` center of base circle
   - Aligned along +Z axis. Use \`sm.rotate(cyl, ref_point=..., axis=..., angle_deg=...)\` for X/Y cylinders.

3. **\`sm.create_sphere(origin, radius)\`**
   - \`origin\`: \`(cx, cy, cz)\` center of sphere

4. **\`sm.create_cone(origin, radius_base, radius_top, height)\`**
   - Truncated cone (frustum) when \`radius_top > 0\`, pointed cone when \`radius_top = 0\`.

5. **\`sm.create_torus(origin, radius_major, radius_minor)\`**
   - Lies in XY plane circling around Z; requires \`radius_major > radius_minor\`.
`,
  },
  '.agents/operations/booleans.md': {
    path: '.agents/operations/booleans.md',
    title: 'booleans.md',
    category: 'Operations Guides',
    content: `# Boolean Operations (NVIDIA usd-brep)

Exact NURBS surface-surface intersection booleans:
- \`sm.boolean_union(brep_a, brep_b)\` — additive union
- \`sm.boolean_difference(workpiece, cutter)\` — subtracts \`cutter\` from \`workpiece\`
- \`sm.boolean_intersection(brep_a, brep_b)\` — keeps common volume
- \`sm.merge_breps([b1, b2, ...], operation=sm.BooleanOp.UNION)\`

**Important Ownership Rule:**
Boolean operations consume their input handles and return the resulting \`Brep\`. Pass \`tool.copy()\` if you need to reuse a tool body across multiple cuts!`,
  },
};

export const EMBEDDED_GUIDE_SUMMARIES: GuideDocSummary[] = Object.values(EMBEDDED_GUIDES).map((g) => ({
  path: g.path,
  title: g.title,
  category: g.category,
  size_bytes: g.content.length,
}));
