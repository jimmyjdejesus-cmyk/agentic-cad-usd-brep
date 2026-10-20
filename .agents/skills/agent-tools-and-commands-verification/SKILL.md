---
name: agent-tools-and-commands-verification
description: Systematically review, audit, dispatch, and test all in-app agent toolsets, backend server API routes, and browser CDP automation commands in the CAD Studio.
---

# Agent Tools, API Endpoints, and Commands Verification Playbook

This skill outlines the testing methodology and operational commands for verifying all AI agent tools, Express backend endpoints, and browser CDP verification suites across ApexCAD Studio.

## 1. Registered In-App Agent Toolsets Catalog (`src/services/appToolsAndSkills.ts`)

All tools enforce `inAppExecutionOnly: true` and are cataloged under `IN_APP_TOOLSETS`:

| Toolset ID | Category | Tool ID | Description |
| :--- | :--- | :--- | :--- |
| `toolset_cad_brep` | CAD Kernel | `usd_brep_validate_topology` | Validates 2-manifold closed shells, faces, edges, bounds. |
| `toolset_cad_brep` | CAD Kernel | `usd_brep_tessellate_mesh` | Converts B-Rep NURBS to triangle meshes with linear tolerance. |
| `toolset_cad_brep` | CAD Kernel | `usd_brep_check_clearance` | Evaluates interference & penetration warnings between parts. |
| `toolset_amd_eda` | AMD Silicon & EDA | `amd_logic_synthesis` | Synthesizes gate-level netlists for ALU and vortex controllers. |
| `toolset_amd_eda` | AMD Silicon & EDA | `amd_force_directed_placer` | Computes physics relaxation to minimize Manhattan wire length. |
| `toolset_amd_eda` | AMD Silicon & EDA | `amd_drc_rule_check` | Validates cell spacing against 45nm lithography pitch constraints. |
| `toolset_amd_eda` | AMD Silicon & EDA | `amd_silicon_to_3d_package` | Generates 3D MCM package OpenUSD B-Rep Python code. |
| `toolset_physics_mass`| Physical Analysis | `calculate_assembly_mass` | Calculates exact volume mass & Center of Mass with material presets. |
| `toolset_physics_mass`| Physical Analysis | `query_material_catalog` | Returns 16 aerospace, marine, medical, and electronic materials. |
| `toolset_assembly_kinematics` | Kinematics & Annotations | `solve_explosion_stages` | Schedules disassembly vectors with ease-out cubic interpolation. |
| `toolset_assembly_kinematics` | Kinematics & Annotations | `sync_3d_annotation_datum` | Anchors GD&T datum notes and surface inspection callouts. |
| `toolset_digital_fabrication` | Digital Fabrication | `generate_cnc_gcode` | Exports multi-pass CNC G-code with holding tabs & safe retracts. |
| `toolset_digital_fabrication` | Digital Fabrication | `generate_dxf_profile` | Exports AutoCAD Release 12 ASCII DXF with CONTOUR & INNER_CUT. |
| `toolset_digital_fabrication` | Digital Fabrication | `preflight_3d_printing` | Evaluates bed contact area, filament mass (PLA/PETG/ABS/TPU), & print time. |

## 2. Server API Route Verification (`server.ts` & `src/server.test.ts`)

The Express backend serves the following endpoints tested via Vitest with ephemeral port binding:
- `GET /api/health`: Health status, doc availability, and preset counts.
- `GET /api/system/hardware`: Telemetry for RAM, VRAM, Apple Silicon detection, and runtimes.
- `GET /api/presets`: Curated parametric CAD presets.
- `POST /api/execute`: Relays code to Python backend or returns HTTP 503 fallback.
- `GET /api/guides` & `GET /api/guides/content`: Serves documentation with path traversal protection.
- `POST /api/agent/turn`: Multi-provider routing (Ollama, Gemini, Hermes, LiteLLM, or deterministic fallback).
- `POST /api/tools/execute`: Server-side proxy dispatching `executeInAppTool`.

## 3. Standard Verification Command Sequence

Run these commands in order to confirm full system readiness:

```bash
# 1. Type check
npm run lint

# 2. Vitest unit & integration test suites (155 tests)
npm test

# 3. Python backend unit tests
python3 -m pytest backend/test_cad_engine.py

# 4. Vite production bundle compilation
npm run build

# 5. Headless Chrome DevTools Protocol (CDP) end-to-end browser suite (9 tests)
npm run test:browser
```
