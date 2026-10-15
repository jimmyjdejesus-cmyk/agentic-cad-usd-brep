import { CadExecutionResult } from '../types/cad';

/**
 * Validates a candidate part name against naming conventions and existing parts.
 */
export function validatePartName(
  rawName: string,
  existingPartNames: string[],
  currentName: string
): { valid: boolean; cleanName: string; error?: string } {
  const cleanName = rawName.trim().replace(/^[/]+/, '').trim();

  if (!cleanName) {
    return { valid: false, cleanName, error: 'Part identifier cannot be empty' };
  }

  if (cleanName === currentName) {
    return { valid: true, cleanName };
  }

  // Enforce valid identifier characters (alphanumeric, underscores, hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanName)) {
    return {
      valid: false,
      cleanName,
      error: 'Part name must contain only letters, numbers, underscores, or hyphens',
    };
  }

  const isCollision = existingPartNames.some(
    (name) => name.toLowerCase() === cleanName.toLowerCase() && name !== currentName
  );
  if (isCollision) {
    return {
      valid: false,
      cleanName,
      error: `A part named "${cleanName}" already exists in the assembly`,
    };
  }

  return { valid: true, cleanName };
}

/**
 * Escapes regex special characters.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renames a part identifier in Python CAD code so re-execution retains the new identifier.
 * Matches return tuple elements e.g.:
 *   ("old_name", var_name, ...) or ('old_name', var_name, ...)
 * and stage dictionary keys:
 *   "old_name": or 'old_name':
 */
export function renamePartInCode(code: string, oldName: string, newName: string): string {
  if (!code || !oldName || !newName || oldName === newName) return code;

  const escOld = escapeRegex(oldName);

  // 1. Match ("oldName", ... or ('oldName', ... in build_parts return list
  const tupleRegex = new RegExp(`(["'])${escOld}\\1(\\s*,)`, 'g');
  let updated = code.replace(tupleRegex, `$1${newName}$1$2`);

  // 2. Match dictionary keys e.g. "oldName": or 'oldName':
  const dictKeyRegex = new RegExp(`(["'])${escOld}\\1(\\s*:)`, 'g');
  updated = updated.replace(dictKeyRegex, `$1${newName}$1$2`);

  return updated;
}

/**
 * Applies persistent part renames to a CadExecutionResult (parts, relationships, warnings, explosion stages).
 */
export function applyPartRenamesToExecutionResult(
  result: CadExecutionResult,
  renames: Record<string, string>
): CadExecutionResult {
  if (!result || !renames || Object.keys(renames).length === 0) {
    return result;
  }

  // Resolve chained renames (e.g., A -> B, B -> C)
  const resolveName = (name: string): string => {
    let current = name;
    let depth = 0;
    const visited = new Set<string>();
    while (renames[current] && depth < 10 && !visited.has(current)) {
      visited.add(current);
      current = renames[current];
      depth++;
    }
    return current;
  };

  const newParts = result.parts?.map((p) => {
    const updatedName = resolveName(p.name);
    return updatedName !== p.name ? { ...p, name: updatedName } : p;
  });

  const newSummary = result.summary
    ? {
        ...result.summary,
        penetration_warnings: result.summary.penetration_warnings?.map((w) => ({
          ...w,
          candidate: resolveName(w.candidate),
          anchor: resolveName(w.anchor),
        })),
        envelope_breaches: result.summary.envelope_breaches?.map((e) => ({
          ...e,
          part: resolveName(e.part),
        })),
        relationships: result.summary.relationships?.map((r) => ({
          ...r,
          part_a: resolveName(r.part_a),
          part_b: resolveName(r.part_b),
        })),
      }
    : result.summary;

  const newStages = result.explosion_stages?.map((stage) => {
    let changed = false;
    const newPartsMap: typeof stage.parts = {};
    for (const [key, val] of Object.entries(stage.parts)) {
      const resolved = resolveName(key);
      if (resolved !== key) changed = true;
      newPartsMap[resolved] = val;
    }
    return changed ? { ...stage, parts: newPartsMap } : stage;
  });

  return {
    ...result,
    parts: newParts ?? result.parts,
    summary: newSummary,
    explosion_stages: newStages ?? result.explosion_stages,
  };
}
