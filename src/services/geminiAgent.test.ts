import { describe, expect, it } from 'vitest';
import { NVIDIA_USD_BREP_SYSTEM_PROMPT, runAgenticCadTurn } from './geminiAgent';

describe('Gemini Agentic CAD Service', () => {
  it('includes canonical NVIDIA usd-brep rules in system prompt', () => {
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('import usd_brep as sm');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('build_parts()');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.create_box');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.create_cylinder');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.create_sphere');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.create_cone');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.create_torus');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.boolean_union');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.boolean_difference');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('sm.fillet_edges');
    expect(NVIDIA_USD_BREP_SYSTEM_PROMPT).toContain('z = 0');
  });

  it('synthesizes spur gear assembly when prompt requests gear', async () => {
    const turn = await runAgenticCadTurn({
      prompt: 'Build a planetary spur gear assembly with lightening holes',
      currentCode: '',
    });

    expect(turn.explanation).toContain('spur gear');
    expect(turn.finalCode).toContain('build_parts');
    expect(turn.finalCode).toContain('spur_gear_12t');
    expect(turn.executionResult.success).toBe(true);
    expect(turn.executionResult.summary?.all_manifold).toBe(true);
    expect(turn.steps.length).toBe(1);
    expect(turn.steps[0].status).toBe('success');
  });

  it('synthesizes flanged pipe elbow when prompt requests valve/pipe/flange', async () => {
    const turn = await runAgenticCadTurn({
      prompt: 'Create a heavy flanged valve pipe manifold',
      currentCode: '',
    });

    expect(turn.explanation).toContain('flanged pipe');
    expect(turn.finalCode).toContain('bottom_flange');
    expect(turn.finalCode).toContain('elbow_manifold');
    expect(turn.executionResult.success).toBe(true);
    expect(turn.executionResult.summary?.all_manifold).toBe(true);
    expect(turn.steps.length).toBe(1);
    expect(turn.steps[0].status).toBe('success');
  });

  it('synthesizes sensor turret without penetration warnings when general prompt given', async () => {
    const turn = await runAgenticCadTurn({
      prompt: 'Construct a dual optic camera turret assembly',
      currentCode: '',
    });

    expect(turn.explanation).toContain('turret');
    expect(turn.finalCode).toContain('mounting_base');
    expect(turn.finalCode).toContain('optic_barrel_left');
    expect(turn.executionResult.success).toBe(true);
    expect(turn.executionResult.summary?.all_manifold).toBe(true);
    expect(turn.executionResult.summary?.penetration_count).toBe(0);
    expect(turn.steps.length).toBe(1);
    expect(turn.steps[0].status).toBe('success');
  });

  it('synthesizes AMD Silicon MCM 2.5D package when prompt requests silicon/eda/chip', async () => {
    const turn = await runAgenticCadTurn({
      prompt: 'Synthesize an AMD ROCm Silicon Multi-Chip Module package with HBM cache dies',
      currentCode: '',
      harness: 'amd-rocm-harness',
      model: 'amd-llama-3.3-70b',
    });

    expect(turn.explanation).toContain('Silicon Multi-Chip Module');
    expect(turn.finalCode).toContain('amd_silicon_die');
    expect(turn.finalCode).toContain('silicon_interposer');
    expect(turn.finalCode).toContain('copper_heat_spreader');
    expect(turn.executionResult.success).toBe(true);
    expect(turn.harnessUsed).toBe('amd-rocm-harness');
    expect(turn.modelUsed).toBe('amd-llama-3.3-70b');
  });

  it('synthesizes helical vortex straw when prompt requests vortex straw', async () => {
    const turn = await runAgenticCadTurn({
      prompt: 'Build a vortex straw with flow chambers and ergonomic tip',
      currentCode: '',
      harness: 'langchain-react',
    });

    expect(turn.explanation).toContain('vortex straw');
    expect(turn.finalCode).toContain('vortex_barrel');
    expect(turn.finalCode).toContain('ergonomic_tip');
    expect(turn.executionResult.success).toBe(true);
  });
});
