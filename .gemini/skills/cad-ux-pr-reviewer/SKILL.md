---
name: cad-ux-pr-reviewer
description: Workflow and validation playbook for conducting PR code reviews, headless CDP verification, and test execution on the NVIDIA usd-brep Agentic CAD Studio codebase.
---

# CAD UX & PR Review Playbook

## Purpose
Guide automated data collection, static analysis, Three.js viewport checks, headless Chrome CDP verification, and test suite execution when reviewing pull requests for `agentic-cad-usd-brep`.

## Review & Verification Steps

1. **GitHub PR Data Retrieval**:
   - Use `github-mcp-server` MCP tools (`get_pull_request`, `get_pull_request_files`, `get_pull_request_status`) and `gh pr view <number>` CLI to inspect PR metadata, changed files, and status checks.
   - Run `python3 /Users/jimmy/.gemini/config/skills/pr-reviewer/scripts/fetch_pr_data.py <pr_url> --no-clone`.

2. **Automated Test Matrix**:
   ```bash
   # TypeScript typechecking
   npm run lint

   # Vitest unit test suite (geometric synthesizer, mass calculations, EDA engine, agent turns, remote/fallback routing)
   npm test

   # Vite production bundle build
   npm run build

   # Automated Headless Chrome CDP Test Suite (9 real DOM/UX scenarios at 1024x768)
   node scripts/verify-browser.mjs

   # Backend Python FastAPI & CAD engine test suite (if python venv available)
   .venv-usd-brep/bin/pytest backend/test_cad_engine.py -v
   ```

3. **Domain-Specific Inspection Checklist**:
   - **Hybrid Kernel Fallback & Event-Loop Leaks**:
     - Ensure `/api/execute` proxy returns HTTP 503 when the Python backend signals `{ fallback: true }`, allowing `cadRuntime.ts` to seamlessly evaluate client-side.
     - Verify all `fetch` timeout timers are enclosed in `try ... finally { clearTimeout(timer); }` to avoid uncollected timer handles on aborted or failed requests.
   - **Responsive 1024px Layout & Viewport Sizing**:
     - Verify that flex containers wrapping the 3D canvas and sidebars include `min-w-0` and `shrink-0` to avoid viewport canvas width collapsing to 0px on medium/laptop screens.
   - **WAI-ARIA Disclosures & Accessibility**:
     - Collapsible drawers/sidebars (`#prompt-copilot-window`, `#inspector-dock`, `#mass-properties-panel-content`, `#custom-density-input-drawer`) must provide `aria-expanded`, `aria-controls`, and descriptive `aria-label` attributes.
     - Modal and drawer close buttons must feature explicit `aria-label="Close"` or specific descriptive text.
   - **Three.js Viewport & WebGL Resilience**:
     - Ensure `THREE.WebGLRenderer` initialization is protected by `try ... catch` and displays an informative warning banner in restricted/headless environments without unmounting the React tree.
     - Verify that raycasters ignore invisible meshes (`c.visible === true`) so internal geometries can be clicked when outer parts are hidden.
     - Timeline overlays must have `pointer-events-none` on outer containers and `pointer-events-auto` on active controls so 3D navigation isn't blocked.
   - **Annotation Anchors**: Confirm that annotations on hidden parts hide both the Three.js leader line/pin and the projected 2D DOM billboard badge.

4. **Review Artifact Generation**:
   - Save findings to `/tmp/PRs/<repo>/<PR>/findings.json`.
   - Run `python3 /Users/jimmy/.gemini/config/skills/pr-reviewer/scripts/generate_review_files.py <dir> --findings <findings.json> --metadata <metadata.json>`.
   - Present findings clearly to the user before posting any comments or approvals (two-stage approval).
