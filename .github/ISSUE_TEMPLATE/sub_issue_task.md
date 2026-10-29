---
name: Sub-Issue / Engineering Task
about: Granular engineering task linked to a parent milestone epic with explicit dependencies and target files
title: "[v1.X.0] "
labels: ["type:sub-issue"]
assignees: ""
---

> **Tracking ID:** `ISS-XXX` | **Milestone:** `M1 (v1.X.0)` | **Parent Epic:** #

### Summary & Engineering Scope
<!-- Clear technical description of the CAD/CAM, viewport, kernel, or copilot task. -->

### Cross-Issue Dependency Links
- **Part of Parent Epic:** #
- **Depends On:** None
- **Blocks Downstream:** None

### Target Repository Files
- `src/...`

### Acceptance Criteria (Definition of Done)
- [ ] Implementation complete with explicit `mm` / `cm` unit handling
- [ ] Unit test coverage added in `src/**/*.test.ts` or `backend/test_cad_engine.py`
- [ ] `npm run lint` and `npm test` pass with 0 errors
