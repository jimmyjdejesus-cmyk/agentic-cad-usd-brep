## Description

<!-- Provide a concise summary of the changes introduced by this pull request. -->
<!-- Explain the problem being solved, feature added, or bug fixed. -->

Fixes / Relates to: # <!-- Issue number if applicable -->

---

## Type of Change

<!-- Please select all categories that apply: -->
- [ ] 🚀 **feat**: New feature or enhancement (e.g., new CAD tool, AI provider, CAM post-processor)
- [ ] 🐛 **fix**: Bug fix or regression resolution
- [ ] 🛠️ **refactor**: Code restructuring without behavior alteration
- [ ] ⚡ **perf**: Performance optimization (e.g., Three.js 60fps render, memory footprint reduction)
- [ ] 🧪 **test**: New or updated test suites (Vitest, Pytest, CDP browser automation)
- [ ] 📚 **docs**: Documentation updates (README, ARCHITECTURE, TDD guides)
- [ ] 🔒 **security**: Secret scanning, credential safety, or security policy improvement
- [ ] 🧹 **chore**: Maintenance, dependencies, CI/CD, or governance

---

## Engineering & CAD Validation Checklist

<!-- Verify all applicable CAD, solid modeling, and geometric integrity checks: -->
- [ ] **B-Rep & CSG Manifold Integrity**:
  - Parts verify as watertight solids (`brep.is_manifold_solid()` or client CSG `manifold-3d`).
  - No negative volumes, inverted face normals, or zero-thickness geometry.
- [ ] **Sanity & Clearance Checks**:
  - Pairwise clearances verified without unintended part interpenetrations.
  - Ground-plane anchors (e.g., $z=0$) preserved during parametric scaling or auto-repair.
- [ ] **Export & Fabrication Formats**:
  - Tested exports: `.usda` (OpenUSD Mesh), `.brep.usda` (NURBS BrepArray), `.stl` (outward normals), `.dxf` (2D contours), or `.gcode` (CNC toolpaths).
- [ ] **AI Routing & Hardware Memory Safety**:
  - Provider routes tested (`Google Gemini`, `Ollama`, `LM Studio`, `vLLM`, `Groq`, `Together`).
  - Memory gating validated with `canRunOnSystem()` (1.5 GB Three.js/Manifold reservation).
- [ ] **UI & Viewport Responsiveness**:
  - Three.js 3D viewport remains responsive (60 FPS target).
  - Responsive at desktop and tablet breakpoints (1024px+).
  - WAI-ARIA labels and keyboard navigation verified for accessible controls.

---

## TDD & Quality Assurance

<!-- Verify all automated testing and static analysis suites pass before submission: -->
- [ ] `npm run lint` — TypeScript static analysis passes with 0 errors (`tsc --noEmit`).
- [ ] `npm test` — Vitest unit and integration test suite passes (all 155+ tests green).
- [ ] `pytest backend/test_cad_engine.py -v` — Python FastAPI B-Rep engine tests pass.
- [ ] `npm run build` — Production Vite bundle compiles cleanly without warnings.
- [ ] `npm run test:browser` — Headless Chrome CDP browser automation passes (if UI modified).
- [ ] **Secret Leak Prevention**: Clean git tree; zero API keys or credentials committed (verified by CI `security-audit`).

---

## Screenshots or Execution Logs (Optional)

<!-- Attach viewport render screenshots, G-code preview, or test execution logs if relevant: -->

```
[Paste terminal test summary or execution output here]
```
