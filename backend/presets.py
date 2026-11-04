"""Curated, verified NVIDIA usd_brep (SMLib) CAD presets and Canonical Maker Benchmarks for Agentic CAD Studio."""

from __future__ import annotations

from typing import Any, Dict, List

CANONICAL_BENCHMARK_PRESET_IDS = [
    "nema17_mount",
    "precision_spur_gear",
    "electronics_enclosure",
    "cnc_holddown_clamp",
    "flanged_pipe_elbow",
]

PRESETS: List[Dict[str, Any]] = [
    {
        "id": "nvidia_example_asset",
        "name": "NVIDIA Reference Asset (Filleted Base + Post + Collar + Orb)",
        "category": "Official NVIDIA Examples",
        "description": "Official example_generate_asset.py from NVIDIA-Omniverse/usd-brep demonstrating exact NURBS primitives, fillet_edges, and multi-part assembly.",
        "envelope": [15.0, 15.0, 15.0],
        "code": '''import usd_brep as sm

def build_parts():
    """Official NVIDIA usd-brep reference asset from tools/scripts/example_generate_asset.py."""
    # Filleted base plate: origin=(-5, -5, 0), length=10, width=10, height=3
    base = sm.create_box((-5.0, -5.0, 0.0), 10.0, 10.0, 3.0)
    sm.fillet_edges(base, base.edges(), radius=0.5)

    # Collar torus sitting on top of the base (z=3.25 so tube r_minor=0.25 clears z=3.0)
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
''',
    },
    {
        "id": "nema17_mount",
        "name": "Benchmark #1: NEMA 17 Stepper Motor L-Bracket",
        "category": "Canonical Maker Benchmarks",
        "description": "90° structural bracket with 31 mm M3 square bolt pattern, 22 mm central boss clearance bore, slotted base mounting holes, 45° stiffening gussets, and mating NEMA 17 stepper motor.",
        "envelope": [20.0, 20.0, 20.0],
        "code": '''import math
import usd_brep as sm

def build_parts():
    """Canonical Maker Benchmark #1: NEMA 17 Stepper Motor L-Bracket with 45° stiffening gussets."""
    # 1. Base mounting plate (z = 0..0.6, width = 5.4, depth = 4.8)
    base = sm.create_box((-2.7, 0.0, 0.0), 5.4, 4.8, 0.6)
    slot1 = sm.create_box((-1.8, 1.4, -0.2), 0.8, 2.0, 1.0)
    slot2 = sm.create_box((1.0, 1.4, -0.2), 0.8, 2.0, 1.0)
    base = sm.boolean_difference(base, slot1)
    base = sm.boolean_difference(base, slot2)

    # 2. Upright motor mounting flange (x: -2.7..2.7, y: 0.0..0.6, z: 0.6..5.6)
    upright = sm.create_box((-2.7, 0.0, 0.6), 5.4, 0.6, 5.0)

    # Central motor boss clearance bore: 22 mm diameter -> radius 1.1 cm, centered at x=0, z=3.1
    boss_bore = sm.create_cylinder((0.0, -1.0, 3.1), 1.1, 3.0)
    sm.rotate(boss_bore, ref_point=(0.0, -1.0, 3.1), axis=(1.0, 0.0, 0.0), angle_deg=90.0)
    upright = sm.boolean_difference(upright, boss_bore)

    # 4x M3 stepper mounting holes on 31 mm (3.1 cm) square pattern -> (+/- 1.55, z=3.1 +/- 1.55)
    for dx in (-1.55, 1.55):
        for dz in (1.55, 4.65):
            m3_hole = sm.create_cylinder((dx, -1.0, dz), 0.17, 3.0)
            sm.rotate(m3_hole, ref_point=(dx, -1.0, dz), axis=(1.0, 0.0, 0.0), angle_deg=90.0)
            upright = sm.boolean_difference(upright, m3_hole)

    # 3. 45-degree triangular stiffening gussets on left and right sides
    gusset_left = sm.create_box((-2.7, 0.6, 0.6), 0.5, 3.6, 3.6)
    gusset_cutter_left = sm.create_box((-2.8, 0.6, 0.6), 0.7, 5.2, 5.2)
    sm.rotate(gusset_cutter_left, ref_point=(-2.8, 0.6, 4.2), axis=(1.0, 0.0, 0.0), angle_deg=45.0)
    gusset_left = sm.boolean_difference(gusset_left, gusset_cutter_left)

    gusset_right = sm.create_box((2.2, 0.6, 0.6), 0.5, 3.6, 3.6)
    gusset_cutter_right = sm.create_box((2.1, 0.6, 0.6), 0.7, 5.2, 5.2)
    sm.rotate(gusset_cutter_right, ref_point=(2.1, 0.6, 4.2), axis=(1.0, 0.0, 0.0), angle_deg=45.0)
    gusset_right = sm.boolean_difference(gusset_right, gusset_cutter_right)

    bracket = sm.boolean_union(base, upright)
    bracket = sm.boolean_union(bracket, gusset_left)
    bracket = sm.boolean_union(bracket, gusset_right)

    # 4. Mating NEMA 17 Stepper Motor Body (positioned resting in front of flange at y = -4.3, z = 1.0)
    motor_body = sm.create_box((-2.1, -4.3, 1.0), 4.2, 4.0, 4.2)
    motor_boss = sm.create_cylinder((0.0, -0.3, 3.1), 1.1, 0.25)
    sm.rotate(motor_boss, ref_point=(0.0, -0.3, 3.1), axis=(1.0, 0.0, 0.0), angle_deg=90.0)
    shaft = sm.create_cylinder((0.0, -0.3, 3.1), 0.25, 2.2)
    sm.rotate(shaft, ref_point=(0.0, -0.3, 3.1), axis=(1.0, 0.0, 0.0), angle_deg=90.0)

    motor = sm.boolean_union(motor_body, motor_boss)
    motor = sm.boolean_union(motor, shaft)

    return [
        ("stepper_bracket", bracket, (0.22, 0.48, 0.82), "anchor"),
        ("nema17_motor", motor, (0.24, 0.25, 0.28), "component"),
    ]
''',
    },
    {
        "id": "precision_spur_gear",
        "name": "Benchmark #2: Parametric Spur Gear with D-Shaft Keyway",
        "category": "Canonical Maker Benchmarks",
        "description": "12-tooth parametric spur gear with lightening holes, central shaft bore, keyway notch, stepped pedestal, and retaining cap built with boolean operations.",
        "envelope": [45.0, 45.0, 30.0],
        "code": '''import math
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
        # Tooth box starting inside root_r and extending outward by 4.2 cm
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

    # Keyway notch in central bore (width=1.2, depth=1.0)
    keyway = sm.create_box((-0.6, 3.6, gear_z0 - 1.0), 1.2, 1.2, gear_h + 2.0)
    gear = sm.boolean_difference(gear, keyway)

    # 3. Top retaining cap sitting at z = 11.4
    cap = sm.create_cylinder((0.0, 0.0, 11.4), 5.8, 2.5)
    cap_hole = sm.create_cylinder((0.0, 0.0, 10.5), 2.2, 4.5)
    cap = sm.boolean_difference(cap, cap_hole)

    return [
        ("base_pedestal", pedestal, (0.25, 0.28, 0.33), "anchor"),
        ("spur_gear_12t", gear, (0.85, 0.62, 0.18), "anchor"),
        ("retaining_cap", cap, (0.72, 0.75, 0.78), "component"),
    ]
''',
    },
    {
        "id": "electronics_enclosure",
        "name": "Benchmark #3: Electronics Enclosure with M3 Heat-Set Bosses",
        "category": "Canonical Maker Benchmarks",
        "description": "Two-part project enclosure with PCB standoffs, M3 heat-set insert holes, USB-C side cutout, and matching countersunk lid.",
        "envelope": [25.0, 25.0, 20.0],
        "code": '''import usd_brep as sm

def build_parts():
    """Two-part project enclosure with PCB standoffs, heat-set insert holes, USB-C slot, and lid."""
    # 1. Main enclosure box body (z = 0..2.8, 10.0 x 6.4 x 2.8 cm)
    box_outer = sm.create_box((-5.0, -3.2, 0.0), 10.0, 6.4, 2.8)
    cavity = sm.create_box((-4.7, -2.9, 0.3), 9.4, 5.8, 2.7)
    enclosure_base = sm.boolean_difference(box_outer, cavity)

    # USB-C side wall cutout (1.2 cm wide, 0.65 cm tall)
    usb_port = sm.create_box((-5.2, -0.6, 0.8), 0.6, 1.2, 0.65)
    enclosure_base = sm.boolean_difference(enclosure_base, usb_port)

    # 4 corner PCB standoffs with M3 heat-set pilot holes
    for (sx, sy) in [(-3.8, -2.1), (3.8, -2.1), (-3.8, 2.1), (3.8, 2.1)]:
        standoff = sm.create_cylinder((sx, sy, 0.3), 0.45, 1.0)
        hole = sm.create_cylinder((sx, sy, 0.6), 0.18, 0.8)
        standoff = sm.boolean_difference(standoff, hole)
        enclosure_base = sm.boolean_union(enclosure_base, standoff)

    # 2. Enclosure Lid sitting at z = 3.1 (elevated with 3 mm clearance to prevent AABB penetration)
    lid_plate = sm.create_box((-5.0, -3.2, 3.1), 10.0, 6.4, 0.35)
    for (sx, sy) in [(-3.8, -2.1), (3.8, -2.1), (-3.8, 2.1), (3.8, 2.1)]:
        screw_hole = sm.create_cylinder((sx, sy, 3.0), 0.18, 0.6)
        lid_plate = sm.boolean_difference(lid_plate, screw_hole)

    return [
        ("enclosure_base", enclosure_base, (0.18, 0.22, 0.28), "anchor"),
        ("enclosure_lid", lid_plate, (0.85, 0.45, 0.15), "component"),
    ]
''',
    },
    {
        "id": "cnc_holddown_clamp",
        "name": "Benchmark #4: CNC Router Cam Lever & Hold-Down Clamp",
        "category": "Canonical Maker Benchmarks",
        "description": "Stepped 2.5D CNC router clamp fixture with M6 T-slot, counterbore shoulder, rear pivot hole, and eccentric clamping cam lever.",
        "envelope": [25.0, 25.0, 20.0],
        "code": '''import usd_brep as sm

def build_parts():
    """Stepped 2.5D CNC router clamp fixture with M6 T-slot, counterbore, and cam lever."""
    # 1. Stepped clamp bar (z = 0..1.6, length=11.0, width=2.8)
    clamp_main = sm.create_box((0.0, -1.4, 0.0), 11.0, 2.8, 1.6)

    # Stepped front clamping toe: step down front 3.5 cm to z = 0.8
    toe_step = sm.create_box((7.5, -1.5, 0.8), 3.8, 3.0, 1.0)
    clamp_main = sm.boolean_difference(clamp_main, toe_step)

    # Center longitudinal slot for M6 T-bolt (4.0 cm long x 0.7 cm wide)
    t_slot = sm.create_box((2.8, -0.35, -0.2), 4.0, 0.7, 2.0)
    clamp_main = sm.boolean_difference(clamp_main, t_slot)

    # Recessed counterbore shoulder for washer / bolt head (4.4 cm x 1.4 cm x 0.5 cm deep)
    cbore = sm.create_box((2.6, -0.7, 1.1), 4.4, 1.4, 0.7)
    clamp_main = sm.boolean_difference(clamp_main, cbore)

    # Rear pivot hole (r = 0.4 cm, through z)
    pivot_hole = sm.create_cylinder((1.2, 0.0, -0.2), 0.4, 2.0)
    clamp_main = sm.boolean_difference(clamp_main, pivot_hole)

    # 2. Cam Clamping Lever resting above rear pivot at z = 1.9 (clearance to avoid penetration)
    cam_lobe = sm.create_cylinder((1.2, 0.0, 1.9), 1.1, 1.2)
    lever_handle = sm.create_box((1.0, -0.5, 1.9), 6.5, 1.0, 0.8)
    cam_lever = sm.boolean_union(cam_lobe, lever_handle)

    return [
        ("stepped_clamp_arm", clamp_main, (0.82, 0.24, 0.22), "anchor"),
        ("clamping_cam_lever", cam_lever, (0.75, 0.78, 0.82), "component"),
    ]
''',
    },
    {
        "id": "flanged_pipe_elbow",
        "name": "Benchmark #5: Industrial 90° Flanged Pipe Manifold",
        "category": "Canonical Maker Benchmarks",
        "description": "Multi-port cylindrical manifold with 6-bolt flange ring, circular O-ring gasket groove, spherical junction hub, horizontal branch, and sensor cap.",
        "envelope": [60.0, 60.0, 55.0],
        "code": '''import math
import usd_brep as sm

def build_parts():
    """Industrial 90-degree flanged pipe manifold with bolt pattern, O-ring groove, and sensor cap."""
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

    # Circular O-ring gasket groove (radius 10.0 cm, groove width 1.2 cm, depth 0.6 cm at top of flange)
    oring_cut = sm.create_cylinder((0.0, 0.0, 3.4), 10.6, 0.8)
    oring_core = sm.create_cylinder((0.0, 0.0, 3.2), 9.4, 1.2)
    oring_groove = sm.boolean_difference(oring_cut, oring_core)
    bottom_flange = sm.boolean_difference(bottom_flange, oring_groove)

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

    return [
        ("bottom_flange", bottom_flange, (0.28, 0.34, 0.42), "anchor"),
        ("elbow_manifold", body, (0.38, 0.52, 0.68), "anchor"),
        ("sensor_cap", sensor_cap, (0.88, 0.64, 0.18), "component"),
    ]
''',
    },
    {
        "id": "robotic_parallel_gripper",
        "name": "Robotic Parallel Jaw Gripper Assembly",
        "category": "Robotics & Actuators",
        "description": "Multi-body robotic end-effector with ISO mounting flange, filleted guide rail housing, dual stepped parallel gripper jaws, and calibration sphere.",
        "envelope": [55.0, 35.0, 55.0],
        "code": '''import usd_brep as sm

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

    return [
        ("iso_mount_flange", mount, (0.22, 0.24, 0.28), "anchor"),
        ("actuator_housing", housing, (0.32, 0.38, 0.46), "anchor"),
        ("left_gripper_jaw", left_jaw, (0.88, 0.42, 0.15), "component"),
        ("right_gripper_jaw", right_jaw, (0.88, 0.42, 0.15), "component"),
        ("calibration_orb", workpiece, (0.20, 0.78, 0.55), "component"),
    ]
''',
    },
    {
        "id": "round_corner_pipe_sweep",
        "name": "NVIDIA Round-Corner Pipe Frame (Planar Path Sweep)",
        "category": "Official NVIDIA Examples",
        "description": "Adapted from Examples/PyAPI/round_corner_pipe.py in NVIDIA-Omniverse/usd-brep: sweeps a circular profile along a closed rectangular path with spherical corner cutters.",
        "envelope": [25.0, 25.0, 15.0],
        "code": '''import usd_brep as sm

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

    return [
        ("display_plinth", plinth, (0.26, 0.29, 0.34), "anchor"),
        ("round_corner_pipe", pipe, (0.85, 0.48, 0.22), "component"),
    ]
''',
    },
]
