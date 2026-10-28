# ApexCAD Studio: 3D Printing, CNC Machining & General 3D Modeling Suite

A unified high-precision CAD/CAM/3D-Print workstation providing browser-based interactive 3D solid modeling (CSG primitives & booleans), multi-layer G-code toolpath simulation with animated endmill cutting, and full 3D print preflight slicing with overhang angle inspection.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following primary focus areas over EDA, prioritizing manufacturing and solid geometry creation:
> - **3D Printing**: Slicer layer visualizer with interactive Z-height scrubbing, layer-by-layer perimeter/infill simulation, print duration estimation, and overhang violation angle warnings ($>45^\circ$).
> - **CNC & CAM**: Interactive 3D toolpath animation with synchronized 3D cutter endmill simulation, feed/speed clearance visualization, and dialect-specific G-code generation (GRBL, LinuxCNC, Haas).
> - **3D General Modeling**: Interactive primitive insertion (Cube, Cylinder, Sphere, Wedge, Torus, Bounded Plate) with direct viewport gizmos and client-side CSG Boolean operations (Union, Subtract/Cut, Intersect) powered by manifold-3d.
> - **EDA Pipeline Status**: Preserved in full under an accessible secondary studio launcher so that logic synthesis and netlist placement remain intact whenever the user returns to silicon design.

- **Confirmed Decision 1**: Prioritize 3D printing slicing preview with overhang detection and layer scrubbing.
- **Confirmed Decision 2**: Implement animated 3D CNC toolpath playback directly in the CAM modal and 3D canvas with rapid vs. feed pass rendering and collision clearance planes.
- **Confirmed Decision 3**: Add on-viewport primitive insertion toolbar and CSG operations directly in the 3D scene with instant mesh rebuild and code synchronization.

---

## 1. Overview & Core Concept

- **What It Does**: ApexCAD Studio transforms the workspace into an end-to-end digital fabrication hub. Engineers and makers can model parametric parts using intuitive 3D primitives and CSG booleans, verify 3D printability with layer-by-layer slicing and overhang analysis, and simulate CNC mill toolpaths with animated endmills before exporting production-ready G-code, DXF, and STL files.
- **Target Audience / Persona**: Mechanical engineers, CNC machinists, 3D printing enthusiasts, and product designers needing instant geometric feedback and toolpath validation without launching heavy desktop software.
- **Key Value**: Closes the loop between 3D modeling and physical manufacturing: zero dead clicks, real client-side geometric computations, instant visual validation of overhangs and tool clearance, and direct file exports.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **3D General Modeling Flow**:
   - The user clicks the Viewport Primitive Toolbar (Box, Cylinder, Sphere, Wedge, Torus) or uses the existing AI prompt harness / Python B-Rep editor.
   - Inserting a shape renders it immediately in the 3D scene with transform handles (position, rotation, scale).
   - Selecting two parts unlocks the **Boolean CSG Bar** (`Union`, `Difference / Cut`, `Intersection`), executing instant Manifold boolean operations and updating the parametric code.
2. **3D Print Slicer & Overhang Analysis Flow**:
   - The user opens the **Manufacturing & CAM Hub** and selects the **3D Print Preflight & Slicer** tab.
   - The interactive layer visualizer enables vertical layer scrubbing ($0.12\text{mm}$ to $0.32\text{mm}$ resolution) displaying outer perimeters, inner walls, and concentric/grid infill paths.
   - Overhang analysis highlights downward-facing faces steeper than $45^\circ$ in amber/red warning heatmaps, with estimated print time, filament mass, and layer count.
3. **CNC Toolpath & Animated Cutter Simulation Flow**:
   - Switching to the **CNC Milling & Toolpaths** tab calculates multi-pass 2.5D/3D profile, pocket, and drilling passes based on selected tool diameter and stepdown.
   - Clicking **Play Simulation** activates an animated 3D endmill cutter traversing the toolpath lines with a timeline slider, play/pause, speed controls ($1\times, 2\times, 5\times$), and rapid vs. feed color-coding (cyan feed, amber rapid).
   - The user inspects the synchronized G-code viewer and downloads verified G-code or DXF cutting contours.

### Visual Identity & Theme

- **Aesthetic Direction**: Utilitarian, precision industrial engineering workstation. Clean dark-graphite foundation with crisp architectural lines, high-contrast geometry rendering, and zero decorative AI fluff.
- **Color Palette (60-30-10 Distribution)**:
  - `60% Dominant Canvas`: Deep obsidian and graphite workspace surfaces (`#090D16`, `#0F172A`).
  - `30% Structural Surfaces`: Slate panels, hairline boundaries (`#1E293B`, border `rgba(255,255,255,0.08)`), and high-legibility crisp white/slate-200 typography.
  - `10% Purposeful Accents`: High-intent cyan (`#06B6D4`) for CNC toolpaths/feeds, emerald (`#10B981`) for watertight safe zones, amber (`#F59E0B`) for rapid traverses and overhang warnings, and cobalt (`#3B82F6`) for primary action triggers.
- **Typography & Hierarchy**:
  - Display / Headings: `Plus Jakarta Sans` (Semibold 600, tight tracking).
  - Body Prose: `Plus Jakarta Sans` (Regular 400, crisp contrast).
  - Telemetry & Coordinates: `JetBrains Mono` / tabular numbers (`font-mono tabular-nums`) for coordinates, layer heights, feed rates, and cycle times.
- **Anti-Slop Discipline**:
  - No decorative floating badges, no purple gradients, no code-comment titles.
  - Unboxed metadata with clean typographic separators (`·`).
  - Interactive tabs styled with solid segmented button backgrounds.
  - Every button, slider, and toggle wired to active geometric and simulation handlers.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side Manifold-3D CSG Booleans**
  - *Chosen Approach*: Execute CSG operations (Union, Subtract, Intersect) directly in the browser using the pre-loaded `manifold-3d` WebAssembly engine, while providing Python B-Rep code synchronization.
  - *Why*: Instant sub-millisecond feedback on boolean cuts without backend round-trip latency, enabling real-time preview during interactive modeling.
  - *Alternatives Considered*: Server-only Python execution (too sluggish for interactive primitive placement and viewport scrubbing).
- **Decision 2: Canvas-Rendered Slicer Layer Visualizer with Overhang Shader**
  - *Chosen Approach*: Implement a dual-mode 3D print inspector: a 3D overhang angle colorizer in Three.js combined with an interactive 2D cross-section layer preview showing toolpaths, perimeters, and infill.
  - *Why*: Gives users both global geometric awareness (where supports are needed) and granular slice inspection (per-layer nozzle path verification).
- **Decision 3: Animated 3D CNC Cutter Toolpath Simulator**
  - *Chosen Approach*: An interactive Three.js CAM preview with an endmill tool model (flute + shank) animated along parsed G-code / toolpath segments, complete with step-scrubbing and cycle time estimation.
  - *Why*: Prevents costly real-world CNC crashes by letting machinists verify clearance height, plunging, and material engagement visually.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ApexCAD React Application                       │
│                                                                        │
│  ┌───────────────────────┐ ┌────────────────────────────────────────┐  │
│  │   Navigation & Tabs   │ │   AI Harness & Model Drawer (Agnostic) │  │
│  │ [CAD/3D] [CAM] [EDA]  │ │ [Gemini 3.8 Flash] [Anthropic] [Local] │  │
│  └───────────┬───────────┘ └───────────────────┬────────────────────┘  │
│              │                                 │                       │
│              ▼                                 ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    3D Viewport & Scene Graph                     │  │
│  │  - Three.js WebGL Engine with Studio Key/Fill/Rim Lighting       │  │
│  │  - Interactive Primitive Toolbar (Box, Cyl, Sphere, Wedge, Plate)│  │
│  │  - Viewport Gizmo & CSG Boolean Bar (Union, Cut, Intersect)      │  │
│  │  - Overhang Surface Highlighting Shader (Amber >45° warnings)    │  │
│  └───────────────────┬─────────────────────────┬────────────────────┘  │
│                      │                         │                       │
│         ┌────────────┴───────────┐ ┌───────────┴───────────┐           │
│         ▼                        │ │                       ▼           │
│  ┌─────────────────────────────┐ │ │ ┌───────────────────────────────┐ │
│  │   CAM & CNC Milling Modal   │ │ │ │   3D Print Slicer & Preflight │ │
│  │ - Multi-pass toolpaths      │ │ │ │ - Layer-by-layer Z scrubber   │ │
│  │ - 3D Animated Cutter Model  │ │ │ │ - Infill & perimeter preview  │ │
│  │ - Rapid vs Feed trajectory  │ │ │ │ - Overhang warning angle mesh │ │
│  │ - GRBL / LinuxCNC / Haas    │ │ │ │ - Time, filament mass & cost  │ │
│  └─────────────────────────────┘ │ │ └───────────────────────────────┘ │
│                                  │ │                                   │
│  ┌─────────────────────────────┐ │ │ ┌───────────────────────────────┐ │
│  │ Manifold-3D WASM CSG Engine │◄┘ └►│ Export Pipeline               │ │
│  │ (Client-side boolean math)  │     │ (STL, STEP, DXF, G-code, JSON)│ │
│  └─────────────────────────────┘     └───────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Component & State Plan

1. **`src/components/Viewport3D.tsx`**:
   - Add primitive insertion handles and direct CSG interaction overlay.
   - Integrate normal-based overhang highlighting mode for 3D print preflight inspection directly on the 3D model.
2. **`src/components/CamCncModal.tsx` & `src/services/camService.ts`**:
   - Add 3D cutter toolpath animation with play/pause, scrub slider, and endmill spindle cylinder rendering.
   - Expand 3D printing tab into an interactive slicer preview with per-layer trajectory rendering (walls, skin, infill), overhang detection table, and print time calculation.
3. **`src/services/csgEngine.ts`**:
   - Provide client-side boolean operations (Union, Subtract, Intersect) combining Manifold-3D geometry with code generation.
4. **`src/App.tsx`**:
   - Integrate the primitive toolbar and boolean controls seamlessly into the main CAD layout.
   - Maintain the EDA Silicon Studio accessible via a clean workspace switcher.
