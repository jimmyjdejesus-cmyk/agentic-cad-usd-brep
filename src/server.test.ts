/**
 * Express Hybrid CAD Server API Endpoint Integration Tests
 *
 * Verifies all HTTP REST endpoints exposed by server.ts:
 * - GET /api/health
 * - GET /api/system/hardware
 * - GET /api/presets
 * - POST /api/execute (503 fallback routing)
 * - GET /api/guides & GET /api/guides/content (with path traversal security test)
 * - POST /api/agent/turn (testOnly mode, local-deterministic, resilient fallback)
 * - POST /api/tools/execute (agent tool dispatch for CAD, EDA, CAM, and physics)
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Server } from 'http';
import { createExpressApp } from '../server';

describe('CAD Studio Express API Server Suite', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await createExpressApp({ withVite: false });
    await new Promise<void>((resolve) => {
      // Listen on ephemeral random port
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it('GET /api/health returns server status, doc availability, and preset counts', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.preset_count).toBeGreaterThanOrEqual(5);
    expect(typeof data.docs_available).toBe('boolean');
  });

  it('GET /api/system/hardware reports accurate host resources and runtimes', async () => {
    const res = await fetch(`${baseUrl}/api/system/hardware`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.systemRamGb).toBeGreaterThan(0);
    expect(data.gpuVramGb).toBeGreaterThan(0);
    expect(data.cpuCores).toBeGreaterThanOrEqual(1);
    expect(data.cpuModel).toBeDefined();
    expect(data.osPlatform).toBeDefined();
    expect(data.detectedVia).toBe('host-system');
    expect(Array.isArray(data.runtimesAvailable)).toBe(true);
    expect(data.runtimesAvailable.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/presets serves default CAD parametric preset library', async () => {
    const res = await fetch(`${baseUrl}/api/presets`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.presets)).toBe(true);
    expect(data.presets.length).toBeGreaterThanOrEqual(5);

    const firstPreset = data.presets[0];
    expect(firstPreset.id).toBeDefined();
    expect(firstPreset.name).toBeDefined();
    expect(firstPreset.code).toContain('def build_parts()');
  });

  it('POST /api/execute safely signals HTTP 503 fallback when standalone Python backend is offline', async () => {
    const res = await fetch(`${baseUrl}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'def build_parts(): pass',
        linear_tolerance: 0.06,
      }),
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.fallback).toBe(true);
    expect(data.error).toContain('Python usd-brep backend not connected');
  });

  it('GET /api/guides lists NVIDIA usd-brep documentation files', async () => {
    const res = await fetch(`${baseUrl}/api/guides`);
    expect(res.status).toBe(200);

    const guides = await res.json();
    expect(Array.isArray(guides)).toBe(true);
    if (guides.length > 0) {
      expect(guides[0].path).toBeDefined();
      expect(guides[0].title).toBeDefined();
      expect(guides[0].category).toBeDefined();
    }
  });

  it('GET /api/guides/content fetches specific guide documentation safely', async () => {
    const res = await fetch(`${baseUrl}/api/guides/content?path=stubs/usd_brep.pyi`);
    // If documentation folder is present on machine, verify content; otherwise expect 404
    if (res.status === 200) {
      const data = await res.json();
      expect(data.title).toBe('usd_brep.pyi');
      expect(data.content).toContain('def create_box');
    } else {
      expect(res.status).toBe(404);
    }
  });

  it('GET /api/guides/content blocks malicious path traversal attempts with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/guides/content?path=../../etc/passwd`);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain('Invalid guide path');
  });

  it('POST /api/agent/turn testOnly mode returns connection verification status', async () => {
    const res = await fetch(`${baseUrl}/api/agent/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'test connection',
        currentCode: '',
        harness: 'hermes-agent',
        providerBaseUrl: 'http://127.0.0.1:54321/v1',
        testOnly: true,
      }),
    });

    // An unreachable test endpoint will cleanly return 502 without crashing
    expect([200, 502]).toContain(res.status);
    const data = await res.json();
    if (res.status === 502) {
      expect(data.ok).toBe(false);
      expect(data.error).toContain('Failed to connect to provider endpoint');
    } else {
      expect(data.ok).toBe(true);
    }
  });

  it('POST /api/agent/turn synthesizes parametric CAD model using deterministic engine', async () => {
    const res = await fetch(`${baseUrl}/api/agent/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'create a hollow cylindrical pipe with outer radius 6 and wall thickness 1',
        currentCode: '',
        harness: 'local-deterministic',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.finalCode).toContain('import usd_brep as sm');
    expect(data.finalCode).toContain('def build_parts()');
    expect(data.steps.length).toBeGreaterThan(0);
    expect(data.steps[0].toolCalls.length).toBeGreaterThan(0);
  });

  it('POST /api/tools/execute returns 400 if toolName or toolId is omitted', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: {} }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing toolName or toolId');
  });

  it('POST /api/tools/execute dispatches usd_brep_validate_topology tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'usd_brep_validate_topology',
        args: {},
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.executedInApp).toBe(true);
    expect(data.result.success).toBe(true);
    expect(data.result.toolId).toBe('usd_brep_validate_topology');
  });

  it('POST /api/tools/execute dispatches generate_cnc_gcode digital fabrication tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId: 'generate_cnc_gcode',
        args: {
          machineDialect: 'grbl',
          feedRateMmMin: 1200,
        },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.output.machineDialect).toBe('grbl');
    expect(data.result.output.gcode).toContain('G21 ; Units: Millimeters');
    expect(data.result.output.gcode).toContain('M30 ; Program End');
  });

  it('POST /api/tools/execute dispatches generate_dxf_profile tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId: 'generate_dxf_profile',
        args: { sliceZMm: 1.0 },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.output.dxf).toContain('SECTION');
    expect(data.result.output.dxf).toContain('CONTOUR');
  });

  it('POST /api/tools/execute dispatches preflight_3d_printing tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId: 'preflight_3d_printing',
        args: {},
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.output.isWatertight).toBe(true);
    expect(data.result.output.estimatedMassG.PLA).toBeGreaterThan(0);
    expect(data.result.output.estimatedPrintTimeMin).toBeGreaterThan(0);
  });

  it('POST /api/tools/execute dispatches amd_logic_synthesis tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId: 'amd_logic_synthesis',
        args: { circuitType: 'alu_4bit' },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.output.gate_count).toBeGreaterThan(10);
    expect(data.result.output.speedup_factor).toContain('AMD Instinct');
  });

  it('POST /api/tools/execute dispatches calculate_assembly_mass tool', async () => {
    const res = await fetch(`${baseUrl}/api/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolId: 'calculate_assembly_mass',
        args: { materialId: 'titanium_gr5' },
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.output.totalMassGrams).toBeGreaterThan(0);
    expect(data.result.summary).toContain('Titanium');
  });
});
