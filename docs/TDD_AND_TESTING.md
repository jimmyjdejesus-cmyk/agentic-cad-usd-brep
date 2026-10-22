# ApexCAD Studio — Test-Driven Development (TDD) & Quality Assurance Guide

## 1. TDD Philosophy & Engineering Principles

ApexCAD Studio enforces a **Strict Test-Driven Development (TDD)** engineering standard:
1. **Zero Untested Logic**: Every geometric transformer, parser, CAM post-processor, AI router, and UI state transition is backed by deterministic automated tests.
2. **Fast Feedback**: The entire Vitest suite executes in **~1.1 seconds**, enabling instant verification during iterative development.
3. **Multi-Dimensional Verification**: Testing spans unit, integration, end-to-end browser automation, and security leak scanning.
4. **Resilience & Graceful Fallback**: Tests explicitly verify offline behavior, missing API keys, connection timeouts, and degenerate CAD dimensions to prevent uncaught runtime exceptions.

---

## 2. Testing Verification Matrix

ApexCAD Studio's test suite consists of **160 frontend tests across 15 test suites**, a Python pytest backend engine suite, and a Headless Chrome CDP browser automation runner.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ApexCAD Studio Test Matrix                      │
├────────────────────────────────┬───────────────┬───────────────────────┤
│ Test Suite                     │ Tests / Spec  │ Primary Responsibility│
├────────────────────────────────┼───────────────┼───────────────────────┤
│ src/server.test.ts             │ 16 tests      │ Express API & Routing │
│ src/services/appToolsAndSkills │ 27 tests      │ Agent Tools & Hermes  │
│ src/services/camService        │  9 tests      │ CAM, G-Code, DXF      │
│ src/services/parametricIntel.. │ 17 tests      │ NLU AST Surgery & Heal│
│ src/services/cadRuntime        │ 23 tests      │ Hybrid & B-Rep Runtime│
│ src/services/cadFileManager    │  5 tests      │ File Retention & Cloud│
│ src/services/edaSiliconEngine  │  7 tests      │ MCM 2.5D Semiconductor│
│ src/services/firebase          │  3 tests      │ Offline Auth Security │
│ src/services/geminiAgent       │ 10 tests      │ AI Cascading & Prompts│
│ src/services/partRenaming      │ 11 tests      │ Synced Part Renaming  │
│ src/services/pbrMaterial       │  5 tests      │ PBR Physics & Presets │
│ src/services/massCalculator    │  6 tests      │ Volume, Mass & CoM    │
│ src/services/releaseManager    │  5 tests      │ SemVer Bump & Release │
│ src/components/CadShapeThumb.. │ 11 tests      │ SVG Vector Thumbnails │
│ src/components/OnboardingTut.. │  5 tests      │ Interactive Walkthru  │
├────────────────────────────────┼───────────────┼───────────────────────┤
│ Total Frontend (Vitest)        │ 160 tests     │ 100% Pass Rate (~1.2s)│
├────────────────────────────────┼───────────────┼───────────────────────┤
│ backend/test_cad_engine.py     │ 18 tests      │ Pytest FastAPI Engine │
│ scripts/verify-browser.mjs     │ 9 scenarios   │ Headless Chrome CDP   │
└────────────────────────────────┴───────────────┴───────────────────────┘
```

---

## 3. Detailed Frontend Test Suite Breakdown

### 3.1 [`src/server.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/server.test.ts) (16 tests)
- **Express API Endpoint Verification**:
  - `GET /api/presets`: Returns all curated CAD presets with required keys (`id`, `name`, `code`, `description`).
  - `GET /api/hardware/profile`: Returns host platform architecture, memory metrics, and CPU logical core count.
  - `GET /api/huggingface/search`: Proxies Hugging Face Hub searches with query parameters, limit constraints, and default fallbacks.
  - `POST /api/execute`: Relays script payloads to Python backend and handles network fallbacks cleanly.
  - `POST /api/agent/turn`: Tests multi-provider inference routing across Google Gemini, Ollama, LM Studio, Groq, and Together.
  - **Connection Probing (`testOnly` mode)**: Validates that endpoint connection tests return structured verification status without triggering model inference.

### 3.2 [`src/services/appToolsAndSkills.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.test.ts) (27 tests)
- **In-App Agent Toolset**:
  - Validates registration and execution of tools: `cad_synthesize_geometry`, `cad_generate_cam_toolpaths`, `cad_audit_topology`, `cad_calculate_mass_properties`, `cad_export_artifact`.
  - Tool schema conformity with JSON Schema / OpenAPI specs.
- **Hermes Hardware Estimator**:
  - Parameter calculation formulas for quantized GGUF weights (`Q4_K_M`, `Q8_0`, `FP16`).
  - Memory saturation detection and WebGPU device capability querying.

### 3.3 [`src/services/camService.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/camService.test.ts) (9 tests)
- **Toolpath Generation**:
  - 2D Profiling: Verifies contour generation and cutter radius compensation.
  - Pocket Clearing: Verifies zig-zag and concentric raster paths within boundary bounds.
  - Waterline Roughing: Slices geometry at incremental Z-levels.
- **Post-Processor & Exporter**:
  - G-Code generation: Validates RS-274 format, feed rates, spindle speed (`M03`), and tool retracts (`G00 Z...`).
  - 2D DXF export: Validates AutoCAD R12 DXF header, `ENTITIES` section, and polyline coordinates.
  - 3D Printing Preflight: Computes layer counts and print time estimates.

### 3.4 [`src/services/parametricIntelligence.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/parametricIntelligence.test.ts) (17 tests)
- **NLU Intent Decomposition**:
  - Extracts parameters and operations from natural language prompts.
- **AST Code Surgery**:
  - Correctly substitutes numeric dimensions in `sm.make_box(...)`, `sm.make_cylinder(...)`.
- **Autonomous Manifold Auto-Repair**:
  - Clamps non-positive dimensions ($d \le 0$) to physical minimums ($1.0\text{ cm}$) while preserving coordinate tuples.
  - Preserves ground-plane anchors ($z=0$) during multi-part penetration clearance adjustments.

### 3.5 [`src/services/cadRuntime.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/cadRuntime.test.ts) (23 tests)
- **Hybrid Execution Engine**:
  - Evaluates CAD scripts against client-side geometric generator when backend is unavailable.
  - Validates watertight mesh checks, bounding boxes, face counts, and vertex normals.

### 3.6 [`src/services/cadFileManager.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/cadFileManager.test.ts) (5 tests)
- **Design Retention & Storage**:
  - LocalStorage serialization, design duplication, versioning, and optional cloud vault synchronization.

### 3.7 [`src/services/edaSiliconEngine.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/edaSiliconEngine.test.ts) (7 tests)
- **Semiconductor Multi-Chip Module (MCM) Synthesis**:
  - Validates BGA substrate, silicon interposer, logic core die, HBM3 memory stacks, and copper IHS lid.

### 3.8 [`src/services/firebase.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/firebase.test.ts) (3 tests)
- **Security & Unconfigured Fallback**:
  - Verifies that missing or dummy Firebase credentials do not trigger uncaught fatal exceptions.
  - Tests offline connection fallback and security state notification.

### 3.9 [`src/services/geminiAgent.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/geminiAgent.test.ts) (10 tests)
- **AI Agent Orchestration**:
  - Model cascading from `gemini-3.8-flash` to backup candidates.
  - 3x self-healing prompt framing with diagnostic error injection (`SM_ERR_*`).

### 3.10 [`src/services/partRenamingService.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/partRenamingService.test.ts) (11 tests)
- **Synchronized Multi-Layer Renaming**:
  - Synchronizes part rename across Python script variables, OpenUSD prim paths, and 3D annotation leader lines.

### 3.11 [`src/services/pbrMaterialService.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/pbrMaterialService.test.ts) (5 tests)
- **PBR Physics Presets**:
  - Verifies physical densities, roughness, metalness, and color hex values for 8 engineering materials.

### 3.12 [`src/services/massCalculator.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/massCalculator.test.ts) (6 tests)
- **Mass Properties Calculator**:
  - Computes volume, mass ($\text{mass} = \text{volume} \times \text{density}$), and center-of-mass (CoM) coordinates.

### 3.13 [`src/components/CadShapeThumbnail.test.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/CadShapeThumbnail.test.tsx) (11 tests)
- **SVG Vector Thumbnails**:
  - Validates dynamic SVG rendering of isometric, orthographic, and schematic previews for CAD archetypes.

### 3.14 [`src/components/OnboardingTutorial.test.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/OnboardingTutorial.test.tsx) (5 tests)
- **Interactive Onboarding**:
  - Step progression, UI spotlight highlights, dismiss, and completion persistence in localStorage.

### 3.15 [`src/services/releaseManager.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/releaseManager.test.ts) (5 tests)
- **Release Versioning & Changelog Automation**:
  - Evaluates SemVer version bumps (`patch`, `minor`, `major`) based on Conventional Commits.
  - Generates categorized markdown changelog sections with commit scopes, descriptions, and hashes.
  - Honors forced bump overrides.

---

## 4. How to Execute Tests

### 4.1 Running Frontend Vitest Suite
```bash
# Run all 155 tests once
npm test

# Run tests in interactive watch mode
npx vitest

# Run a specific test suite
npx vitest src/services/camService.test.ts

# Run tests matching a specific pattern
npx vitest -t "G-Code"
```

### 4.2 Running TypeScript Static Analysis
```bash
# Verify 0 type errors across codebase
npm run lint
```

### 4.3 Running Python Backend Engine Tests
```bash
# Ensure Python 3.12 virtual environment is active
.venv-usd-brep/bin/pytest backend/test_cad_engine.py -v
```

### 4.4 Running Headless Chrome CDP Verification
```bash
# Runs 9 DOM/ARIA and 3D viewport scenarios via Chrome DevTools Protocol
npm run test:browser
```

### 4.5 Running Secret & Credential Leak Audit
```bash
# Runs the automated regex pattern scanner over all git-tracked files
python3 -c "
import os, re, sys
patterns = {
    'Google / Firebase API Key': re.compile(r'AIza[0-9A-Za-z-_]{35}'),
    'OpenAI API Key': re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    'Hugging Face Token': re.compile(r'hf_[a-zA-Z0-9]{20,}'),
}
tracked = [f.strip() for f in os.popen('git ls-files').readlines()]
for fpath in tracked:
    if os.path.isfile(fpath):
        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
            for idx, line in enumerate(f, 1):
                for name, pat in patterns.items():
                    if pat.search(line):
                        print(f'Leak [{name}] in {fpath}:{idx}')
                        sys.exit(1)
print('PASSED: Clean git tree.')
"
```

---

## 5. Adding New Tests (TDD Workflow)

When implementing new CAD features or AI routing capabilities, follow this standard TDD sequence:

1. **Write the Failing Test First**:
   - Create or locate the corresponding `*.test.ts` file.
   - Define exact inputs, expected bounding boxes, manifold status, or G-code lines.
   - Run `npx vitest <spec-file>` and confirm the test fails for the expected reason.

2. **Implement Minimal Code**:
   - Write the cleanest implementation that satisfies the test contract.
   - Include inline explanatory comments for the next developer or agent.

3. **Verify and Refactor**:
   - Re-run `npm test` and `npm run lint`.
   - Ensure the new test passes without regressions across the other 13 test suites.
