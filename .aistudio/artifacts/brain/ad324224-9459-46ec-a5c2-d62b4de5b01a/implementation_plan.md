# ApexCAD Studio Custom File Creation & Dynamic Geometry Templates

A complete architectural overhaul to unlock custom file creation without being locked into hardcoded presets. Introduces a dedicated "New Design" header action, an interactive geometry starter template modal (Box/Enclosure, Cylinder/Shaft, Prism/Bracket, and Blank Script), and unified dual-tier persistence across browser local storage and Cloud Vault.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were confirmed during the Phase 1 clarification interview:

- **Confirmed Header Flow**: A dedicated `+ New` button placed immediately adjacent to the Design dropdown in the header, giving users instant access to create custom designs without navigating away.
- **Confirmed Starter Templates Modal**: When clicking `+ New`, a modal opens presenting 4 curated starter templates:
  1. **Box / Enclosure**: Parametric solid cuboid with filleted baseplate, wall shell, and mounting bosses.
  2. **Cylinder / Stepped Shaft**: Precision rotational cylinder with concentric stepped shoulder and center bore.
  3. **Prism / Angle Bracket**: Structural L-bracket with rib gussets and circular weight-relief cutouts.
  4. **Blank Clean Slate**: Minimal, syntax-valid Python `usd_brep` script with required SmLib and USD stage boilerplate.
- **Confirmed Dual-Tier Storage**: Custom designs are saved seamlessly to browser `localStorage` (accessible offline without login) and automatically syncable to Firebase Cloud Vault when signed in.
- **Dynamic Design Selector**: Replaces the rigid preset-only dropdown with an organized two-section menu separating **Presets** from **My Custom Files**, complete with quick Save, Rename, and Delete actions.

---

## 1. Overview & Core Concept

### What It Does
Empowers engineers and modelers to break free from hardcoded demo presets by creating, authoring, executing, and persisting new custom 3D CAD parts and silicon assemblies from scratch or from standardized mechanical starter templates.

### Target Audience / Persona
CAD engineers, silicon package designers, and hobbyists who want a flexible 3D modeling and USD B-Rep authoring environment where their work is saved, organized, and editable without being overwritten by factory presets.

### Key Value
- **Zero Preset Lock-In**: Create limitless new CAD scripts with custom names, custom bounding envelopes, and custom material settings.
- **Rapid Prototyping Templates**: Jumpstart modeling with industry-standard parametric primitives (enclosures, shafts, brackets) rather than starting from an intimidating blank text buffer.
- **Seamless Local & Cloud Continuity**: Work locally right away, with instant one-click syncing to the user's cloud account.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Creating a New File (`+ New` Header Trigger)**:
   - User clicks the high-contrast `+ New` button adjacent to the Design selector in the header.
   - The **Create New CAD Design** modal appears over a darkened backdrop.
   - User inputs a descriptive design name (e.g. `SensorHousing_V1` or `MotorMount_Plate`).
   - User clicks one of the 4 visual template cards (Box Enclosure, Stepped Cylinder, Structural Bracket, or Blank Script), which highlights with an emerald border and checkmark.
   - User clicks **Create Design**.
   - The modal closes, the new file is immediately stored in `localStorage`, set as active in the header, and executed in the 3D viewport.

2. **Managing Files in the Design Dropdown**:
   - The header dropdown displays an organized list:
     - `My Files (N)`: User-created custom designs, tagged with an edit badge and delete icon.
     - `Factory Presets`: The original 13 USD B-Rep presets (Heat Sink, Turbine Blade, etc.).
   - Switching between files preserves individual code, material selection, mass calculation, and 3D annotations.

3. **Saving & Syncing Custom Files**:
   - A dedicated `Save` button appears in the header toolbar when working on a custom file or modified preset.
   - When signed in with Google, clicking `Save` updates both local storage and the user's Firestore Cloud Vault with a single click.
   - An intuitive status toast provides tactile feedback (`Saved locally and synced to Cloud Vault`).

### Visual Identity & Theme Tokens

- **Canvas Background (60%)**: `#121316` (Deep matte charcoal zinc).
- **Structural Surfaces (30%)**: `#181a20` (Header and modals), `#1e2028` (Template card tiles), hairline borders `#272a34`.
- **Accent Budget (10%)**:
  - Emerald (`#10b981` / `#059669`) for positive actions (`+ New`, `Create Design`, active template selection).
  - Sky Blue (`#0284c7` / `#38bdf8`) for active viewport elements and focused inputs.
  - Rose (`#f43f5e`) for delete actions with confirmation safeguard.
- **Typography**: Clean display sans paired with `font-mono tabular-nums` for dimensions, part counts, and volumes.
- **Anti-Slop Discipline**: No generic pills or fake metadata badges; clean unboxed labels with `·` separators; single-line truncated file labels.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Interactive Template Modal vs. Immediate Blank File**
  - *Chosen Approach*: Open an interactive template modal providing Box, Cylinder, Bracket, and Blank options.
  - *Why*: Solves the "blank canvas paralysis" for mechanical engineers while still offering a 1-click Blank Script for advanced users who write raw Python B-Rep scripts.
  - *Alternatives Considered*: Always opening a blank script (rejected: users would need to manually remember and re-type complex SmPyLib imports and stage initialization).

- **Decision 2: Dual Storage (Local Storage + Cloud Vault)**
  - *Chosen Approach*: Store custom files in `localStorage` by default, and seamlessly mirror them to Firebase Firestore whenever the user is logged in.
  - *Why*: Allows zero-friction usage without requiring an upfront Google login, while guaranteeing cloud persistence across devices for authenticated engineers.
  - *Alternatives Considered*: Cloud-only storage (rejected: forces login walls on first-time visitors).

- **Decision 3: Dedicated Header "+ New" Button Alongside Design Selector**
  - *Chosen Approach*: Add a compact, high-contrast `+ New` button right next to the Design selector in Zone 1.
  - *Why*: Directly targets the user's focus area (CSS selector 1 & 2), making file creation obvious without crowding the center workspace switcher or right viewport flyouts.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ApexCAD Studio Header                                  │
│  [Logo · ApexCAD]  ──  [+ New File] [Design: My Files ▼]  ──  [3D CAD | EDA | Code]   │
│  [Display · Save · Vault · Export]                                                     │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
     ┌───────────────────────────────┐             ┌───────────────────────────────┐
     │   Create New Design Modal     │             │    Design Selector Dropdown   │
     │  • Design Name Input          │             │  • Section: My Files          │
     │  • 4 Template Cards           │             │    - CustomBracket_01 (Local) │
     │    - Box / Enclosure          │             │    - Enclosure_Base (Cloud)   │
     │    - Cylinder / Shaft         │             │  • Section: Factory Presets   │
     │    - Prism / Bracket          │             │    - Round Corner Pipe        │
     │    - Blank Script             │             │    - Heat Sink                │
     │  • [Cancel] [Create Design]   │             │    - Turbine Blade...         │
     └──────────────┬────────────────┘             └───────────────┬───────────────┘
                    │                                              │
                    ▼                                              ▼
     ┌─────────────────────────────────────────────────────────────────────────────┐
     │                     Unified File State Manager                              │
     │  • Current File ID & Name                                                   │
     │  • Python Script & Envelope                                                 │
     │  • Material Preset & Density Override                                       │
     │  • 3D Annotations & Custom Part Renames                                     │
     ├─────────────────────────────────────────────┬───────────────────────────────┤
     │ Local Storage Tier (`cad_user_files`)       │ Cloud Tier (`users/{uid}/...`)│
     │ • Instant offline save                      │ • Firestore Cloud Vault Sync  │
     │ • JSON serializable records                 │ • Multi-device access         │
     └─────────────────────────────────────────────┴───────────────────────────────┘
```

### Data Models & Schemas

```typescript
export interface UserCadFile {
  id: string;                    // Unique identifier e.g. 'file_1742081234567'
  name: string;                  // User-facing name e.g. 'Custom Sensor Bracket'
  code: string;                  // Full Python usd-brep script
  envelope: [number, number, number]; // [width, depth, height] in cm
  materialName: string;          // Default 'Aluminum 6061-T6'
  materialDensity?: number;      // Density in g/cm3
  createdAt: string;             // ISO Timestamp
  updatedAt: string;             // ISO Timestamp
  isCustom: true;                // Distinguishes from factory presets
  cloudSynced?: boolean;         // True if saved to Firestore
}

export interface CadTemplate {
  id: 'box' | 'cylinder' | 'bracket' | 'blank';
  name: string;
  description: string;
  icon: string;
  defaultName: string;
  envelope: [number, number, number];
  starterCode: string;
}
```

### Component & File Implementation Plan

1. **`src/types/cad.ts`**:
   - Add `UserCadFile` interface and `CadTemplate` definition.
2. **`src/data/cadTemplates.ts`**:
   - Create 4 validated, watertight Python starter scripts using SmPyLib primitives (`make_box`, `make_cylinder`, swept fillets, boolean unions).
3. **`src/services/cadFileManager.ts`**:
   - Implement helper functions for `loadUserFiles()`, `saveUserFile()`, `deleteUserFile()`, `exportUserFile()`.
   - Implement synchronization between local storage and Firestore `saveUserAssembly()`.
4. **`src/components/NewDesignModal.tsx`**:
   - Modern, sleek modal with 4 interactive template cards, thumbnail preview outlines, name validation, and keyboard shortcuts (`Enter` to submit, `Esc` to close).
5. **`src/App.tsx` Integration**:
   - Add `+ New` button next to the Design dropdown in the header.
   - Update Design selector to render `<optgroup label="My Custom Files">` and `<optgroup label="Factory Presets">`.
   - Add a quick `Save` / `Sync` button in the header toolbar with visual confirmation feedback.
   - Support smooth switching, editing, creating, and deleting of custom files without resetting factory presets.
