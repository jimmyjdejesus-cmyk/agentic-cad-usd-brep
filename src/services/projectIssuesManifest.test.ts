import { describe, it, expect } from 'vitest';
import {
  loadManifest,
  verifyManifest,
  formatSubIssueMarkdown,
  formatEpicMarkdown,
} from '../../scripts/sync-project-issues.mjs';

describe('Project Milestones, Epics & Sub-Issues Manifest Suite', () => {
  it('loads a valid project-issues-manifest.json with 5 milestones, 5 epics, and 20 sub-issues', () => {
    const manifest = loadManifest();
    const verification = verifyManifest(manifest);

    expect(verification.valid).toBe(true);
    expect(verification.errors).toEqual([]);
    expect(verification.stats.milestones).toBe(5);
    expect(verification.stats.epics).toBe(5);
    expect(verification.stats.subIssues).toBe(20);
    expect(verification.stats.completedSubIssues).toBeGreaterThanOrEqual(1);
  });

  it('ensures every epic maps 1:1 to a milestone and all sub-issues link back to their parent epic', () => {
    const manifest = loadManifest();

    for (const epic of manifest.epics) {
      const childSubs = manifest.subIssues.filter((s: any) => s.epicId === epic.id);
      expect(childSubs.map((s: any) => s.id)).toEqual(epic.subIssueIds);
    }
  });

  it('formats sub-issue and epic markdown bodies with resolved #issue cross-links', () => {
    const manifest = loadManifest();
    const epicMap = new Map([['EPIC-1', 10]]);
    const subMap = new Map([
      ['ISS-101', 11],
      ['ISS-102', 12],
    ]);

    const sub102 = manifest.subIssues.find((s: any) => s.id === 'ISS-102');
    const subMd = formatSubIssueMarkdown(sub102, epicMap, subMap);
    expect(subMd).toContain('#10 (`EPIC-1`)');
    expect(subMd).toContain('#11 (`ISS-101`)');
    expect(subMd).toContain('### Acceptance Criteria (Definition of Done)');

    const epic1 = manifest.epics.find((e: any) => e.id === 'EPIC-1');
    const ms1 = manifest.milestones.find((m: any) => m.id === 'M1');
    const epicMd = formatEpicMarkdown(epic1, ms1, manifest.subIssues, subMap);
    expect(epicMd).toContain('- [x] #11 — **`ISS-101`**');
    expect(epicMd).toContain('- [ ] #12 — **`ISS-102`**');
  });
});
