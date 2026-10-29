---
name: Milestone Epic
about: Parent epic tracking a release milestone, target end state, sub-issue checklist, and exit criteria
title: "[EPIC v1.X.0] "
labels: ["type:epic"]
assignees: ""
---

> **Epic ID:** `EPIC-X` | **Milestone:** `v1.X.0`

### Epic Overview & Target End State
<!-- Concise summary of the user-facing maker outcome for this release milestone. -->

**Target User Outcome:** 

### Linked Sub-Issues Checklist
<!-- Use GitHub task list syntax (- [ ] #issue_number) to automatically link and track sub-issues in GitHub. -->
- [ ] `ISS-X01`: 
- [ ] `ISS-X02`: 
- [ ] `ISS-X03`: 
- [ ] `ISS-X04`: 

### Milestone Release Exit Criteria (Definition of Done)
- [ ] All linked sub-issues closed and verified on `dev`
- [ ] Vitest unit suite (`npm test`), TypeScript static analysis (`npm run lint`), and Python backend suite (`pytest`) pass with 0 errors
- [ ] Canonical Maker Benchmark Fixtures validated for watertight 2-manifold STL and closed R12 DXF geometry
