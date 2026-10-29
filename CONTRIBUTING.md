# Contributing to ApexCAD Studio

Thank you for your interest in contributing to **ApexCAD Studio** (`agentic-cad-usd-brep`)! Whether you are fixing a bug, adding metric fastener primitives for 3D printing, improving CNC G-code toolpaths, or refining the agentic copilot loop, your contributions are welcome.

Before opening an issue or pull request, please review our [Product Roadmap & Release End States](ROADMAP.md) and [Branching Strategy & Release Lifecycle Guide](docs/BRANCHING_AND_RELEASES.md).

## 1. Development Environment Setup

ApexCAD Studio uses a **Dual-Runtime Hybrid Architecture** so contributors can work on the frontend, client-side `manifold-3d` WebAssembly CSG engine, and CAM studio on **any OS (macOS Apple Silicon/Intel, Linux, or Windows)** with just Node.js, while optionally running the native Python 3.12 [NVIDIA `usd-brep`](https://github.com/NVIDIA-Omniverse/usd-brep) C++ kernel backend on Linux or Windows x86_64/aarch64.

### Prerequisites
- **Node.js**: `v20.x` or higher (`npm` v10+)
- **Python**: `3.12` (optional for frontend/Wasm work; required for backend `pytest` and native `usd-brep` C++ kernel execution)

### Step-by-Step Local Setup
```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/agentic-cad-usd-brep.git
cd agentic-cad-usd-brep

# 2. Switch to the active integration branch (never work directly on main)
git checkout dev

# 3. Copy the environment template (never commit real API keys)
cp .env.example .env

# 4. Install frontend & server dependencies
npm install

# 5. Start the Express + Vite development server on http://localhost:3000
npm run dev
```

### Optional: Python 3.12 Backend Setup
```bash
# Create a Python 3.12 virtual environment
python3.12 -m venv .venv-usd-brep
source .venv-usd-brep/bin/activate  # On Windows: .\.venv-usd-brep\Scripts\Activate.ps1

# Install FastAPI & test dependencies
pip install -r backend/requirements.txt

# On Linux x86_64/aarch64 or Windows x86_64, install the NVIDIA usd-brep wheel:
pip install usd-brep

# Run the FastAPI backend on http://127.0.0.1:8000
npm run backend
```

## 2. Branching & Pull Request Policy

We enforce a strict **`dev` → `main` Git Flow** via automated GitHub Actions guards ([`.github/workflows/pr-target-guard.yml`](.github/workflows/pr-target-guard.yml)):

1. **Never target `main` directly**: Direct pushes and feature pull requests targeting `main` are automatically blocked by CI. `main` only receives code from automated weekly/on-demand Release PRs (`dev` → `main`) or emergency `hotfix/*` branches.
2. **Branch from `dev`**: Create a short-lived topic branch from `dev`:
   - `feat/<short-slug>` — New user-facing CAD, CAM, 3D printing, or copilot features
   - `fix/<short-slug>` — Bug fixes in geometry evaluation, exports, or UI state
   - `refactor/<short-slug>` — Code modularization (such as extracting components from `src/App.tsx`)
   - `docs/<short-slug>` — Documentation, roadmap, or guide updates
   - `test/<short-slug>` — New Vitest, pytest, or headless browser test coverage
3. **Use Conventional Commits**: All commit messages and PR titles must follow the [Conventional Commits](https://www.conventionalcommits.org/) format (`type(scope): description`) because `scripts/release-manager.mjs` uses them to calculate Semantic Versioning (`SemVer`) bumps and generate `CHANGELOG.md`:
   - `feat(cam): add concentric pocket clearing stepover pass` (triggers **Minor** bump)
   - `fix(stl): apply 10x millimeter scale to per-part STL downloads` (triggers **Patch** bump)
   - `refactor(ui): extract library sidebar from App.tsx` (triggers **Patch** bump)

## 3. Pre-PR Verification Checklist

Every pull request targeting `dev` must pass all automated checks in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Run these locally before opening your PR:

```bash
# 1. TypeScript Static Analysis (Must return 0 errors)
npm run lint

# 2. Frontend & Service Unit Tests (Vitest — 160+ tests across 15 suites)
npm test

# 3. Production Vite Bundle Check
npm run build

# 4. Python Backend Tests (if modifying backend/*.py)
pytest backend/test_cad_engine.py -v
```

### Engineering & Security Rules
- **Zero Tracked Secrets**: Never commit `.env` files, real API keys (`AIza...`, `sk-...`, `hf_...`), or Firebase credentials. Our CI `security-audit` job scans all tracked files on every push and fails immediately on any match.
- **Keep `cm` vs. `mm` Units Explicit**: OpenUSD and NVIDIA `usd-brep` operate in **centimeters** (`metersPerUnit = 0.01`, `upAxis = "Z"`), whereas 3D printing slicers (Bambu Studio, PrusaSlicer, Cura) and CNC controllers (`G21`) expect **millimeters** (`1 cm = 10 mm`). Always document unit expectations in function signatures and tests.
- **Honest Feature Boundaries**: Do not add stubbed UI buttons or claim unimplemented CAD/CAM operations in documentation. If a feature is experimental or partial, label it clearly in the UI and update the Feature Maturity Matrix in [ROADMAP.md](ROADMAP.md).

## 4. High-Impact "Good First Issues" for Contributors

Looking for a practical place to jump in? These self-contained tasks directly advance our `v1.3.0` and `v1.4.0` maker milestones:

- **Metric Fastener & Heat-Set Insert Catalog (`src/services/csgEngine.ts`)**: Add standard metric `M2`, `M3`, `M4`, `M5`, and `M6` clearance bores, ISO 4762 socket head counterbores, and brass heat-set insert bosses to `PRIMITIVE_CATALOG` with unit tests in `src/services/csgEngine.test.ts`.
- **Target-Scoped Dimension Mutation (`src/services/parametricIntelligence.ts`)**: Update `mutateDimensionInCode()` so dimensional edits (e.g., *"make `boss_cyl` radius 4 cm"*) match the specific variable assignment for `intent.targetPart` rather than replacing all `sm.create_cylinder` calls globally.
- **Multi-Line `return [...]` Support in CSG Booleans (`src/services/csgEngine.ts`)**: Harden `applyCsgBooleanToScript()` so boolean Union/Difference/Intersection operations cleanly parse multi-line Python `return [...]` lists with trailing commas and comments.
- **CNC Dogbone Corner Relief (`src/services/camService.ts`)**: Add an optional `addDogboneRelief: boolean` pass in `offsetPolyline()` for `inside_pocket` cuts so a round endmill clears sharp `90°` internal corners for mating rectangular tabs.
- **Modularize `src/App.tsx`**: Extract the left Preset/File Library pane, center Copilot Workbench, or right Engineering Inspector tabs from `src/App.tsx` into dedicated components under `src/components/` while keeping all existing Vitest suites green.
