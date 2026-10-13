# Dynamic Hugging Face Hub Integration with Cognitive Architecture Filtering & Hardware Profiling

A universal, unconstrained connection to the Hugging Face Hub allowing engineers to search, inspect, and select any model across the open-source ecosystem—including uncensored/abliterated weights, deep reasoning models, and spatial world models—with real-time resource profiling and in-app CAD/EDA toolset execution.

---

### User Confirmed Decisions & Architectural Directives

> [!IMPORTANT]
> The implementation incorporates the user's explicit answers and requirements:
> - **Direct Hugging Face Hub Connection**: Dynamic live search directly querying the Hugging Face API (`https://huggingface.co/api/models`), plus support for manual repo ID entry (e.g., `failspy/Meta-Llama-3-8B-Instruct-abliterated-v3`, `cognitivecomputations/dolphin-2.9.2-qwen2-72b`, `facebook/ijepa`, `deepseek-ai/DeepSeek-R1`).
> - **Hugging Face Token Support**: Persistent local storage of user HF tokens (`hf_...`) for authenticated access to gated repos, private models, and higher API rate limits.
> - **Cognitive Architecture Filter Presets**:
>   1. **System 2 Deep Reasoning & Chain of Thought**: Tag/keyword filters for step-by-step thinking models (R1, QwQ, Marco-o1, Sky-T1, reasoning).
>   2. **System 1 Fast Intuitive Reflex**: Ultra-low latency, instant generation models under 3B/7B (SmolLM, Llama-3.2-1B/3B, Qwen-2.5-0.5B/1.5B).
>   3. **Abliterated & Uncensored Open Weights**: Unaligned, refusal-removed, and bypass models (Dolphin, Abliterated, Tess, Nous Hermes DPO).
>   4. **JEPA & World Model Spatial Embeddings**: Latent predictive, joint-embedding predictive architecture, and 3D spatial models (I-JEPA, V-JEPA, world-models, spatial encoders).
> - **Hermes-Style Resource Profiler**: Dynamic comparison of model requirements (RAM, VRAM, quantization overhead) against detected system resources (`navigator.hardwareConcurrency`, `navigator.deviceMemory`, WebGPU adapter) with immediate Fit status (`Optimal Fit`, `Partial Offload`, `OOM Risk`).
> - **In-App Toolsets & Skills Guarantee**: Tool execution (NVIDIA B-Rep NURBS, Mass/Physics, Kinematics, EDA Silicon Placer) remains 100% inside the app environment regardless of the model chosen.

---

### 1. Proposed Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                            │
│  - Quick Model Selector in Header (Harness + Active Model)             │
│  - Full AI Harness & HF Hub Configurator Modal                         │
│    ├─ Live Search Bar (Debounced HF API Query or Direct Repo ID)       │
│    ├─ Cognitive Architecture Filter Dropdown (System 1/2, Abliterated) │
│    ├─ HF Access Token Input (Secure localStorage)                      │
│    └─ Quantization Selector (FP16, Q8_0, Q4_K_M, INT4)                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Hugging Face Hub Live Service (hfHubService.ts)            │
│  - Queries https://huggingface.co/api/models?search=...&filter=...     │
│  - Fetches model metadata (safetensors size, model_type, downloads)    │
│  - Direct Repo ID validator and config parser                          │
│  - Persists & attaches Bearer tokens when provided                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│           Hermes-Style Hardware Resource Engine (cad.ts)               │
│  - Hardware Detection: CPU cores, RAM, WebGPU device & VRAM            │
│  - Parameter & Memory Estimator: Calculates weights + KV cache         │
│  - Generates ResourceFit: 'optimal' | 'tight' | 'oom'                  │
│  - Live Throughput Prediction (Tokens/sec)                             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│            Agnostic Agent Dispatcher & In-App Tool Execution           │
│  - Translates agent output to In-App CAD/EDA Tool Calls                │
│  - Supports Nous Hermes XML tool_call format, Pi Agent streaming,      │
│    and direct WebGPU/Ollama/vLLM/HF Inference endpoints               │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. User Experience & Component Design

#### A. AI Model & Harness Modal Upgrades (`AiHarnessModal.tsx`)
1. **Live Hugging Face Search & Direct Repo Input**:
   - Live search input querying the Hugging Face Hub API in real time.
   - Dedicated "Direct Repo ID" quick-load button: Engineers can paste any HF model ID (e.g. `author/model-name`) or URL and click **Load Model** to fetch config and calculate specs immediately.
   - "Custom HF Access Token" field with eye toggle, status indicator, and local storage retention.
2. **Cognitive Architecture Preset Filter**:
   - Seamless dropdown selector with badges:
     - `All / Unrestricted`: Universal search across all 1M+ Hugging Face models.
     - `System 2 Deep Reasoning & CoT`: Filters for reasoning tags, chain-of-thought, and distillation models.
     - `System 1 Fast Intuitive Reflex`: Filters for instant sub-3B/7B fast-reflex models.
     - `Abliterated & Uncensored Open Weights`: Filters for `abliterated`, `uncensored`, `dolphin`, `hermes`, and open-weight variants without guardrails.
     - `JEPA & World Model Spatial Embeddings`: Filters for joint-embedding architectures, visual-spatial representations, and 3D geometric world models.
3. **Hermes Hardware Comparison Dashboard**:
   - Visual RAM & VRAM gauge bar showing model footprint vs. available memory.
   - Compatibility status banner:
     - **Optimal Fit** (Green): Fits fully in VRAM with high throughput (>35 tok/sec).
     - **Partial Offload** (Amber): Fits in system RAM with CPU/GPU offload (~10-20 tok/sec).
     - **OOM Warning** (Red): Exceeds available memory; recommends 4-bit quantization or smaller variant.
   - Hardware calibration sliders allowing users to manually adjust detected RAM, VRAM, and context window length (2K to 32K).

#### B. Header & Control Bar Dropdown (`App.tsx`)
- Combined model and harness dropdown:
  - Groups: *Agent Harnesses (Hermes, Pi, LangChain, ROCm)*, *Cognitive & Reasoning Models*, *Hugging Face Hub (Custom & Active)*.
  - Quick-action button: **HF Hub Connect & Explore** opening the search and resource profiler.
  - Active model pill displays model name, quantization (e.g. `Q4_K_M`), and fit indicator.

---

### 3. Implementation Steps

1. **Hugging Face Hub Service (`src/services/hfHubService.ts`)**:
   - Implement `searchHuggingFaceModels(query, filterMode, token, limit)` connecting to `https://huggingface.co/api/models`.
   - Implement `fetchModelDetails(repoId, token)` fetching `model_type`, `safetensors` size, tags, and license.
   - Implement token management (`getStoredHfToken()`, `setStoredHfToken(token)`).
   - Implement parameter estimation heuristics from repo metadata and model architecture.

2. **Types & Hardware Profiler Enhancements (`src/types/cad.ts` & `src/services/appToolsAndSkills.ts`)**:
   - Add `CognitiveFilterMode` type: `'all' | 'system2-reasoning' | 'system1-reflex' | 'abliterated-uncensored' | 'jepa-world-model'`.
   - Update `calculateResourceEstimate()` to dynamically handle arbitrary model parameter counts (from 100M to 120B+) and custom context lengths.
   - Add preset models representing each cognitive category for instant offline fallback.

3. **AiHarnessModal Refinement (`src/components/AiHarnessModal.tsx`)**:
   - Integrate live query fetching with debouncing (350ms) and loading spinner.
   - Add manual repository input field ("Load any Hugging Face repo ID").
   - Add cognitive filter selector pills/dropdown.
   - Render model cards with download stats, likes, tags (e.g., `reasoning`, `abliterated`, `vision`), memory requirement badge, and one-click "Select Model & Test Fit".

4. **Agent Integration & Toolsets Invariance (`server.ts` & `src/services/geminiAgent.ts`)**:
   - Ensure dynamic HF model selections pass correctly into the agent executor.
   - Verify all CAD and EDA in-app tool calling functions run with full fidelity regardless of model selected.

5. **Verification & Build**:
   - Run TypeScript verification, compile applet, and verify zero regressions in CAD 3D viewport, synthesis, and placement.
