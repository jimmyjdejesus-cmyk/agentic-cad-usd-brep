---
name: agentic-cad-usd-brep
description: Comprehensive workflow guide and operational playbook for configuring, running, testing, and developing the NVIDIA usd-brep Agentic CAD Studio with Gemini copilot and FastAPI backend.
---

# NVIDIA `usd-brep` Agentic CAD Studio Skill

## Architecture Overview

The studio combines:
1. **Frontend**: Vite + React 18 + Three.js Z-up CAD Viewport (`1 unit = 1 cm`, `upAxis = "Z"`).
2. **Backend**:
   - `server.ts` Express server on port 3000 that hosts Vite middlewares, proxies CAD requests, and runs server-side Gemini orchestration.
   - `backend/server.py` FastAPI server on port 8000 running Python 3.12 B-Rep execution engine (`backend.cad_engine`).
3. **Hybrid Execution**:
   - If Python 3.12 backend on port 8000 is active, evaluates exact NURBS B-Rep operations via NVIDIA `usd_brep` (`SMLib` / `_omni_solid`).
   - If in browser / cloud preview mode or on platforms without `usd_brep` C++ wheels (e.g. macOS ARM64), smoothly falls back to the client-side Three.js geometric synthesizer without 404/500 errors.
4. **Self-Healing Loop**:
   - Up to 3 iterations in `geminiAgent.ts` executing `executeCadScript` against generated code.
   - Catches `SM_ERR_*` exceptions and `sanity_warnings`, feeding structured error reports back into Gemini.

## Commands Reference

```bash
# Frontend & Express Hybrid Server (Port 3000)
npm run dev

# Run Vitest Frontend & Synthesizer Tests
npm test

# Run Production Build
npm run build

# Type Check
npm run lint

# Python Backend Virtualenv Setup
uv venv .venv-usd-brep --python 3.12
uv pip install fastapi uvicorn pydantic numpy pytest httpx --python .venv-usd-brep/bin/python

# Run Python Backend (Port 8000)
npm run backend

# Run Backend Pytest Suite
.venv-usd-brep/bin/pytest backend/test_cad_engine.py -v
```

## Critical APIs and Routing

- `GET /api/health`: Probes Python port 8000 and reports accurate `usd_brep_available`.
- `GET /api/presets`: Serves curated parametric B-Rep presets.
- `POST /api/execute`: Proxies execution requests to Python backend or returns 503 fallback signal for client-side evaluation.
- `POST /api/agent/turn`: Handles multi-harness CAD synthesis, maps `gemini-3.8-flash` to `gemini-2.5-flash` API endpoint, and routes `ollama-local` to localhost:11434.
- `GET /api/guides`: Discovers all 36 NVIDIA `usd-brep` docs and stubs in `docs/nvidia-usd-brep/`.
