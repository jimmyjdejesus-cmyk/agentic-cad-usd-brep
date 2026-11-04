import { describe, it, expect } from 'vitest';
import { computeLineDiff } from './App';

describe('App / Code Editor Diff Preview (computeLineDiff)', () => {
  it('returns empty array when both inputs are empty', () => {
    const diff = computeLineDiff('', '');
    expect(diff).toEqual([]);
  });

  it('marks all lines as added when old text is empty', () => {
    const newCode = 'line1\nline2';
    const diff = computeLineDiff('', newCode);
    expect(diff).toHaveLength(2);
    expect(diff[0]).toEqual({ type: 'added', text: 'line1', newLine: 1 });
    expect(diff[1]).toEqual({ type: 'added', text: 'line2', newLine: 2 });
  });

  it('marks all lines as removed when new text is empty', () => {
    const oldCode = 'line1\nline2';
    const diff = computeLineDiff(oldCode, '');
    expect(diff).toHaveLength(2);
    expect(diff[0]).toEqual({ type: 'removed', text: 'line1', oldLine: 1 });
    expect(diff[1]).toEqual({ type: 'removed', text: 'line2', oldLine: 2 });
  });

  it('identifies identical scripts as unchanged with matching line numbers', () => {
    const code = 'import usd_brep as sm\n\ndef build_parts():\n    return []';
    const diff = computeLineDiff(code, code);
    expect(diff.every((d) => d.type === 'unchanged')).toBe(true);
    expect(diff).toHaveLength(4);
    expect(diff[0].oldLine).toBe(1);
    expect(diff[0].newLine).toBe(1);
  });

  it('accurately identifies modifications, insertions, and deletions in Python code', () => {
    const oldCode = `import usd_brep as sm
def build_parts():
    box = sm.create_box((0, 0, 0), 10, 10, 5)
    return [("box", box, (1, 1, 1))]`;

    const newCode = `import usd_brep as sm
def build_parts():
    box = sm.create_box((0, 0, 0), 15, 10, 5)
    fillet = sm.fillet_edges(box, radius=1.0)
    return [("box", box, (1, 1, 1))]`;

    const diff = computeLineDiff(oldCode, newCode);
    const added = diff.filter((d) => d.type === 'added');
    const removed = diff.filter((d) => d.type === 'removed');
    const unchanged = diff.filter((d) => d.type === 'unchanged');

    expect(added.some((d) => d.text.includes('15, 10, 5'))).toBe(true);
    expect(added.some((d) => d.text.includes('fillet_edges'))).toBe(true);
    expect(removed.some((d) => d.text.includes('10, 10, 5'))).toBe(true);
    expect(unchanged.some((d) => d.text.includes('import usd_brep as sm'))).toBe(true);
  });
});
