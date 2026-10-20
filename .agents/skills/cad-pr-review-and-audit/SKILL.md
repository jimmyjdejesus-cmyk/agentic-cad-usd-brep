---
name: cad-pr-review-and-audit
description: Review, verify, and audit CAD agent and hardware-gated B-Rep pull requests using GitHub MCP, Vitest suites, TypeScript type checks, and AST code surgery heuristics.
---

# CAD PR Review & Audit Playbook

## Purpose
This skill establishes a repeatable procedure for auditing, verifying, and commenting on pull requests in the `agentic-cad-usd-brep` repository using both GitHub MCP tools (`create_pull_request_review`) and `gh` CLI.

---

## 1. Automated Verification Workflow

Before posting code review comments, always run the full local validation pipeline:

```bash
# 1. Vitest Unit & Integration Suites (123 tests across 13 suites)
npm test

# 2. TypeScript Static Analysis (zero emitted errors expected)
npm run lint

# 3. Production Vite Bundle & Asset Build (ensure WASM modules link cleanly)
npm run build
```

---

## 2. Key Audit Dimensions for CAD PRs

When evaluating changes across the agentic CAD stack, systematically review against:

### A. Digital Fabrication & CAM (`src/services/camService.ts` & `src/components/CamCncModal.tsx`)
- **2D DXF Export**: Ensure standard AutoCAD R12 ASCII (`AC1009`) format with millimeter `$INSUNITS = 4` and separate layers (`CONTOUR` for outside cut, `INNER_CUT` for interior pockets/holes).
- **CNC G-Code Generator**: Verify tool radius compensation offsets, multi-pass stepdown passes down to target depth, safe retracts ($Z_{safe}$), and optional holding tabs to prevent part ejection.
- **3D Printing Preflight**: Verify watertight manifold validation ($\chi = 2$, 0 boundary edges), filament mass calculation, and bed adhesion contact ratio.

### B. Provider Router (`server.ts` & `src/services/geminiAgent.ts`)
- **Base URL normalization**: Ensure URLs like `http://localhost:11434`, `http://localhost:11434/v1`, and full `/chat/completions` paths are resolved without double-slashes or missing paths.
- **Error handling**: Check that non-200 responses log status codes and error bodies (`console.warn`) rather than failing silently.
- **Fallback transparency**: When fallback parametric synthesis takes over due to provider failure, ensure UI messages accurately reflect that the local fallback engine was used rather than implying the LLM succeeded.

### B. Hardware Gating (`canRunOnSystem` in `src/services/appToolsAndSkills.ts`)
- **Memory baseline**: Verify that the **1.5 GB memory reservation** for Three.js WebGL and Manifold WASM geometry is maintained.
- **Utilization thresholds**: Flag any models consuming >95% effective memory or running below 4 tokens/sec.
- **User confirmation**: Confirm that tight-fit warning flags (`requiresConfirmation`) match modal UI behaviors.

### C. Parametric Intelligence & Auto-Repair (`src/services/parametricIntelligence.ts`)
- **Coordinate vs. Dimension Clamping**: When repairing invalid inputs (`SM_ERR_INVALID_INPUT`), ensure clamping to `1.0` only applies to positive dimension parameters (radius, height, width, length), NOT origin coordinates `(x, y, z)` which can legitimately be `0.0` or negative.
- **Clearance Adjustments**: When bumping vertical clearance to resolve bounding-box penetrations, ensure only upper parts (`z0 > 0`) or specific colliding components are translated, preserving ground clearance `z=0`.

---

## 3. Submitting PR Reviews via GitHub MCP

To leave comments atomically via `github-mcp-server`:

```json
{
  "ServerName": "github-mcp-server",
  "ToolName": "create_pull_request_review",
  "Arguments": {
    "owner": "jimmyjdejesus-cmyk",
    "repo": "agentic-cad-usd-brep",
    "pull_number": 8,
    "commit_id": "LATEST_COMMIT_SHA",
    "event": "COMMENT",
    "body": "### Overall Assessment\n\n...",
    "comments": [
      {
        "path": "src/services/parametricIntelligence.ts",
        "line": 862,
        "body": "Specific actionable suggestion..."
      }
    ]
  }
}
```
