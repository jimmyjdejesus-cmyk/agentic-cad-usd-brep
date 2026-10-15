# ApexCAD Studio GUI Organization & Docked Workspace Architecture

A comprehensive overhaul of the workspace layout, docking all previously floating elements into structured, collapsible panels, adopting an eye-friendly neutral charcoal zinc dark aesthetic, organizing the top toolbar into balanced functional zones, and rebranding to ApexCAD Studio with zero remaining third-party platform references.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and design choices were confirmed during Phase 1 clarification:

- **Confirmed Docking Strategy**: All floating overlays (Explosion timeline, Part tree, Mass calculator, 3D Annotations) are consolidated into a dedicated, dockable **Multi-Panel Right Sidebar** with clean tabbed navigation (`[Parts]`, `[Mass]`, `[Pins]`, `[Explosion]`). The 3D viewport canvas remains 100% unobstructed.
- **Confirmed Visual Aesthetic**: Neutral charcoal zinc (`#121316` canvas, `#181a20` structural panels, `#272a34` borders) with soft matte finish designed for long-session mechanical and silicon CAD engineering without eye fatigue. Harsh and saturated dark blues are eliminated.
- **Confirmed Brand Identity**: Renamed to **ApexCAD Studio** across the entire UI, top bar, modals, and metadata. All legacy references to AI Studio and OpenFlow are completely eradicated.
- **Top Toolbar & Left Sidebar Stacking**: The top bar is reorganized into three logical zones (Brand/Preset, Workspace Mode, and Display/Export/Vault). The left Prompt Copilot is neatly stacked with hierarchical model configuration, toolset access, chat history, and prompt drafting.

---

## 1. Overview & Core Concept

### What It Does
ApexCAD Studio is a high-precision generative CAD and Silicon EDA engineering suite powered by NVIDIA usd-brep and accelerated B-Rep geometry solvers. This redesign eliminates all fragmented floating overlays and HUD collisions by transitioning to an industry-standard dual-sidebar CAD docking paradigm.

### Target Persona
Mechanical engineers, CAD modelers, and silicon packaging architects who require an expansive, unobstructed 3D modeling canvas paired with predictable, docked engineering inspection panels.

### Key Value
- **Zero Viewport Clutter**: No floating timeline bar blocking the bottom of the geometry, no floating badges drifting in the top-right corner.
- **Docked Precision Sidebar**: Parts tree, mass calculations, 3D pins, and kinematic explosion controls now share a cohesive, collapsible right-hand drawer.
- **Eye-Friendly Matte Neutral Theme**: Replaces eye-straining high-saturation blues with smooth charcoal zinc and legible typography.
- **Clean Brand Autonomy**: Professional CAD branding without platform leaks.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Workspace Navigation & Header Organization**:
   - **Zone 1 (Left - Project Context)**: ApexCAD Studio logo, NVIDIA usd-brep kernel active pill, CAD Preset selector dropdown.
   - **Zone 2 (Center - Workspace Modes)**: Segmented pill toggle between `3D CAD Studio`, `AMD Silicon EDA`, and `Code & USD`.
   - **Zone 3 (Right - Viewport & Storage Utilities)**: Display Overlays dropdown (Grid, Bounds, Center of Mass, Wireframe, Snapping), Cloud Vault button, and Unified Export button.

2. **Left Sidebar (Prompt Copilot & Toolset Registry)**:
   - Collapsible panel with smooth toggle (`[<]` / `[>]`).
   - Clean vertical stacking:
     1. Header with title & collapse trigger.
     2. Model & Harness selector row (Gemini, Hugging Face Hub, Ollama, etc.).
     3. Active Toolsets & Skills drawer button (`NVIDIA usd-brep`, `AMD ROCm`, etc.).
     4. Chat messages stream with clear code and status snippets.
     5. Chat prompt input with generate trigger.

3. **3D Viewport Canvas (Center)**:
   - Full height and width between sidebars.
   - Contextual placement notice only when Annotating (`Click surface to place pin · Esc to cancel`).
   - Floating selection chip only when a specific 3D part is actively selected (`/{partName} · Vol · Watertight`).

4. **Right Sidebar (Docked Engineering & Explosion Inspector)**:
   - Docked on the right edge, collapsible to 0px with a single toggle button.
   - Four dedicated tabs with badge counts:
     - **Parts Tab**: Hierarchical parts tree, manifold status, visibility toggle (Eye/EyeOff), part volume, surface color swatch.
     - **Mass Tab**: Material presets (Aluminum, Titanium, Steel, PEEK, Silicon), density override, total mass, volume, center of mass coordinates, bounding box dimensions.
     - **Pins Tab**: 3D annotation list, filter resolved/active, jump-to-camera button, delete/edit.
     - **Explosion Tab**: Disassembly sequence timeline, play/pause, step backward/forward, stage notches, playback speed (0.5x–2.0x), continuous radial vs stage mode.

### Visual Identity & Theme Tokens

- **Canvas Background (60%)**: `#121316` (Neutral Charcoal Zinc, matte non-glare).
- **Structural Surfaces (30%)**: `#181a20` (Panel base), `#1e2028` (Cards & sub-headers), hairline borders `#272a34`.
- **Accents & States (10%)**:
  - Sky Blue (`#0284c7` / `#38bdf8`) for primary selections & active CAD modes.
  - Emerald (`#10b981`) for kernel active & successful mesh verification.
  - Amber (`#f59e0b`) for mass/center of mass highlights.
  - Rose (`#f43f5e`) for AMD EDA mode.
- **Typography**:
  - Interface text: Clean sans (`Inter`, `system-ui`).
  - Engineering readouts: `font-mono tabular-nums text-zinc-300` for weights, coordinates, and volumes.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Docked Right Sidebar vs. Floating Overlays**
  - *Chosen Approach*: Embed the Part tree, Mass properties, Annotations, and Explosion timeline into a tabbed right sidebar.
  - *Why*: Eliminates floating bars that overlap 3D parts and obscure viewport rotation controls; follows standard SolidWorks/Onshape/Fusion360 patterns.
  - *Alternatives Considered*: Floating draggable windows (rejected: complex window management, causes clutter).

- **Decision 2: Explosion Timeline Inside Tabbed Inspector**
  - *Chosen Approach*: Move the explosion playback and scrubbing controls into the `[Explosion]` tab of the right sidebar, with clean stage selection and scrub controls.
  - *Why*: Frees up the entire bottom of the viewport canvas, eliminating the floating timeline bar that previously hovered over parts.
  - *Alternatives Considered*: Permanent bottom shelf (rejected: permanently steals 80px of vertical height across all modes).

- **Decision 3: Reorganized 3-Zone Top Bar**
  - *Chosen Approach*: Move viewport display toggles (Grid, Wireframe, Bounds, CoM) into a clean `Display` flyout on the top bar or quick viewport pill, alongside Export and Vault.
  - *Why*: Creates an uncluttered, balanced header with clear visual separation between project context, mode switching, and file actions.

---

## 4. Technical Architecture & Workspace Layout

### Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ApexCAD Studio Header                                  │
│  [Logo · ApexCAD · Kernel]   ──   [3D CAD | Silicon EDA | Code]   ──   [Display · Export · Vault] │
├──────────────────────┬──────────────────────────────────────────┬──────────────────────┤
│                      │                                          │                      │
│   Left Sidebar       │          Interactive 3D Viewport         │    Right Sidebar     │
│   (Prompt Copilot)   │                                          │    (Inspector Dock)  │
│                      │  • Unobstructed Three.js Canvas          │                      │
│  • Model & Harness   │  • Orbit / Pan / Zoom                    │  [Parts][Mass][Pins] │
│  • Toolset Registry  │  • Contextual Part Chip (on click)       │  [   Explosion     ] │
│  • Prompt History    │  • Annotation Placement Guide            │                      │
│  • CAD Generation    │                                          │  • Hierarchical Tree │
│                      │                                          │  • Mass Properties   │
│                      │                                          │  • Kinematics Scrub  │
│                      │                                          │                      │
└──────────────────────┴──────────────────────────────────────────┴──────────────────────┘
```

### Component & State Mapping

1. **`App.tsx` Layout Restructure**:
   - Introduce `isRightSidebarOpen` state and `activeRightTab` (`'parts' | 'mass' | 'annotations' | 'explosion'`).
   - Replace floating overlays with the flex-docked `<aside>` on the right.
   - Clean up top navigation header with unified neutral charcoal palette and `ApexCAD Studio` branding.
   - Remove all legacy `AI Studio` text and modals, replacing with `ApexCAD Studio Details`.

2. **`ExplosionTimeline.tsx` Dock Integration**:
   - Support rendering both as a docked panel view (inside the right sidebar) and standalone view with responsive layout.
   - Clean up typography, remove unnecessary floating borders.

3. **Neutral Zinc Styling**:
   - Update global backgrounds from `#07090e` / `#06080d` / `#0b0f17` to `#121316`, `#181a20`, `#1e2028`, and `#272a34`.
   - Update `index.html` background and scrollbar colors to match.
