# ApexCAD Studio: Factory Preset Removal & Hands-on Onboarding Engine

A streamlined architectural overhaul that completely removes static factory presets, establishes a pristine zero-state workspace with the New Design dialog, and introduces a rich, interactive hands-on tutorial guiding users through building their very first 3D B-Rep part.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and UX decisions were confirmed during the Phase 1 clarification interview:
>
> - **Confirmed Initial Workspace State**: The application will start in a clean blank workspace rather than auto-loading an arbitrary factory preset. If no custom files exist, the user is greeted by an inviting zero-state launchpad with the New Design modal and an option to launch the hands-on onboarding tutorial.
> - **Confirmed Onboarding Style**: An **interactive hands-on tutorial** that walks the user step-by-step through configuring and building their first 3D solid part, navigating the 3D viewport, executing code/prompts, inspecting mass properties, and saving to Cloud Vault.
> - **Confirmed Template Strategy**: Basic geometric starter templates (Parametric Enclosure Box, Concentric Cylinder Shaft, Bearing Sphere, Conical Nozzle, Seal Torus, and Clean Blank Slate) are preserved inside the `New Design` dialog, ensuring users never face blank-canvas paralysis.
> - **Cleaned Preset Dropdown**: The header dropdown is decluttered to exclusively manage user-created designs ("My Designs"), with quick Rename, Delete, and Cloud Sync actions.

---

## 1. Overview & Core Concept

### What It Does
Transforms ApexCAD Studio from a preset-showcase into a genuine personal CAD authoring tool. Users start with their own clean workspace, configure real parts from geometry primitives or blank Python B-Rep code, and learn all CAD capabilities through a guided, step-by-step interactive onboarding experience.

### Target Audience / Persona
Mechanical engineers, silicon package designers, and CAD makers who need a clutter-free, production-ready modeling suite where only their own projects and custom files are stored and displayed.

### Key Value
- **Zero Factory Clutter**: No unwanted hardcoded presets competing with personal files in the design selector or cluttering memory.
- **Immediate Hands-on Mastery**: New users are guided through real interactive actions (selecting a primitive, rotating in 3D, running the B-Rep engine, analyzing physical mass).
- **Graceful Zero-State Experience**: When launching without previous files, the app displays a focused welcome launchpad rather than an error or an arbitrary pre-baked model.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **First-Time User Experience (Zero-State & Onboarding)**:
   - On first launch (when no saved user files exist), the 3D viewport displays a subtle coordinate grid with a sleek, non-intrusive **Welcome Launchpad**.
   - The user is offered two primary pathways:
     - **"Start Hands-On Tutorial"** (Recommended): Initiates the guided 6-step tutorial that builds an actual part right before their eyes.
     - **"Create New Design"**: Directly opens the geometric template modal (Box, Cylinder, Sphere, Cone, Torus, Blank).
   - A persistent **"Tutorial / Tour"** button in the header utility bar allows reopening the guide at any time.

2. **The 6-Step Interactive Hands-on Tutorial Flow**:
   - **Step 1: Welcome & Mission Briefing**: Introduces ApexCAD Studio's core philosophy—exact NURBS boundary representation (B-Rep) with real-time USD generation.
   - **Step 2: Choose Starter Geometry**: User interacts directly with the starter selector (Box, Cylinder, or Blank) to pick their target part foundation.
   - **Step 3: 3D Viewport Mastery**: Teaches camera controls: Left-click drag to Orbit, Right-click / Shift-drag to Pan, Wheel to Zoom, and projection presets (ISO, Front, Top, Wireframe).
   - **Step 4: AI & Code Generation Harness**: Demonstrates how Python code drives exact geometry and how natural language prompts update the solid model.
   - **Step 5: Physical Material & Mass Analysis**: Demonstrates assigning materials (Aluminum 6061-T6, Grade 5 Titanium, 316L Stainless Steel) and calculating live volume, center of gravity, and mass.
   - **Step 6: Completion & Workspace Hand-off**: Saves their newly crafted first part directly to their workspace with local storage and Firebase Cloud Vault syncing, leaving the viewport in live edit mode.

3. **Returning User Experience**:
   - The app immediately loads the user's most recent active project from `localStorage` or Cloud Vault.
   - The header design dropdown displays exclusively the user's projects (`My Designs (N)`), complete with last-modified timestamps, quick delete, and rename actions.

### Visual Identity & Theme Tokens
- **Background**: Deep matte zinc (`#090a0f` / `bg-slate-950`).
- **Surfaces**: Dark slate cards (`#131722` / `bg-slate-900/90`) with crisp borders (`border-slate-800`).
- **Accents**:
  - Indigo/Sky (`#6366f1` / `#0ea5e9`) for active highlights and tutorial step indicators.
  - Emerald (`#10b981`) for positive actions ("Create Design", "Finish Tutorial", "Saved").
  - Amber (`#f59e0b`) for active viewport indicators.
- **Anti-Slop Discipline**: Zero static pills or candy badges. Clean unboxed typographic metadata separated by `·`. Clear, single-line action buttons with proper horizontal padding.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Complete Removal of Factory Presets from Startup and UI**
  - *Chosen Approach*: Remove `DEFAULT_PRESETS` from default dropdown listings and startup logic. The application only lists user-created files (`userFiles`).
  - *Why*: Direct compliance with user intent. Eliminates the cognitive burden of navigating past 5 pre-made factory assets to find personal designs.
  - *Fallback Safeguard*: The underlying NVIDIA usd-brep example scripts remain available in the "Guides" and documentation tabs for developer reference without polluting the design switcher.

- **Decision 2: Interactive Hands-On Tutorial Modal vs. Passive Video/Tooltip Walkthrough**
  - *Chosen Approach*: An interactive step-by-step modal with live viewport interaction, step progression, and automatic creation of a real working part upon completion.
  - *Why*: Hands-on learning ensures muscle memory for 3D navigation and CAD code execution. The user finishes onboarding with an actual 3D model in their workspace.

- **Decision 3: Zero-State Launchpad vs. Auto-creating a Blank File on Load**
  - *Chosen Approach*: Display a clean zero-state launchpad that lets the user choose between the Hands-on Tutorial and the New Design dialog.
  - *Why*: Prevents creating phantom "Untitled_123" files in the user's library without their consent.

---

## 4. Technical Architecture & Data Strategy

### System Component Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ApexCAD Studio Header                                  │
│  [Logo · ApexCAD]  ──  [+ New Design] [My Designs (N) ▼]  ──  [Tutorial] [Vault Sync]  │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┴─────────────────────────────────┐
         ▼                                                                   ▼
┌───────────────────────────────────┐               ┌────────────────────────────────────┐
│      Zero-State Launchpad         │               │     OnboardingTutorial Modal       │
│  - "Start Hands-on Tutorial"      │ ────────────> │  - Step 1: Welcome & Mission       │
│  - "Create New Design" (+ New)    │               │  - Step 2: Choose Starter Shape    │
│  - Quick tips for navigation      │               │  - Step 3: Viewport Orbit/Pan/Zoom │
└───────────────────────────────────┘               │  - Step 4: Code & AI Generation    │
                                                    │  - Step 5: Material & Mass Physics │
                                                    │  - Step 6: Finalize First Part     │
                                                    └─────────────────┬──────────────────┘
                                                                      │
                                                                      ▼
                                                    ┌────────────────────────────────────┐
                                                    │        User Design Library         │
                                                    │  - localStorage ('apexcad_files')  │
                                                    │  - Firestore Cloud Vault           │
                                                    │  - Active 3D CAD Viewport          │
                                                    └────────────────────────────────────┘
```

### State Management & Persistence Mapping

1. **Onboarding State (`apexcad_onboarding_completed`)**:
   - Boolean flag in `localStorage`. If `false` or absent, the Zero-State launchpad highlights the tutorial prompt.
   - Users can trigger the tutorial anytime via the header `Tutorial` button, resetting step index to 0.

2. **File Library (`userFiles`)**:
   - `loadUserFiles()`: Loads custom designs from `localStorage`.
   - When empty, `activeFile` is set to `null`, activating the clean Zero-State Launchpad.
   - When a design is created (via New Design modal or Onboarding completion), it becomes `activeFile`, executes in the viewport, and auto-saves.

3. **Factory Presets Cleared**:
   - `presets` state in `App.tsx` replaced by `userFiles`.
   - The design dropdown displays exclusively user files with clean unboxed metadata (updated timestamp, template type, delete/rename controls).
