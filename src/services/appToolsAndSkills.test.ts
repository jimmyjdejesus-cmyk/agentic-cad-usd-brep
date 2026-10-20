import { describe, expect, it } from 'vitest';
import {
  detectSystemHardwareResources,
  calculateModelResourceFootprint,
  canRunOnSystem,
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

  it('correctly maps AMD ROCm / HIP acceleration when hasRocm is true', () => {
    const mockRocmRig: SystemHardwareResources = {
      systemRamGb: 64,
      gpuVramGb: 24,
      cpuCores: 16,
      hasWebGpu: false,
      gpuAdapterName: 'AMD Radeon RX 7900 XTX',
      osPlatform: 'Linux',
      deviceType: 'Workstation',
      isAppleSilicon: false,
      hasRocm: true,
    };

    const estimate = calculateModelResourceFootprint(14.0, 'Q4_K_M', mockRocmRig, true);
    expect(estimate.runtimeNeeded).toContain('AMD ROCm');
    expect(estimate.offloadStrategy).toBe('100% GPU / Unified Memory');
  });

  it('performs multi-word tokenized query matching in fallback models', async () => {
    // Search with two separated tokens 'qwen coder'
    const models = await searchHuggingFaceModels('qwen coder', 'all');
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(models.some((m) => m.name.toLowerCase().includes('qwen'))).toBe(true);
  });

  it('safely handles empty or missing id in getOllamaCommandForModel', () => {
    expect(getOllamaCommandForModel('')).toBe('');
  });

  describe('canRunOnSystem Hardware Gate & OOM Protection', () => {
    const baseline16GbRig: SystemHardwareResources = {
      systemRamGb: 16,
      gpuVramGb: 16,
      cpuCores: 8,
      hasWebGpu: true,
      gpuAdapterName: 'Apple M2 Pro',
      osPlatform: 'macOS',
      deviceType: 'Apple Silicon Mac (Unified Memory)',
      isAppleSilicon: true,
      hasMetal: true,
    };

    it('approves a 7B model on a 16GB rig with healthy margins', () => {
      const result = canRunOnSystem(7.61, 'Q4_K_M', baseline16GbRig, true);
      expect(result.allowed).toBe(true);
      expect(result.estimate.totalRequiredRamGb).toBeLessThan(8);
      expect(result.requiresConfirmation).toBeFalsy();
    });

    it('blocks a 70B model on an 8GB laptop to prevent system freeze', () => {
      const modest8GbRig: SystemHardwareResources = {
        systemRamGb: 8,
        gpuVramGb: 2,
        cpuCores: 4,
        hasWebGpu: false,
        gpuAdapterName: 'Integrated Graphics',
        osPlatform: 'Windows',
        deviceType: 'Laptop / Mobile',
        isAppleSilicon: false,
      };

      const result = canRunOnSystem(70.0, 'Q4_K_M', modest8GbRig, true);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Out-Of-Memory Risk');
      expect(result.estimate.fitStatus).toBe('oom-risk');
    });

    it('enforces 1.5 GB reservation for WebGL & Manifold CAD viewport', () => {
      // Rig has 8 GB total RAM
      const tightRig: SystemHardwareResources = {
        systemRamGb: 8,
        gpuVramGb: 8,
        cpuCores: 4,
        hasWebGpu: true,
        gpuAdapterName: 'M1',
        osPlatform: 'macOS',
        deviceType: 'Apple Silicon Mac (Unified Memory)',
        isAppleSilicon: true,
        hasMetal: true,
      };

      // A 14B model requires ~9.5 GB, exceeding the 8 GB capacity
      const result = canRunOnSystem(14.0, 'Q4_K_M', tightRig, true);
      expect(result.allowed).toBe(false);
    });
  });
});
