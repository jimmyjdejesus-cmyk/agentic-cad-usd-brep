import { describe, expect, it } from 'vitest';
import {
  detectSystemHardwareResources,
  calculateModelResourceFootprint,
} from './appToolsAndSkills';
import {
  getOllamaCommandForModel,
  searchHuggingFaceModels,
  COGNITIVE_FALLBACK_MODELS,
} from './hfHubService';
import { SystemHardwareResources } from '../types/cad';

describe('Hermes Hardware & Resource Estimator Service', () => {
  it('detects system hardware resources with sensible baseline values', () => {
    // Execute synchronous hardware detection
    const resources = detectSystemHardwareResources();

    // Verify key hardware telemetry attributes are present
    expect(resources.systemRamGb).toBeGreaterThanOrEqual(8);
    expect(resources.gpuVramGb).toBeGreaterThanOrEqual(4);
    expect(resources.cpuCores).toBeGreaterThanOrEqual(2);
    expect(resources.osPlatform).toBeDefined();
    expect(resources.deviceType).toBeDefined();
  });

  it('accurately calculates Hermes resource footprint for a 7B model on a 16GB machine', () => {
    // Simulate an Apple Silicon M1 machine with 16GB Unified Memory
    const mockRig: SystemHardwareResources = {
      systemRamGb: 16,
      gpuVramGb: 16,
      cpuCores: 8,
      hasWebGpu: true,
      gpuAdapterName: 'Apple M1',
      osPlatform: 'macOS (Apple Silicon)',
      deviceType: 'Apple Silicon Mac (Unified Memory)',
      isAppleSilicon: true,
      hasMetal: true,
    };

    // Calculate footprint for Qwen 2.5 Coder 7B at Q4_K_M quantization
    const estimate = calculateModelResourceFootprint(7.61, 'Q4_K_M', mockRig, true);

    // Weights (~4.4 GB) + KV cache (~0.8 GB) + overhead (~0.45 GB) = ~5.7 GB
    expect(estimate.totalRequiredRamGb).toBeGreaterThan(4.5);
    expect(estimate.totalRequiredRamGb).toBeLessThan(7.5);
    expect(estimate.fitStatus).toBe('optimal');
    expect(estimate.runtimeCategory).toBe('Ollama / Local Socket');
    expect(estimate.offloadStrategy).toBe('100% GPU / Unified Memory');
    expect(estimate.runtimeNeeded).toContain('Metal Unified Memory');
  });

  it('identifies OOM risk when model size exceeds rig memory', () => {
    // Simulate a modest 8GB laptop without discrete GPU
    const mockRig: SystemHardwareResources = {
      systemRamGb: 8,
      gpuVramGb: 4,
      cpuCores: 4,
      hasWebGpu: false,
      gpuAdapterName: 'Intel Iris Xe',
      osPlatform: 'Windows',
      deviceType: 'Laptop / Mobile',
      isAppleSilicon: false,
    };

    // Evaluate 70B parameter model requiring >40GB RAM
    const estimate = calculateModelResourceFootprint(70.0, 'Q4_K_M', mockRig, true);

    expect(estimate.fitStatus).toBe('oom-risk');
    expect(estimate.utilizationPercentage).toBeGreaterThan(100);
    expect(estimate.recommendation).toContain('High risk of out-of-memory crash');
  });

  it('generates exact Ollama CLI commands for curated local models', () => {
    // Hermes 3 8B
    expect(getOllamaCommandForModel('NousResearch/Hermes-3-Llama-3.1-8B-GGUF')).toBe(
      'ollama run hermes3:8b'
    );

    // Qwen 2.5 Coder 7B
    expect(getOllamaCommandForModel('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF')).toBe(
      'ollama run qwen2.5-coder:7b'
    );

    // DeepSeek R1 7B
    expect(getOllamaCommandForModel('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B-GGUF')).toBe(
      'ollama run deepseek-r1:7b'
    );

    // Llama 3.2 3B
    expect(getOllamaCommandForModel('meta-llama/Llama-3.2-3B-Instruct-GGUF')).toBe(
      'ollama run llama3.2:3b'
    );

    // Llama 3.2 1B
    expect(getOllamaCommandForModel('bartowski/Llama-3.2-1B-Instruct-GGUF')).toBe(
      'ollama run llama3.2:1b'
    );
  });

  it('returns curated local GGUF models when filterMode is local-gguf', async () => {
    // Query with local-gguf cognitive filter mode
    const models = await searchHuggingFaceModels('', 'local-gguf');

    expect(models.length).toBeGreaterThanOrEqual(4);
    // Ensure all returned models have valid ollamaCommand attached
    const withOllamaCmd = models.filter((m) => Boolean(m.ollamaCommand));
    expect(withOllamaCmd.length).toBeGreaterThanOrEqual(4);
    expect(COGNITIVE_FALLBACK_MODELS['local-gguf']).toBeDefined();
    expect(COGNITIVE_FALLBACK_MODELS['local-gguf'].length).toBeGreaterThanOrEqual(6);
  });
});
