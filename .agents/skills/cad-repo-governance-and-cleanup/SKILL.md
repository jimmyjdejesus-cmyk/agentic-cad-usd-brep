---
name: cad-repo-governance-and-cleanup
description: Protocol and playbooks for identifying and deleting stale local/remote branches, synchronizing architectural and TDD documentation with live test suites, validating GitHub PR templates, and maintaining ApexCAD Studio repository health.
---

# CAD Repository Governance & Cleanup Playbook

This skill outlines the standard operating procedure for auditing git branches, pruning stale references, maintaining GitHub templates, and synchronizing architectural and testing documentation in ApexCAD Studio.

---

## 1. Stale Branch Audit & Pruning Workflow

### 1.1 List All Pull Requests and Branch Relationships
```bash
# List all PRs with merge status and branch names
gh pr list --state all --json number,title,state,headRefName

# List local tracking branches with commit status
git branch -vv

# List all local and remote branches
git branch -a
```

### 1.2 Verify Ancestry & Squash Merge Commits
Before deleting any branch, verify that its commits are fully accounted for in `main`:
```bash
# If direct ancestor:
git merge-base --is-ancestor <branch-name> main && echo "Ancestor of main"

# If squash-merged via PR (e.g. PR #8 or PR #5):
git log --grep="#<PR_NUMBER>" --oneline
```

### 1.3 Safe Deletion & Pruning
```bash
# Delete local branch
git branch -d <branch-name>  # or -D if squash-merged

# Delete remote branch if it still exists on origin
git push origin --delete <branch-name>

# Prune tracking references
git fetch --prune origin
```

---

## 2. Documentation Synchronization Checklist

When features or tests are added or modified, update all relevant documentation layers:

1. **`README.md`**:
   - Update Vitest test count badge and test matrix summary.
   - Verify feature highlights, supported AI providers, and kernel capabilities.
   - Check Quick Start commands and documentation cross-links.

2. **`ARCHITECTURE_AND_PLAN.md` & `docs/ARCHITECTURE.md`**:
   - Keep Mermaid diagrams synchronized with the dual-runtime architecture:
     - Frontend (Vite + React 18 + Three.js)
     - AI Layer (Model-Agnostic Router + Hardware Memory Gate + AST-like Surgery)
     - Geometric Kernels (NVIDIA `usd-brep` SMLib C++ & WebAssembly `manifold-3d` CSG)
     - Manufacturing (CAM, CNC G-Code, 2D DXF, 3D Print Preflight)
     - Express + FastAPI backend routes

3. **`docs/TDD_AND_TESTING.md`**:
   - Update test suite breakdown table with exact test counts for each `*.test.ts` file.
   - Document new mock strategies and regression prevention patterns.

4. **`docs/CAM_AND_MANUFACTURING.md` & `docs/MODEL_AGNOSTIC_AI.md`**:
   - Maintain accurate command dialect references (RS-274 G-Code, AutoCAD R12 DXF).
   - Document hardware memory gating calculations ($1.5\text{ GB}$ viewport reservation).

---

## 3. GitHub PR & Community Template Standards

Ensure `.github/` contains:
- **`.github/pull_request_template.md`**:
  - Detailed summary of changes.
  - B-Rep and CSG manifold integrity checks (watertightness, non-negative volume, clearance).
  - Hardware memory gate verification (`canRunOnSystem()`).
  - Automated testing checklist (`npm run lint`, `npm test`, `pytest`, `npm run build`, security audit).
  - UI/UX & WAI-ARIA accessibility checks.
- **`.github/ISSUE_TEMPLATE/`**:
  - `bug_report.md` with CAD context (kernel mode, template, export format).
  - `feature_request.md` with modeling and AI harness architecture proposals.
  - `config.yml` with links to NVIDIA `usd-brep` and OpenUSD specifications.

---

## 4. Quality Assurance Verification Gates

Before concluding any maintenance session, run all verification gates:

```bash
# 1. TypeScript static analysis
npm run lint

# 2. Vitest frontend test suite
npm test

# 3. Python backend engine verification
.venv-usd-brep/bin/pytest backend/test_cad_engine.py -v

# 4. Production bundle build
npm run build

# 5. Security audit pattern check
python3 -c "
import os, re, sys
patterns = {
    'Google/Firebase': re.compile(r'AIza[0-9A-Za-z-_]{35}'),
    'OpenAI': re.compile(r'sk-[a-zA-Z0-9]{20,}'),
    'Hugging Face': re.compile(r'hf_[a-zA-Z0-9]{20,}'),
}
for f in [f.strip() for f in os.popen('git ls-files').readlines()]:
    if os.path.isfile(f):
        with open(f, 'r', encoding='utf-8', errors='ignore') as fp:
            for idx, line in enumerate(fp, 1):
                for name, pat in patterns.items():
                    if pat.search(line):
                        print(f'Leak in {f}:{idx}'); sys.exit(1)
print('PASSED: Clean git tree.')
"
```
