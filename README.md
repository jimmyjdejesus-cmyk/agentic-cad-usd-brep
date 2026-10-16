# ApexCAD Studio — NVIDIA `usd-brep` Agentic CAD Studio

[![CI Matrix](https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep/actions/workflows/ci.yml/badge.svg)](https://github.com/jimmyjdejesus-cmyk/agentic-cad-usd-brep/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-cyan.svg)](https://react.dev/)
[![OpenUSD](https://img.shields.io/badge/OpenUSD-24.08-green.svg)](https://openusd.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-yellow.svg)](LICENSE)

An **Agentic B-Rep CAD Studio** powered by **NVIDIA's `usd-brep` (`SMLib` / `_omni_solid` C++ NURBS kernel)**, **OpenUSD (`UsdGeom.Mesh` & `BrepArray`)**, and **Google Gemini (`@google/genai` `gemini-3.8-flash`)**, featuring agnostic AI harness support (Google GenAI, Nous Hermes Agent, Pi Agent, Hugging Face WebGPU, and local Ollama sockets).

---

## Architecture & Hybrid Execution

ApexCAD Studio is engineered for continuous agility and resilience:

1. **Local Native C++ B-Rep Mode**:
   - Connects to the local Python 3.12 FastAPI backend running NVIDIA's `usd-brep==1.0.0` C++ solid modeling kernel (`_omni_solid`).
   - Computes exact NURBS boundary representations, boolean unions/differences/intersections, circular fillets, sweeps, `sm.tessellate()`, and `sm.usd` OpenUSD stage serialization.
2. **Client-Side Geometric Synthesizer (Zero-Crash Fallback)**:
   - When running in browser preview, Google AI Studio Build Mode, or on host platforms without native `usd_brep` C++ wheels (e.g. macOS ARM64), the studio automatically falls back to the client-side Three.js geometric synthesizer without 404/500 stalls.
3. **Multi-Harness Copilot Execution**:
   - **Google GenAI (`gemini-3.8-flash`)**: Cloud-orchestrated server-side synthesis with candidate model cascading and 3x self-healing manifold repair loop.
   - **Nous Hermes Agent**: Local/remote agent with native function calling and topology verification tool execution.
   - **Pi Agent**: Rapid continuous reactive co-design with 60fps viewport synchronization.
   - **Hugging Face WebGPU**: On-device in-browser inference with zero telemetry.
   - **Ollama / vLLM Socket**: Localhost socket integration on `http://127.0.0.1:11434`.

---

## Key Capabilities

### 1. Parametric CAD & Templates
- **Template Switcher & Creator**: Launch new designs from geometric archetypes (**Box / Enclosure**, **Cylinder / Rotor**, **Triangular Prism**, or **Blank Canvas**).
- **Interactive SVG Shape Thumbnails**: Isometric, orthographic, and schematic previews rendered dynamically.
- **Persistent File Management**: Save, duplicate, rename, export, and load designs across local storage and cloud vaults.

### 2. Engineering Inspector & UX
- **Docked Multi-Tab Sidebar**: Switch cleanly between **Parts Hierarchy**, **Mass Properties**, **3D Annotations**, and **Explosion Timeline**.
- **Part Isolation & Renaming**: Single-click part isolation, hide/show toggling, and in-place part renaming that propagates synchronously across Python code, OpenUSD tags, and 3D annotations.
- **Mass Properties Calculator**: Dynamic mass, volume, bounding box, and center-of-mass (CoM) calculated dynamically with PBR material presets (Steel, Aluminum, Titanium, Brass, ABS, PEEK, Delrin, Carbon Fiber).
- **Explosion Timeline**: Keyframed assembly disassembly with easing curves, scrubbing slider, and part translation vectors.
- **3D Surface & Vertex Annotations**: Place interactive 3D pins on geometric features with snap-to-vertex, leader lines, resolution toggling, and camera focus.

### 3. AMD Silicon & EDA Multi-Chip Module (MCM) Studio
- Synthesize 2.5D semiconductor packaging assemblies including organic substrate BGA, silicon interposer, logic core die, HBM3 cache stacks, and copper integrated heat spreader (IHS) from circuit netlists.

### 4. Official NVIDIA `usd-brep` Guide Explorer
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

### Step 2: Install Frontend Dependencies & Start Server

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

## Testing & Verification Matrix

The repository features automated test coverage across frontend, backend, browser, and security dimensions:

```bash
# 1. Frontend Unit Tests (Vitest — 72 tests across 9 test suites)
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
- **Job 2 (`frontend-ci`)**: Executes TypeScript linting (`tsc --noEmit`), Vitest suite (`npm test`), and production bundle compilation (`npm run build`).
- **Job 3 (`backend-ci`)**: Sets up Python 3.12, installs `backend/requirements.txt`, and verifies `backend/test_cad_engine.py`.

---

## Security & Secrets Management

- **Zero Tracked Secrets**: Configuration files (e.g. `firebase-applet-config.json`) contain zero hardcoded credentials or API keys.
- **Dynamic Variable Injection**: Secrets are loaded exclusively from environment variables (`process.env.GEMINI_API_KEY`, `import.meta.env.VITE_FIREBASE_API_KEY`).
- **Graceful Unconfigured Mode**: If optional services (like Firebase Auth) are not configured, the application falls back gracefully with user-friendly notices without throwing fatal initialization exceptions.
- **Secret Scanning Auditing**: Automated in GitHub Actions and guided by the [`.gemini/skills/secret-audit-and-remediation/SKILL.md`](.gemini/skills/secret-audit-and-remediation/SKILL.md) workspace skill.

---

## License

This project is licensed under the Apache 2.0 License. NVIDIA `usd-brep` documentation and type stubs are copyright NVIDIA Corporation.
