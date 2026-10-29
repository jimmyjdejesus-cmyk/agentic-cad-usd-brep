# ApexCAD Studio — NVIDIA `usd-brep` Agentic CAD Studio

[![CI Matrix](https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep/actions/workflows/ci.yml/badge.svg)](https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep/actions/workflows/ci.yml)
[![Vitest](https://img.shields.io/badge/Vitest-160%20Tests%20Passing-brightgreen.svg)](docs/TDD_AND_TESTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-cyan.svg)](https://react.dev/)
[![OpenUSD](https://img.shields.io/badge/OpenUSD-24.08-green.svg)](https://openusd.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellow.svg)](LICENSE)

An **Agentic B-Rep and CSG CAD Studio** powered by **NVIDIA's `usd-brep` (`SMLib` / `_omni_solid` C++ NURBS kernel)**, **OpenUSD (`UsdGeom.Mesh` & `BrepArray`)**, **WebAssembly `manifold-3d` CSG Engine**, and **Google Gemini (`@google/genai` `gemini-3.8-flash`)**, featuring complete model-agnostic AI copilot support (Google GenAI, local Ollama socket, LM Studio, vLLM, Groq, Together AI, and Hugging Face Hub live GGUF explorer).

---

## Architecture & Dual Solid Modeling Kernels

ApexCAD Studio is engineered for agility, crash resilience, and cross-platform flexibility:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   Frontend: Vite + React 18 + TypeScript                   │
│             (Root layout compatible with Google AI Studio Build)           │
├───────────────────────┬──────────────────────────┬─────────────────────────┤
│  Pane 1: CAD Library  │  Pane 2: Agentic Workbench│  Pane 3: 3D USD Viewport│
│  • Geometric Archetypes│ • Gemini 3.8 Flash Agent│  • Three.js Orbit/Grid  │
│  • Parametric Gallery │ • Model-Agnostic Router  │  • Docked Inspector:    │
│  • Versioned Designs  │ • Hardware Memory Gate   │    Parts, Mass, 3D Pins │
│  • In-App Agent Tools │ • 3x Self-Healing Loop   │  • CAM & G-Code Studio  │
│  • Primitive Shaper   │ • Python Code Editor     │  • 1-Click Export:      │
│    (Box, Cyl, Sphere) │ • Topology Diagnostics   │    USD, STL, DXF, GCode │
└───────────┬───────────┴─────────────┬────────────┴────────────┬────────────┘
            │                         │                         │
            ▼                         ▼                         ▼
   ┌────────────────────────────────────┐      ┌─────────────────────────────┐
   │ Mode A: Local Native Kernel API    │      │ Mode B: Client-Side CSG     │
   │ FastAPI (`backend/server.py`)      │      │ Manifold-3D WebAssembly     │
   │ Runs in `.venv-usd-brep` (Py 3.12) │      │ Runs 100% in-browser        │
   │ • Real `import usd_brep as sm`     │      │ • Watertight 2-manifold CSG │
   │ • Exact NURBS booleans, fillets,   │      │ • Exact outward normals     │
   │   sweeps, curves, surfaces         │      │ • Individual part download  │
   │ • `sm.tessellate()` → `PolyBrep`   │      │ • Zero-crash offline        │
   │ • `sm.usd.export_brep()` & `.usda` │      │   reliability               │
   └────────────────────────────────────┘      └─────────────────────────────┘
```

1. **Mode A: Native Python 3.12 C++ B-Rep Kernel**:
   - Connects to the local FastAPI backend running NVIDIA's `usd-brep==1.0.0` C++ solid modeling library (`_omni_solid` / `SMLib`).
   - Computes exact analytic NURBS boundary representations, circular filleting, sweeps, boolean operations, OpenUSD `BrepArray` export, and tolerance-controlled tessellation.
2. **Mode B: Client-Side WebAssembly CSG Kernel (`manifold-3d`)**:
   - Executes 100% in-browser on macOS (Apple Silicon), Linux, Windows, or within Google AI Studio preview sandboxes without requiring a local Python C++ toolchain.
   - Computes watertight constructive solid geometry (CSG), exact outward facet normals for clean 3D printing slicing, and per-part STL downloads.
3. **Model-Agnostic Copilot Routing**:
   - **Google Gemini (`gemini-3.8-flash`)**: Cloud-orchestrated synthesis with 3x self-healing manifold repair loop.
   - **Local Sockets**: Direct connection to local Ollama (`http://127.0.0.1:11434`), LM Studio (`http://127.0.0.1:1234`), or vLLM (`http://127.0.0.1:8000/v1`).
   - **Cloud LPUs & APIs**: Groq, Together AI, or OpenAI with custom endpoint configuration.
   - **Hugging Face Hub Live Explorer**: Live repository search and GGUF quantization parsing (`Q4_K_M`, `Q8_0`, `FP16`).
   - **Hardware Memory Gate**: Evaluates host RAM, cores, and WebGPU limits, enforcing a **1.5 GB memory reservation** for the CAD viewport to prevent system OOM freezes.

---

## Key Capabilities

### 1. Parametric CAD & Templates
- **Geometric Archetypes**: Rapid initialization from **Box / Enclosure**, **Cylinder / Rotor**, **Triangular Prism**, or **Blank Canvas** templates.
- **Direct Canvas Primitive Insertion**: One-click placement of Box, Cylinder, Sphere, Wedge, Cone, and Torus primitives directly into the 3D viewport.
- **Dynamic SVG Shape Thumbnails**: Isometric, orthographic, and schematic previews rendered dynamically.
- **Persistent File Management**: Save, duplicate, rename, export, and load designs across browser storage and optional cloud vaults.

### 2. Engineering Inspector & UX
- **Docked Multi-Tab Sidebar**: Switch cleanly between **Parts Hierarchy**, **Mass Properties**, **3D Annotations**, and **Explosion Timeline**.
- **Part Isolation & Renaming**: Single-click part isolation, hide/show toggling, and synchronized part renaming that propagates across Python code, OpenUSD prim paths, and 3D annotation pins.
- **Mass Properties Calculator**: Dynamic mass, volume, bounding box, and 3D Center-of-Mass (CoM) calculated dynamically across 8 PBR industrial materials (Steel, Aluminum, Titanium, Brass, ABS, PEEK, Delrin, Carbon Fiber).
- **Explosion Timeline**: Keyframed assembly disassembly with easing curves, scrubbing slider, and part translation vectors.
- **3D Surface & Vertex Annotations**: Place interactive 3D pins on geometric features with snap-to-vertex, leader lines, resolution toggling, and camera focus.

### 3. CAM, CNC G-Code & Digital Fabrication Studio
- **2.5D Perimeter Toolpaths (Beta)**: Multi-pass 2D outside contour and inside pocket perimeter offset milling with shoelace cutter radius compensation, holding tabs, and interactive 3D toolpath simulation (*full interior raster/concentric pocket clearing and multi-Z waterline roughing scheduled for `v2.0.0` — see [ROADMAP.md](ROADMAP.md)*).
- **CNC G-Code Post-Processor (Beta)**: Standard RS-274 (`Grbl`, `Marlin`, `LinuxCNC`, `Haas`) G-code generation with configurable feed rates, plunge rates, spindle speed (`M03`), and safe Z clearance planes.
- **2D Vector DXF Cut-Sheet Exporter (Stable)**: AutoCAD R12 ASCII DXF output (`mm` units) for CNC laser, plasma, waterjet, and router tables.
- **True-Scale 3D Printing Preflight & STL Export (Stable)**: `10×` millimeter STL scaling (`cm` → `mm`) for direct 1:1 import into Bambu Studio, PrusaSlicer, OrcaSlicer, and Cura, plus real-time `>45°` overhang heatmaps, 2D layer slicing preview, and PLA/PETG/ABS/TPU mass estimates.

### 4. AMD Silicon & EDA Multi-Chip Module (MCM) Studio *(Experimental)*
- Optional domain module for synthesizing 2.5D semiconductor packaging assemblies (organic substrate BGA, silicon interposer, logic core die, HBM3 cache stacks, and copper IHS) from circuit netlists.

### 5. Official NVIDIA `usd-brep` Guide Explorer
- Bundles all **36 official guides, skills, `.pyi` type stubs, and example scripts** from [`NVIDIA-Omniverse/usd-brep`](https://github.com/NVIDIA-Omniverse/usd-brep) inside [`docs/nvidia-usd-brep/`](docs/nvidia-usd-brep/), searchable directly in-app.

---

## Quick Start

### Prerequisites
- **Node.js**: `v20.x` or higher
- **Python**: `3.12` (recommended for native NVIDIA `usd-brep` C++ kernel)
- **uv** (recommended) or standard `pip`

---

### Step 1: Clone & Configure Environment

```bash
git clone https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep.git
cd agentic-cad-usd-brep

# Copy example environment configuration
cp .env.example .env
```

Edit `.env` to configure your API keys (credentials in `.env` are strictly gitignored):
```bash
# Google Gemini API Key for server-side CAD synthesis & self-healing
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Client Configuration (Optional - for Auth & Cloud Storage)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
```

---

### Step 2: Install Dependencies & Start Server

```bash
# Install NPM dependencies
npm install

# Start Express hybrid server & Vite dev server (Port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 3: (Optional) Start Python 3.12 B-Rep Kernel Backend (Port 8000)

To execute exact C++ NURBS B-Rep operations on supported platforms (Linux x86_64 or Windows x86_64):

```bash
# Setup virtual environment with Python 3.12
uv venv .venv-usd-brep --python 3.12

# Install backend dependencies
uv pip install -r backend/requirements.txt --python .venv-usd-brep

# Install NVIDIA usd-brep wheel (if on supported x86_64 platform)
uv pip install usd-brep --python .venv-usd-brep

# Start FastAPI server on http://127.0.0.1:8000
npm run backend
```

---

## Branching Strategy & Release Lifecycle

ApexCAD Studio follows a structured development and release cadence:

- **`main` (Production Branch)**: Direct commits to `main` are **strictly prohibited** by branch protection and CI guards. Only verified code via **Scheduled Release PRs from `dev`** or emergency hotfixes can be merged into `main`.
- **`dev` (Active Integration Branch)**: All day-to-day development happens in topic branches (`feat/*`, `fix/*`, `refactor/*`) branched from `dev` and merged into `dev` via pull requests.
- **Automated Scheduled Releases**: A GitHub Actions workflow ([`.github/workflows/scheduled-release-pr.yml`](.github/workflows/scheduled-release-pr.yml)) runs weekly on Mondays at 00:00 UTC (or manually triggered) to calculate SemVer version bumps from Conventional Commits, update `CHANGELOG.md`, and open an automated Release PR from `dev` to `main`.
- **Automated Publishing & Tagging**: Merging a release PR into `main` automatically triggers [`.github/workflows/publish-release.yml`](.github/workflows/publish-release.yml), creating an annotated Git tag (`vX.Y.Z`) and publishing a formal GitHub Release.

```bash
# Developer Release CLI Tooling
npm run release:check       # Check if dev is ahead of main & preview next SemVer version
npm run release:changelog   # Preview formatted markdown changelog for pending commits
npm run release:bump        # Bump package.json and update CHANGELOG.md locally
```

See the [Branching Strategy & Release Lifecycle Guide](docs/BRANCHING_AND_RELEASES.md) for full architectural details.

---

## Testing & Quality Assurance Matrix

The repository features comprehensive automated test coverage across frontend, backend, browser, and security dimensions:

```bash
# 1. Frontend Unit Tests (Vitest — 160 tests across 15 test suites, ~1.2s)
npm test

# 2. TypeScript Static Analysis (0 errors)
npm run lint

# 3. Production Bundle Build (Vite)
npm run build

# 4. Headless Chrome CDP Verification (9 DOM/ARIA & Viewport scenarios)
npm run test:browser

# 5. Python Backend Engine Verification
pytest backend/test_cad_engine.py -v
```

---

## CI/CD Automation

Continuous Integration is automated via GitHub Actions in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Job 1 (`security-audit`)**: Scans all tracked files for exposed API keys, private keys, and secrets with 0-tolerance leak enforcement.
- **Job 2 (`frontend-ci`)**: Executes TypeScript linting (`tsc --noEmit`), Vitest suite (`npm test`), and production bundle compilation (`npm run build`) across both `main` and `dev` branches.
- **Job 3 (`backend-ci`)**: Sets up Python 3.12, installs `backend/requirements.txt`, and verifies `backend/test_cad_engine.py`.
- **Guard Workflow ([`.github/workflows/pr-target-guard.yml`](.github/workflows/pr-target-guard.yml))**: Enforces that direct feature PRs target `dev`, rejecting any attempt to target `main` directly.

---

## Documentation & Maintainer Governance

- 🗺️ [Product Roadmap & Release End States (`ROADMAP.md`)](ROADMAP.md) — Feature Maturity Matrix (`Stable`, `Beta`, `Experimental`, `Planned`), release milestones (`v1.2.0` → `v2.0.0`), exit criteria, and maker benchmark fixtures.
- 🤝 [Contributor Guide (`CONTRIBUTING.md`)](CONTRIBUTING.md) — Local setup, `cm` vs. `mm` unit conventions, `dev` → `main` PR rules, and high-impact "Good First Issues".
- 🌿 [Branching Strategy & Release Lifecycle Guide](docs/BRANCHING_AND_RELEASES.md) — Dual-branch flow (`dev` & `main`), no-commit policy, automated scheduled releases, SemVer calculation, and publishing.
- 🏛️ [System Architecture Specification](docs/ARCHITECTURE.md) — Comprehensive layer-by-layer architectural breakdown, hardware memory gating formulas, and kernel interfaces.
- 🧪 [TDD & Quality Assurance Guide](docs/TDD_AND_TESTING.md) — Test-Driven Development methodology, detailed catalog of all 15 test suites (162 unit tests), and regression testing protocols.
- ⚙️ [CAM, CNC G-Code & Digital Fabrication Guide](docs/CAM_AND_MANUFACTURING.md) — Toolpath strategies, RS-274 G-Code dialect, and 2D DXF cut-sheet export.
- 🧠 [Model-Agnostic AI & Hardware Gating Guide](docs/MODEL_AGNOSTIC_AI.md) — Multi-provider configuration (Ollama, LM Studio, vLLM, Groq, Together, Hugging Face Hub), memory gating calculations, and OOM prevention.
- 📋 [Pull Request Template](.github/pull_request_template.md) — Engineering validation checklist and testing requirements for PR submissions.

---

## Security & Secrets Management

- **Zero Tracked Secrets**: Configuration files (e.g. `firebase-applet-config.json`, `.firebaserc`) contain zero hardcoded credentials or API keys.
- **Dynamic Variable Injection**: Secrets are loaded exclusively from environment variables (`process.env.GEMINI_API_KEY`, `import.meta.env.VITE_FIREBASE_API_KEY`).
- **Graceful Unconfigured Mode**: If optional services (like Firebase Auth) are not configured, the application falls back gracefully with user-friendly notices without throwing fatal initialization exceptions.
- **Secret Scanning Auditing**: Automated in GitHub Actions and guided by workspace audit skills.

---

## License

This project is licensed under the Apache 2.0 License. NVIDIA `usd-brep` documentation and type stubs are copyright NVIDIA Corporation.
