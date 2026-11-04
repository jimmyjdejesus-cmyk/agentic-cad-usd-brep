# ApexCAD Studio — Model-Agnostic AI & Hardware Gating Guide

## 1. Multi-Provider Copilot Architecture

ApexCAD Studio is engineered with complete **AI Provider Independence**. While Google Gemini 3.8 Flash serves as the primary high-speed cloud orchestrator, the studio natively connects to local LLM engines, private OpenAI-compatible endpoints, and on-device WebGPU models.

All provider routing and configuration is managed through [`server.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/server.ts), [`src/services/geminiAgent.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/geminiAgent.ts), and the **AI Harness Modal** ([`src/components/AiHarnessModal.tsx`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/components/AiHarnessModal.tsx)).

---

## 2. Supported AI Providers & Presets

| Provider | Endpoint URL | Default Model | Authentication | Execution Mode |
|---|---|---|---|---|
| **Google Gemini** | `@google/genai` SDK | `gemini-3.8-flash` | `GEMINI_API_KEY` | Cloud (FastAPI / Express Server) |
| **Ollama** | `http://127.0.0.1:11434/v1` | `llama3.2:latest` | None required | Localhost Socket |
| **LM Studio** | `http://127.0.0.1:1234/v1` | `local-model` | None required | Localhost Socket |
| **vLLM** | `http://127.0.0.1:8000/v1` | `vllm-model` | Optional Bearer | Localhost / Remote Server |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `gsk_...` | High-Speed Cloud LPU |
| **Together AI** | `https://api.together.xyz/v1` | `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo` | API Key | Cloud Inference |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` | `sk-...` | Cloud Inference |
| **Hugging Face Hub** | Live Hub Search | GGUF Quantizations | Optional `HF_TOKEN` | Local Download & Execution |

---

## 3. Hardware-Gated Memory Protection (`canRunOnSystem`)

Located in [`src/services/appToolsAndSkills.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.ts).

### 3.1 The Problem: Host OOM Crashes
Running large 7B, 14B, or 70B parameter models alongside WebGL/Three.js 3D CAD viewports can exhaust system memory, causing OS kernel page thrashing, browser crashes, or WebGL context loss.

### 3.2 The Solution: True-to-System Memory Gating

ApexCAD Studio interrogates host hardware via `navigator.hardwareConcurrency`, `navigator.deviceMemory`, WebGPU adapter limits, and backend `/api/hardware/profile`.

Before allowing a local model to execute, `canRunOnSystem()` performs the following validation:

1. **CAD Viewport Memory Reservation**:
   - Reserving **1.5 GB of system RAM** exclusively for Three.js geometry buffers, WebAssembly `manifold-3d` CSG structures, and rendering textures:
   $$\text{Available CAD Headroom} = \text{Total System RAM} - 1.5\text{ GB}$$

2. **Quantized Footprint Estimation**:
   - Calculates exact memory needed for model weights plus context window buffers:
   $$\text{Model Footprint (GB)} = \frac{\text{Parameter Count (B)} \times \text{Bits per Weight}}{8 \times 10^9} + 1.25\text{ GB (Context Buffer)}$$

3. **Gating Criteria**:
   - If $\text{Model Footprint} > \text{Available CAD Headroom}$, the model is **Gated (Blocked)** to protect the system.
   - If host memory utilization exceeds **95%**, warning alerts are surfaced.
   - If estimated token generation throughput is below **4 tokens/second**, the UI advises selecting a smaller quantization (e.g., `Q4_K_M` instead of `FP16`).

---

## 4. Connection Probing (`testOnly` Mode)

To ensure that incorrect URLs or offline sockets do not produce cryptic failures during CAD synthesis, ApexCAD Studio features an active connection probe mode:

```bash
POST /api/agent/turn
{
  "provider": "ollama",
  "endpointUrl": "http://127.0.0.1:11434/v1",
  "modelName": "llama3.2",
  "testOnly": true
}
```

The server sends a lightweight test payload (`"Respond with OK"`, `max_tokens: 5`) and returns:
- `status: "verified"` if the endpoint responded with HTTP 200.
- `status: "failed"` with specific error details (e.g. `ECONNREFUSED 127.0.0.1:11434`, HTTP 404 model not found) if the endpoint is unreachable.

---

## 5. Hugging Face Hub Live Search

Users can search for any GGUF model directly within the CAD Studio UI:
- Queries the Hugging Face Hub API via backend proxy: `GET /api/huggingface/search?q={query}&limit=12`.
- Automatically parses file names to detect quantization tiers (`Q4_K_M`, `Q5_K_M`, `Q8_0`, `FP16`).
- Computes estimated download sizes and hardware compatibility scores on the fly.

---

## 6. Target-Scoped AST Code Surgery & Deterministic Offline Fallback

When operating without an active cloud LLM or when performing rapid micro-edits directly from viewport interactions:
- **`mutateDimensionInCode`**: Injects parametric dimension changes by locating the exact variable bound to `intent.targetPart` (e.g. `cyl_2 = sm.make_cylinder(...)`), eliminating cross-part side effects.
- **`injectBoreOrPocket`**: Automatically centers subtractive operations on the target part's computed bounding center $(c_x, c_y)$ across its full vertical span.
- **`applyCsgBooleanToScript`**: Parses multi-line formatted `return [...]` lists, dictionary remappings, and trailing commas without breaking Python syntax or assembly explosion animations.

---

## 7. Testing & Verification Suites

Model-agnostic routing, hardware gating, and offline AST surgery are validated across dedicated Vitest suites:
- [`src/server.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/server.test.ts) (16 tests): Validates multi-provider endpoints, `testOnly` connection probing, and Hugging Face Hub search proxying.
- [`src/services/appToolsAndSkills.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/appToolsAndSkills.test.ts) (27 tests): Validates Hermes hardware estimators, memory saturation gates, and agent tool registrations.
- [`src/services/geminiAgent.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/geminiAgent.test.ts) (10 tests): Validates model cascading, 3x self-healing prompt loops, and error injection.
- [`src/services/parametricIntelligence.test.ts`](file:///Users/jimmy/Documents/Repos/CAD-Agentic/src/services/parametricIntelligence.test.ts) (17 tests): Validates target-scoped AST surgery and auto-repair.
