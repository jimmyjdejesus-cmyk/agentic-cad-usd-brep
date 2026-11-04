# ApexCAD Studio — System Architecture Specification

## 1. Executive Architecture Overview

ApexCAD Studio is an **Agentic Boundary Representation (B-Rep) and Constructive Solid Geometry (CSG) Computer-Aided Design (CAD) Studio**. It bridges high-level natural language prompt engineering, AI provider orchestration, exact solid modeling kernels, and digital manufacturing toolchains (CAM, G-Code, DXF, OpenUSD, STL).

```mermaid
flowchart TD
    subgraph UI_Layer["User Experience & Workspace (React 18 + Vite)"]
        UI_Prompt["Agentic Chat & Prompt Workbench"]
        UI_Tabs["Engineering Inspector\n(Parts, Mass, Annotations, Explode)"]
        UI_Viewport["Three.js 3D Viewport (Z-Up, Orbit, Wireframe)"]
        UI_Dim["Floating Dimension Readout & Unit Toggle\n(mm vs. cm)"]
        UI_CAM["CAM Studio & Fabrication Modal\n(3D Toolpath Sim, Overhang Heatmap, Slicer)"]
        UI_Harness["Model-Agnostic AI Harness & Hardware Gate"]
        UI_EDA["Opt-In Experimental EDA Studio\n(2.5D MCM Semiconductor Packaging)"]
    end

    subgraph Intelligence_Layer["AI & Parametric Intelligence Engine"]
        Router["Model-Agnostic Provider Router\n(Gemini 3.8 Flash, Ollama, vLLM, LM Studio, Groq, Together)"]
        HardwareGate["Hermes Hardware & Memory Gate\n(RAM, VRAM, 1.5GB Viewport Reservation)"]
        AST_Surgery["Parametric Intelligence & AST Surgery\n(Target-Scoped mutateDimensionInCode)"]
        CSG_Engine["CSG Boolean Engine\n(applyCsgBooleanToScript Multi-Line Return Parser)"]
        SelfHealing["3x Manifold Self-Healing Loop\n(Dimension Clamping, Z=0 Clearance)"]
        UnitConverter["Unit Converter Service\n(Bidirectional mm <-> cm, formatting)"]
    end

    subgraph Kernel_Layer["Dual-Runtime Geometric Solid Modeling"]
        subgraph Mode_A["Mode A: Native Python 3.12 Kernel (Port 8000)"]
            PyFastAPI["FastAPI Execution Engine (backend/server.py)"]
            SMLib["NVIDIA usd-brep / SMLib C++ NURBS Kernel"]
            UsdExport["OpenUSD Export (BrepArray & UsdGeom.Mesh)"]
        end
        subgraph Mode_B["Mode B: Client-Side CSG Kernel (Wasm)"]
            ManifoldWasm["Manifold-3D WebAssembly CSG Engine"]
            ThreeSynth["Client-Side Three.js Geometric Evaluator"]
            StlExport["Watertight Binary STL Exporter (Exact Normals, 10x mm Scaling)"]
        end
    end

    subgraph Manufacturing_Layer["CAM & Digital Fabrication Pipeline"]
        Toolpaths["CAM Toolpath Generator\n(2D Profiling, Pocketing, Waterline, Finishing)"]
        SimToolpaths["3D Toolpath Simulator & Motion Path Builder\n(Rapid G00, Feed G01, Holding Tabs)"]
        GCode["RS-274 / LinuxCNC / Haas G-Code Post-Processor"]
        DXF["2D Vector DXF Cut-Sheet Exporter (AutoCAD R12)"]
        Slicer["3D Printing Preflight & Layer Slicing Estimator\n(>45° Overhang Heatmap, Slicer Layers)"]
    end

    UI_Prompt --> Router
    Router --> HardwareGate
    HardwareGate --> AST_Surgery
    AST_Surgery --> CSG_Engine
    CSG_Engine --> SelfHealing
    SelfHealing --> Mode_A
    SelfHealing --> Mode_B
    Mode_A --> UI_Viewport
    Mode_B --> UI_Viewport
    UI_Viewport --> UI_Dim
    UI_Dim --> UnitConverter
    UI_Viewport --> UI_Tabs
    UI_Viewport --> Manufacturing_Layer
    Manufacturing_Layer --> UI_CAM
    Toolpaths --> SimToolpaths
```

---

## 2. Layer-by-Layer Architectural Breakdown

### 2.1 Layer 1: Model-Agnostic AI Provider Router & Hardware Gate

Located at [`server.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/server.ts), [`src/services/geminiAgent.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/geminiAgent.ts), and [`src/services/appToolsAndSkills.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.ts).

1. **Provider Independence**:
   - **Google Gemini**: Uses `@google/genai` with `gemini-3.8-flash` cascading to `gemini-2.5-pro` for deep parametric design.
   - **Local Socket Engines**: Connects directly to local Ollama (`http://127.0.0.1:11434`), vLLM (`http://127.0.0.1:8000/v1`), or LM Studio (`http://127.0.0.1:1234/v1`).
   - **Cloud OpenAI-Compatible APIs**: Routes to Groq (`api.groq.com`), Together AI (`api.together.xyz`), or OpenAI (`api.openai.com`).
   - **Hugging Face Hub Live Explorer**: Live repository search for GGUF quantizations (`Q4_K_M`, `Q8_0`, `FP16`) via server proxy.

2. **True-to-System Hardware Gating (`canRunOnSystem()`)**:
   - Evaluates system RAM, CPU logical cores, and WebGPU VRAM.
   - Enforces a **1.5 GB memory reservation** dedicated to the Three.js 3D viewport and Manifold WebAssembly buffers.
   - Prevents host Out-Of-Memory (OOM) lockups by gating models whose memory footprint exceeds available system headroom:
     $$\text{Estimated RAM (GB)} = \frac{\text{Parameters (B)} \times \text{Bits per Weight}}{8 \times 10^9} + 1.25\text{ GB (Context Buffer)}$$
   - Flags execution warnings if estimated token generation throughput falls below $4\text{ tokens/sec}$ or memory saturation exceeds $95\%$.

---

### 2.2 Layer 2: Parametric Intelligence, AST Code Surgery & CSG Booleans

Located at [`src/services/parametricIntelligence.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/parametricIntelligence.ts), [`src/services/csgEngine.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/csgEngine.ts), and [`src/services/geminiAgent.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/geminiAgent.ts).

1. **Natural Language Intent Decomposition**:
   - Parses engineering modifications from natural language prompts (e.g., "enlarge bore to 25mm", "bore 4 mounting holes through flanges", "scale height of boss_cyl by 1.5x", "remove internal ribs").
   - Identifies operations: `SCALE_DIMENSION`, `BORE_HOLE`, `ADD_FEATURE`, `ROTATE_AXIS`, `TRANSLATE_OFFSET`, `DELETE_PART`.

2. **Target-Scoped AST-Like Code Surgery (`mutateDimensionInCode`)**:
   - Isolates the exact variable assignment bound to `intent.targetPart` (e.g., `boss_cyl = sm.make_cylinder(...)`), ensuring that modifications to a part in a multi-part assembly leave sibling parts intact.
   - Centers subtractive operations (`injectBoreOrPocket()`) on the target part's computed bounding center $(c_x, c_y)$ across its full vertical $Z$ span.

3. **Multi-Line CSG Boolean Engine (`applyCsgBooleanToScript`)**:
   - Safely parses and modifies multi-line `return [...]` array lists with trailing commas, line breaks, and inline comments.
   - Computes constructive solid geometry combinations (`sm.boolean_union()`, `sm.boolean_difference()`, `sm.boolean_intersection()`) with dictionary key remapping for explosion and timeline animations.

4. **Autonomous 3-Stage Manifold Self-Healing**:
   - If a solid operation produces an unclosed or non-manifold mesh, non-positive volume, or interpenetration breach:
     - **Stage 1 (Dimension Clamping)**: Adjusts degenerate parameters ($d \le 0$) to minimum physical thresholds ($1.0\text{ cm}$) while preserving origin coordinate tuples.
     - **Stage 2 (Penetration Clearance Elevation)**: Preserves ground-plane anchors ($z=0$) while adjusting upper stacked components upward to clear interpenetration collisions.
     - **Stage 3 (Boolean Re-Ordering)**: Re-sequences union and difference trees to eliminate self-intersecting coplanar faces.

---

### 2.3 Layer 3: Dual-Runtime Geometric Solid Modeling Kernels

ApexCAD Studio employs a dual-runtime strategy to eliminate crashes across different operating systems and deployment environments.

#### Mode A: Native Python 3.12 B-Rep Kernel (`usd-brep`)
- **Backend Service**: FastAPI server at [`backend/server.py`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/backend/server.py) and [`backend/cad_engine.py`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/backend/cad_engine.py).
- **Core Engine**: NVIDIA's `usd-brep==1.0.0` C++ solid modeling library (`_omni_solid` / `SMLib`).
- **Capabilities**:
  - Exact analytic NURBS surface evaluation.
  - Boolean operations (`union`, `difference`, `intersection`).
  - Circular edge and vertex filleting (`sm.fillet()`).
  - Swept solids along 3D space curves (`sm.sweep()`).
  - Native OpenUSD stage serialization (`sm.usd.export_brep()` into `BrepArray`).
  - Tessellation into `PolyBrep` mesh arrays with chord-height tolerance controls.

#### Mode B: Client-Side WebAssembly CSG Kernel (`manifold-3d`)
- **Engine**: WebAssembly build of `manifold-3d` via [`src/services/cadRuntime.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/cadRuntime.ts).
- **Zero-Crash Resilience**: Runs 100% in-browser on macOS Apple Silicon, Windows, Linux, and Google AI Studio iframe previews without requiring a local Python C++ environment.
- **Capabilities**:
  - Watertight polygon mesh booleans with guaranteed 2-manifold output.
  - Computes exact outward facet normals for clean 3D printing slicing.
  - **True-Scale Slicer Scaling**: Generates binary and ASCII `.stl` files with `10×` millimeter scaling (`unitScale = 10.0`) for direct 1:1 import into Bambu Studio, PrusaSlicer, OrcaSlicer, and Cura.
  - Supports individual part isolation and per-part download.

---

### 2.4 Layer 4: CAM, Toolpathing & Manufacturing Pipeline

Located at [`src/services/camService.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/camService.ts).

1. **Toolpath Generation Modes**:
   - **2D Contour Profiling**: Follows outer part silhouettes with cutter radius compensation (`G41`/`G42`).
   - **Pocket Clearing**: Raster zig-zag and concentric offset clearing of internal cavities with stepover control.
   - **Waterline Z-Level Roughing**: Slices 3D geometry into discrete horizontal $Z$ planes with incremental stepdown.
   - **Ballnose 3D Surface Finishing**: Scans continuous complex curved surfaces for high surface finish.

2. **3D CNC Toolpath Simulation & Motion Path Builder**:
   - Generates simulated motion steps with feed, speed, and axis bounds tracking.
   - Visualizes rapid positioning (`G00`), linear feeds (`G01`), spindle activations (`M03`), and holding tabs in the 3D viewport.

3. **CNC G-Code Post-Processor**:
   - Produces standard RS-274 / LinuxCNC / Haas compliant G-code:
     - Rapid positioning: `G00`
     - Linear feed moves: `G01`
     - Arc interpolation: `G02` (CW), `G03` (CCW)
     - Spindle and coolant controls: `M03`, `M05`, `M08`, `M09`, `M30`
     - Industrial controller dialect support: Grbl, Marlin, LinuxCNC, and Haas (with `M06` tool change sequences).
   - Incorporates tool diameter, spindle RPM, plunge feed rate, and cutting feed rate parameters.

4. **2D Vector DXF Cut-Sheet Exporter**:
   - Projects 3D B-Rep horizontal cross-sections onto 2D $XY$ plane.
   - Outputs industry-standard AutoCAD Release 12 (R12) DXF with `ENTITIES` section containing `LINE` and `POLYLINE` blocks for laser, plasma, and waterjet cutters.

5. **3D Printing Preflight & Slicing Estimator**:
   - Analyzes watertight manifoldness, overhang angles ($>45^\circ$), and bounding volume.
   - Real-time downward normal heatmap highlights overhang regions requiring support structures.
   - Computes layer counts for $0.12\text{ mm}$, $0.20\text{ mm}$, and $0.28\text{ mm}$ layer heights.
   - Estimates print duration, filament mass (grams), and bed temperatures based on material presets.

---

### 2.5 Layer 5: Interactive 3D Viewport & Engineering Workspace

Located at [`src/components/Viewport3D.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/Viewport3D.tsx), [`src/services/unitConverter.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/unitConverter.ts), and [`src/App.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/App.tsx).

- **Three.js Z-Up Coordinate System**: Matches standard CAD conventions ($Z$ pointing upward, $XY$ ground plane).
- **Floating Dimension Readout & Unit Toggle (`mm` vs. `cm`)**:
  - Live floating overlay displaying part bounding dimensions ($W \times D \times H$) in real time.
  - Interactive unit switch (`mm` default for makers vs. `cm` OpenUSD default) with dynamic coordinate formatting.
- **Interactive OrbitControls**: Smooth dampening, pan, zoom, and orthographic camera views (Top, Front, Right, Isometric).
- **Physical PBR Rendering**: Realistic metallic and dielectric materials with roughness, normal maps, and ambient occlusion.
- **Docked Tabbed Inspector**:
  - **Parts Tree**: Per-part visibility toggle, isolation mode, and synchronized multi-layer renaming.
  - **Mass Properties Calculator**: Dynamic center-of-mass (CoM) marker, volume, and mass for 8 industrial materials.
  - **3D Annotations Dock**: Interactive vertex-snapped annotation pins with leader lines, WAI-ARIA labels, and camera focus.
  - **Explosion Timeline**: Keyframe-scrubbed assembly disassembly animation.
- **Opt-In Experimental EDA Studio**: Modular 2.5D semiconductor packaging module (BGA substrate, silicon interposer, logic core die, HBM3 cache stacks, copper IHS) isolated behind workspace settings.

---

### 2.6 Layer 6: In-App Agent Tools & API Automation

Located at [`src/services/appToolsAndSkills.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.ts), [`server.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/server.ts), and [`scripts/sync-project-issues.mjs`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/scripts/sync-project-issues.mjs).

- **Tool Calling Catalog**: Agent tools registered for autonomous invocation:
  - `cad_synthesize_geometry`: Generates B-Rep CAD assets from prompts.
  - `cad_generate_cam_toolpaths`: Generates CNC toolpaths, G-code, and DXF profiles.
  - `cad_audit_topology`: Inspects manifoldness, volume, and clearances.
  - `cad_calculate_mass_properties`: Computes mass and CoM for specified materials.
  - `cad_export_artifact`: Exports USD, STL, DXF, or G-Code.
- **Backend Express API Routes**:
  - `POST /api/execute`: Relays Python CAD scripts to FastAPI backend.
  - `POST /api/agent/turn`: Multi-provider LLM inference endpoint with `testOnly` connectivity probe mode.
  - `GET /api/hardware/profile`: Returns host CPU cores, memory stats, and platform architecture.
  - `GET /api/huggingface/search`: Proxies Hugging Face Hub searches for local GGUF models.
- **Quality Verification & Governance**:
  - 19 Vitest test suites (191 tests, 100% pass rate in ~1.7s).
  - Project milestones, epics, and sub-issues tracked via manifest with automated GitHub issue sync (`npm run issues:sync`).

---

## 3. Subsystem Data Flow Diagrams

### 3.1 Dual-Runtime Geometric Execution Flow
ApexCAD Studio routes script execution between Mode A (native Python C++ kernel) and Mode B (client-side WebAssembly) to guarantee zero crashes across all development platforms:

```mermaid
flowchart LR
    Script["Python build_parts() Script"] --> Detect{"FastAPI Backend\nHealthy on :8000?"}
    Detect -->|Yes (Linux/Win x86_64)| ModeA["Mode A: usd-brep Native C++"]
    ModeA --> BrepEval["SMLib NURBS Solids\n& Boolean Operations"]
    BrepEval --> Tessellate["sm.tessellate() -> PolyBrep"]
    Tessellate --> StageExport["OpenUSD BrepArray\n& .usda Stage"]
    StageExport --> Viewport["Three.js 3D Viewport"]

    Detect -->|No / macOS / Sandbox| ModeB["Mode B: manifold-3d Wasm"]
    ModeB --> ClientParse["Client-Side Geometric\nBlock Evaluator"]
    ClientParse --> WasmCSG["manifold-3d 2-Manifold\nWatertight CSG"]
    WasmCSG --> Stl10x["10x mm STL Export\n& Mesh Geometry"]
    Stl10x --> Viewport
```

### 3.2 Model-Agnostic AI Prompt & Self-Healing Pipeline
Prompt execution flows through hardware safety gates, dynamic provider routing, and a 3-pass manifold self-healing repair loop:

```mermaid
flowchart TD
    User["User Prompt / Viewport Edit"] --> Harness["AI Router (server.ts)"]
    Harness --> Gate{"canRunOnSystem()\nMemory Gate"}
    Gate -->|OOM Risk| Reject["Block Execution & Warn User"]
    Gate -->|Sufficient RAM| ProviderDispatch{"Selected Provider"}
    ProviderDispatch -->|Local| Ollama["Local Socket\n(Ollama / vLLM / LM Studio)"]
    ProviderDispatch -->|Cloud| Gemini["Google Gemini\n(3.8 Flash / 2.5 Pro)"]
    ProviderDispatch -->|Offline Micro-Edit| AST["Deterministic AST Surgery\n(mutateDimensionInCode)"]
    Ollama --> TurnEval["Evaluate Geometry"]
    Gemini --> TurnEval
    AST --> TurnEval
    TurnEval --> ManifoldCheck{"Topology & Volume\nManifold Valid?"}
    ManifoldCheck -->|Valid| Render["Render in 3D Viewport"]
    ManifoldCheck -->|Breach / Degenerate| Heal["3x Self-Healing Repair\n(Clamp dims, Z=0 Clearance)"]
    Heal --> TurnEval
```

### 3.3 CAM & Digital Fabrication Pipeline
CAD models seamlessly translate into shop-ready manufacturing artifacts for CNC machining, 2D profile cutting, and 3D printing:

```mermaid
flowchart TD
    PartMesh["Selected Part Geometry (cm)"] --> UnitConv["Unit Converter (cm -> mm)"]
    UnitConv --> CAMChoice{"Target Manufacturing Process"}

    CAMChoice -->|CNC Milling| ToolpathGen["CAM Toolpath Planner\n(2D Contour, Pocketing, Tabs)"]
    ToolpathGen --> SimSteps["buildCncToolpathSimulationSteps()"]
    SimSteps --> SimViewer["3D Toolpath Simulator & Motion Playback"]
    ToolpathGen --> PostProc["RS-274 Post-Processor\n(Grbl, Marlin, LinuxCNC, Haas M06)"]
    PostProc --> GCodeFile[".gcode / .nc File"]

    CAMChoice -->|Laser / Waterjet| DxfGen["generateDxfProfile()\n(z=0 or sliceZ plane)"]
    DxfGen --> DxfFile["AutoCAD R12 .dxf Vector Cut-Sheet"]

    CAMChoice -->|3D Printing| SlicerCheck["Preflight Slicer & Overhang Analysis"]
    SlicerCheck --> Heatmap[">45° Overhang Downward Normal Heatmap"]
    SlicerCheck --> LayerPreview["2D Slicer Layer Breakdown"]
    SlicerCheck --> Stl10x["10x Millimeter Watertight STL Export"]
```
