# CAD Assembly Multi-Stage Explosion & Animation Timeline

An interactive multi-stage disassembly animation system for NVIDIA `usd-brep` CAD assemblies, enabling engineers to define sequential explosion stages directly within CAD scripts and play them back in the 3D viewport with timeline scrubbing and per-part 3D translation vectors.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural direction below incorporates all choices confirmed during Phase 1:
> - **Explosion Stage Definition**: Returned directly from `build_parts()` in the CAD script (as `return parts, explosion_stages` or script-level stage descriptors), keeping geometry and disassembly sequencing unified in one file.
> - **Viewport Playback Controls**: Full animation deck featuring Play/Pause, Continuous Scrubber Timeline, Previous/Next Step buttons, Stage Select Dropdown, and Reassemble Reset.
> - **Part Motion Specification**: 3D translation offset vectors `[dx, dy, dz]` per part for each stage, supporting progressive cumulative offsets and per-part easing curves (`linear`, `ease-in`, `ease-out`, `ease-in-out`).

- **Confirmed Decision 1**: CAD script entry point returns `(parts, explosion_stages)` or backward-compatible `parts` list when stages are omitted. Default presets will be enriched with realistic mechanical explosion sequences (e.g., removing fasteners/caps first, lifting gears/collars along shafts, sliding housing covers).
- **Confirmed Decision 2**: Interactive playback controls live in a dedicated, collapsible bottom HUD bar within the 3D viewport, preserving full viewport visibility while offering fine-grained scrubbing.
- **Confirmed Decision 3**: Animation engine interpolates part meshes in real time using `requestAnimationFrame`, calculating interpolated matrix transformations between keyframe stages for 60fps performance without re-tessellating geometry.

---

### 1. Overview & Core Concept

- **What It Does**: Upgrades the CAD studio from a single global explosion slider to an engineering-grade sequential assembly disassembly animator. Users can inspect internal components step-by-step, review assembly procedures, and scrub through custom disassembly stages defined directly in the Python CAD script.
- **Target Audience / Persona**: Mechanical engineers, robotics designers, and CAD modelers using OpenUSD and NVIDIA `usd-brep` who need to communicate assembly hierarchies, verify disassembly clearances, and create interactive presentation exploded views.
- **Key Value**: Replaces artificial radial scatter with physically accurate mechanical disassembly paths (e.g. axial pull-out before radial expansion), making complex multi-part B-Rep assemblies intuitive to inspect.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Zero State / Assembly Mode**: When an assembly loads, the viewport displays the model in its fully assembled state ($t = 0$). The timeline bar indicates Stage 0 ("Assembled State").
2. **Sequential Stepping**: The user clicks **Step Forward (Next Stage)** to advance to Stage 1 (e.g., "Retaining Cap Ejection"). The viewport smoothly animates the cap along the $+Z$ axis according to its easing curve.
3. **Continuous Playback**: The user clicks **Play**, playing through all defined stages in order. The stage name badge updates in real time, and the scrubber knob glides across the timeline track.
4. **Scrubbing & Pausing**: Dragging the timeline slider smoothly interpolates all active parts between adjacent stages or across the entire sequence.
5. **Editing CAD Script**: Users can edit `explosion_stages` in the code editor (e.g., tweaking translation vectors or adding a new stage). Upon execution, the timeline instantly updates stage notches and labels.

#### Visual Identity & Theme
- **Surface & HUD Styling**: Semi-transparent dark slate backdrop (`bg-slate-950/85 backdrop-blur-md`) with subtle border lines (`border-slate-800`), matching the dark CAD environment.
- **Control Bar Placement**: Floating dock centered at the bottom of the 3D canvas with rounded corners (`rounded-xl`), elevated shadow, and high-contrast icon buttons.
- **Accent Tokens**: Electric sky blue (`text-sky-400`, `bg-sky-500`) for active play states and stage scrubbers; Emerald (`text-emerald-400`) for success / completed stages; Amber (`text-amber-400`) for current active stage markers.
- **Timeline Typography**: Monospace font for time counters (`font-mono text-xs text-slate-300`), clean uppercase tracking for stage headers (`text-[10px] tracking-wider text-slate-400`).

#### Interactive Feedback & Motion
- **Smooth Easing**: Configurable ease-out / ease-in-out curve interpolation between stages prevents mechanical jarring.
- **Stage Milestones / Tick Marks**: Visual notches on the scrubber timeline corresponding to each named stage, allowing one-click snapping to specific assembly states.
- **Dual Mode Support**: When a CAD script does not define explicit explosion stages, the interface gracefully falls back to the proportional radial explode mode with an informative toggle.

---

### 3. Key Product Decisions & Trade-Offs

#### Decision 1: Explosion Stage Definition in CAD Script
- **Chosen Approach**: Allow `build_parts()` to return either:
  1. `return parts, explosion_stages`
  2. Or define an explicit `explosion_stages = [...]` structure in the script body.
  Each stage specifies:
  ```python
  {
      "name": "Eject Fastener Cap",
      "duration": 1.2, # seconds
      "easing": "ease-out", # "linear" | "ease-in" | "ease-out" | "ease-in-out"
      "translations": {
          "retaining_cap": [0.0, 0.0, 14.0],
          "spur_gear_12t": [0.0, 0.0, 0.0]
      }
  }
  ```
- **Why**: Keeps all mechanical design logic and kinematic disassembly data together in the script, adhering to parametric CAD standards where geometry and assembly metadata are unified.
- **Alternatives Considered**: Creating an external JSON metadata file (rejected: separates design from code and complicates AI generation).

#### Decision 2: Real-Time Transform Interpolation vs. Re-Meshing
- **Chosen Approach**: Three.js mesh instance translation offsets calculated during the render loop via lerp/easing, modifying `mesh.position` directly without mutating underlying `BufferGeometry`.
- **Why**: Retains high-fidelity 60 FPS performance regardless of triangle count; zero garbage collection overhead.
- **Alternatives Considered**: Generating discrete mesh geometries per stage (rejected: wasteful memory consumption and stuttering).

#### Decision 3: Backward Compatibility with Existing Presets
- **Chosen Approach**: All existing presets (e.g., Planetary Gearbox, Optical LiDAR Turret, Flanged Pipe Elbow) will be enriched with authentic engineering explosion stages, while the evaluator automatically generates default sequential stages if a user writes a script returning just `parts`.
- **Why**: Zero breaking changes for existing code; immediate out-of-the-box delight on every preset.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          CAD Python Script                             │
│  def build_parts():                                                    │
│      ...                                                               │
│      return parts, explosion_stages                                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│           cadRuntime.ts (Evaluator & Parser)                           │
│  - Parses parts tuples (name, brep, color, kind)                       │
│  - Parses explosion_stages JSON/list structure                         │
│  - Emits CadExecutionResult with explosion_stages[]                    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│           App.tsx (Studio State & Playback Controller)                 │
│  - activeStageIndex, currentTime, isPlaying, playbackSpeed             │
│  - Stage scrubber timeline & transport controls                        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│           Viewport3D.tsx (Three.js Z-Up Scene Engine)                  │
│  - Computes per-part interpolated translation vector [tx, ty, tz]      │
│  - Applies easing functions (easeOutCubic, easeInOutQuad, etc.)        │
│  - Updates Three.js mesh.position & wireframe/bounds helpers           │
└────────────────────────────────────────────────────────────────────────┘
```

#### Data Model & Types (`src/types/cad.ts`)
```typescript
export type ExplosionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface ExplosionPartTransform {
  translation: [number, number, number]; // [dx, dy, dz] offset in cm
  rotation?: [number, number, number];    // optional Euler rotation in deg
  easing?: ExplosionEasing;
}

export interface ExplosionStage {
  id: string;
  name: string;
  description?: string;
  duration: number; // in seconds, default 1.0s
  easing?: ExplosionEasing;
  parts: Record<string, ExplosionPartTransform | [number, number, number]>;
}
```

#### Playback Controller Features
- **Transport Buttons**: Play ($\blacktriangleright$), Pause ($\mathbf{II}$), Previous Stage ($\mathbf{I\blacktriangleleft}$), Next Stage ($\blacktriangleright\mathbf{I}$), Reset / Reassemble ($\mathbf{\circlearrowleft}$).
- **Timeline Slider**: Scrubbing from $0.0$ to total duration with stage notch indicators and tooltip showing current stage name and sub-second timestamp.
- **Speed Selector**: $0.5\times$, $1\times$, $1.5\times$, $2\times$ playback rate toggle.
- **Stage Quick-Select**: Clickable stage badges to jump directly to any stage keyframe.
