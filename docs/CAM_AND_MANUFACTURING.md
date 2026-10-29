# ApexCAD Studio — CAM, CNC G-Code & Digital Fabrication Guide

## 1. Overview of Manufacturing Studio

ApexCAD Studio features a native **Computer-Aided Manufacturing (CAM) and Digital Fabrication Engine** that transforms 3D CAD geometry into machine-ready toolpaths, CNC G-code, 2D vector DXF cut-sheets, and 3D printing preflight data.

All CAM operations are accessible directly through the in-app **CAM Studio Modal** ([`src/components/CamCncModal.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/CamCncModal.tsx)) or programmatically via the agent tool `cad_generate_cam_toolpaths` ([`src/services/appToolsAndSkills.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.ts)).

---

## 2. CAM Toolpath Generation Strategies

Implemented in [`src/services/camService.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/camService.ts).

### 2.1 Toolpath Operations

1. **2D Contour Profiling (`profile_2d`)**:
   - Traces the outer boundary or internal holes of a part at specified depth intervals.
   - Applies cutter radius compensation (left `G41` / right `G42`) based on the endmill diameter.
   - Supports tabs/bridges to prevent small parts from dislodging during cutout.

2. **Pocket Clearing (`pocket_clearing`)**:
   - Clears internal cavities using high-efficiency zig-zag raster or concentric offset paths.
   - Configurable **Stepover** (percentage of tool diameter, typically $40\% - 70\%$) to maintain constant chip load.
   - Implements helical ramp or plunge entries at specified plunge feed rates.

3. **Waterline Z-Level Roughing (`waterline_roughing`)**:
   - Slices arbitrary 3D geometry into discrete horizontal $Z$ planes spaced by **Stepdown** ($1.0 - 5.0\text{ mm}$).
   - Removes bulk stock rapidly while preserving stock allowance for finishing passes.

4. **Ballnose 3D Surface Finishing (`surface_finishing`)**:
   - Scans complex 3D curved surfaces with fine stepover ($0.2 - 0.5\text{ mm}$) using ball-end mills.
   - Minimizes scallop height for high surface finish.

---

## 3. CNC G-Code Post-Processor

The post-processor converts mathematical toolpaths into standardized **RS-274 / LinuxCNC / Fanuc** compliant G-Code.

### 3.1 G-Code Dialect & Commands

| G-Code Command | Description | Function |
|---|---|---|
| `G00` | Rapid Traverse | Non-cutting positioning at machine traverse rate (e.g., `G00 Z5.0`). |
| `G01` | Linear Cutting Feed | Straight-line cutting move at specified feed rate `F` (e.g., `G01 X20.0 Y10.0 F600`). |
| `G02` / `G03` | Circular Arc Interpolation | Clockwise (`G02`) or Counter-Clockwise (`G03`) circular moves with $I, J$ arc center offsets. |
| `G90` | Absolute Programming | Sets all coordinates relative to workpiece zero (`WCS G54`). |
| `G21` | Metric Units | Sets coordinate programming in millimeters. |
| `M03` | Spindle Clockwise | Starts spindle clockwise at specified RPM `S` (e.g., `M03 S12000`). |
| `M05` | Spindle Stop | Stops spindle rotation at end of program or tool change. |
| `M08` / `M09` | Coolant On / Off | Flood/mist coolant control. |
| `M30` | Program End & Rewind | Resets machine control state and parks spindle. |

### 3.2 Toolpath Parameters
- **Tool Diameter**: Mill diameter in millimeters (default $3.175\text{ mm}$ or $6.0\text{ mm}$).
- **Spindle Speed**: RPM (default $12,000 - 18,000\text{ RPM}$).
- **Cutting Feed Rate**: Linear feed in mm/min (default $600 - 1,200\text{ mm/min}$).
- **Plunge Feed Rate**: Vertical plunge feed in mm/min (default $200 - 300\text{ mm/min}$).
- **Safe Retract Height**: Rapid clearance plane above workpiece (default $5.0\text{ mm}$).
- **Holding Tabs**: Configurable width ($3.0 - 6.0\text{ mm}$) and height ($1.0 - 2.0\text{ mm}$) bridges strategically placed on final contour passes to prevent small parts from ejecting under high cutter loads.

### 3.3 3D CNC Toolpath Simulation & Motion Path Builder
Implemented via `buildCncToolpathSimulationSteps()` in [`src/services/camService.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/camService.ts):
- Builds simulated step-by-step machine tool motion steps with rapid travels (`G00`), linear feeds (`G01`), and spindle state tracking (`M03`).
- Tracks motion bounds ($X_{min/max}, Y_{min/max}, Z_{min/max}$) and computes total cutting distance and estimated machining time.
- Renders an interactive 3D playback toolpath in the CAD Studio modal with color-coded moves (Cyan for cutting feed, Orange for rapid traverse, Green for holding tabs).

### 3.4 Controller Dialect Support
- **Grbl & Marlin**: Standard desktop CNC router and 3D printer milling dialect (`G90`, `G21`, `G00`, `G01`, `M03`, `M05`, `M30`).
- **LinuxCNC**: Industrial open-architecture dialect with precision arc tolerance handling.
- **Haas**: Production VMC dialect with canned setup routines, explicit work coordinate system selection (`G54`), spindle speed safety limits, and automatic tool change sequences (`T01 M06`).

---

## 4. 2D Vector DXF Cut-Sheet Exporter

Implemented in [`src/services/camService.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/camService.ts).

### 4.1 Format & Compatibility
- Outputs standard **AutoCAD Release 12 (R12) DXF**, widely supported by:
  - CNC Laser Cutters (LightBurn, RDWorks, CypCut)
  - CNC Plasma Cutters (SheetCam, Hypertherm)
  - CNC Waterjets (OMAX Intelli-MAX, Flow)
  - Vector CAD tools (AutoCAD, Fusion 360, FreeCAD, Illustrator)

### 4.2 Cross-Section Extraction
- Slices 3D geometry at ground level ($z = 0$) or user-specified plane height.
- Projects boundary edges onto 2D $XY$ vector entities.
- Sets metric millimeter header parameters (`$MEASUREMENT = 1`, `$INSUNITS = 4`).
- Generates clean closed `POLYLINE` entities preserving exact dimensional accuracy.

---

## 5. 3D Printing Preflight, Slicing Estimator & True-Scale STL

Analyzes 3D models before exporting to STL/3MF for slicing:

1. **Watertight Manifold Check**:
   - Ensures zero non-manifold edges, self-intersections, or naked boundaries.
2. **Layer Count & Height Estimation**:
   - Calculates total layers for standard nozzle profiles:
     - Ultra-fine: $0.12\text{ mm}$
     - Standard: $0.20\text{ mm}$
     - Draft: $0.28\text{ mm}$
3. **Build Time & Material Consumption**:
   - Calculates bounding volume and infill mass (default $20\%$ gyroid infill).
   - Computes filament mass in grams using material densities (PLA: $1.24\text{ g/cm}^3$, PETG: $1.27\text{ g/cm}^3$, ABS: $1.04\text{ g/cm}^3$).
   - Recommends nozzle and heated bed temperatures for target materials.
4. **Real-Time Overhang Heatmap (>45°)**:
   - In-viewport shader highlights downward-facing facet normals exceeding 45° overhang limits, providing instant visual feedback on unprintable overhangs requiring support geometry.
5. **True-Scale Slicer STL Scaling (`10×` Multiplier)**:
   - Native OpenUSD stage metrics operate at `metersPerUnit = 0.01` (centimeters).
   - FDM/SLA slicers (Bambu Studio, PrusaSlicer, OrcaSlicer, Cura) interpret raw STL coordinates in millimeters.
   - Slicer exports automatically apply a `10×` scaling factor (`unitScale = 10.0`), guaranteeing 1:1 true-scale physical prints with zero manual rescaling.

---

## 6. CAM Studio Modal Accessibility (WAI-ARIA)

Implemented in [`src/components/CamCncModal.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/CamCncModal.tsx) and verified in [`src/components/CamCncModal.test.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/CamCncModal.test.tsx):
- Dedicated `role="tablist"` navigation with `aria-selected` and `aria-controls` bindings.
- Dedicated `role="tabpanel"` panels with keyboard focus trapping and arrow-key cycling.
- `aria-live="polite"` status announcer for screen reader notifications of toolpath generation, G-code copying, and slicing progress.
- Form inputs have programmatic `htmlFor` and `aria-describedby` associations detailing physical units.
