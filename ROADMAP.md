# ApexCAD Studio — Product Roadmap & Release End States

ApexCAD Studio is an **Agentic B-Rep and CSG CAD/CAM Studio** built for **makers, 3D printing enthusiasts, and CNC machinists**. Our core mission is to combine **clean, precision 3D part modeling and direct editing** with an **agentic AI copilot**—powered by [NVIDIA `usd-brep` (`SMLib`)](https://github.com/NVIDIA-Omniverse/usd-brep) for exact NURBS solid modeling in [OpenUSD](https://openusd.org/) and `manifold-3d` WebAssembly for guaranteed watertight 2-manifold geometry in the browser.

This document defines our **Feature Maturity Matrix**, **Release Milestones (`v1.2.0` → `v2.0.0`)**, **Exit Criteria (Definition of Done)**, and **Canonical Maker Benchmark Fixtures** so users and contributors know what is production-ready today and where the project is headed.

## 1. Feature Maturity Matrix (Current State: `v1.1.x` → `v1.2.0`)

To maintain complete transparency with early adopters and contributors, every subsystem is classified into one of four maturity tiers:
- **Stable**: Production-tested, covered by automated Vitest/pytest suites, and reliable for daily 3D printing and CNC workflows.
- **Beta**: Functional end-to-end for standard parts, with known syntax or geometric edge-case limitations being actively hardened.
- **Experimental**: Early prototype or domain exploration; subject to architectural changes or opt-in toggling.
- **Planned**: Scheduled for a specific upcoming release milestone with defined exit criteria.

| Subsystem / Capability | Maturity Tier | Current Implementation & Boundaries | Target Milestone |
| :--- | :--- | :--- | :--- |
| **Native Python 3.12 `usd-brep` Kernel** (`backend/cad_engine.py`) | **Stable** | Full `import usd_brep as sm` execution, NURBS primitives, booleans, fillets, chamfers, `sm.tessellate()`, pairwise `sm.brep_relationship()`, and `.usda` / `.brep.usda` / `.stl` export on Linux/Windows x86_64 | Continuous |
| **In-Browser `manifold-3d` Wasm CSG Kernel** (`src/services/cadRuntime.ts`) | **Beta** | Watertight 2-manifold booleans, outward-normal STL export, and `10×` millimeter slicer scaling; currently uses a line-by-line regex parser that does not yet evaluate multi-line Python ASTs or in-browser fillets/chamfers | `v1.4.0` |
| **1:1 Millimeter STL & R12 DXF Export** (`src/services/camService.ts`) | **Stable** | Exports ASCII `.stl` with `10×` millimeter scaling (`cm` → `mm`) for Bambu Studio, PrusaSlicer, OrcaSlicer, and Cura, plus AutoCAD R12 `.dxf` 2D flat patterns for LightBurn and SheetCAM | `v1.2.0` |
| **3D Print Preflight & Overhang Heatmap** (`src/components/Viewport3D.tsx`) | **Stable** | Real-time `>45°` downward-normal overhang heatmap in the 3D viewport, layer-by-layer 2D slicer preview, bed adhesion risk check, and PLA/PETG/ABS/TPU mass/time estimates | `v1.2.0` |
| **Interactive Primitive Insertion & CSG Toolbar** (`src/components/CsgBooleanToolbar.tsx`) | **Beta** | Modal placement of Box, Cylinder, Sphere, Cone, Wedge, Torus, and Counterbore primitives plus 2-part Union/Difference/Intersection; lacks interactive 3D viewport transform gizmos and live inspector sliders | `v1.3.0` |
| **Agentic Copilot & Self-Healing Loop** (`src/services/geminiAgent.ts`) | **Beta** | 3-pass synthesis and topology verification loop (`runAgenticCadTurn`); offline regex fallback (`parametricIntelligence.ts`) currently mutates global primitive regexes rather than scoping strictly to the selected part | `v1.3.0` / `v1.5.0` |
| **CNC G-Code Post-Processor** (`src/services/camService.ts`) | **Beta** | Multi-pass 2D perimeter contour milling (`outside_contour`, `inside_pocket` offset) with shoelace cutter radius compensation, holding tabs, and interactive 3D toolpath playback (`grbl`, `marlin`, `linuxcnc`, `haas`); does not yet generate interior raster/concentric pocket clearing or multi-Z stepped roughing | `v2.0.0` |
| **AMD Silicon & 2.5D MCM EDA Studio** (`src/components/AmdEdaSiliconStudio.tsx`) | **Experimental** | Specialized 2.5D semiconductor interposer/package generator; secondary to core 3D printing and CNC maker workflows | Opt-in module (`v1.2.0`) |

## 2. Release Milestones & End States (`v1.2.0` → `v2.0.0`)

Each release is gated by a concrete user outcome and verifiable engineering exit criteria before merging from `dev` into `main`.

### Milestone `v1.2.0` — True-Scale Maker Baseline & Documentation Alignment
- **Target End State**: A maker can open any factory preset or custom design, inspect its `>45°` overhang heatmap and slicer layers, and export a 1:1 millimeter `.stl` or `.dxf` that opens at exact dimensions in Bambu Studio, PrusaSlicer, OrcaSlicer, Cura, or LightBurn with zero manual rescaling.
- **Core Scope**:
  - Ship `10×` millimeter STL scaling (`unitScale = 10.0`) across the main export menu (`src/App.tsx`), individual part downloads, and the CAM/3D Print Studio (`src/components/CamCncModal.tsx`).
  - Restore quick switching between **My Custom Designs** and **Factory Presets** in the top header selector.
  - Standardize model-agnostic and harness-agnostic local/cloud AI routing in `server.ts` and `src/services/appToolsAndSkills.ts` (Ollama, LM Studio, vLLM, Groq, Together AI, OpenAI-compatible endpoints, and Gemini) with verified model identifiers, hardware-gated OOM prevention, and deterministic offline fallback.
  - Align `README.md` with the Feature Maturity Matrix and move the experimental AMD EDA Silicon Studio behind an optional workspace toggle.
- **Exit Criteria (Definition of Done)**:
  - [x] Unit tests in `src/services/cadRuntime.test.ts` and `src/components/CamCncModal.test.tsx` verify `10×` millimeter vertex scaling and unit toggle rendering.
  - [ ] All Vitest suites (`npm test`), TypeScript static checks (`npm run lint`), and Python engine tests (`pytest backend/test_cad_engine.py`) pass with 0 errors.
  - [ ] Exported `10 cm` CAD test plate measures `100.0 mm × 100.0 mm` when imported into a standard 3D slicer.

### Milestone `v1.3.0` — Precision Direct Editing, 3D Gizmos & Parametric Inspector
- **Target End State**: Users can design and edit mechanical parts visually in the 3D viewport—clicking any part to drag/rotate/scale it with millimeter grid snapping or typing exact dimensions into the sidebar inspector—while the underlying Python `build_parts()` code updates cleanly in real time.
- **Core Scope**:
  - Integrate `THREE.TransformControls` in `src/components/Viewport3D.tsx` with keyboard shortcuts (`G` / `T` Translate, `R` Rotate, `S` Scale) and configurable grid snapping (`1 mm`, `5 mm`, `10 mm`, `15°`).
  - Add a **Parametric Properties Inspector** tab in the right sidebar displaying live editable inputs (`width`, `depth`, `height`, `radius`, `[x, y, z]` origin, `[rx, ry, rz]` rotation) for the currently selected part.
  - Refactor `mutateDimensionInCode()` in `src/services/parametricIntelligence.ts` and `applyCsgBooleanToScript()` in `src/services/csgEngine.ts` to bind edits strictly to the target variable name (`targetPart`) and support multi-line `return [...]` lists without corrupting adjacent primitives.
  - Decompose `src/App.tsx` into modular components (`HeaderToolbar`, `LibrarySidebar`, `CopilotWorkbench`, `InspectorSidebar`) to keep files under 400 lines.
- **Exit Criteria (Definition of Done)**:
  - [ ] Selecting one cylinder in a 4-cylinder assembly and changing its radius or dragging its 3D gizmo modifies only that cylinder's statement in `build_parts()`.
  - [ ] Multi-step CSG boolean operations (`Union`, `Cut`, `Intersect`) succeed on multi-line formatted Python scripts with 100% test coverage.

### Milestone `v1.4.0` — Structured Browser CAD Parser, Fillets/Chamfers & Fastener Library
- **Target End State**: Browser-only and macOS users get parity with common mechanical CAD operations—including edge chamfers, fillets, and standard metric hardware cutouts (M2–M8 bolts, counterbores, countersinks, heat-set inserts, and hex nut traps).
- **Core Scope**:
  - Replace the single-line regex evaluator in `evaluateClientSideUsdBrep()` (`src/services/cadRuntime.ts`) with a structured block/expression evaluator supporting multi-line function calls, keyword arguments, helper functions, and list comprehensions.
  - Implement in-browser `sm.chamfer_edges()` and `sm.fillet_edges()` approximations using `manifold-3d` cross-section extrusion bevels and CSG edge rounding, and replace the hardcoded torus in `sm.sweep_along_planar_path` with real path extrusion along 2D polyline segments.
  - Expand `PRIMITIVE_CATALOG` in `src/services/csgEngine.ts` with a **Metric Fastener & Hardware Library**:
    - Clearance & tap holes (`M2`, `M2.5`, `M3`, `M4`, `M5`, `M6`, `M8`)
    - Socket head cap screw (SHCS) counterbores (`ISO 4762` / `DIN 912`)
    - Flat head countersinks (`90° ISO 10642`)
    - Brass heat-set insert bosses (Voron/CNC Kitchen standard dimensions)
    - Hex nut traps and captive nut slots
    - 2020 / 2040 V-slot and T-slot aluminum extrusion mounting profiles
- **Exit Criteria (Definition of Done)**:
  - [ ] A user can insert an M3 counterbore or heat-set insert boss onto a bracket and subtract it in browser mode, yielding a watertight 2-manifold mesh matching ISO/metric clearance tables within `±0.05 mm`.
  - [ ] Scripts containing `sm.chamfer_edges()` and `sm.fillet_edges()` render visible beveled/rounded edges in the browser viewport.

### Milestone `v1.5.0` — Context-Aware Copilot (Selection Pinning & DFM Auto-Repair)
- **Target End State**: The AI copilot acts as a true spatial co-designer that understands what part, face, or vertex the user clicked in the 3D viewport and automatically enforces **Design for Manufacturing (DFM)** rules for 3D printing and CNC machining.
- **Core Scope**:
  - Pass viewport selection context (`selectedPartName`, selected 3D annotation pin coordinates/normals from `activeSnapRef`, and active part bounding box) into `/api/agent/turn` (`server.ts` and `src/services/geminiAgent.ts`).
  - Enable spatial copilot commands such as *"Add 4 M4 counterbore mounting holes inset 8 mm from the corners of `@base_plate`"* or *"Place a 4 mm stiffening rib between `@base_plate` and `@vertical_flange`"*.
  - Add automated **DFM Sanity Checks** to the copilot self-healing loop:
    - **FDM 3D Printing DFM**: Minimum wall thickness check (`>= 1.2 mm`), steep overhang warning (`> 45°`), and clearance check (`>= 0.25 mm` between mating moving parts).
    - **CNC Machining DFM**: Minimum internal corner radius check (`>= toolRadius`), slot width vs. endmill diameter check, and tool depth-to-diameter aspect ratio warning.
- **Exit Criteria (Definition of Done)**:
  - [ ] Prompting the copilot with a `@part_name` or active 3D surface pin modifies only the targeted feature while leaving the rest of the assembly untouched.
  - [ ] Automated DFM checks catch thin walls (`< 1.2 mm`) and unmachinable sharp internal pocket corners, surfacing actionable 1-click auto-fixes.

### Milestone `v2.0.0` — 2.5D Multi-Depth CNC CAM, Pocket Clearing & STEP / 3MF Interop
- **Target End State**: Machinists and makers can generate shop-ready 2.5D CNC G-code (including interior pocket clearing, stepped Z-levels, peck drilling, and dogbone corner relief) and export multi-part `.3mf` and `.step` files directly from ApexCAD Studio.
- **Core Scope**:
  - Upgrade `src/services/camService.ts` from single-Z (`z = 1.0 mm`) perimeter slicing to **Multi-Z Feature Extraction**, detecting through-holes, blind pockets, counterbores, and stepped bosses across the part's Z-height.
  - Implement true **Concentric & Raster Pocket Clearing** with configurable stepover (`10%–80%` of tool diameter), **Peck Drilling Cycles (`G81` / `G83`)** for circular holes, **Ramp Entry** moves, and automatic **Dogbone / T-Bone Corner Relief** for internal `90°` CNC corners.
  - Add **`.3mf` Archive Export** (bundling multi-part meshes, millimeter unit metadata, and part colors in a single slicer-ready file) and **ISO 10303-21 `.step` / `.stp` Export** via the Python backend (`usd_to_occt` / OpenCASCADE bridge).
- **Exit Criteria (Definition of Done)**:
  - [ ] Generated G-code for a stepped mechanical bracket (containing a blind pocket, 4 counterbored holes, and an outer profile with holding tabs) simulates cleanly in `CncToolpathSimulator.tsx` and external G-code verifiers without gouging the part.
  - [ ] Exported `.3mf` files open in Bambu Studio / PrusaSlicer with all sub-parts, names, and millimeter dimensions intact.

## 3. Canonical Maker Benchmark Fixtures

Every release from `v1.2.0` onward is validated against 5 real-world digital fabrication fixtures to guarantee we never regress on practical maker workflows:

1. **NEMA 17 Stepper Motor L-Bracket**: 90° structural bracket with `31 mm` M3 square bolt pattern, `22 mm` central boss clearance bore, and 45° stiffening gussets (tests FDM overhang self-support and multi-axis hole alignment).
2. **Parametric Spur Gear (`12T`–`36T`)**: Involute-approximated gear with central shaft bore, keyway/D-shaft flat, and weight-reduction web pockets (tests `for` loop generation, radial boolean subtraction, and manifoldness).
3. **Electronics Enclosure with M3 Heat-Set Bosses**: Two-part snap/screw-fit project box with internal PCB mounting standoffs, USB-C/ventilation wall cutouts, and lid lip clearance (tests multi-part non-penetration and clearance sanity checks).
4. **CNC Router Cam Lever & Hold-Down Clamp**: Stepped 2.5D fixture clamp with `M6` T-slot clearance slot and counterbored pivot hole (tests 2D DXF flat-pattern export, CNC outside contour + inside slot toolpaths, and holding tabs).
5. **Flanged Pipe & Sensor Mount Manifold**: Multi-port cylindrical manifold with bolt flange ring and O-ring groove (tests exact `usd-brep` NURBS cylinder/torus booleans and watertight STL export).
