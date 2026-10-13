"""NVIDIA usd_brep (SMLib) CAD Execution, Diagnostics, and OpenUSD Export Engine."""

from __future__ import annotations

import math
import os
import re
import tempfile
import time
import traceback
from typing import Any

import numpy as np
import usd_brep as sm


def _sanitize_prim_name(name: str, index: int) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "_", str(name or f"part_{index}"))
    if not cleaned or cleaned[0].isdigit():
        cleaned = f"part_{cleaned}"
    return cleaned


def sanity_checks(
    parts_points: list[tuple[str, list[tuple[float, float, float]]]],
    anchor_names: list[str] | set[str],
    detail_names: list[str] | set[str] | None = None,
    growth: float = 0.30,
    penetration_tol: float = 0.05,
    envelope_tol: float = 0.5,
    min_volume: float = 0.5,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Canonical multi-part sanity check adapted from NVIDIA .agents/docs/generate_asset.md §13."""
    anchor_set = set(anchor_names)
    boxes: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    ordered_names: list[str] = []
    for name, points in parts_points:
        if not points:
            continue
        pts = np.asarray(points, dtype=np.float64)
        boxes[name] = (pts.min(axis=0), pts.max(axis=0))
        ordered_names.append(name)

    candidates = set(boxes) - anchor_set

    # Canonical NVIDIA check: compare each candidate part only against anchor parts
    # (Avoid all-pairs check: intentional contact/clearance between trusted components is allowed)
    penetrations: list[dict[str, Any]] = []
    for candidate in sorted(candidates):
        for anchor in sorted(anchor_set & set(boxes)):
            a_mn, a_mx = boxes[candidate]
            b_mn, b_mx = boxes[anchor]
            extent = np.maximum(
                0.0,
                np.minimum(a_mx - penetration_tol, b_mx - penetration_tol)
                - np.maximum(a_mn + penetration_tol, b_mn + penetration_tol),
            )
            volume = float(np.prod(extent))
            if volume > min_volume:
                penetrations.append(
                    {
                        "candidate": candidate,
                        "anchor": anchor,
                        "overlap_volume": round(volume, 4),
                    }
                )

    anchors = [boxes[name] for name in anchor_set if name in boxes]
    if not anchors:
        return penetrations, []

    # Detail envelope containment (only for loose detail / accessory parts, not primary stacked components)
    if detail_names is not None:
        target_candidates = set(detail_names) & set(boxes)
    else:
        target_candidates = set()

    if not target_candidates:
        return penetrations, []

    env_min = np.min([b[0] for b in anchors], axis=0)
    env_max = np.max([b[1] for b in anchors], axis=0)
    pad = (env_max - env_min) * growth
    env_min, env_max = env_min - pad, env_max + pad
    breaches: list[dict[str, Any]] = []
    axis_names = ["X", "Y", "Z"]
    for name in sorted(target_candidates):
        part_min, part_max = boxes[name]
        for axis in range(3):
            if part_min[axis] < env_min[axis] - envelope_tol:
                breaches.append(
                    {
                        "part": name,
                        "axis": axis_names[axis],
                        "bound": "min",
                        "value": round(float(part_min[axis]), 4),
                        "limit": round(float(env_min[axis] - envelope_tol), 4),
                    }
                )
            if part_max[axis] > env_max[axis] + envelope_tol:
                breaches.append(
                    {
                        "part": name,
                        "axis": axis_names[axis],
                        "bound": "max",
                        "value": round(float(part_max[axis]), 4),
                        "limit": round(float(env_max[axis] + envelope_tol), 4),
                    }
                )
    return penetrations, breaches


def _unpack_faces_to_triangles(flat_faces: list[int]) -> tuple[list[int], list[int], list[int]]:
    """Unpack SMLib PolyBrep flat face stream [n, i0, i1, ...] into USD counts, indices, and triangles."""
    counts: list[int] = []
    indices: list[int] = []
    triangles: list[int] = []
    i = 0
    total = len(flat_faces)
    while i < total:
        n = int(flat_faces[i])
        counts.append(n)
        poly = [int(x) for x in flat_faces[i + 1 : i + 1 + n]]
        indices.extend(poly)
        if n == 3:
            triangles.extend(poly)
        elif n > 3:
            for k in range(1, n - 1):
                triangles.extend([poly[0], poly[k], poly[k + 1]])
        i += 1 + n
    return counts, indices, triangles


def generate_mesh_usda(parts_data: list[dict[str, Any]], asset_name: str = "CadAsset") -> str:
    """Generate canonical OpenUSD ASCII (.usda) stage matching NVIDIA generate_asset.md §5 & §9."""
    safe_root = _sanitize_prim_name(asset_name, 0)
    lines = [
        "#usda 1.0",
        "(",
        f'    defaultPrim = "{safe_root}"',
        "    metersPerUnit = 0.01",
        '    upAxis = "Z"',
        ")",
        "",
        f'def Xform "{safe_root}"',
        "{",
    ]

    for idx, part in enumerate(parts_data):
        pname = _sanitize_prim_name(part["name"], idx)
        pts = part["mesh"]["points"]
        normals = part["mesh"]["normals"]
        counts = part["mesh"]["face_vertex_counts"]
        indices = part["mesh"]["face_vertex_indices"]
        bounds = part["diagnostics"]["bounds"]
        color = part.get("color") or [0.35, 0.65, 0.95]
        kind = part.get("kind") or "component"

        pts_str = ", ".join(f"({p[0]:.6g}, {p[1]:.6g}, {p[2]:.6g})" for p in pts)
        counts_str = ", ".join(str(c) for c in counts)
        indices_str = ", ".join(str(i) for i in indices)
        mn, mx = bounds[0], bounds[1]

        lines.append(f'    def Mesh "{pname}"')
        lines.append("    {")
        lines.append(f'        custom token asset:kind = "{kind}"')
        lines.append(
            f"        float3[] extent = [({mn[0]:.6g}, {mn[1]:.6g}, {mn[2]:.6g}), ({mx[0]:.6g}, {mx[1]:.6g}, {mx[2]:.6g})]"
        )
        lines.append(f"        int[] faceVertexCounts = [{counts_str}]")
        lines.append(f"        int[] faceVertexIndices = [{indices_str}]")
        if normals and len(normals) == len(pts):
            norms_str = ", ".join(f"({n[0]:.6g}, {n[1]:.6g}, {n[2]:.6g})" for n in normals)
            lines.append(f"        normal3f[] normals = [{norms_str}] (")
            lines.append('            interpolation = "vertex"')
            lines.append("        )")
        lines.append(f"        point3f[] points = [{pts_str}]")
        lines.append(
            f"        color3f[] primvars:displayColor = [({color[0]:.4f}, {color[1]:.4f}, {color[2]:.4f})] ("
        )
        lines.append('            interpolation = "constant"')
        lines.append("        )")
        lines.append('        uniform token subdivisionScheme = "none"')
        lines.append("    }")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def generate_ascii_stl(parts_data: list[dict[str, Any]], asset_name: str = "CadAsset") -> str:
    """Export all tessellated parts to an ASCII STL string for 3D printing and CAD viewers."""
    safe_name = _sanitize_prim_name(asset_name, 0)
    lines = [f"solid {safe_name}"]
    for part in parts_data:
        pts = part["mesh"]["points"]
        tris = part["mesh"]["triangles"]
        for i in range(0, len(tris), 3):
            p0 = pts[tris[i]]
            p1 = pts[tris[i + 1]]
            p2 = pts[tris[i + 2]]
            ux, uy, uz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
            vx, vy, vz = p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]
            nx = uy * vz - uz * vy
            ny = uz * vx - ux * vz
            nz = ux * vy - uy * vx
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            if length > 1e-12:
                nx, ny, nz = nx / length, ny / length, nz / length
            else:
                nx, ny, nz = 0.0, 0.0, 1.0
            lines.append(f"  facet normal {nx:.6g} {ny:.6g} {nz:.6g}")
            lines.append("    outer loop")
            lines.append(f"      vertex {p0[0]:.6g} {p0[1]:.6g} {p0[2]:.6g}")
            lines.append(f"      vertex {p1[0]:.6g} {p1[1]:.6g} {p1[2]:.6g}")
            lines.append(f"      vertex {p2[0]:.6g} {p2[1]:.6g} {p2[2]:.6g}")
            lines.append("    endloop")
            lines.append("  endfacet")
    lines.append(f"endsolid {safe_name}")
    return "\n".join(lines)


def get_engine_status() -> dict[str, Any]:
    """Return runtime status of the NVIDIA usd_brep C++ kernel."""
    import sys

    return {
        "usd_brep_available": True,
        "engine": "NVIDIA usd-brep (SMLib / _omni_solid)",
        "kernel_version": "1.0.0",
        "python_version": sys.version,
    }


def execute_cad_script(
    code: str,
    asset_name: str = "CadAsset",
    chord_height_tolerance: float = 0.0,
    angle_tolerance_deg: float = 15.0,
    export_brep_usd: bool = True,
    envelope: tuple[float, float, float] | None = None,
    linear_tolerance: float | None = None,
) -> dict[str, Any]:
    """Execute a usd_brep Python script, run diagnostics, tessellate, and export OpenUSD & STL."""
    start_time = time.perf_counter()
    if linear_tolerance is not None and chord_height_tolerance == 0.0:
        chord_height_tolerance = float(linear_tolerance)

    if not code or not code.strip():
        return {
            "ok": False,
            "success": False,
            "error": "Empty CAD script provided.",
            "error_type": "ValidationError",
            "kernel": "nvidia-usd-brep-1.0.0",
        }

    # Execute in isolated namespace with usd_brep pre-imported as `sm` and `usd_brep`
    exec_globals: dict[str, Any] = {
        "__builtins__": __builtins__,
        "__name__": "__cad_agent__",
        "sm": sm,
        "usd_brep": sm,
        "math": math,
        "np": np,
    }

    try:
        exec(compile(code, "<agent_cad_script>", "exec"), exec_globals)
    except Exception as exc:
        return {
            "ok": False,
            "success": False,
            "error": f"{type(exc).__name__}: {exc}",
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
            "kernel": "nvidia-usd-brep-1.0.0",
        }

    # Extract parts from `build_parts()` function or top-level `parts`
    raw_parts: list[dict[str, Any]] = []
    try:
        if callable(exec_globals.get("build_parts")):
            built = exec_globals["build_parts"]()
            if isinstance(built, sm.Brep):
                raw_parts = [{"name": "main_body", "brep": built, "color": (0.3, 0.65, 0.95), "kind": "body"}]
            elif isinstance(built, (list, tuple)):
                for idx, item in enumerate(built):
                    if isinstance(item, sm.Brep):
                        raw_parts.append(
                            {"name": f"part_{idx}", "brep": item, "color": (0.3, 0.65, 0.95), "kind": "body"}
                        )
                    elif isinstance(item, dict) and isinstance(item.get("brep"), sm.Brep):
                        raw_parts.append(item)
                    elif isinstance(item, (tuple, list)) and len(item) >= 2:
                        pname = str(item[0])
                        pbrep = item[1]
                        if not isinstance(pbrep, sm.Brep):
                            raise TypeError(
                                f"Part '{pname}' (index {idx}) is not a usd_brep.Brep (got {type(pbrep).__name__})"
                            )
                        pcolor = item[2] if len(item) >= 3 else (0.3, 0.65, 0.95)
                        pkind = str(item[3]) if len(item) >= 4 else "component"
                        raw_parts.append({"name": pname, "brep": pbrep, "color": pcolor, "kind": pkind})
                    else:
                        raise TypeError(
                            f"Item {idx} returned by build_parts() is not a valid (name, Brep, color, kind) tuple or dict"
                        )
            else:
                raise TypeError("build_parts() must return a list of (name, Brep, color, kind) tuples, dicts, or an sm.Brep")
        elif isinstance(exec_globals.get("parts"), list):
            raw_parts = exec_globals["parts"]
        else:
            return {
                "ok": False,
                "success": False,
                "error": "Script must define a `build_parts()` function returning a list of `(name, brep, color, kind)` tuples.",
                "error_type": "MissingEntrypointError",
                "kernel": "nvidia-usd-brep-1.0.0",
            }
    except Exception as exc:
        return {
            "ok": False,
            "success": False,
            "error": f"{type(exc).__name__}: {exc}",
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
            "kernel": "nvidia-usd-brep-1.0.0",
        }

    if not raw_parts:
        return {
            "ok": False,
            "success": False,
            "error": "Empty parts list returned by build_parts(). At least one sm.Brep part is required.",
            "error_type": "NoPartsError",
            "kernel": "nvidia-usd-brep-1.0.0",
        }

    parts_output: list[dict[str, Any]] = []
    breps_by_name: list[tuple[str, sm.Brep]] = []
    parts_points_for_sanity: list[tuple[str, list[tuple[float, float, float]]]] = []
    anchor_names: list[str] = []
    detail_names: list[str] = []

    default_palette = [
        [0.28, 0.62, 0.96],
        [0.95, 0.45, 0.25],
        [0.25, 0.82, 0.55],
        [0.95, 0.78, 0.20],
        [0.72, 0.45, 0.95],
        [0.92, 0.32, 0.55],
    ]

    try:
        for idx, p in enumerate(raw_parts):
            name = str(p.get("name") or f"part_{idx}")
            brep: sm.Brep = p["brep"]
            raw_color = p.get("color")
            if raw_color is not None and len(raw_color) >= 3:
                color = [float(raw_color[0]), float(raw_color[1]), float(raw_color[2])]
            else:
                color = default_palette[idx % len(default_palette)]
            kind = str(p.get("kind") or ("anchor" if idx == 0 else "component"))
            if kind.lower() in ("anchor", "body", "chassis", "frame", "base"):
                anchor_names.append(name)
            elif kind.lower() in ("accessory", "detail", "trim", "fill", "insert", "decoration"):
                detail_names.append(name)

            info = brep.info()
            census = brep.material_census()
            is_manifold = bool(info.get("manifold", brep.is_manifold_solid()))
            vol = float(info.get("volume", 0.0)) if is_manifold else 0.0
            area = float(brep.area())
            bounds = info.get("bounds", brep.bounding_box())
            center = info.get("center", brep.center())

            polybrep, tess_report = sm.tessellate(
                brep,
                chord_height_tolerance=float(chord_height_tolerance),
                curve_angle_tolerance_deg=float(angle_tolerance_deg),
                surface_angle_tolerance_deg=float(angle_tolerance_deg),
                return_report=True,
            )
            mesh_dict = polybrep.to_mesh_arrays(face_varying_normals=False)
            pts = [[round(float(c), 5) for c in pt] for pt in mesh_dict["points"]]
            norms = [[round(float(c), 5) for c in nm] for nm in mesh_dict.get("normals", [])]
            counts, indices, triangles = _unpack_faces_to_triangles(mesh_dict["faces"])

            parts_points_for_sanity.append((name, mesh_dict["points"]))
            breps_by_name.append((name, brep))

            parts_output.append(
                {
                    "name": name,
                    "kind": kind,
                    "color": color,
                    "diagnostics": {
                        "faces": int(info["faces"]),
                        "edges": int(info["edges"]),
                        "vertices": int(info["vertices"]),
                        "manifold": is_manifold,
                        "volume": round(vol, 4),
                        "area": round(area, 4),
                        "solid_count": int(census.get("solid_count", 1)),
                        "void_count": int(census.get("void_count", 0)),
                        "bounds": [
                            [round(float(x), 4) for x in bounds[0]],
                            [round(float(x), 4) for x in bounds[1]],
                        ],
                        "center": [round(float(x), 4) for x in center],
                        "tessellation": {
                            "vertex_count": len(pts),
                            "triangle_count": len(triangles) // 3,
                            "output_manifold": bool(tess_report.get("output_manifold", True)),
                            "lamina_edge_count": int(tess_report.get("lamina_edge_count", 0)),
                            "failure_count": len(tess_report.get("failures", [])),
                        },
                    },
                    "mesh": {
                        "points": pts,
                        "normals": norms,
                        "triangles": triangles,
                        "face_vertex_counts": counts,
                        "face_vertex_indices": indices,
                    },
                }
            )
    except Exception as exc:
        return {
            "ok": False,
            "success": False,
            "error": f"{type(exc).__name__}: {exc}",
            "error_type": type(exc).__name__,
            "traceback": traceback.format_exc(),
            "kernel": "nvidia-usd-brep-1.0.0",
        }

    # Pairwise BRep topological/spatial relationship matrix (capped at first 8 parts for speed)
    relationships: list[dict[str, Any]] = []
    non_penetrating_pairs: set[tuple[str, str]] = set()
    interpenetrating_pairs: set[tuple[str, str]] = set()
    sanity_warnings: list[str] = []
    penetration_count = 0
    max_rel = min(len(breps_by_name), 8)
    for i in range(max_rel):
        for j in range(i + 1, max_rel):
            name_a, brep_a = breps_by_name[i]
            name_b, brep_b = breps_by_name[j]
            try:
                rel = sm.brep_relationship(brep_a, brep_b)
                rel_name = str(rel.get("relationship", "unknown"))
                dist = round(float(rel.get("distance", 0.0)), 4)
                rel_clean = rel_name.lower().strip()
                # NVIDIA usd_brep kernel returns 'separate', 'touching', 'interpenetrating', 'a_contains_b', 'b_contains_a'
                if rel_clean in ("separate", "touching", "disjoint"):
                    non_penetrating_pairs.add((name_a, name_b))
                    non_penetrating_pairs.add((name_b, name_a))
                elif rel_clean in ("interpenetrating", "a_contains_b", "b_contains_a"):
                    interpenetrating_pairs.add((name_a, name_b))
                    interpenetrating_pairs.add((name_b, name_a))
                relationships.append(
                    {
                        "part_a": name_a,
                        "part_b": name_b,
                        "relationship": rel_name,
                        "distance": dist,
                    }
                )
            except Exception as rel_exc:
                relationships.append(
                    {
                        "part_a": name_a,
                        "part_b": name_b,
                        "relationship": f"error: {rel_exc}",
                        "distance": 0.0,
                    }
                )

    if not anchor_names and parts_points_for_sanity:
        anchor_names = [parts_points_for_sanity[0][0]]
    raw_penetrations, envelope_breaches = sanity_checks(
        parts_points_for_sanity, anchor_names, detail_names=detail_names
    )
    penetrations = [
        pen
        for pen in raw_penetrations
        if (pen["candidate"], pen["anchor"]) not in non_penetrating_pairs
    ]
    # Include kernel-confirmed interpenetrations even if AABB volume is small
    for i in range(max_rel):
        for j in range(i + 1, max_rel):
            na, nb = breps_by_name[i][0], breps_by_name[j][0]
            if (na, nb) in interpenetrating_pairs:
                if not any(
                    (p["candidate"] == nb and p["anchor"] == na) or (p["candidate"] == na and p["anchor"] == nb)
                    for p in penetrations
                ):
                    penetrations.append(
                        {
                            "candidate": nb,
                            "anchor": na,
                            "overlap_volume": 0.0,
                        }
                    )
    for pen in penetrations:
        penetration_count += 1
        vol_info = f" (AABB overlap volume={pen['overlap_volume']} cm³)" if pen.get("overlap_volume") else ""
        sanity_warnings.append(
            f"PENETRATE: '{pen['candidate']}' overlaps '{pen['anchor']}'{vol_info}"
        )
    for br in envelope_breaches:
        sanity_warnings.append(
            f"ENVELOPE: '{br['part']}' {br['bound']} {br['axis']}={br['value']} exceeds anchor envelope limit {br['limit']}"
        )

    mesh_usda = generate_mesh_usda(parts_output, asset_name=asset_name)
    stl_content = generate_ascii_stl(parts_output, asset_name=asset_name)

    brep_usda_preview = ""
    if export_brep_usd:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                brep_path = os.path.join(tmpdir, f"{_sanitize_prim_name(asset_name, 0)}_brep.usda")
                sm.usd.export_breps([b.copy() for _, b in breps_by_name], brep_path)
                with open(brep_path, "r", encoding="utf-8") as fh:
                    brep_usda_preview = fh.read()
        except Exception as exc:
            brep_usda_preview = f"# BrepArray export note: {exc}\n"

    all_mins = np.min([p["diagnostics"]["bounds"][0] for p in parts_output], axis=0)
    all_maxs = np.max([p["diagnostics"]["bounds"][1] for p in parts_output], axis=0)

    # Check ground plane z >= 0 (tolerance -0.05 cm)
    if float(all_mins[2]) < -0.05:
        sanity_warnings.append(
            f"GROUND_PLANE: Assembly dips below ground plane z=0 (min_z={float(all_mins[2]):.3f} cm)"
        )

    # Check explicit target envelope (W, D, H) if supplied
    if envelope is not None and len(envelope) == 3:
        extents = all_maxs - all_mins
        for idx_ax, ax_label in enumerate(("Width (X)", "Depth (Y)", "Height (Z)")):
            if float(extents[idx_ax]) > float(envelope[idx_ax]) * 1.15:
                sanity_warnings.append(
                    f"TARGET_ENVELOPE: Assembly {ax_label} ({float(extents[idx_ax]):.2f} cm) exceeds target envelope ({float(envelope[idx_ax]):.2f} cm)"
                )

    all_manifold = all(p["diagnostics"]["manifold"] for p in parts_output)
    total_volume = round(sum(p["diagnostics"]["volume"] for p in parts_output), 4)
    total_faces = sum(p["diagnostics"]["faces"] for p in parts_output)
    total_edges = sum(p["diagnostics"]["edges"] for p in parts_output)
    total_vertices = sum(p["diagnostics"]["vertices"] for p in parts_output)
    total_triangles = sum(p["diagnostics"]["tessellation"]["triangle_count"] for p in parts_output)

    elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

    return {
        "ok": True,
        "success": True,
        "kernel": "nvidia-usd-brep-1.0.0",
        "asset_name": asset_name,
        "elapsed_ms": elapsed_ms,
        "sanity_warnings": sanity_warnings,
        "summary": {
            "part_count": len(parts_output),
            "all_manifold": all_manifold,
            "total_volume": total_volume,
            "total_nurbs_faces": total_faces,
            "total_nurbs_edges": total_edges,
            "total_nurbs_vertices": total_vertices,
            "total_mesh_triangles": total_triangles,
            "penetration_count": penetration_count,
            "overall_bounds": [
                [round(float(x), 4) for x in all_mins],
                [round(float(x), 4) for x in all_maxs],
            ],
            "penetration_warnings": penetrations,
            "envelope_breaches": envelope_breaches,
            "relationships": relationships,
        },
        "parts": parts_output,
        "exports": {
            "mesh_usda": mesh_usda,
            "brep_usda": brep_usda_preview,
            "stl": stl_content,
        },
        "usda_mesh_text": mesh_usda,
        "usda_brep_text": brep_usda_preview,
        "stl_text": stl_content,
    }

