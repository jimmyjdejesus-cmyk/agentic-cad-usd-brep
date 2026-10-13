# NVIDIA `usd-brep` Agentic CAD Studio

An **Agentic B-Rep CAD Studio** powered by **NVIDIA's `usd-brep` (`SMLib` / `_omni_solid` NURBS solid modeling kernel)**, **OpenUSD (`UsdGeom.Mesh` & `BrepArray`)**, and **Google Gemini (`@google/genai` `gemini-3.8-flash`)**.

Designed from the ground up for **hybrid execution**:
1. **Local Native C++ B-Rep Mode**: Connects to the local CPython 3.12 FastAPI backend running NVIDIA's `usd-brep==1.0.0` C++ solid modeling kernel (`_omni_solid`) for exact NURBS primitives, boolean operations, circular fillets, sweeps, `sm.tessellate()`, `sm.brep_relationship()`, and `sm.usd` OpenUSD stage export.
2. **Google AI Studio Cloud Preview ("Vibe Editing") Mode**: Structured at the repository root (`metadata.json`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/`) so you can import the GitHub repo directly into **Google AI Studio Build Mode** with **Two-Way GitHub Sync**, complete with an in-browser `usd_brep` geometric synthesizer fallback when running in the cloud preview.

---

## Key Features

- **Autonomous Self-Healing B-Rep Copilot (`gemini-3.8-flash`)**:
  - Generates Python `usd_brep` (`import usd_brep as sm`) scripts defining `build_parts()`.
  - Automatically verifies every generated part with `brep.info()` (`manifold`, `volume`, `faces`, `edges`, `vertices`), `sm.brep_relationship()`, and NVIDIA's multi-part `sanity_checks()` (AABB interpenetration detection, `z >= 0` ground-plane check, and envelope bounds).
  - Self-repairs up to 3 iterations if `SM_ERR_*` kernel exceptions, non-manifold shells, or part penetrations are detected.
- **Interactive Z-Up OpenUSD 3D Viewport**:
  - Three.js Z-up CAD stage (`1 unit = 1 cm`, `upAxis = "Z"`) with orbit/pan/zoom camera controls, wireframe overlay, AABB bounding boxes, part picking, and an interactive **Explode Assembly** slider.
- **Live OpenUSD & CAD Export**:
  - Inspect and download ASCII **OpenUSD Mesh (`.usda`)** (`UsdGeom.Mesh` with `primvars:displayColor` and `custom token asset:kind`), **Exact NURBS BrepArray (`.brep.usda`)**, and **ASCII `.stl`**.
- **Complete Official NVIDIA `usd-brep` Reference & API Guide Explorer**:
  - Bundles all **36 official guides, skills, `.pyi` type stubs, and example scripts** from [`NVIDIA-Omniverse/usd-brep`](https://github.com/NVIDIA-Omniverse/usd-brep) inside [`docs/nvidia-usd-brep/`](docs/nvidia-usd-brep/), searchable directly inside the studio UI.

---

## Quick Start (Local Native NVIDIA `usd-brep` C++ Kernel + Vite UI)

### 1. Start the Python 3.12 `usd-brep` Backend (Port 8000)

`usd-brep==1.0.0` requires CPython 3.12 (`>=3.12,<3.13`). Using `uv`:

```powershell
# Create Python 3.12 virtual environment and install NVIDIA usd-brep + FastAPI
uv venv .venv-usd-brep --python 3.12
uv pip install --python .venv-usd-brep\Scripts\python.exe usd-brep fastapi uvicorn pydantic numpy pytest httpx

# Start the FastAPI B-Rep server on http://127.0.0.1:8000
npm run backend
```

### 2. Start the Vite + React Frontend (Port 3000)

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` in your browser. The header badge will show **`C++ _omni_solid Kernel Active`**.

---

## Connecting to Google AI Studio for "Vibe Editing" (Two-Way GitHub Sync)

This repository is pre-configured for **Google AI Studio Build Mode**:

1. Open **[Google AI Studio — Build](https://aistudio.google.com/apps)**.
2. Click **Import from GitHub** (or open the GitHub sync panel in the top toolbar) and select:
   - **Repository**: `jimmyjdejesus-cmyk/agentic-cad-usd-brep`
3. Google AI Studio reads `metadata.json`, `package.json`, `vite.config.ts`, `index.html`, and `src/` directly from the root of the repository and automatically injects `process.env.GEMINI_API_KEY`.
4. Prompt Google AI Studio to vibe-edit the UI, add new parametric presets, or customize the 3D viewport, and commit/push changes back to GitHub with one click!

---

## Running Automated Tests

```powershell
# 1. Run Python backend unit & integration tests against the real NVIDIA usd-brep C++ kernel
.\.venv-usd-brep\Scripts\python.exe -m pytest backend/test_cad_engine.py -v

# 2. Run Frontend Vitest unit tests (client-side fallback synthesizer, USDA/STL export, edge cases)
npm test

# 3. Type-check and build production bundle
npm run build
```

---

## Repository Structure

```text
├── metadata.json                # Google AI Studio app manifest
├── package.json                 # Root Vite + React 18 + Three.js + @google/genai config
├── vite.config.ts               # Vite config with /api proxy to port 8000 & GEMINI_API_KEY define
├── index.html                   # App HTML entry
├── ARCHITECTURE_AND_PLAN.md     # Deep research & architecture synthesis across open-source Agentic CAD repos
├── src/
│   ├── App.tsx                  # 3-Pane Agentic CAD Studio UI + OpenUSD Inspector + API Guide Explorer
│   ├── components/
│   │   └── Viewport3D.tsx       # Three.js Z-up CAD viewport (orbit/pan/zoom, wireframe, AABB, explode view)
│   ├── services/
│   │   ├── cadRuntime.ts        # Hybrid executor (FastAPI C++ usd-brep backend + browser fallback synthesizer)
│   │   ├── cadRuntime.test.ts   # Vitest unit test suite
│   │   └── geminiAgent.ts       # @google/genai (gemini-3.8-flash) copilot with 3x self-healing repair loop
│   ├── data/
│   │   └── presetsData.ts       # 5 verified multi-part NVIDIA usd-brep parametric CAD presets
│   └── types/
│       └── cad.ts               # TypeScript data contracts
├── backend/
│   ├── cad_engine.py            # NVIDIA usd-brep execution, manifold/census queries, sanity_checks, USD/STL export
│   ├── presets.py               # Backend preset catalog
│   ├── server.py                # FastAPI endpoints (/api/health, /api/presets, /api/execute, /api/guides)
│   └── test_cad_engine.py       # Pytest suite verifying presets, OpenUSD round-trip, and edge cases
└── docs/
    └── nvidia-usd-brep/         # Complete official NVIDIA-Omniverse/usd-brep documentation, skills, stubs & examples
```
