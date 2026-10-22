/**
 * src/services/releaseManager.test.ts
 * 
 * Unit test suite for release manager, version calculation, and changelog generation.
 */

import { describe, it, expect } from 'vitest';
import { calculateNextVersion, generateChangelogSection } from '../../scripts/release-manager.mjs';

describe('Release Manager Version Calculation & SemVer Suite', () => {
  it('correctly calculates a patch version bump for bugfixes and maintenance', () => {
    const commits = [
      { hash: 'a1b2c3d', title: 'fix: resolve boundary normal calculation', type: 'fix', scope: '', description: 'resolve boundary normal calculation', isBreaking: false },
      { hash: 'e4f5g6h', title: 'chore: update dependency packages', type: 'chore', scope: '', description: 'update dependency packages', isBreaking: false },
    ];

    const result = calculateNextVersion('1.0.0', commits, 'auto');
    expect(result.nextVersion).toBe('1.0.1');
    expect(result.bumpType).toBe('patch');
  });

  it('correctly calculates a minor version bump when a feature commit is present', () => {
    const commits = [
      { hash: 'a1b2c3d', title: 'fix: resolve boundary normal calculation', type: 'fix', scope: '', description: 'resolve boundary normal calculation', isBreaking: false },
      { hash: 'b2c3d4e', title: 'feat(cam): add 2D vector DXF cut-sheet exporter', type: 'feat', scope: 'cam', description: 'add 2D vector DXF cut-sheet exporter', isBreaking: false },
      { hash: 'c3d4e5f', title: 'docs: update architectural diagrams', type: 'docs', scope: '', description: 'update architectural diagrams', isBreaking: false },
    ];

    const result = calculateNextVersion('1.0.0', commits, 'auto');
    expect(result.nextVersion).toBe('1.1.0');
    expect(result.bumpType).toBe('minor');
  });

  it('correctly calculates a major version bump when a breaking change commit is present', () => {
    const commits = [
      { hash: 'a1b2c3d', title: 'feat!: redesign solid modeling kernel boundary schema', type: 'feat', scope: '', description: 'redesign solid modeling kernel boundary schema', isBreaking: true },
    ];

    const result = calculateNextVersion('1.0.0', commits, 'auto');
    expect(result.nextVersion).toBe('2.0.0');
    expect(result.bumpType).toBe('major');
  });

  it('honors forced bump types over automatic calculation', () => {
    const commits = [
      { hash: 'a1b2c3d', title: 'fix: simple typo', type: 'fix', scope: '', description: 'simple typo', isBreaking: false },
    ];

    const resultMinor = calculateNextVersion('1.0.0', commits, 'minor');
    expect(resultMinor.nextVersion).toBe('1.1.0');
    expect(resultMinor.bumpType).toBe('minor');

    const resultMajor = calculateNextVersion('1.0.0', commits, 'major');
    expect(resultMajor.nextVersion).toBe('2.0.0');
    expect(resultMajor.bumpType).toBe('major');
  });

  it('generates a categorized markdown changelog section with scopes and hashes', () => {
    const commits = [
      { hash: 'a1b2c3d', title: 'feat(cam): add ballnose surface finishing', type: 'feat', scope: 'cam', description: 'add ballnose surface finishing', isBreaking: false },
      { hash: 'b2c3d4e', title: 'fix(repair): preserve origin coordinate tuples', type: 'fix', scope: 'repair', description: 'preserve origin coordinate tuples', isBreaking: false },
      { hash: 'c3d4e5f', title: 'perf(viewport): optimize 60fps Three.js frame budget', type: 'perf', scope: 'viewport', description: 'optimize 60fps Three.js frame budget', isBreaking: false },
      { hash: 'd4e5f6g', title: 'test: add unit tests for release manager', type: 'test', scope: '', description: 'add unit tests for release manager', isBreaking: false },
    ];

    const changelog = generateChangelogSection('1.1.0', commits, '2026-10-22');

    expect(changelog).toContain('## [1.1.0] — 2026-10-22');
    expect(changelog).toContain('### 🚀 Features & Enhancements');
    expect(changelog).toContain('- **cam:** add ballnose surface finishing (a1b2c3d)');
    expect(changelog).toContain('### 🐛 Bug Fixes & Auto-Repair');
    expect(changelog).toContain('- **repair:** preserve origin coordinate tuples (b2c3d4e)');
    expect(changelog).toContain('### ⚡ Performance Improvements');
    expect(changelog).toContain('- **viewport:** optimize 60fps Three.js frame budget (c3d4e5f)');
    expect(changelog).toContain('### 🛠️ Architecture, Tests & Maintenance');
    expect(changelog).toContain('- add unit tests for release manager (d4e5f6g)');
  });
});
