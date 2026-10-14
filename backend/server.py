"""FastAPI Server for Agentic CAD Studio powered by NVIDIA usd_brep."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.cad_engine import execute_cad_script, get_engine_status
from backend.presets import PRESETS

DOCS_ROOT = Path(__file__).resolve().parent.parent / "docs" / "nvidia-usd-brep"

app = FastAPI(
    title="Agentic CAD Studio — NVIDIA usd_brep Engine API",
    description="Executes Python B-Rep CAD scripts using NVIDIA SMLib (usd_brep) with manifold validation, sanity checks, and OpenUSD (.usda) export.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    code: str = Field(..., description="Python script defining build_parts() using usd_brep as sm")
    asset_name: str = Field(default="CadAsset", description="Root USD Xform prim name")
    envelope: Optional[Tuple[float, float, float]] = Field(
        default=None,
        description="Optional bounding envelope (W, D, H) in cm for NVIDIA sanity_checks()",
    )
    linear_tolerance: float = Field(
        default=0.05,
        ge=0.0,
        le=5.0,
        description="Chord-height tolerance in cm for sm.tessellate()",
    )


class GuideDocSummary(BaseModel):
    path: str
    title: str
    category: str
    size_bytes: int


class GuideDocDetail(BaseModel):
    path: str
    title: str
    category: str
    content: str


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    """Return NVIDIA usd_brep runtime status and version info."""
    status = get_engine_status()
    return {
        "status": "ok",
        **status,
        "docs_available": DOCS_ROOT.exists(),
        "preset_count": len(PRESETS),
    }


@app.get("/api/presets")
def list_presets() -> Dict[str, Any]:
    """Return curated NVIDIA usd_brep parametric presets."""
    return {"presets": PRESETS}


@app.post("/api/execute")
def execute_cad(req: ExecuteRequest) -> Dict[str, Any]:
    """Execute a usd_brep Python CAD script and return meshes, topology diagnostics, and OpenUSD outputs."""
    return execute_cad_script(
        code=req.code,
        asset_name=req.asset_name,
        envelope=req.envelope,
        linear_tolerance=req.linear_tolerance,
    )


@app.get("/api/guides", response_model=List[GuideDocSummary])
def list_guides() -> List[GuideDocSummary]:
    """List all official NVIDIA usd-brep documentation files downloaded locally."""
    if not DOCS_ROOT.exists():
        return []
    docs: List[GuideDocSummary] = []
    for file_path in sorted(DOCS_ROOT.rglob("*")):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(DOCS_ROOT).as_posix()
        if ".agents/operations" in rel:
            category = "Operations Guides"
        elif ".agents/skills" in rel:
            category = "Agent Skills"
        elif ".agents/docs" in rel:
            category = "Agent Architecture & Workflow"
        elif "stubs" in rel:
            category = "Type Stubs (.pyi)"
        elif "Examples" in rel or "scripts" in rel:
            category = "Official Code Examples"
        else:
            category = "Core Documentation"
        docs.append(
            GuideDocSummary(
                path=rel,
                title=file_path.name,
                category=category,
                size_bytes=file_path.stat().st_size,
            )
        )
    return docs


@app.get("/api/guides/content", response_model=GuideDocDetail)
def get_guide_content(path: str) -> GuideDocDetail:
    """Return the full markdown/code content of a specific NVIDIA usd-brep guide."""
    if ".." in path or path.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid guide path")
    target = (DOCS_ROOT / path).resolve()
    if not target.exists() or not target.is_file() or DOCS_ROOT.resolve() not in target.parents:
        raise HTTPException(status_code=404, detail=f"Guide not found: {path}")
    content = target.read_text(encoding="utf-8", errors="replace")
    return GuideDocDetail(
        path=path,
        title=target.name,
        category="NVIDIA usd-brep Documentation",
        content=content,
    )
