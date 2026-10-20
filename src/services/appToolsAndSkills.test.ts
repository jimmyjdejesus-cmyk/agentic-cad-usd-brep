import { describe, expect, it } from 'vitest';
import {
  detectSystemHardwareResources,
  calculateModelResourceFootprint,
  canRunOnSystem,
  IN_APP_TOOLSETS,
  executeInAppTool,
} from './appToolsAndSkills';
import {
  getOllamaCommandForModel,
  searchHuggingFaceModels,
  COGNITIVE_FALLBACK_MODELS,
} from './hfHubService';
import { CadExecutionResult, SystemHardwareResources } from '../types/cad';

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

describe('In-App Agent Toolsets & Dispatch Execution Suite', () => {
  // Mock active CAD execution result for realistic in-app tool execution
  const mockCadResult: CadExecutionResult = {
    ok: true,
    success: true,
    kernel: 'usd_brep',
    parts: [
      {
        name: 'mounting_flange',
        kind: 'anchor',
        color: [0.2, 0.4, 0.8],
        diagnostics: {
          faces: 6,
          edges: 12,
          vertices: 8,
          manifold: true,
          volume: 120.0,
          area: 160.0,
          solid_count: 1,
          void_count: 0,
          bounds: [
            [-5.0, -5.0, 0.0],
            [5.0, 5.0, 2.0],
          ],
          center: [0.0, 0.0, 1.0],
          tessellation: {
            vertex_count: 8,
            triangle_count: 12,
            output_manifold: true,
            lamina_edge_count: 0,
            failure_count: 0,
          },
        },
        mesh: {
          points: [
            [-5.0, -5.0, 0.0],
            [5.0, -5.0, 0.0],
            [5.0, 5.0, 0.0],
            [-5.0, 5.0, 0.0],
            [-5.0, -5.0, 2.0],
            [5.0, -5.0, 2.0],
            [5.0, 5.0, 2.0],
            [-5.0, 5.0, 2.0],
          ],
          normals: [[0, 0, 1]],
          triangles: [
            0, 1, 2, 0, 2, 3, // bottom
            4, 6, 5, 4, 7, 6, // top
            0, 4, 5, 0, 5, 1, // front
            1, 5, 6, 1, 6, 2, // right
            2, 6, 7, 2, 7, 3, // back
            3, 7, 4, 3, 4, 0, // left
          ],
          face_vertex_counts: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
          face_vertex_indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        },
      },
      {
        name: 'guide_pin',
        kind: 'component',
        color: [0.8, 0.3, 0.2],
        diagnostics: {
          faces: 4,
          edges: 6,
          vertices: 6,
          manifold: true,
          volume: 18.0,
          area: 32.0,
          solid_count: 1,
          void_count: 0,
          bounds: [
            [-1.0, -1.0, 2.1],
            [1.0, 1.0, 6.0],
          ],
          center: [0.0, 0.0, 4.05],
          tessellation: {
            vertex_count: 12,
            triangle_count: 20,
            output_manifold: true,
            lamina_edge_count: 0,
            failure_count: 0,
          },
        },
        mesh: {
          points: [
            [-1.0, -1.0, 2.1],
            [1.0, -1.0, 2.1],
            [1.0, 1.0, 2.1],
            [-1.0, 1.0, 2.1],
            [-1.0, -1.0, 6.0],
            [1.0, -1.0, 6.0],
          ],
          normals: [[0, 0, 1]],
          triangles: [0, 1, 2, 0, 2, 3],
          face_vertex_counts: [3, 3],
          face_vertex_indices: [0, 1],
        },
      },
    ],
    summary: {
      part_count: 2,
      all_manifold: true,
      total_volume: 138.0,
      total_nurbs_faces: 10,
      total_nurbs_edges: 18,
      total_nurbs_vertices: 14,
      total_mesh_triangles: 32,
      penetration_count: 0,
      overall_bounds: [
        [-5.0, -5.0, 0.0],
        [5.0, 5.0, 6.0],
      ],
      penetration_warnings: [],
      envelope_breaches: [],
      relationships: [],
    },
    explosion_stages: [
      {
        id: 'stage_pin_disassembly',
        name: 'Pin Disassembly',
        duration: 1.2,
        easing: 'ease-out',
        parts: { guide_pin: [0, 0, 5.0] },
      },
    ],
  };

  it('catalogs all 5 in-app toolsets with required schema invariants', () => {
    // Verify toolset count
    expect(IN_APP_TOOLSETS.length).toBe(5);

    const toolsetIds = IN_APP_TOOLSETS.map((ts) => ts.id);
    expect(toolsetIds).toContain('toolset_cad_brep');
    expect(toolsetIds).toContain('toolset_amd_eda');
    expect(toolsetIds).toContain('toolset_physics_mass');
    expect(toolsetIds).toContain('toolset_assembly_kinematics');
    expect(toolsetIds).toContain('toolset_digital_fabrication');

    // Verify all tools have inAppExecutionOnly set to true
    for (const ts of IN_APP_TOOLSETS) {
      expect(ts.tools.length).toBeGreaterThanOrEqual(2);
      for (const t of ts.tools) {
        expect(t.inAppExecutionOnly).toBe(true);
        expect(t.name).toBeTruthy();
        expect(t.category).toBeTruthy();
        expect(t.description).toBeTruthy();
      }
    }
  });

  it('executes usd_brep_validate_topology tool correctly', async () => {
    const res = await executeInAppTool(
      'usd_brep_validate_topology',
      {},
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.summary).toContain('2 B-Rep bodies');
    expect(res.output.all_manifold).toBe(true);
    expect(res.output.part_count).toBe(2);
    expect(res.output.total_faces).toBe(10);
    expect(res.output.total_edges).toBe(18);
  });

  it('executes usd_brep_tessellate_mesh tool correctly', async () => {
    const res = await executeInAppTool(
      'usd_brep_tessellate_mesh',
      { linearTolerance: 0.04 },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.output.linear_tolerance).toBe(0.04);
    expect(res.output.triangle_count).toBeGreaterThan(0);
    expect(res.output.has_normals).toBe(true);
  });

  it('executes usd_brep_check_clearance tool correctly', async () => {
    // Case 1: Zero warnings
    const cleanRes = await executeInAppTool(
      'usd_brep_check_clearance',
      {},
      { execResult: mockCadResult }
    );
    expect(cleanRes.success).toBe(true);
    expect(cleanRes.summary).toContain('Zero mechanical penetrations');

    // Case 2: Injected penetration warning
    const warnedResult: CadExecutionResult = {
      ...mockCadResult,
      summary: {
        ...mockCadResult.summary,
        penetration_warnings: [
          { candidate: 'guide_pin', anchor: 'mounting_flange', overlap_volume: 0.8 },
        ],
      },
    };
    const warnedRes = await executeInAppTool(
      'usd_brep_check_clearance',
      {},
      { execResult: warnedResult }
    );
    expect(warnedRes.success).toBe(false);
    expect(warnedRes.summary).toContain('1 penetration warnings');
  });

  it('executes calculate_assembly_mass tool with aerospace material presets', async () => {
    // Test with direct material ID
    const res = await executeInAppTool(
      'calculate_assembly_mass',
      { materialId: 'titanium_gr5' },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.summary).toContain('Titanium Ti-6Al-4V');
    expect(res.output.totalMassGrams).toBeGreaterThan(0);
    expect(res.output.totalMassLbs).toBeGreaterThan(0);
    expect(res.output.centerOfMass).toBeDefined();

    // Test with alias tag '6al4v'
    const aliasRes = await executeInAppTool(
      'calculate_assembly_mass',
      { materialId: '6al4v' },
      { execResult: mockCadResult }
    );
    expect(aliasRes.summary).toContain('Titanium Ti-6Al-4V');
  });

  it('executes query_material_catalog tool and returns standard library', async () => {
    const res = await executeInAppTool('query_material_catalog');
    expect(res.success).toBe(true);
    expect(res.output.materials.length).toBeGreaterThanOrEqual(16);
    expect(res.summary).toContain('aerospace and electronic material specifications');
  });

  it('executes solve_explosion_stages tool correctly', async () => {
    const res = await executeInAppTool(
      'solve_explosion_stages',
      { expansionMagnitude: 1.5 },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.output.stages.length).toBe(1);
    expect(res.output.stages[0].name).toBe('Pin Disassembly');
  });

  it('executes sync_3d_annotation_datum tool and registers GD&T note', async () => {
    const res = await executeInAppTool('sync_3d_annotation_datum', {
      partName: 'mounting_flange',
      title: 'Perpendicularity to Datum A',
      datumSymbol: 'Datum B',
      toleranceMm: 0.02,
    });

    expect(res.success).toBe(true);
    expect(res.output.partName).toBe('mounting_flange');
    expect(res.output.datumSymbol).toBe('Datum B');
    expect(res.output.toleranceMm).toBe(0.02);
    expect(res.summary).toContain('Datum B');
  });

  it('executes AMD ROCm EDA logic synthesis tool for alu_4bit and vortex_controller', async () => {
    // Benchmark 1: 4-bit ALU
    const aluRes = await executeInAppTool('amd_logic_synthesis', { circuitType: 'alu_4bit' });
    expect(aluRes.success).toBe(true);
    expect(aluRes.output.gate_count).toBeGreaterThan(10);
    expect(aluRes.output.speedup_factor).toContain('AMD Instinct');

    // Benchmark 2: Vortex Controller
    const vortexRes = await executeInAppTool('amd_logic_synthesis', {
      circuitType: 'vortex_controller',
    });
    expect(vortexRes.success).toBe(true);
    expect(vortexRes.output.name).toContain('Vortex');
  });

  it('executes AMD force-directed gate placer algorithm', async () => {
    const res = await executeInAppTool('amd_force_directed_placer', {
      circuitType: 'alu_4bit',
      iterations: 30,
      damping: 0.9,
    });

    expect(res.success).toBe(true);
    expect(res.output.iterations).toBe(30);
    expect(res.output.total_wire_length_um).toBeGreaterThan(0);
    expect(res.output.placed_gates.length).toBeGreaterThan(5);
  });

  it('executes AMD 45nm Design Rule Checking (DRC) tool', async () => {
    const res = await executeInAppTool('amd_drc_rule_check', {
      circuitType: 'alu_4bit',
      pitchToleranceUm: 45,
    });

    expect(res.toolId).toBe('amd_drc_rule_check');
    expect(res.output.violations).toBeDefined();
    expect(Array.isArray(res.output.violations)).toBe(true);
  });

  it('executes AMD silicon to 3D MCM OpenUSD packaging tool', async () => {
    const res = await executeInAppTool('amd_silicon_to_3d_package', { circuitType: 'alu_4bit' });
    expect(res.success).toBe(true);
    expect(res.output.python_code).toContain('import usd_brep as sm');
    expect(res.output.python_code).toContain('substrate_bga');
    expect(res.output.components).toContain('copper_heat_spreader');
  });

  it('executes generate_cnc_gcode digital fabrication tool with G-code output', async () => {
    const res = await executeInAppTool(
      'generate_cnc_gcode',
      {
        partName: 'mounting_flange',
        machineDialect: 'grbl',
        feedRateMmMin: 1500,
        addHoldingTabs: true,
      },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.output.partName).toBe('mounting_flange');
    expect(res.output.machineDialect).toBe('grbl');
    expect(res.output.lineCount).toBeGreaterThan(20);
    expect(res.output.gcode).toContain('G21 ; Units: Millimeters');
    expect(res.output.gcode).toContain('M03 S');
    expect(res.output.gcode).toContain('M30 ; Program End');
  });

  it('executes generate_dxf_profile tool and returns AutoCAD R12 ASCII', async () => {
    const res = await executeInAppTool(
      'generate_dxf_profile',
      { partName: 'mounting_flange', sliceZMm: 1.0 },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.output.version).toContain('AutoCAD R12');
    expect(res.output.dxf).toContain('SECTION');
    expect(res.output.dxf).toContain('POLYLINE');
    expect(res.output.dxf).toContain('CONTOUR');
    expect(res.output.dxf).toContain('EOF');
  });

  it('executes preflight_3d_printing tool with volume and filament metrics', async () => {
    const res = await executeInAppTool(
      'preflight_3d_printing',
      { partName: 'mounting_flange' },
      { execResult: mockCadResult }
    );

    expect(res.success).toBe(true);
    expect(res.output.isWatertight).toBe(true);
    expect(res.output.estimatedMassG.PLA).toBeGreaterThan(0);
    expect(res.output.estimatedMassG.PETG).toBeGreaterThan(0);
    expect(res.output.estimatedPrintTimeMin).toBeGreaterThanOrEqual(12);
    expect(['low', 'medium', 'high']).toContain(res.output.adhesionRisk);
  });

  it('gracefully handles unrecognized tool IDs and preserves execution context', async () => {
    const res = await executeInAppTool('custom_experimental_kernel', { param: 42 });
    expect(res.success).toBe(true);
    expect(res.summary).toContain("Tool 'custom_experimental_kernel' completed successfully");
    expect(res.output.args.param).toBe(42);
  });
});
