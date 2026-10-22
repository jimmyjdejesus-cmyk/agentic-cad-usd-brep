# ApexCAD Studio — CAM, CNC G-Code & Digital Fabrication Guide

## 1. Overview of Manufacturing Studio

ApexCAD Studio features a native **Computer-Aided Manufacturing (CAM) and Digital Fabrication Engine** that transforms 3D CAD geometry into machine-ready toolpaths, CNC G-code, 2D vector DXF cut-sheets, and 3D printing preflight data.

All CAM operations are accessible directly through the in-app **CAM Studio Modal** ([`src/components/CamModal.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/CamModal.tsx)) or programmatically via the agent tool `cad_generate_cam_toolpaths` ([`src/services/appToolsAndSkills.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.ts)).

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

---

## 4. 2D Vector DXF Cut-Sheet Exporter

Implemented in [`src/services/dxfExporter.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/dxfExporter.ts).

### 4.1 Format & Compatibility
- Outputs standard **AutoCAD Release 12 (R12) DXF**, widely supported by:
  - CNC Laser Cutters (LightBurn, RDWorks, CypCut)
  - CNC Plasma Cutters (SheetCam, Hypertherm)
  - CNC Waterjets (OMAX Intelli-MAX, Flow)
  - Vector CAD tools (AutoCAD, Fusion 360, FreeCAD, Illustrator)

### 4.2 Cross-Section Extraction
- Slices 3D geometry at ground level ($z = 0$) or user-specified plane height.
- Projects boundary edges onto 2D $XY$ vector entities.
- Generates clean closed `POLYLINE` entities preserving exact dimensional accuracy.

---

## 5. 3D Printing Preflight & Slicing Estimator

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
