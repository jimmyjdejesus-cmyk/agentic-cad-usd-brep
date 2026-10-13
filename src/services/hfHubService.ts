import { HuggingFaceModel, CognitiveFilterMode, HarnessTypeId } from '../types/cad';

const HF_API_BASE = 'https://huggingface.co/api/models';
const HF_TOKEN_STORAGE_KEY = 'openflow_hf_access_token';

export function getStoredHfToken(): string {
  try {
    return localStorage.getItem(HF_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredHfToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(HF_TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(HF_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Heuristic parameter size extractor from repository name or tags.
 * e.g., 'failspy/Meta-Llama-3-8B-Instruct-abliterated-v3' -> 8
 * e.g., 'Qwen/Qwen2.5-Coder-1.5B' -> 1.5
 * e.g., 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO' -> 47
 * e.g., 'facebook/ijepa' -> 0.6
 */
export function estimateParamsFromNameOrTags(nameOrId: string, tags: string[] = []): number {
  const lower = nameOrId.toLowerCase();
  
  // MoE notation like 8x7b
  const moeMatch = lower.match(/(\d+)x(\d+)(?:\.\d+)?b/);
  if (moeMatch) {
    const experts = parseInt(moeMatch[1], 10);
    const size = parseInt(moeMatch[2], 10);
    // Usually total active or total parameters
    return experts * size;
  }

  // Decimal B like 1.5b, 0.5b, 3.2b, 7b, 70b, 405b
  const bMatch = lower.match(/(\d+(?:\.\d+)?)\s*b\b/);
  if (bMatch) {
    return parseFloat(bMatch[1]);
  }

  // Millions notation e.g., 135m, 350m, 500m
  const mMatch = lower.match(/(\d+(?:\.\d+)?)\s*m\b/);
  if (mMatch) {
    return parseFloat(mMatch[1]) / 1000;
  }

  // Search tags
  for (const tag of tags) {
    const tLower = tag.toLowerCase();
    const tagBMatch = tLower.match(/(\d+(?:\.\d+)?)\s*b\b/);
    if (tagBMatch) {
      return parseFloat(tagBMatch[1]);
    }
  }

  if (lower.includes('ijepa') || lower.includes('vjepa') || lower.includes('jepa')) {
    return 0.6; // standard ViT-H/14 is ~632M params
  }

  // Default assumption for modern instruction models
  return 7.0;
}

/**
 * Heuristic context window extractor
 */
export function estimateContextWindowFromNameOrTags(nameOrId: string, tags: string[] = []): number {
  const lower = nameOrId.toLowerCase();
  if (lower.includes('128k') || lower.includes('131k')) return 131072;
  if (lower.includes('64k')) return 65536;
  if (lower.includes('32k')) return 32768;
  if (lower.includes('16k')) return 16384;
  if (lower.includes('8k')) return 8192;
  if (lower.includes('qwen') || lower.includes('llama-3') || lower.includes('deepseek')) return 32768;
  return 8192;
}

/**
 * Recommend best in-app harness based on model identity
 */
export function pickRecommendedHarness(repoId: string, tags: string[] = []): HarnessTypeId {
  const lower = repoId.toLowerCase();
  if (lower.includes('hermes') || lower.includes('nous')) return 'hermes-agent';
  if (lower.includes('pi') || lower.includes('inflection')) return 'pi-agent';
  if (lower.includes('coder') || lower.includes('openhands') || lower.includes('swe')) return 'openhands-agent';
  if (lower.includes('gguf') || lower.includes('ollama')) return 'ollama-local';
  if (lower.includes('onnx') || lower.includes('webgpu') || lower.includes('transformers.js')) return 'huggingface-webgpu';
  return 'hermes-agent';
}

/**
 * Cognitive preset filters mapping to search terms or tags
 */
export const COGNITIVE_PRESET_OPTIONS: {
  id: CognitiveFilterMode;
  label: string;
  badge: string;
  color: string;
  description: string;
  defaultQuery: string;
}[] = [
  {
    id: 'all',
    label: 'All Models (Live HF Hub)',
    badge: 'Unrestricted',
    color: 'sky',
    description: 'Direct query against entire Hugging Face Hub (1M+ open-weight repositories).',
    defaultQuery: '',
  },
  {
    id: 'system2-reasoning',
    label: 'System 2: Deep Reasoning & CoT',
    badge: 'Step-by-Step CoT',
    color: 'emerald',
    description: 'Chain-of-thought, distilled mathematical & physical reasoning (DeepSeek-R1, QwQ, Marco-o1).',
    defaultQuery: 'deepseek-r1 reasoning',
  },
  {
    id: 'system1-reflex',
    label: 'System 1: Fast Intuitive Reflex',
    badge: 'Ultra-Low Latency',
    color: 'amber',
    description: 'Instant reflex & continuous viewport streaming under 3B/7B (SmolLM2, Llama-3.2, Qwen-2.5-1.5B).',
    defaultQuery: 'smollm fast instruct',
  },
  {
    id: 'abliterated-uncensored',
    label: 'Abliterated & Uncensored Open Weights',
    badge: 'Uncensored / Refusal-Free',
    color: 'purple',
    description: 'Uncensored, orthogonalized refusal-free weights (Abliterated Llama, Dolphin, Tess, Hermes).',
    defaultQuery: 'abliterated uncensored',
  },
  {
    id: 'jepa-world-model',
    label: 'JEPA & World Model Spatial Embeddings',
    badge: '3D & Spatial Latents',
    color: 'rose',
    description: 'Joint-Embedding Predictive Architecture (I-JEPA, V-JEPA) & 3D geometric world representations.',
    defaultQuery: 'jepa world model 3d',
  },
];

/**
 * Offline & fallback models when network is unavailable
 */
export const COGNITIVE_FALLBACK_MODELS: Record<CognitiveFilterMode, HuggingFaceModel[]> = {
  all: [
    {
      id: 'NousResearch/Hermes-3-Llama-3.1-8B',
      name: 'Hermes 3 Llama-3.1 8B',
      author: 'NousResearch',
      paramsBillions: 8.0,
      contextWindow: 131072,
      architecture: 'LlamaForCausalLM',
      downloads: '1.2M',
      likes: 840,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['agent', 'function-calling', 'hermes', 'tool-use', 'system2'],
      description: 'Nous Research flagship open agent model with native tool-calling and internal scratchpad verification.',
    },
    {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      name: 'DeepSeek R1 Distill Qwen 7B',
      author: 'deepseek-ai',
      paramsBillions: 7.6,
      contextWindow: 32768,
      architecture: 'Qwen2ForCausalLM',
      downloads: '4.8M',
      likes: 2150,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['reasoning', 'system2', 'chain-of-thought', 'math'],
      description: 'System 2 chain-of-thought distillation with deep CAD geometrical reasoning traces.',
    },
    {
      id: 'failspy/Meta-Llama-3-8B-Instruct-abliterated-v3',
      name: 'Llama 3 8B Instruct Abliterated v3',
      author: 'failspy',
      paramsBillions: 8.0,
      contextWindow: 8192,
      architecture: 'LlamaForCausalLM',
      downloads: '380K',
      likes: 490,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['abliterated', 'uncensored', 'refusal-free', 'open-weights'],
      description: 'Fully abliterated open weights via representation engineering to eliminate refusal vectors for unrestricted CAD & EDA scripts.',
    },
    {
      id: 'facebook/ijepa',
      name: 'I-JEPA ViT-Huge Spatial Latents',
      author: 'facebook',
      paramsBillions: 0.63,
      contextWindow: 4096,
      architecture: 'VisionTransformer',
      downloads: '85K',
      likes: 310,
      pipelineTag: 'feature-extraction',
      recommendedHarness: 'huggingface-webgpu',
      tags: ['jepa', 'world-model', 'spatial', 'embeddings'],
      description: 'Joint-Embedding Predictive Architecture learning non-generative abstract 3D spatial representations of object assemblies.',
    },
    {
      id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
      name: 'SmolLM2 1.7B Instruct',
      author: 'HuggingFaceTB',
      paramsBillions: 1.7,
      contextWindow: 8192,
      architecture: 'LlamaForCausalLM',
      downloads: '920K',
      likes: 620,
      pipelineTag: 'text-generation',
      recommendedHarness: 'pi-agent',
      tags: ['system1', 'reflex', 'ultra-fast', 'webgpu'],
      description: 'Ultra-low latency System 1 reflex model ideal for live 60fps continuous CAD slider updates and fast heuristics.',
    },
  ],
  'system2-reasoning': [
    {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
      name: 'DeepSeek R1 Distill Qwen 7B',
      author: 'deepseek-ai',
      paramsBillions: 7.6,
      contextWindow: 32768,
      architecture: 'Qwen2ForCausalLM',
      downloads: '4.8M',
      likes: 2150,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['reasoning', 'system2', 'chain-of-thought'],
      description: 'System 2 chain-of-thought distillation with deep CAD geometrical reasoning traces.',
    },
    {
      id: 'Qwen/QwQ-32B-Preview',
      name: 'QwQ 32B Reasoning Preview',
      author: 'Qwen',
      paramsBillions: 32.5,
      contextWindow: 32768,
      architecture: 'Qwen2ForCausalLM',
      downloads: '1.1M',
      likes: 1820,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['reasoning', 'system2', 'cot'],
      description: 'Advanced reasoning model with deep self-reflection loops for complex multi-part kinematics and EDA placement.',
    },
    {
      id: 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B',
      name: 'DeepSeek R1 Distill Llama 8B',
      author: 'deepseek-ai',
      paramsBillions: 8.0,
      contextWindow: 131072,
      architecture: 'LlamaForCausalLM',
      downloads: '2.4M',
      likes: 1420,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['reasoning', 'deepseek-r1', 'chain-of-thought'],
      description: 'Llama 3.1 8B fine-tuned with DeepSeek R1 reasoning traces for engineering verification.',
    },
  ],
  'system1-reflex': [
    {
      id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',
      name: 'SmolLM2 1.7B Instruct',
      author: 'HuggingFaceTB',
      paramsBillions: 1.7,
      contextWindow: 8192,
      architecture: 'LlamaForCausalLM',
      downloads: '920K',
      likes: 620,
      pipelineTag: 'text-generation',
      recommendedHarness: 'pi-agent',
      tags: ['system1', 'reflex', 'ultra-fast', 'webgpu'],
      description: 'Ultra-low latency System 1 reflex model ideal for live 60fps continuous CAD slider updates and fast heuristics.',
    },
    {
      id: 'Qwen/Qwen2.5-Coder-1.5B-Instruct',
      name: 'Qwen 2.5 Coder 1.5B Instruct',
      author: 'Qwen',
      paramsBillions: 1.54,
      contextWindow: 32768,
      architecture: 'Qwen2ForCausalLM',
      downloads: '850K',
      likes: 510,
      pipelineTag: 'text-generation',
      recommendedHarness: 'pi-agent',
      tags: ['system1', 'fast', 'coder', 'webgpu'],
      description: 'Lightweight coding model offering instant response times and sub-100ms CAD code patch completion.',
    },
    {
      id: 'meta-llama/Llama-3.2-1B-Instruct',
      name: 'Llama 3.2 1B Instruct',
      author: 'meta-llama',
      paramsBillions: 1.23,
      contextWindow: 131072,
      architecture: 'LlamaForCausalLM',
      downloads: '3.1M',
      likes: 1240,
      pipelineTag: 'text-generation',
      recommendedHarness: 'pi-agent',
      tags: ['system1', 'reflex', 'on-device'],
      description: 'Extremely lightweight 1B model running natively in WebGPU or local CPU threads with zero latency.',
    },
  ],
  'abliterated-uncensored': [
    {
      id: 'failspy/Meta-Llama-3-8B-Instruct-abliterated-v3',
      name: 'Llama 3 8B Instruct Abliterated v3',
      author: 'failspy',
      paramsBillions: 8.0,
      contextWindow: 8192,
      architecture: 'LlamaForCausalLM',
      downloads: '380K',
      likes: 490,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['abliterated', 'uncensored', 'refusal-free', 'open-weights'],
      description: 'Representation engineering removes refusal vectors, enabling uncensored technical generation for hardware, EDA, and CAD.',
    },
    {
      id: 'cognitivecomputations/dolphin-2.9.2-qwen2-72b',
      name: 'Dolphin 2.9.2 Qwen2 72B',
      author: 'cognitivecomputations',
      paramsBillions: 72.0,
      contextWindow: 32768,
      architecture: 'Qwen2ForCausalLM',
      downloads: '140K',
      likes: 380,
      pipelineTag: 'text-generation',
      recommendedHarness: 'openhands-agent',
      tags: ['uncensored', 'dolphin', 'open-weights', 'agent'],
      description: 'Dolphin uncensored instruction tuning on Qwen2 with full alignment freedom and multi-step tool execution.',
    },
    {
      id: 'migtissera/Tess-v2.5-Mistral-7B',
      name: 'Tess v2.5 Mistral 7B',
      author: 'migtissera',
      paramsBillions: 7.24,
      contextWindow: 32768,
      architecture: 'MistralForCausalLM',
      downloads: '95K',
      likes: 210,
      pipelineTag: 'text-generation',
      recommendedHarness: 'hermes-agent',
      tags: ['uncensored', 'tess', 'open-weights'],
      description: 'Fully unaligned open model built for deep technical domain tasks without corporate refusals or preachy caveats.',
    },
  ],
  'jepa-world-model': [
    {
      id: 'facebook/ijepa',
      name: 'I-JEPA ViT-Huge Spatial Latents',
      author: 'facebook',
      paramsBillions: 0.63,
      contextWindow: 4096,
      architecture: 'VisionTransformer',
      downloads: '85K',
      likes: 310,
      pipelineTag: 'feature-extraction',
      recommendedHarness: 'huggingface-webgpu',
      tags: ['jepa', 'world-model', 'spatial', 'embeddings'],
      description: 'Joint-Embedding Predictive Architecture learning non-generative abstract 3D spatial representations of object assemblies.',
    },
    {
      id: 'facebook/vjepa',
      name: 'V-JEPA Video & Kinematic World Model',
      author: 'facebook',
      paramsBillions: 1.1,
      contextWindow: 4096,
      architecture: 'VisionTransformer',
      downloads: '62K',
      likes: 280,
      pipelineTag: 'video-classification',
      recommendedHarness: 'huggingface-webgpu',
      tags: ['jepa', 'world-model', 'kinematics', 'physics'],
      description: 'Self-supervised spatial world model predicting kinematic transitions and physical mechanical transformations.',
    },
    {
      id: 'openai/shap-e',
      name: 'Shap-E 3D Implicit Latent Field',
      author: 'openai',
      paramsBillions: 0.85,
      contextWindow: 2048,
      architecture: 'Diffusion3D',
      downloads: '420K',
      likes: 910,
      pipelineTag: 'text-to-3d',
      recommendedHarness: 'huggingface-webgpu',
      tags: ['world-model', '3d', 'spatial-embeddings', 'nerf'],
      description: 'Learned spatial latent embeddings representing continuous 3D implicit neural representations and manifold surfaces.',
    },
  ],
};

/**
 * Live search against the Hugging Face Hub API
 */
export async function searchHuggingFaceModels(
  query: string,
  filterMode: CognitiveFilterMode = 'all',
  token?: string,
  limit = 20
): Promise<HuggingFaceModel[]> {
  const customToken = token || getStoredHfToken();
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (customToken) {
    headers['Authorization'] = `Bearer ${customToken}`;
  }

  // Build search query based on cognitive preset + user term
  let effectiveSearch = query.trim();
  if (filterMode !== 'all') {
    const preset = COGNITIVE_PRESET_OPTIONS.find((p) => p.id === filterMode);
    if (preset && !effectiveSearch) {
      effectiveSearch = preset.defaultQuery;
    } else if (preset && effectiveSearch) {
      // Append tag hints to refine the live query
      if (filterMode === 'system2-reasoning' && !effectiveSearch.toLowerCase().includes('reason')) {
        effectiveSearch = `${effectiveSearch} reasoning`;
      } else if (filterMode === 'abliterated-uncensored' && !effectiveSearch.toLowerCase().includes('uncensored') && !effectiveSearch.toLowerCase().includes('abliterated')) {
        effectiveSearch = `${effectiveSearch} abliterated`;
      } else if (filterMode === 'jepa-world-model' && !effectiveSearch.toLowerCase().includes('jepa') && !effectiveSearch.toLowerCase().includes('3d')) {
        effectiveSearch = `${effectiveSearch} jepa`;
      }
    }
  }

  const url = new URL(HF_API_BASE);
  if (effectiveSearch) {
    url.searchParams.set('search', effectiveSearch);
  } else {
    // Default to popular text-generation / open models
    url.searchParams.set('pipeline_tag', 'text-generation');
    url.searchParams.set('sort', 'downloads');
    url.searchParams.set('direction', '-1');
  }
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('full', 'true');

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      console.warn(`Hugging Face API returned ${response.status}. Using cognitive preset fallbacks.`);
      return getFallbackForQuery(effectiveSearch, filterMode);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return getFallbackForQuery(effectiveSearch, filterMode);
    }

    return data.map((item: any) => {
      const id = item.id || item.modelId || '';
      const parts = id.split('/');
      const author = parts.length > 1 ? parts[0] : 'Community';
      const name = parts.length > 1 ? parts[1] : id;
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
      const downloadsCount = typeof item.downloads === 'number' ? formatCount(item.downloads) : 'N/A';
      const likesCount = typeof item.likes === 'number' ? item.likes : 0;
      const pipelineTag = item.pipeline_tag || (tags.includes('text-generation') ? 'text-generation' : 'feature-extraction');

      const paramsBillions = estimateParamsFromNameOrTags(id, tags);
      const contextWindow = estimateContextWindowFromNameOrTags(id, tags);
      const recommendedHarness = pickRecommendedHarness(id, tags);

      return {
        id,
        name: formatFriendlyModelName(name),
        author,
        paramsBillions,
        contextWindow,
        architecture: item.config?.model_type || 'AutoModelForCausalLM',
        downloads: downloadsCount,
        likes: likesCount,
        pipelineTag,
        recommendedHarness,
        tags: tags.slice(0, 8),
        description: item.description || `Hugging Face model ${id} (${paramsBillions}B params, ${pipelineTag}).`,
        isCustom: true,
      };
    });
  } catch (err) {
    console.warn('Network issue fetching from Hugging Face Hub, returning cached cognitive presets:', err);
    return getFallbackForQuery(effectiveSearch, filterMode);
  }
}

/**
 * Fetch a specific arbitrary repo ID directly from Hugging Face
 * e.g., 'failspy/Meta-Llama-3-8B-Instruct-abliterated-v3'
 */
export async function fetchModelFromHfHub(
  repoId: string,
  token?: string
): Promise<HuggingFaceModel> {
  const cleanId = repoId.trim().replace(/^https?:\/\/huggingface\.co\//, '');
  const customToken = token || getStoredHfToken();
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (customToken) {
    headers['Authorization'] = `Bearer ${customToken}`;
  }

  try {
    const response = await fetch(`${HF_API_BASE}/${cleanId}`, {
      method: 'GET',
      headers,
    });

    if (response.ok) {
      const item = await response.json();
      const parts = cleanId.split('/');
      const author = parts.length > 1 ? parts[0] : 'Community';
      const name = parts.length > 1 ? parts[1] : cleanId;
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
      const paramsBillions = estimateParamsFromNameOrTags(cleanId, tags);
      const contextWindow = estimateContextWindowFromNameOrTags(cleanId, tags);

      return {
        id: cleanId,
        name: formatFriendlyModelName(name),
        author,
        paramsBillions,
        contextWindow,
        architecture: item.config?.model_type || 'AutoModel',
        downloads: typeof item.downloads === 'number' ? formatCount(item.downloads) : 'N/A',
        likes: typeof item.likes === 'number' ? item.likes : 0,
        pipelineTag: item.pipeline_tag || 'text-generation',
        recommendedHarness: pickRecommendedHarness(cleanId, tags),
        tags: tags.slice(0, 8),
        description: item.description || `Hugging Face Hub repository ${cleanId}`,
        isCustom: true,
      };
    }
  } catch (err) {
    console.warn(`Could not fetch details for ${cleanId} from Hugging Face API, constructing synthesized model:`, err);
  }

  // Synthesize directly if API is blocked or model is offline
  const parts = cleanId.split('/');
  const author = parts.length > 1 ? parts[0] : 'Community';
  const name = parts.length > 1 ? parts[1] : cleanId;
  const paramsBillions = estimateParamsFromNameOrTags(cleanId);
  const contextWindow = estimateContextWindowFromNameOrTags(cleanId);

  return {
    id: cleanId,
    name: formatFriendlyModelName(name),
    author,
    paramsBillions,
    contextWindow,
    architecture: 'AutoModelForCausalLM',
    downloads: 'Custom Direct Load',
    likes: 1,
    pipelineTag: 'text-generation',
    recommendedHarness: pickRecommendedHarness(cleanId),
    tags: ['custom-hf', 'direct-load', 'open-weights'],
    description: `Direct Hugging Face repository ${cleanId} loaded on demand.`,
    isCustom: true,
  };
}

function getFallbackForQuery(query: string, filterMode: CognitiveFilterMode): HuggingFaceModel[] {
  const list = COGNITIVE_FALLBACK_MODELS[filterMode] || COGNITIVE_FALLBACK_MODELS.all;
  if (!query) return list;
  const qLower = query.toLowerCase();
  const filtered = list.filter(
    (m) =>
      m.name.toLowerCase().includes(qLower) ||
      m.id.toLowerCase().includes(qLower) ||
      m.tags.some((t) => t.toLowerCase().includes(qLower))
  );
  return filtered.length > 0 ? filtered : list;
}

function formatCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

function formatFriendlyModelName(rawName: string): string {
  return rawName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
