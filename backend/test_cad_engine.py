"""Comprehensive unit and integration tests for the NVIDIA usd_brep CAD engine & FastAPI server."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

try:
    import usd_brep as sm
    HAS_USD_BREP = True
except ImportError:
    sm = None  # type: ignore
    HAS_USD_BREP = False

from backend.cad_engine import execute_cad_script, get_engine_status
from backend.presets import PRESETS
from backend.server import app

client = TestClient(app)


def test_engine_status():
    status = get_engine_status()
    assert "usd_brep_available" in status
    assert "python_version" in status


def test_api_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"


def test_api_presets_endpoint():
    res = client.get("/api/presets")
    assert res.status_code == 200
    data = res.json()
    assert "presets" in data
    assert len(data["presets"]) >= 5


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
@pytest.mark.parametrize("preset", PRESETS, ids=[p["id"] for p in PRESETS])
def test_all_presets_execute_manifold_and_pass_sanity_checks(preset):
    result = execute_cad_script(
        code=preset["code"],
        envelope=tuple(preset["envelope"]) if preset.get("envelope") else None,
        linear_tolerance=0.08,
    )
    assert result["success"] is True, f"Preset {preset['id']} failed: {result.get('error')}\n{result.get('traceback')}"
    assert len(result["parts"]) >= 2
    for part in result["parts"]:
        diag = part["diagnostics"]
        assert diag["manifold"] is True, f"Part {part['name']} in {preset['id']} is not manifold"
        assert diag["volume"] > 0, f"Part {part['name']} in {preset['id']} has non-positive volume"
        assert diag["tessellation"]["triangle_count"] > 0
        assert len(part["mesh"]["points"]) == diag["tessellation"]["vertex_count"]
        assert len(part["mesh"]["triangles"]) == diag["tessellation"]["triangle_count"] * 3

    summary = result["summary"]
    assert summary["all_manifold"] is True
    assert summary["penetration_count"] == 0, (
        f"Preset {preset['id']} has penetrations: {result['sanity_warnings']}"
    )
    assert result["sanity_warnings"] == [], f"Preset {preset['id']} emitted warnings: {result['sanity_warnings']}"
    assert "#usda 1.0" in result["usda_mesh_text"]
    assert "def Mesh" in result["usda_mesh_text"]
    assert "#usda 1.0" in result["usda_brep_text"]
    assert "solid " in result["stl_text"]


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_openusd_roundtrip_mesh_and_nurbs_brep():
    code = """import usd_brep as sm
def build_parts():
    b1 = sm.create_box((-10.0, -10.0, 0.0), 20.0, 20.0, 5.0)
    b2 = sm.create_cylinder((0.0, 0.0, 5.1), 4.0, 10.0)
    return [
        ("plate", b1, (0.4, 0.4, 0.4), "anchor"),
        ("post", b2, (0.8, 0.6, 0.2), "component"),
    ]
"""
    res = execute_cad_script(code)
    assert res["success"] is True

    with tempfile.TemporaryDirectory() as tmpdir:
        mesh_path = Path(tmpdir) / "test_mesh.usda"
        mesh_path.write_text(res["usda_mesh_text"], encoding="utf-8")
        imported_meshes = sm.usd.import_meshes(str(mesh_path))
        assert len(imported_meshes) == 2

        brep_path = Path(tmpdir) / "test_brep.usda"
        brep_path.write_text(res["usda_brep_text"], encoding="utf-8")
        imported_breps = sm.usd.import_breps(str(brep_path))
        assert len(imported_breps) == 2
        for b in imported_breps:
            assert b.info()["manifold"] is True


def test_edge_case_empty_code():
    res = execute_cad_script("   \n  ")
    assert res["success"] is False
    assert "empty" in (res.get("error") or "").lower()


def test_edge_case_syntax_error():
    res = execute_cad_script("def build_parts(\n  return []")
    assert res["success"] is False
    assert "SyntaxError" in (res.get("error") or "")


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_edge_case_missing_build_parts():
    res = execute_cad_script("import usd_brep as sm\nx = sm.create_box((0.0, 0.0, 0.0), 1.0, 1.0, 1.0)")
    assert res["success"] is False
    assert "build_parts" in (res.get("error") or "")


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_edge_case_empty_parts_list():
    res = execute_cad_script("def build_parts():\n    return []")
    assert res["success"] is False
    assert "empty" in (res.get("error") or "").lower()


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_edge_case_non_brep_object_in_tuple():
    res = execute_cad_script('def build_parts():\n    return [("bad", "not_a_brep", (1,0,0), "metal")]')
    assert res["success"] is False
    assert "not a usd_brep.Brep" in (res.get("error") or "")


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_edge_case_smlib_runtime_error():
    # Zero scale factor triggers SM_ERR_INVALID_INPUT RuntimeError in SMLib
    code = """import usd_brep as sm
def build_parts():
    b = sm.create_box((0.0, 0.0, 0.0), 5.0, 5.0, 5.0)
    sm.scale(b, (0.0, 1.0, 1.0))
    return [("bad_box", b, (1, 0, 0), "metal")]
"""
    res = execute_cad_script(code)
    assert res["success"] is False
    assert "SM_ERR" in (res.get("error") or "") or "RuntimeError" in (res.get("error") or "")


@pytest.mark.skipif(not HAS_USD_BREP, reason="usd_brep C++ kernel wheel not installed on this OS")
def test_sanity_check_detects_penetration_and_ground_plane_breach():
    code = """import usd_brep as sm
def build_parts():
    # Box dipping below z=0 and overlapping with a second box
    b1 = sm.create_box((-5.0, -5.0, -3.0), 10.0, 10.0, 8.0)
    b2 = sm.create_box((-2.0, -2.0, 0.0), 10.0, 10.0, 8.0)
    return [
        ("box_a", b1, (0.5, 0.2, 0.2), "anchor"),
        ("box_b", b2, (0.2, 0.5, 0.2), "component"),
    ]
"""
    res = execute_cad_script(code, envelope=(8.0, 8.0, 6.0))
    assert res["success"] is True
    assert res["summary"]["penetration_count"] == 1
    warnings_joined = "\n".join(res["sanity_warnings"])
    assert "PENETRATE" in warnings_joined
    assert "dips below ground plane" in warnings_joined
    assert "exceeds target envelope" in warnings_joined


def test_fastapi_endpoints():
    # 1. Health endpoint
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert "usd_brep_available" in r_health.json()

    # 2. Presets endpoint
    r_presets = client.get("/api/presets")
    assert r_presets.status_code == 200
    assert len(r_presets.json()["presets"]) == len(PRESETS)

    # 3. Guides list endpoint
    r_guides = client.get("/api/guides")
    assert r_guides.status_code == 200
    guides = r_guides.json()
    assert len(guides) >= 30
    paths = [g["path"] for g in guides]
    assert ".agents/docs/generate_asset.md" in paths

    # 4. Guide content endpoint
    r_doc = client.get("/api/guides/content", params={"path": ".agents/docs/generate_asset.md"})
    assert r_doc.status_code == 200
    assert "# Generate 3D Assets" in r_doc.json()["content"]

    # 5. Path traversal protection
    r_bad = client.get("/api/guides/content", params={"path": "../../backend/server.py"})
    assert r_bad.status_code == 400

    # 6. Execute endpoint
    r_exec = client.post(
        "/api/execute",
        json={
            "code": PRESETS[0]["code"],
            "envelope": PRESETS[0]["envelope"],
            "linear_tolerance": 0.1,
        },
    )
    assert r_exec.status_code == 200
    payload = r_exec.json()
    if HAS_USD_BREP:
        assert payload["success"] is True
        assert len(payload["parts"]) == 4
        assert "stl_text" in payload["parts"][0]
    else:
        assert payload["fallback"] is True


def test_generate_part_ascii_stl_computed_normals():
    from backend.cad_engine import generate_part_ascii_stl

    mock_part = {
        "name": "tri_plate",
        "mesh": {
            "points": [[0.0, 0.0, 0.0], [10.0, 0.0, 0.0], [0.0, 10.0, 0.0]],
            "triangles": [0, 1, 2],
        },
    }
    stl = generate_part_ascii_stl(mock_part, "tri_plate")
    assert "solid tri_plate" in stl
    assert "facet normal 0 0 1" in stl
    assert "vertex 0 0 0" in stl
    assert "endsolid tri_plate" in stl
