---
name: cad-deep-review-and-system-audit
description: Comprehensive end-to-end audit, multi-tier testing, security screening, and bundle optimization playbook for ApexCAD Studio.
---

# CAD Deep Review & System Audit Playbook

This skill establishes the standardized, repeatable operational procedure for executing a thorough, repository-wide deep audit of ApexCAD Studio across frontend, backend, AI routing, digital fabrication, security, and release governance.

---

## 1. Automated Verification Pipeline (Zero-Defect Standard)

Execute every quality gate before declaring any audit or release complete:

```bash
# 1. Vitest Unit & Integration Suites (160 tests across 15 suites, ~1.1s)
npm test

# 2. TypeScript Static Analysis (strict noEmit check, 0 errors expected)
npm run lint

# 3. Headless Chrome CDP Automation Suite (9 browser scenarios at 1024x768)
npm run test:browser

# 4. Python FastAPI Engine Verification (18 tests in .venv-usd-brep)
.venv-usd-brep/bin/pytest backend/test_cad_engine.py -v

# 5. Production Vite Bundle & Asset Build (ensure clean vendor code-splitting)
npm run build

# 6. Secret & Credential Leak Audit (scans all tracked git files)
python3 -c "
import os, re, sys
patterns = {
    'Google/Firebase': re.compile(r'AIza[0-9A-Za-z-_]{35}'),
    'OpenAI': re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    'Anthropic': re.compile(r'sk-ant-[a-zA-Z0-9]{20,}'),
    'Hugging Face': re.compile(r'hf_[a-zA-Z0-9]{20,}'),
}
for f in [f.strip() for f in os.popen('git ls-files').readlines()]:
    if os.path.isfile(f):
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            for idx, line in enumerate(fp, 1):
                for name, pat in patterns.items():
                    if pat.search(line):
                        print(f'Leak in {f}:{idx}'); sys.exit(1)
print('PASSED: Clean git tree.')
"

# 7. Release Divergence & Conventional Commit Status
npm run release:check
```

---

## 2. Core Architectural Audit Dimensions

Systematically evaluate the codebase against these four architectural pillars:

### A. Digital Fabrication & CAM (`src/services/camService.ts` & `src/components/CamCncModal.tsx`)
- **2D DXF Export**:
  - Must conform to AutoCAD Release 12 ASCII standard (`AC1009`).
  - Unit header must specify millimeters: `$INSUNITS = 4`.
  - Separate layers: `CONTOUR` (Color 1: Red for exterior cut) and `INNER_CUT` (Color 3: Green for internal pockets/holes).
- **CNC G-Code Generator**:
  - Tool radius compensation must calculate polygon winding order via shoelace formula before offsetting.
  - Multi-pass step-downs must plunge incrementally down to target depth with safe retracts ($Z_{safe}$).
  - Optional holding tabs must be placed only on the final contour pass.
- **3D Printing Preflight**:
  - Validate watertight 2-manifold closed shells ($\chi = 2$, 0 boundary edges).
  - Calculate bed adhesion contact ratio ($A_{bed} / A_{footprint}$) and evaluate adhesion risk (low/medium/high).
  - Compute accurate filament weight estimates for PLA, PETG, ABS, and TPU.

### B. Model-Agnostic Provider Router (`server.ts` & `src/services/geminiAgent.ts`)
- **Base URL Normalization**:
  - Prevent double slashes (`//`) or omitted subpaths when user provides endpoints like `http://localhost:11434`, `http://localhost:11434/v1`, or full `/chat/completions`.
- **Transparent Fallback Messaging**:
  - When external providers (Gemini, Ollama, LM Studio, Groq) are unreachable, the UI explanation must explicitly clarify that the local deterministic parametric fallback engine synthesized the geometry rather than implying the LLM succeeded.
- **Connection Probing (`testOnly` mode)**:
  - Return immediate connection verification (HTTP 200 or 502) without triggering model token generation or fallback synthesis.

### C. True-to-System Hardware Gating (`canRunOnSystem` in `src/services/appToolsAndSkills.ts`)
- **CAD Studio Viewport Reservation**:
  - Maintain the **1.5 GB memory reservation** dedicated to the Three.js WebGL canvas and Manifold WASM solid geometry evaluation.
- **Blocking & Confirmation Thresholds**:
  - Block activation (`allowed: false`, `requiresConfirmation: true`) if required model memory exceeds available RAM/VRAM, if effective utilization exceeds 95%, or if estimated throughput falls below 4 tokens/sec.
- **Platform Telemetry**:
  - Host endpoint (`/api/system/hardware`) must accurately detect Apple Silicon Unified Memory without being clamped by browser 8 GB limits.

### D. Parametric Intelligence & Auto-Repair (`src/services/parametricIntelligence.ts`)
- **Coordinate vs. Dimension Separation**:
  - When handling `SM_ERR_INVALID_INPUT`, clamping to physical minimums ($1.0\text{ cm}$) must strictly apply to dimensional parameters (radius, width, length, height), NOT origin coordinates `(x, y, z)` which can legitimately be `0.0` or negative.
- **Ground Clearance Integrity**:
  - When elevating components to eliminate bounding-box interpenetrations, ensure ground plane anchor alignment ($z=0$) is preserved by translating only upper stacked parts ($z0 > 0.05$ or subsequent multi-part indices).

---

## 3. Production Bundle Optimization Standards

- Keep production bundle chunk sizes under 800 kB via Vite `rollupOptions.output.manualChunks`:
  - `three-vendor`: Three.js runtime & controls
  - `lucide-vendor`: Icon assets
  - `firebase-vendor`: Auth & Firestore SDKs
  - `manifold-BE4c7gO-.wasm`: WebAssembly geometry engine (~541 kB)

---

## 4. Documentation & Release Alignment

Ensure that:
1. `README.md` badge and summary reflects current Vitest test count (160 tests) and feature matrix.
2. `docs/TDD_AND_TESTING.md` accurately lists test counts across all 15 test suites.
3. `.gitignore` ignores transient build and telemetry directories (`.firebase/`, `.pytest_cache/`, `dist/`).
4. `scripts/release-manager.mjs check` reports `dev` branch synchronization with `main`.
