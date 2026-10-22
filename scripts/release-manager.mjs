#!/usr/bin/env node
/**
 * scripts/release-manager.mjs
 * 
 * Release and versioning orchestrator for ApexCAD Studio.
 * Handles:
 * 1. Divergence analysis between main and dev branches
 * 2. Semantic version (SemVer) calculation based on Conventional Commits
 * 3. Categorized markdown changelog generation
 * 4. Automated package.json version updates
 * 
 * Usage:
 *   node scripts/release-manager.mjs check
 *   node scripts/release-manager.mjs changelog
 *   node scripts/release-manager.mjs bump [auto|patch|minor|major]
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');

/**
 * Execute a shell command and return trimmed output.
 * @param {string} cmd 
 * @returns {string}
 */
export function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

/**
 * Parse commit messages between base and head refs.
 * @param {string} baseRef e.g. "origin/main"
 * @param {string} headRef e.g. "origin/dev"
 * @returns {Array<{ hash: string, title: string, type: string, scope: string, description: string, isBreaking: boolean }>}
 */
export function getCommitsBetween(baseRef = 'origin/main', headRef = 'origin/dev') {
  // Fetch latest ref metadata if git is configured
  const rawLog = run(`git log ${baseRef}..${headRef} --pretty=format:"%h%x09%s"`);
  if (!rawLog) return [];

  const lines = rawLog.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [hash, ...rest] = line.split('\t');
    const title = rest.join('\t').trim();

    // Check for breaking changes indicated by exclamation mark (e.g. feat!:) or explicit footer
    const isBreaking = title.includes('BREAKING CHANGE') || /^[a-zA-Z]+(\([^)]+\))?!:/.test(title);

    // Parse conventional commit format: type(scope): description
    const match = title.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?!?:\s*(.+)$/);
    if (match) {
      return {
        hash,
        title,
        type: match[1].toLowerCase(),
        scope: match[2] || '',
        description: match[3],
        isBreaking,
      };
    }

    return {
      hash,
      title,
      type: 'other',
      scope: '',
      description: title,
      isBreaking,
    };
  });
}

/**
 * Determine the next semantic version based on commit history.
 * @param {string} currentVersion e.g. "1.0.0"
 * @param {Array<object>} commits
 * @param {string} forcedBump "auto" | "patch" | "minor" | "major"
 * @returns {{ nextVersion: string, bumpType: string }}
 */
export function calculateNextVersion(currentVersion, commits, forcedBump = 'auto') {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  let bumpType = forcedBump;
  if (forcedBump === 'auto') {
    if (commits.some((c) => c.isBreaking)) {
      bumpType = 'major';
    } else if (commits.some((c) => c.type === 'feat')) {
      bumpType = 'minor';
    } else {
      bumpType = 'patch';
    }
  }

  let nextVersion = currentVersion;
  switch (bumpType) {
    case 'major':
      nextVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      nextVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      nextVersion = `${major}.${minor}.${patch + 1}`;
      bumpType = 'patch';
      break;
  }

  return { nextVersion, bumpType };
}

/**
 * Generate formatted Markdown changelog section for a release.
 * @param {string} version e.g. "1.1.0"
 * @param {Array<object>} commits
 * @param {string} releaseDate ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
export function generateChangelogSection(version, commits, releaseDate = new Date().toISOString().split('T')[0]) {
  const features = commits.filter((c) => c.type === 'feat');
  const fixes = commits.filter((c) => c.type === 'fix');
  const perf = commits.filter((c) => c.type === 'perf');
  const refactors = commits.filter((c) => ['refactor', 'chore', 'test', 'docs', 'style'].includes(c.type));
  const others = commits.filter((c) => !features.includes(c) && !fixes.includes(c) && !perf.includes(c) && !refactors.includes(c));

  let md = `## [${version}] — ${releaseDate}\n\n`;

  if (features.length > 0) {
    md += `### 🚀 Features & Enhancements\n`;
    for (const f of features) {
      const scope = f.scope ? `**${f.scope}:** ` : '';
      md += `- ${scope}${f.description} (${f.hash})\n`;
    }
    md += `\n`;
  }

  if (fixes.length > 0) {
    md += `### 🐛 Bug Fixes & Auto-Repair\n`;
    for (const f of fixes) {
      const scope = f.scope ? `**${f.scope}:** ` : '';
      md += `- ${scope}${f.description} (${f.hash})\n`;
    }
    md += `\n`;
  }

  if (perf.length > 0) {
    md += `### ⚡ Performance Improvements\n`;
    for (const p of perf) {
      const scope = p.scope ? `**${p.scope}:** ` : '';
      md += `- ${scope}${p.description} (${p.hash})\n`;
    }
    md += `\n`;
  }

  if (refactors.length > 0) {
    md += `### 🛠️ Architecture, Tests & Maintenance\n`;
    for (const r of refactors) {
      const scope = r.scope ? `**${r.scope}:** ` : '';
      md += `- ${scope}${r.description} (${r.hash})\n`;
    }
    md += `\n`;
  }

  if (others.length > 0) {
    md += `### 📦 Other Changes\n`;
    for (const o of others) {
      md += `- ${o.title} (${o.hash})\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Main execution handler when called directly via CLI.
 */
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'check';
  const forcedBump = args[1] || 'auto';

  // Read current version from package.json
  const pkgRaw = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const currentVersion = pkg.version;

  // Retrieve commits on dev ahead of main
  const commits = getCommitsBetween('origin/main', 'HEAD');

  if (action === 'check') {
    console.log(`Current Version in package.json: v${currentVersion}`);
    console.log(`Pending Commits on dev ahead of main: ${commits.length}`);

    if (commits.length === 0) {
      console.log('✅ dev is in sync with main. No scheduled release pending.');
      process.exit(0);
    }

    const { nextVersion, bumpType } = calculateNextVersion(currentVersion, commits, forcedBump);
    console.log(`Suggested Next Release: v${nextVersion} (Bump: ${bumpType.toUpperCase()})`);
    console.log(`\nCommit summary (${commits.length} commits):`);
    for (const c of commits.slice(0, 10)) {
      console.log(`  - [${c.type}] ${c.title}`);
    }
    if (commits.length > 10) {
      console.log(`  ... and ${commits.length - 10} more commits.`);
    }
    process.exit(0);
  }

  if (action === 'changelog') {
    if (commits.length === 0) {
      console.log('No pending commits between origin/main and HEAD.');
      process.exit(0);
    }
    const { nextVersion } = calculateNextVersion(currentVersion, commits, forcedBump);
    const changelogSection = generateChangelogSection(nextVersion, commits);
    console.log(changelogSection);
    process.exit(0);
  }

  if (action === 'bump') {
    if (commits.length === 0 && forcedBump === 'auto') {
      console.log('No pending commits to release. Exiting.');
      process.exit(0);
    }

    const { nextVersion, bumpType } = calculateNextVersion(currentVersion, commits, forcedBump);
    console.log(`Bumping package.json from v${currentVersion} to v${nextVersion} (${bumpType})...`);

    // Update package.json version
    pkg.version = nextVersion;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // Generate changelog section and prepend to CHANGELOG.md
    const newSection = generateChangelogSection(nextVersion, commits);
    let existingChangelog = '';
    if (fs.existsSync(CHANGELOG_PATH)) {
      existingChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
    } else {
      existingChangelog = `# Changelog — ApexCAD Studio\n\nAll notable changes to this project will be documented in this file.\n\n`;
    }

    // Prepend new section after the introduction divider
    const introDivider = '\n---\n\n';
    let updatedChangelog = '';
    if (existingChangelog.includes(introDivider)) {
      const parts = existingChangelog.split(introDivider);
      updatedChangelog = parts[0] + introDivider + newSection + parts.slice(1).join(introDivider);
    } else {
      updatedChangelog = `# Changelog — ApexCAD Studio\n\nAll notable changes to this project will be documented in this file.\n\n---\n\n${newSection}${existingChangelog}`;
    }

    fs.writeFileSync(CHANGELOG_PATH, updatedChangelog, 'utf8');
    console.log(`✅ Successfully updated package.json and CHANGELOG.md to v${nextVersion}`);
    process.exit(0);
  }

  console.error(`Unknown action "${action}". Expected "check", "changelog", or "bump".`);
  process.exit(1);
}

// Execute if run directly from node CLI
if (process.argv[1] && process.argv[1].endsWith('release-manager.mjs')) {
  main().catch((err) => {
    console.error('Release manager error:', err);
    process.exit(1);
  });
}
