import { GoogleGenAI, Type } from '@google/genai';
import { AgentIterationStep, CadExecutionResult } from '../types/cad';
import { executeCadScript } from './cadRuntime';

export const NVIDIA_USD_BREP_SYSTEM_PROMPT = `You are an expert Agentic B-Rep CAD Engineer powered by NVIDIA's usd_brep (SMLib / _omni_solid) C++ NURBS kernel.
Your job is to write or modify Python 3.12 scripts that define a \`build_parts()\` function returning a list of \`(name, brep, color_rgb, kind)\` tuples.

CRITICAL NVIDIA usd_brep API RULES (from .agents/docs/generate_asset.md & .agents/operations/primitives.md):
1. Import: \`import usd_brep as sm\` (and \`import math\` if needed).
2. Coordinate Convention:
   - Z-up (\`upAxis = "Z"\`), units in centimeters (\`metersPerUnit = 0.01\`).
   - Rest the assembly on the ground plane \`z = 0\` (\`min_z >= 0\`), centered around \`(0, 0)\` in XY.
3. Exact Primitive Signatures (DO NOT invent arguments):
   - \`sm.create_box((minX, minY, minZ), length, width, height)\`
     * Note: first tuple is the MINIMUM corner \`(minX, minY, minZ)\`, NOT the center! \`length, width, height\` are positive extents along X, Y, Z.
   - \`sm.create_cylinder((cx, cy, z0), radius, height)\`
     * Note: aligned along +Z from \`z0\` to \`z0 + height\`. Takes 3 arguments: \`origin, radius, height\`. To orient along X or Y, call \`sm.rotate(cyl, ref_point=(cx, cy, z0), axis=(0.0, 1.0, 0.0), angle_deg=90.0)\`.
   - \`sm.create_sphere((cx, cy, cz), radius)\`
   - \`sm.create_cone((cx, cy, z0), radius_base, radius_top, height)\`
   - \`sm.create_torus((cx, cy, cz), radius_major, radius_minor)\` (requires \`radius_major > radius_minor\`)
4. Transforms (modify target in-place):
   - \`sm.translate(brep, (dx, dy, dz))\`
   - \`sm.rotate(brep, ref_point=(px, py, pz), axis=(ax, ay, az), angle_deg=90.0)\`
   - \`sm.scale(brep, (sx, sy, sz))\`
5. Booleans (return new Brep; consume inputs unless \`.copy()\` is used):
   - \`res = sm.boolean_union(a, b)\`
   - \`res = sm.boolean_difference(workpiece, cutter)\`
   - \`res = sm.boolean_intersection(a, b)\`
6. Edge Fillets & Chamfers (modify target in-place):
   - \`sm.fillet_edges(brep, brep.edges(), radius=0.4)\`
   - \`sm.chamfer_edges(brep, brep.edges(), distance=0.3)\`
7. Multi-Part Sanity & Non-Penetration:
   - Separate distinct components into their own \`(name, brep, (r, g, b), kind)\` tuple in the list returned by \`build_parts()\`.
   - Leave a small clearance (0.1 to 0.2 cm) between stacked parts so their bounding boxes do not penetrate, OR union overlapping parts into a single manifold body via \`sm.boolean_union\`.
   - Use \`"anchor"\` for primary structural parts and \`"component"\` for sub-parts.`;

export interface AgentTurnResponse {
  explanation: string;
  finalCode: string;
  executionResult: CadExecutionResult;
  steps: AgentIterationStep[];
}

function getEffectiveApiKey(override?: string): string {
  if (override && override.trim()) return override.trim();
  const envKey =
    (typeof process !== 'undefined' && process.env && (process.env.GEMINI_API_KEY || process.env.API_KEY)) || '';
  return envKey.trim();
}

export async function runAgenticCadTurn(params: {
  prompt: string;
  currentCode: string;
  apiKey?: string;
  maxIterations?: number;
}): Promise<AgentTurnResponse> {
  const { prompt, currentCode, apiKey, maxIterations = 3 } = params;
  const effectiveKey = getEffectiveApiKey(apiKey);
  const steps: AgentIterationStep[] = [];

  if (!effectiveKey) {
    // Offline / No-Key Parametric Agent Fallback so the user can test self-verification immediately
    const synthesized = synthesizeParametricEditFallback(prompt, currentCode);
    const execRes = await executeCadScript(synthesized.code, 'AgentCadAsset');
    steps.push({
      attempt: 1,
      action: 'Local Parametric Rule Synthesis (No GEMINI_API_KEY set)',
      status: execRes.success && (execRes.sanity_warnings?.length || 0) === 0 ? 'success' : 'warning',
      details: execRes.success
        ? `Built ${execRes.summary?.part_count} manifold B-Rep parts (${execRes.summary?.total_nurbs_faces} NURBS faces, ${execRes.summary?.total_mesh_triangles} mesh triangles).`
        : `Error: ${execRes.error}`,
      code: synthesized.code,
    });
    return {
      explanation: `${synthesized.explanation}\n\n*(Tip: Click **API Key** in the top bar or open in **Google AI Studio** to enable live \`gemini-3.8-flash\` multi-turn B-Rep code synthesis and self-healing repair.)*`,
      finalCode: synthesized.code,
      executionResult: execRes,
      steps,
    };
  }

  const ai = new GoogleGenAI({ apiKey: effectiveKey });
  let workingCode = currentCode;
  let lastResult: CadExecutionResult | null = null;
  let finalExplanation = '';
  let feedbackContext = '';

  for (let attempt = 1; attempt <= maxIterations; attempt++) {
    const userPrompt =
      attempt === 1
        ? `USER REQUEST:\n${prompt}\n\nCURRENT USD_BREP PYTHON SCRIPT:\n\`\`\`python\n${currentCode}\n\`\`\`\n\nGenerate the complete updated Python script defining \`build_parts()\` using \`import usd_brep as sm\`.`
        : `SELF-HEALING REPAIR ITERATION ${attempt}:\nThe previous script produced the following NVIDIA usd_brep kernel or sanity-check issue:\n${feedbackContext}\n\nPREVIOUS SCRIPT:\n\`\`\`python\n${workingCode}\n\`\`\`\n\nFix the geometry/API call so all parts are manifold, rest on z >= 0, and have zero unwanted penetrations.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: NVIDIA_USD_BREP_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: 'Concise engineering summary of the B-Rep modeling steps and dimensions chosen.',
            },
            code: {
              type: Type.STRING,
              description: 'Complete executable Python script importing usd_brep as sm and defining build_parts().',
            },
          },
          required: ['explanation', 'code'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}') as { explanation?: string; code?: string };
    workingCode = (parsed.code || workingCode).trim();
    finalExplanation = parsed.explanation || 'Updated NVIDIA usd_brep B-Rep assembly.';

    const execRes = await executeCadScript(workingCode, 'AgentCadAsset');
    lastResult = execRes;

    if (!execRes.success) {
      feedbackContext = `Runtime / Kernel Error: ${execRes.error}\n${execRes.traceback || ''}`;
      steps.push({
        attempt,
        action: attempt === 1 ? 'Initial B-Rep Generation' : `Self-Healing Repair #${attempt - 1}`,
        status: 'error',
        details: `Kernel rejected script: ${execRes.error}`,
        code: workingCode,
      });
      continue;
    }

    const warnings = execRes.sanity_warnings || [];
    const nonManifold = execRes.summary && !execRes.summary.all_manifold;

    if (nonManifold || warnings.length > 0) {
      feedbackContext = [
        nonManifold ? 'One or more B-Rep solids failed is_manifold_solid() check.' : '',
        ...warnings,
      ]
        .filter(Boolean)
        .join('\n');

      steps.push({
        attempt,
        action: attempt === 1 ? 'Initial B-Rep Generation' : `Self-Healing Repair #${attempt - 1}`,
        status: 'warning',
        details: `Built ${execRes.summary?.part_count} parts, but sanity check flagged: ${feedbackContext}`,
        code: workingCode,
      });

      if (attempt < maxIterations) {
        continue;
      }
    } else {
      steps.push({
        attempt,
        action: attempt === 1 ? 'Initial B-Rep Generation & Verification' : `Verified Self-Healed B-Rep (#${attempt - 1})`,
        status: 'success',
        details: `All ${execRes.summary?.part_count} parts verified manifold (${execRes.summary?.total_nurbs_faces} NURBS faces, ${execRes.summary?.total_volume} cm³, 0 penetrations).`,
        code: workingCode,
      });
      break;
    }
  }

  return {
    explanation: finalExplanation,
    finalCode: workingCode,
    executionResult: lastResult || (await executeCadScript(workingCode, 'AgentCadAsset')),
    steps,
  };
}

function synthesizeParametricEditFallback(
  prompt: string,
  currentCode: string
): { explanation: string; code: string } {
  const lower = prompt.toLowerCase();

  if (lower.includes('planetary') || lower.includes('gear')) {
    return {
      explanation:
        'Synthesized a multi-part parametric spur gear & shaft assembly using `sm.create_cylinder`, `sm.create_box`, `sm.rotate`, and `sm.boolean_difference`.',
      code: `import math
import usd_brep as sm

def build_parts():
    """Parametric 12-tooth spur gear with lightening holes on a stepped pedestal."""
    pedestal = sm.create_cylinder((0.0, 0.0, 0.0), 14.0, 5.0)
    recess = sm.create_cylinder((0.0, 0.0, 3.0), 10.0, 3.0)
    pedestal = sm.boolean_difference(pedestal, recess)

    num_teeth = 12
    root_r = 13.5
    gear_z0 = 5.2
    gear_h = 6.0

    gear = sm.create_cylinder((0.0, 0.0, gear_z0), root_r, gear_h)
    for i in range(num_teeth):
        angle_deg = i * (360.0 / num_teeth)
        tooth = sm.create_box((root_r - 1.5, -1.5, gear_z0), 4.2, 3.0, gear_h)
        sm.rotate(tooth, ref_point=(0.0, 0.0, gear_z0), axis=(0.0, 0.0, 1.0), angle_deg=angle_deg)
        gear = sm.boolean_union(gear, tooth)

    for i in range(4):
        ang = i * (math.pi / 2.0) + (math.pi / 4.0)
        hx = 9.2 * math.cos(ang)
        hy = 9.2 * math.sin(ang)
        pocket = sm.create_cylinder((hx, hy, gear_z0 - 1.0), 2.1, gear_h + 2.0)
        gear = sm.boolean_difference(gear, pocket)

    bore = sm.create_cylinder((0.0, 0.0, gear_z0 - 1.0), 4.2, gear_h + 2.0)
    gear = sm.boolean_difference(gear, bore)

    cap = sm.create_cylinder((0.0, 0.0, 11.4), 5.8, 2.5)
    cap_hole = sm.create_cylinder((0.0, 0.0, 10.5), 2.2, 4.5)
    cap = sm.boolean_difference(cap, cap_hole)

    return [
        ("base_pedestal", pedestal, (0.25, 0.28, 0.33), "anchor"),
        ("spur_gear_12t", gear, (0.85, 0.62, 0.18), "anchor"),
        ("retaining_cap", cap, (0.72, 0.75, 0.78), "component"),
    ]
`,
    };
  }

  if (lower.includes('valve') || lower.includes('flange') || lower.includes('pipe')) {
    return {
      explanation:
        'Synthesized an industrial 90-degree flanged pipe manifold with 6 bolt holes, hollow internal flow passages, and a tapered sensor cap.',
      code: `import math
import usd_brep as sm

def build_parts():
    """Industrial 90-degree flanged pipe manifold."""
    bottom_flange = sm.create_cylinder((0.0, 0.0, 0.0), 18.0, 4.0)
    for i in range(6):
        ang = i * (2.0 * math.pi / 6.0)
        bx = 13.5 * math.cos(ang)
        by = 13.5 * math.sin(ang)
        hole = sm.create_cylinder((bx, by, -1.0), 1.8, 6.0)
        bottom_flange = sm.boolean_difference(bottom_flange, hole)
    bore_bottom = sm.create_cylinder((0.0, 0.0, -1.0), 6.5, 6.0)
    bottom_flange = sm.boolean_difference(bottom_flange, bore_bottom)

    riser_outer = sm.create_cylinder((0.0, 0.0, 4.1), 9.5, 22.0)
    hub_outer = sm.create_sphere((0.0, 0.0, 26.0), 11.0)
    branch_outer = sm.create_cylinder((0.0, 0.0, 26.0), 9.0, 20.0)
    sm.rotate(branch_outer, ref_point=(0.0, 0.0, 26.0), axis=(0.0, 1.0, 0.0), angle_deg=90.0)

    body = sm.boolean_union(riser_outer, hub_outer)
    body = sm.boolean_union(body, branch_outer)

    bore_vert = sm.create_cylinder((0.0, 0.0, 3.5), 6.5, 23.0)
    bore_horiz = sm.create_cylinder((0.0, 0.0, 26.0), 6.0, 25.0)
    sm.rotate(bore_horiz, ref_point=(0.0, 0.0, 26.0), axis=(0.0, 1.0, 0.0), angle_deg=90.0)
    body = sm.boolean_difference(body, bore_vert)
    body = sm.boolean_difference(body, bore_horiz)

    sensor_cap = sm.create_cone((0.0, 0.0, 37.2), radius_base=5.5, radius_top=3.5, height=4.5)

    return [
        ("bottom_flange", bottom_flange, (0.28, 0.34, 0.42), "anchor"),
        ("elbow_manifold", body, (0.38, 0.52, 0.68), "anchor"),
        ("sensor_cap", sensor_cap, (0.88, 0.64, 0.18), "component"),
    ]
`,
    };
  }

  // Default: add a protective sensor dome / beacon ring to the current script or build a custom turret
  return {
    explanation:
      'Constructed a multi-part precision sensor turret assembly with a filleted base plate, rotating azimuth drum, dual optical barrels, and top LiDAR dome.',
    code: `import usd_brep as sm

def build_parts():
    """Precision Dual-Optic Sensor & LiDAR Turret Assembly."""
    # 1. Filleted mounting base plate (z = 0..4)
    base = sm.create_box((-14.0, -14.0, 0.0), 28.0, 28.0, 4.0)
    sm.fillet_edges(base, base.edges(), radius=0.8)

    # 2. Azimuth turret housing (z = 4.2..18.2)
    drum = sm.create_cylinder((0.0, 0.0, 4.2), 10.0, 14.0)
    eye_recess = sm.create_box((4.0, -6.5, 8.0), 8.0, 13.0, 7.0)
    drum = sm.boolean_difference(drum, eye_recess)

    # 3. Dual optical lens barrels extending along +X
    lens_left = sm.create_cylinder((6.5, -3.5, 11.5), 2.2, 6.0)
    sm.rotate(lens_left, ref_point=(6.5, -3.5, 11.5), axis=(0.0, 1.0, 0.0), angle_deg=90.0)

    lens_right = sm.create_cylinder((6.5, 3.5, 11.5), 2.2, 6.0)
    sm.rotate(lens_right, ref_point=(6.5, 3.5, 11.5), axis=(0.0, 1.0, 0.0), angle_deg=90.0)

    # 4. Top LiDAR hemisphere dome (z = 18.4..25.4)
    lidar_collar = sm.create_cone((0.0, 0.0, 18.4), radius_base=7.5, radius_top=5.5, height=3.0)
    lidar_dome = sm.create_sphere((0.0, 0.0, 25.2), 3.6)

    return [
        ("mounting_base", base, (0.24, 0.27, 0.32), "anchor"),
        ("azimuth_housing", drum, (0.35, 0.48, 0.64), "anchor"),
        ("optic_barrel_left", lens_left, (0.18, 0.80, 0.65), "component"),
        ("optic_barrel_right", lens_right, (0.18, 0.80, 0.65), "component"),
        ("lidar_collar", lidar_collar, (0.85, 0.62, 0.18), "component"),
        ("lidar_dome", lidar_dome, (0.92, 0.28, 0.28), "component"),
    ]
`,
  };
}
