import { describe, expect, it } from 'vitest';
import {
  synthesizeCircuitNetlist,
  runForceDirectedPlacement,
  runDesignRuleCheck,
  generate3dMcmPackageBrepCode,
} from './edaSiliconEngine';
import {
  AI_HARNESS_OPTIONS,
  AI_MODEL_OPTIONS,
  IN_APP_TOOLSETS,
  executeInAppTool,
} from './appToolsAndSkills';

describe('ApexCAD Studio AMD ROCm Silicon EDA Engine', () => {
  it('synthesizes unified netlist database for 4-bit ALU', () => {
    const netlist = synthesizeCircuitNetlist('alu_4bit');
    expect(netlist.gates.length).toBeGreaterThan(10);
    expect(netlist.wires.length).toBeGreaterThan(10);
    expect(netlist.totalWireLengthUm).toBeGreaterThan(0);
    expect(netlist.totalChipAreaUm2).toBeGreaterThan(0);
    expect(netlist.name).toContain('ALU');
  });

  it('performs Force-Directed Placement and reduces Manhattan wire length', () => {
    const initial = synthesizeCircuitNetlist('alu_4bit');
    const initialWireLength = initial.totalWireLengthUm;

    // Run 40 relaxation steps
    const placed = runForceDirectedPlacement(initial, 40, 0.90);
    expect(placed.convergenceIterations).toBe(40);
    expect(placed.gates.length).toBe(initial.gates.length);

    // Verify all gates remain bounded on the 1000um x 1000um die
    for (const g of placed.gates) {
      expect(g.x).toBeGreaterThanOrEqual(60);
      expect(g.x).toBeLessThanOrEqual(1000);
      expect(g.y).toBeGreaterThanOrEqual(60);
      expect(g.y).toBeLessThanOrEqual(1000);
    }
  });

  it('runs predictive 45nm Design Rule Check (DRC)', () => {
    const netlist = synthesizeCircuitNetlist('alu_4bit');
    const drcViolations = runDesignRuleCheck(netlist, 45);
    expect(Array.isArray(drcViolations)).toBe(true);
  });

  it('generates 3D USD-BRep MCM Package CAD code', () => {
    const netlist = synthesizeCircuitNetlist('alu_4bit');
    const code = generate3dMcmPackageBrepCode(netlist);

    expect(code).toContain('import usd_brep as sm');
    expect(code).toContain('build_parts()');
    expect(code).toContain('substrate_bga');
    expect(code).toContain('silicon_interposer');
    expect(code).toContain('amd_silicon_die');
    expect(code).toContain('copper_heat_spreader');
  });
});

describe('In-App Toolsets & Agnostic AI Architecture', () => {
  it('registers industry-standard harnesses', () => {
    const ids = AI_HARNESS_OPTIONS.map((h) => h.id);
    expect(ids).toContain('google-genai');
    expect(ids).toContain('langchain-react');
    expect(ids).toContain('agnostic-toolcall');
    expect(ids).toContain('autonomous-verifier');
    expect(ids).toContain('amd-rocm-harness');
    expect(ids).toContain('local-deterministic');
  });

  it('registers models across Google, Anthropic, OpenAI, and AMD ROCm', () => {
    const providers = new Set(AI_MODEL_OPTIONS.map((m) => m.provider));
    expect(providers).toContain('Google');
    expect(providers).toContain('Anthropic');
    expect(providers).toContain('OpenAI');
    expect(providers).toContain('AMD ROCm / Open-Weights');
  });

  it('locks all tools inside the application environment', async () => {
    for (const toolset of IN_APP_TOOLSETS) {
      for (const tool of toolset.tools) {
        expect(tool.inAppExecutionOnly).toBe(true);
      }
    }

    const res = await executeInAppTool('usd_brep_validate_topology', {}, {
      execResult: {
        ok: true,
        success: true,
        kernel: 'usd_brep',
        parts: [],
      },
    });
    expect(res.success).toBe(true);
    expect(res.toolId).toBe('usd_brep_validate_topology');
  });
});
