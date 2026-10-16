# Agentic CAD Studio — Deep Research & Architecture Plan

## 1. Deep Research Summary

### 1.1 NVIDIA `usd-brep` (`NVIDIA-Omniverse/usd-brep` v1.0.0)
- **What It Is**: NVIDIA Omniverse's standalone C++ and Python library (`usd-brep==1.0.0`, CPython 3.12) for exact **NURBS-based Boundary Representation (BRep)** solid modeling (`SMLib` / `SM_API` / `_omni_solid` / `usd_brep`) with native OpenUSD (`BrepArray` and `UsdGeom.Mesh`) import and export.
- **Bundled Runtime**: The PyPI wheel (`pip install usd-brep` on CPython 3.12) bundles its own OpenUSD 25.11 runtime and the `omniSolid` schema (`BrepArray`), requiring zero external Omniverse Kit installation.
- **Canonical Agent Workflow (`.agents/docs/generate_asset.md` & `tools/scripts/example_generate_asset.py`)**:
  1. Author parametric `build_parts()` returning `list[dict(name, brep, color, kind)]` using `usd_brep` (`import usd_brep as sm`).
  2. Validate each part using `brep.is_manifold_solid()`, `brep.volume()`, `brep.material_census()`, `brep.info()`, and pairwise `sm.brep_relationship(a, b)` / `sm.brep_distance(a, b)`.
  3. Tessellate exact NURBS BReps via `sm.tessellate(brep, chord_height_tolerance=..., curve_angle_tolerance_deg=..., surface_angle_tolerance_deg=...)` into `PolyBrep` and extract mesh buffers via `PolyBrep.to_mesh_arrays()`.
  4. Run NVIDIA's multi-part sanity checks (`sanity_checks()` from `.agents/docs/generate_asset.md` §13) for gross interpenetration against anchor parts and envelope containment breaches.
  5. Export:
     - **Canonical Mesh-Only OpenUSD (`.usda`)** with `upAxis = "Z"`, `metersPerUnit = 0.01`, root `/<AssetName>` `Xform`, per-part `UsdGeom.Mesh` prims, `primvars:displayColor`, and `custom token asset:kind`.
     - **Exact NURBS `BrepArray` OpenUSD (`.brep.usda`)** via `sm.usd.export_brep()` / `sm.usd.export_breps()` for lossless downstream CAD operations.
     - **Binary/ASCII `.stl` and `.obj`** for 3D printing and universal 3D viewers.

### 1.2 Survey of Existing Agentic CAD Repositories (What Not to Rebuild)
We researched the leading open-source agentic CAD repositories to adopt their best patterns without rebuilding existing kernels or validators:

| Repository | Core Stack | Key Takeaway Adopted in This Project |
|---|---|---|
| **`NVIDIA-Omniverse/usd-brep`** | `usd_brep` (`_omni_solid`) C++ NURBS kernel + OpenUSD `BrepArray` | **Used directly** as our primary Python 3.12 BRep modeling, tessellation, topology/manifold querying, and OpenUSD export engine, along with NVIDIA's official `.agents/` operation guides and `example_generate_asset.py` contract. |
| **`NVIDIA-Omniverse/usd-convert-cad`** | `usd-convert-cad` wheel + CAD-to-USD agent skill | Adopted the **CLI/subprocess exit-code + structured diagnostic contract** and OpenUSD stage metadata conventions (`upAxis="Z"`, `metersPerUnit=0.01`). |
| **`cyberchitta/cad-khana`** | `build123d` + diagnostics-first CLI | Adopted the **diagnostics-first feedback loop**: every run checks manifoldness, volume, void cavities (`material_census`), pairwise clearance/interpenetration (`brep_relationship`), and bounding-box sanity checks (`sanity_checks`) so the LLM agent self-corrects without human babysitting. |
| **`jdilla1277/agentcad`** | `build123d` / `CadQuery` + JSON stdout contract + live browser viewer | Adopted the **structured JSON execution response** (stdout JSON separate from kernel logs) and **versioned A/B build history** with instant browser 3D preview. |
| **`kreuzhofer/chat3d-app`** | React + TypeScript + Vite + Three.js + multi-step LLM pipeline | Adopted the **Three-Pane Workspace UI** (Preset/History Sidebar, Agentic Chat + Code & Diagnostics Workbench, Interactive Three.js 3D Viewport). |

---

## 2. System Architecture (Hybrid Local `usd_brep` Kernel + Google AI Studio Vibe-Coding Ready)

To satisfy both:
1. **Real NVIDIA `usd_brep` execution** (using the official CPython 3.12 `usd-brep==1.0.0` C++ kernel), and
2. **Seamless Google AI Studio ("Vibe Editing") compatibility** (where AI Studio imports the GitHub repo as a Vite + React + TypeScript project and runs it inside AI Studio's browser preview sandbox),

we use a **Dual-Runtime Hybrid Architecture**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Frontend: Vite + React 18 + TypeScript                   │
│             (Root layout compatible with Google AI Studio Build)           │
├───────────────────────┬──────────────────────────┬─────────────────────────┤
│  Pane 1: CAD Library  │  Pane 2: Agentic Workbench│  Pane 3: 3D USD Viewer  │
│  • NVIDIA Reference   │  • Gemini 3.8 Flash Agent │  • Three.js Orbit/Grid  │
│    Assets & Templates │    (@google/genai SDK)    │  • Per-Part Selection   │
│  • Parametric Gallery │  • Auto-Repair Loop       │  • Wireframe / BBox /   │
│  • Version History    │  • Python Code Editor     │    Explode Assembly     │
│    with Diffs         │  • Diagnostics Inspector  │  • 1-Click Export:      │
│                       │    (Manifold, Volume,     │    .usda (Mesh),        │
│                       │     Clearances, Breaches) │    .brep.usda (NURBS),  │
│                       │                           │    .stl, .py            │
└───────────┬───────────┴─────────────┬────────────┴────────────┬────────────┘
            │                         │                         │
            ▼                         ▼                         ▼
   ┌────────────────────────────────────┐      ┌─────────────────────────────┐
   │ Mode A: Local Native Kernel API    │      │ Mode B: Browser AI Studio   │
   │ FastAPI (`backend/server.py`)      │      │ Fallback Interpreter        │
   │ Runs in `.venv-usd-brep` (Py 3.12) │      │ Runs 100% client-side when  │
   │ • Real `import usd_brep as sm`     │      │ inside Google AI Studio     │
   │ • Exact NURBS booleans, fillets,   │      │ cloud preview iframe        │
   │   sweeps, curves, surfaces         │      │ • Evaluates `sm.*` calls    │
   │ • `sm.tessellate()` → `PolyBrep`   │      │   to Three.js meshes        │
   │ • `sm.usd.export_brep()` & `.usda` │      │ • Exports `.usda` & `.stl`  │
   └────────────────────────────────────┘      └─────────────────────────────┘
```

### 2.1 Repository Layout
- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `metadata.json` — Root Vite + React + TypeScript configuration adhering strictly to Google AI Studio's GitHub import & two-way sync specification.
- `src/` — React + Three.js + `@google/genai` application:
  - `src/services/geminiAgent.ts` — Multi-step Agentic CAD pipeline using `@google/genai` (`gemini-3.8-flash`), embedded with NVIDIA's official `usd_brep` API signature guide & `SM_ERR_*` self-healing loop.
  - `src/services/cadRuntime.ts` — Hybrid execution client: automatically uses the native Python 3.12 `usd_brep` FastAPI backend when available (`/api/execute`), and gracefully falls back to the client-side `usd_brep` geometric evaluator when running in Google AI Studio's cloud preview.
  - `src/data/presets.ts` — Curated, verified `usd_brep` scripts (including NVIDIA's official `example_generate_asset.py` and `round_corner_pipe.py`, plus mechanical CAD parts: Flanged Pipe Elbow, Parametric Spur Gear, Robotic Parallel Gripper, Hollow Voronoi/Lattice Cube).
  - `src/components/Viewport3D.tsx` — Interactive Three.js Z-up CAD viewport with part picking, wireframe overlay, bounding boxes, explode view slider, and camera presets (`iso`, `front`, `top`, `right`).
- `backend/` — Lightweight Python 3.12 FastAPI execution engine (`backend/server.py` + `backend/cad_engine.py`):
  - Executes `build_parts()` against real `usd_brep` (`_omni_solid`), computes `Brep.info()`, `material_census()`, pairwise `brep_relationship()`, NVIDIA's `sanity_checks()`, tessellates with configurable tolerances, and exports `.usda` (Mesh), `.brep.usda` (NURBS `BrepArray`), and `.stl`.
- `docs/nvidia-usd-brep/` — Complete mirror of NVIDIA's official `usd-brep` documentation, `.agents/operations/*.md` guides, `.agents/docs/generate_asset.md` playbook, `.agents/docs/errors.md`, type stubs (`__init__.pyi`, `usd.pyi`), and reference examples.

---

## 3. Production Enhancements & Security Architecture

### 3.1 Engineering Inspector & Workspace UX
- **Docked Multi-Tab Sidebar (`src/App.tsx`)**: Consolidated floating overlays into a single responsive sidebar featuring:
  - **Parts Inspector**: Visibility toggling, single-part isolation, and inline part renaming.
  - **Mass Properties Calculator**: Dynamic mass, volume, and center-of-mass (CoM) computed across material presets.
  - **3D Annotations Dock**: Real-time vertex/surface pin tracking, resolution state, and viewport focus triggers.
  - **Explosion Timeline**: Eased multi-stage disassembly animation and keyframe scrubbing.

### 3.2 Dynamic Shape Templates & CAD File Manager
- **Geometric Archetypes (`src/data/cadTemplates.ts`)**: Rapid initialization from Box, Cylinder, Triangular Prism, or Blank Canvas templates.
- **Dynamic Shape Thumbnails (`src/components/CadShapeThumbnail.tsx`)**: Vector SVG rendering of parametric dimensions and schematic silhouettes.
- **Persistent Storage (`src/services/cadFileManager.ts`)**: Versioned design retention across browser localStorage and optional Firestore cloud vaults.

### 3.3 CI/CD & Automated Verification Pipeline
- **GitHub Actions Matrix (`.github/workflows/ci.yml`)**:
  1. `security-audit`: Pattern scanning of tracked files for zero credential leakage.
  2. `frontend-ci`: TypeScript typechecking (`npm run lint`), Vitest suite (`npm test`), and production bundle compilation (`npm run build`).
  3. `backend-ci`: Python 3.12 environment setup and pytest execution for `backend/test_cad_engine.py`.
- **Browser Automation Suite (`scripts/verify-browser.mjs`)**: Headless Chrome CDP testing across 9 DOM/ARIA and viewport interaction scenarios.

### 3.4 Security & Secret Management Playbook
- **Zero-Leaked Keys in Tracked Assets**: Configuration manifests like `firebase-applet-config.json` use empty string placeholders.
- **Environment Resolution**: Seamless loading of `VITE_FIREBASE_API_KEY` and `GEMINI_API_KEY` across Vite client and Node server contexts.
- **Fail-Safe Initialization**: Safe dummy fallback keys prevent module-load crashes (`auth/invalid-api-key`) in unconfigured offline environments.

