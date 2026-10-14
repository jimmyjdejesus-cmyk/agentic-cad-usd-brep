---
name: cad-ux-pr-reviewer
description: Workflow and validation playbook for conducting PR code reviews and test verification on the NVIDIA usd-brep Agentic CAD Studio codebase.
---

# CAD UX & PR Review Playbook

## Purpose
Guide automated data collection, static analysis, Three.js viewport checks, and test suite execution when reviewing pull requests for `agentic-cad-usd-brep`.

## Review & Verification Steps

1. **GitHub PR Data Retrieval**:
   - Use `github-mcp-server` MCP tools (`get_pull_request`, `get_pull_request_files`, `get_pull_request_status`) or `gh pr view <number>` CLI to inspect PR metadata, changed files, and status checks.
   - Run `python3 /Users/jimmy/.gemini/config/skills/pr-reviewer/scripts/fetch_pr_data.py <pr_url> --output-dir /tmp/reviews --no-clone`.

2. **Automated Test Matrix**:
   ```bash
   # TypeScript typechecking
   npm run lint

   # Vitest unit test suite (geometric synthesizer, mass calculations, EDA engine, agent turns)
   npm test

   # Vite production bundle build
   npm run build

   # Backend Python FastAPI & CAD engine test suite
   .venv-usd-brep/bin/pytest backend/test_cad_engine.py -v
   ```

3. **Domain-Specific Inspection Checklist**:
   - **Three.js Viewport & Raycasting**: Verify that raycasters ignore invisible meshes (`c.visible === true`) so internal geometries can be clicked when outer parts are hidden.
   - **Timeline & Canvas Hit-Testing**: Ensure overlays have `pointer-events-none` on outer containers and `pointer-events-auto` on active controls so 3D navigation isn't blocked.
   - **Manifold B-Rep Diagnostics**: Ensure `all_manifold` solid diagnostics and sanity check alerts properly integrate with the Gemini 3x repair loop.
   - **Annotation Anchors**: Confirm that annotations on hidden parts hide both the Three.js leader line/pin and the projected 2D DOM billboard badge.

4. **Review Artifact Generation**:
   - Save findings to `/tmp/reviews/PRs/<repo>/<PR>/findings.json`.
   - Run `python3 /Users/jimmy/.gemini/config/skills/pr-reviewer/scripts/generate_review_files.py <dir> --findings <findings.json> --metadata <metadata.json>`.
