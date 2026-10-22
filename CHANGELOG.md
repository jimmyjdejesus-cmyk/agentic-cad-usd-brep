# Changelog — ApexCAD Studio

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-10-22

### 🚀 Features & Enhancements
- **flow:** configure dev-driven workflow, PR guard, SemVer release automation, and branch protection (6389cce)

## [1.0.0] — 2026-10-21

### 🚀 Features & Enhancements
- **Kernel:** Integrated NVIDIA `usd-brep` (`SMLib` / `_omni_solid` C++ NURBS kernel) with OpenUSD stage import and export (`BrepArray` and `UsdGeom.Mesh`).
- **Client CSG:** Implemented client-side WebAssembly `manifold-3d` CSG engine for 100% offline watertight boolean unions, differences, and intersections with exact outward normal STL exports.
- **Model-Agnostic Copilot:** Added multi-provider AI routing across Google Gemini 3.8 Flash, local Ollama socket (`http://127.0.0.1:11434`), LM Studio, vLLM, Groq, Together AI, and OpenAI.
- **Hardware Gating:** Implemented `canRunOnSystem()` hardware detection and resource estimator enforcing 1.5 GB Three.js viewport reservation to prevent host out-of-memory crashes.
- **Hugging Face Explorer:** Added live Hugging Face Hub search with automatic GGUF quantization parsing (`Q4_K_M`, `Q8_0`, `FP16`).
- **CAM & Fabrication:** Native CAM toolpath generation (2D Profiling, Pocket Clearing, Waterline Roughing, Ballnose Finishing), RS-274 G-Code post-processor, 2D vector DXF cut-sheets, and 3D printing slicing preflight.
- **Parametric Archetypes:** Added Box/Enclosure, Cylinder/Rotor, Triangular Prism, and direct canvas primitive insertion (Box, Cylinder, Sphere, Wedge, Cone, Torus).
- **Engineering Inspector:** Multi-tab sidebar for Parts Tree, Mass Properties & Center-of-Mass marker (8 industrial PBR materials), 3D vertex annotation pins, and disassembly explosion timeline.
- **MCM Semiconductor Packaging:** Synthesize 2.5D semiconductor packaging assemblies (BGA substrate, silicon interposer, logic die, HBM3 stacks, copper IHS).

### 🛠️ Architecture, Tests & Maintenance
- **Testing:** 160 Vitest frontend tests across 15 suites, Python FastAPI pytest engine suite, and headless Chrome CDP automation.
- **CI/CD:** Automated GitHub Actions matrix with secret scanning leak prevention, TypeScript linting, Vitest suites, and backend pytest.
