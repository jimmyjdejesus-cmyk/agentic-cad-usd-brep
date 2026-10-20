---
name: model-agnostic-cad-intelligence
description: Configure, test, and maintain model-agnostic AI harnesses (Ollama, vLLM, LM Studio, Groq, Together, Gemini), Hugging Face Hub live search, Hermes hardware-gated OOM prevention, and autonomous parametric B-Rep CAD synthesis and self-healing.
---

# Model-Agnostic CAD Intelligence & Hardware Gate Playbook

## Overview
This skill guides developers and autonomous agents in configuring, extending, and testing:
1. **Model-Agnostic AI Router (`server.ts`)**: Routes agentic CAD turns to Google Gemini, local Ollama sockets, OpenAI-compatible APIs (LM Studio, vLLM, Groq, Together AI), or Hugging Face Inference API.
2. **True-to-System Hardware Gating (`src/services/appToolsAndSkills.ts`)**: Evaluates model parameter count, quantization, KV cache, and 1.5 GB Three.js/Manifold CAD viewport reservation to block system freeze and OOM crashes before model activation.
3. **Autonomous Parametric B-Rep Intelligence (`src/services/parametricIntelligence.ts`)**: Replaces brittle static keyword lookup with semantic intent decomposition (dimensional scaling, hole boring, additive features, rotation, translation, part deletion) and AST surgery on `usd_brep` (`sm.*`) Python scripts, plus deterministic self-healing auto-repair.

---

## 1. Agnostic Provider Configuration

### Environment Variables (`.env`)
```bash
# Gemini Cloud
GEMINI_API_KEY=your_gemini_key

# Agnostic OpenAI-Compatible Providers (Groq, Together, vLLM, LM Studio)
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your_key

# Hugging Face Hub
HF_API_TOKEN=hf_your_token
```

### Local Inference Quick Endpoints
- **Ollama**: `http://localhost:11434/v1` (CLI: `ollama run qwen2.5-coder:7b`)
- **LM Studio**: `http://localhost:1234/v1`
- **vLLM**: `http://localhost:8000/v1`
- **Groq Cloud**: `https://api.groq.com/openai/v1`

---

## 2. Hardware Gating Verification (`canRunOnSystem`)

Whenever testing a new local open-weights model from Hugging Face Hub:
1. Model parameters (B) and quantization (`Q4_K_M`, `Q8_0`, `FP16`) are converted into total memory footprint.
2. A hard reservation of **1.5 GB RAM** is deducted for the browser's active Three.js WebGL canvas and Manifold WASM kernel.
3. If memory utilization exceeds 95% or estimated throughput drops below 4 tokens/sec, `canRunOnSystem` triggers the Hardware Gate overlay in `AiHarnessModal`.

### Testing Hardware Gate Logic
```bash
npx vitest run src/services/appToolsAndSkills.test.ts
```

---

## 3. Parametric CAD Intelligence & Self-Healing

The parametric engine parses natural language editing prompts into structured geometric intent:
- **Dimensions**: "make cylinder 5cm taller", "increase base width by 4cm" -> locates target primitive in AST and adjusts extents while keeping ground clearance `z >= 0`.
- **Holes/Pockets**: "bore 3mm hole through top flange" -> generates cutter cylinder and applies `sm.boolean_difference()`.
- **Additions**: "add bracket on right side" -> instantiates new B-Rep body and registers in `build_parts()`.
- **Rotations/Translations**: "rotate spindle 45 deg around Z" -> generates `sm.rotate()` or `sm.translate()`.
- **Self-Healing Auto-Repair**: `attemptAutoRepair(code, execResult)` detects non-manifold bodies or bounding box penetrations, shifts offsets by +0.2 cm clearance, and re-executes automatically.

### Testing Parametric Engine & Agent Turn
```bash
npx vitest run src/services/parametricIntelligence.test.ts src/services/geminiAgent.test.ts
```

---

## 4. Full Quality Assurance Checklist
Run before committing any agent changes:
```bash
# 1. Type check
npm run lint

# 2. Complete test suite
npm test

# 3. Production build
npm run build
```
