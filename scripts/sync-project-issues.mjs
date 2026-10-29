#!/usr/bin/env node
/**
 * scripts/sync-project-issues.mjs
 *
 * Project Milestone, Epic, Sub-Issue & Dependency Orchestrator for ApexCAD Studio.
 *
 * Capabilities:
 * 1. `list`   — Prints the complete hierarchy of Milestones, Parent Epics, Sub-Issues, and Dependency Links.
 * 2. `verify` — Validates referential integrity (all epic/milestone IDs, acyclic dependencies, and target files exist).
 * 3. `sync`   — Idempotently syncs Labels, Milestones, Parent Epics, and Sub-Issues (with #issue cross-linking
 *               and GitHub sub-issue task lists) to GitHub via REST API (`GITHUB_TOKEN`) or `gh` CLI.
 *
 * Usage:
 *   node scripts/sync-project-issues.mjs list
 *   node scripts/sync-project-issues.mjs verify
 *   node scripts/sync-project-issues.mjs sync [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(__dirname, 'project-issues-manifest.json');

export function loadManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw);
}

/**
 * Validates the manifest structure, cross-references, dependency graph, and target file paths.
 */
export function verifyManifest(manifest = loadManifest()) {
  const errors = [];
  const milestoneIds = new Set(manifest.milestones.map((m) => m.id));
  const epicIds = new Set(manifest.epics.map((e) => e.id));
  const subIssueIds = new Set(manifest.subIssues.map((s) => s.id));
  const labelNames = new Set(manifest.labels.map((l) => l.name));

  // 1. Validate Epics
  for (const epic of manifest.epics) {
    if (!milestoneIds.has(epic.milestoneId)) {
      errors.push(`Epic ${epic.id} references unknown milestone ${epic.milestoneId}`);
    }
    for (const lbl of epic.labels) {
      if (!labelNames.has(lbl)) {
        errors.push(`Epic ${epic.id} references undeclared label "${lbl}"`);
      }
    }
    for (const subId of epic.subIssueIds) {
      if (!subIssueIds.has(subId)) {
        errors.push(`Epic ${epic.id} references unknown sub-issue ${subId}`);
      }
    }
  }

  // 2. Validate Sub-Issues & Dependencies
  for (const sub of manifest.subIssues) {
    if (!epicIds.has(sub.epicId)) {
      errors.push(`Sub-issue ${sub.id} references unknown epic ${sub.epicId}`);
    }
    if (!milestoneIds.has(sub.milestoneId)) {
      errors.push(`Sub-issue ${sub.id} references unknown milestone ${sub.milestoneId}`);
    }
    for (const lbl of sub.labels) {
      if (!labelNames.has(lbl)) {
        errors.push(`Sub-issue ${sub.id} references undeclared label "${lbl}"`);
      }
    }
    for (const depId of sub.dependsOn || []) {
      if (!subIssueIds.has(depId)) {
        errors.push(`Sub-issue ${sub.id} dependsOn unknown sub-issue ${depId}`);
      }
      if (depId === sub.id) {
        errors.push(`Sub-issue ${sub.id} cannot depend on itself`);
      }
    }
    for (const blkId of sub.blocks || []) {
      if (!subIssueIds.has(blkId)) {
        errors.push(`Sub-issue ${sub.id} blocks unknown sub-issue ${blkId}`);
      }
    }
    for (const relFile of sub.targetFiles || []) {
      const fullPath = path.join(ROOT_DIR, relFile);
      if (!fs.existsSync(fullPath)) {
        errors.push(`Sub-issue ${sub.id} references non-existent target path: ${relFile}`);
      }
    }
  }

  // 3. Cycle detection on dependsOn graph
  const adj = new Map();
  for (const sub of manifest.subIssues) {
    adj.set(sub.id, sub.dependsOn || []);
  }
  const visited = new Set();
  const inStack = new Set();

  function hasCycle(nodeId) {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of adj.get(nodeId) || []) {
      if (hasCycle(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }

  for (const sub of manifest.subIssues) {
    if (hasCycle(sub.id)) {
      errors.push(`Dependency cycle detected involving sub-issue ${sub.id}`);
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      milestones: manifest.milestones.length,
      labels: manifest.labels.length,
      epics: manifest.epics.length,
      subIssues: manifest.subIssues.length,
      completedSubIssues: manifest.subIssues.filter((s) => s.status === 'completed').length,
    },
  };
}

/**
 * Formats the markdown body for a Sub-Issue with parent epic link, dependency links, and acceptance criteria.
 */
export function formatSubIssueMarkdown(sub, epicIssueNumberMap = new Map(), subIssueNumberMap = new Map()) {
  const parentRef = epicIssueNumberMap.has(sub.epicId)
    ? `#${epicIssueNumberMap.get(sub.epicId)} (\`${sub.epicId}\`)`
    : `\`${sub.epicId}\``;

  const dependsList =
    sub.dependsOn && sub.dependsOn.length > 0
      ? sub.dependsOn
          .map((id) => (subIssueNumberMap.has(id) ? `#${subIssueNumberMap.get(id)} (\`${id}\`)` : `\`${id}\``))
          .join(', ')
      : 'None (Ready to start)';

  const blocksList =
    sub.blocks && sub.blocks.length > 0
      ? sub.blocks
          .map((id) => (subIssueNumberMap.has(id) ? `#${subIssueNumberMap.get(id)} (\`${id}\`)` : `\`${id}\``))
          .join(', ')
      : 'None';

  const filesMd = (sub.targetFiles || []).map((f) => `- \`${f}\``).join('\n');
  const criteriaMd = (sub.acceptanceCriteria || [])
    .map((c) => `- [${sub.status === 'completed' ? 'x' : ' '}] ${c}`)
    .join('\n');

  return [
    `> **Tracking ID:** \`${sub.id}\` | **Milestone:** \`${sub.milestoneId}\` | **Parent Epic:** ${parentRef}`,
    '',
    '### Summary & Engineering Scope',
    sub.description,
    '',
    '### Cross-Issue Dependency Links',
    `- **Part of Parent Epic:** ${parentRef}`,
    `- **Depends On:** ${dependsList}`,
    `- **Blocks Downstream:** ${blocksList}`,
    '',
    '### Target Repository Files',
    filesMd,
    '',
    '### Acceptance Criteria (Definition of Done)',
    criteriaMd,
  ].join('\n');
}

/**
 * Formats the markdown body for a Parent Epic Issue with a GitHub Sub-Issue task checklist.
 */
export function formatEpicMarkdown(epic, milestone, subIssues, subIssueNumberMap = new Map()) {
  const linkedSubs = subIssues.filter((s) => s.epicId === epic.id);
  const subChecklist = linkedSubs
    .map((s) => {
      const checked = s.status === 'completed' ? 'x' : ' ';
      const numRef = subIssueNumberMap.has(s.id) ? `#${subIssueNumberMap.get(s.id)} — ` : '';
      const deps =
        s.dependsOn && s.dependsOn.length > 0 ? ` *(depends on: ${s.dependsOn.join(', ')})*` : '';
      return `- [${checked}] ${numRef}**\`${s.id}\`**: ${s.title}${deps}`;
    })
    .join('\n');

  const exitGates = (milestone?.exitCriteria || []).map((c) => `- [ ] ${c}`).join('\n');

  return [
    `> **Epic ID:** \`${epic.id}\` | **Milestone:** \`${milestone?.title || epic.milestoneId}\``,
    '',
    '### Epic Overview & Target End State',
    epic.summary,
    '',
    `**Target User Outcome:** ${milestone?.targetEndState || ''}`,
    '',
    '### Linked Sub-Issues Checklist',
    subChecklist,
    '',
    '### Milestone Release Exit Criteria (Definition of Done)',
    exitGates,
  ].join('\n');
}

/**
 * Synchronizes Labels, Milestones, Epics, and Sub-Issues with GitHub REST API using GITHUB_TOKEN.
 */
async function syncWithGitHubApi(manifest, dryRun = false) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoSlug = process.env.GITHUB_REPOSITORY || manifest.repository;

  if (!token && !dryRun) {
    console.log('ℹ️  No GITHUB_TOKEN / GH_TOKEN detected in environment.');
    console.log('   To push milestones and issues directly to GitHub:');
    console.log('   1. Run `GITHUB_TOKEN=$(gh auth token) npm run issues:sync`, OR');
    console.log('   2. Trigger the `.github/workflows/sync-milestones-and-issues.yml` workflow in GitHub Actions.');
    return;
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const apiBase = `https://api.github.com/repos/${repoSlug}`;

  async function ghRequest(method, endpoint, body) {
    if (dryRun) {
      console.log(`[DRY-RUN] ${method} ${endpoint}`);
      return {};
    }
    const res = await fetch(`${apiBase}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && res.status !== 422) {
      const text = await res.text();
      throw new Error(`GitHub API ${method} ${endpoint} failed (${res.status}): ${text}`);
    }
    return res.status === 204 ? {} : await res.json();
  }

  console.log(`\n🔄 Syncing ${manifest.labels.length} labels to ${repoSlug}...`);
  for (const label of manifest.labels) {
    await ghRequest('POST', '/labels', {
      name: label.name,
      color: label.color,
      description: label.description,
    });
  }

  console.log(`🔄 Syncing ${manifest.milestones.length} milestones to ${repoSlug}...`);
  const existingMilestones = dryRun ? [] : await ghRequest('GET', '/milestones?state=all&per_page=100');
  const milestoneNumberMap = new Map();

  for (const ms of manifest.milestones) {
    const found = Array.isArray(existingMilestones)
      ? existingMilestones.find((m) => m.title === ms.title || m.title.startsWith(ms.version))
      : null;

    const description = `${ms.targetEndState}\n\nExit Criteria:\n${ms.exitCriteria.map((c) => `• ${c}`).join('\n')}`;
    if (found) {
      await ghRequest('PATCH', `/milestones/${found.number}`, {
        title: ms.title,
        description,
        due_on: ms.dueOn,
      });
      milestoneNumberMap.set(ms.id, found.number);
    } else {
      const created = await ghRequest('POST', '/milestones', {
        title: ms.title,
        state: ms.state || 'open',
        description,
        due_on: ms.dueOn,
      });
      milestoneNumberMap.set(ms.id, created.number || 1);
    }
  }

  const existingIssues = dryRun ? [] : await ghRequest('GET', '/issues?state=all&per_page=100');
  const epicIssueNumberMap = new Map();
  const subIssueNumberMap = new Map();

  // Pass 1: Create or find Parent Epics
  console.log(`🔄 Syncing ${manifest.epics.length} parent epic issues...`);
  for (const epic of manifest.epics) {
    const msObj = manifest.milestones.find((m) => m.id === epic.milestoneId);
    const msNum = milestoneNumberMap.get(epic.milestoneId);
    const found = Array.isArray(existingIssues)
      ? existingIssues.find((i) => i.title === epic.title || (i.body && i.body.includes(`\`${epic.id}\``)))
      : null;

    const initialBody = formatEpicMarkdown(epic, msObj, manifest.subIssues, subIssueNumberMap);
    if (found) {
      epicIssueNumberMap.set(epic.id, found.number);
    } else {
      const created = await ghRequest('POST', '/issues', {
        title: epic.title,
        body: initialBody,
        milestone: msNum,
        labels: epic.labels,
      });
      epicIssueNumberMap.set(epic.id, created.number || 100);
    }
  }

  // Pass 2: Create or update Sub-Issues with Parent Epic links
  console.log(`🔄 Syncing ${manifest.subIssues.length} sub-issues...`);
  for (const sub of manifest.subIssues) {
    const msNum = milestoneNumberMap.get(sub.milestoneId);
    const found = Array.isArray(existingIssues)
      ? existingIssues.find((i) => i.title === sub.title || (i.body && i.body.includes(`**Tracking ID:** \`${sub.id}\``)))
      : null;

    const body = formatSubIssueMarkdown(sub, epicIssueNumberMap, subIssueNumberMap);
    if (found) {
      await ghRequest('PATCH', `/issues/${found.number}`, {
        title: sub.title,
        body,
        milestone: msNum,
        labels: sub.labels,
        state: sub.status === 'completed' ? 'closed' : 'open',
      });
      subIssueNumberMap.set(sub.id, found.number);
    } else {
      const created = await ghRequest('POST', '/issues', {
        title: sub.title,
        body,
        milestone: msNum,
        labels: sub.labels,
      });
      if (sub.status === 'completed' && created.number) {
        await ghRequest('PATCH', `/issues/${created.number}`, { state: 'closed' });
      }
      subIssueNumberMap.set(sub.id, created.number || 200);
    }
  }

  // Pass 3: Update Sub-Issues and Parent Epics with resolved #issue_number cross-links
  console.log(`🔄 Updating parent epics and sub-issues with resolved #issue cross-links...`);
  for (const sub of manifest.subIssues) {
    const num = subIssueNumberMap.get(sub.id);
    if (num) {
      const body = formatSubIssueMarkdown(sub, epicIssueNumberMap, subIssueNumberMap);
      await ghRequest('PATCH', `/issues/${num}`, { body });
    }
  }

  for (const epic of manifest.epics) {
    const num = epicIssueNumberMap.get(epic.id);
    const msObj = manifest.milestones.find((m) => m.id === epic.milestoneId);
    if (num) {
      const body = formatEpicMarkdown(epic, msObj, manifest.subIssues, subIssueNumberMap);
      await ghRequest('PATCH', `/issues/${num}`, { body });
    }
  }

  console.log(`✅ Successfully synced all Milestones, Epics, Sub-Issues, and Dependency Links to ${repoSlug}!`);
}

function printList(manifest) {
  console.log(`================================================================================`);
  console.log(`  ${manifest.project} — Milestone & Sub-Issue Tracking Hierarchy`);
  console.log(`================================================================================\n`);

  for (const ms of manifest.milestones) {
    const epic = manifest.epics.find((e) => e.milestoneId === ms.id);
    const subs = manifest.subIssues.filter((s) => s.milestoneId === ms.id);
    const doneCount = subs.filter((s) => s.status === 'completed').length;

    console.log(`🎯 MILESTONE ${ms.id}: ${ms.title} [${doneCount}/${subs.length} completed]`);
    console.log(`   End State: ${ms.targetEndState}`);
    if (epic) {
      console.log(`   📦 Parent Epic (${epic.id}): ${epic.title}`);
    }
    for (const s of subs) {
      const icon = s.status === 'completed' ? '✅' : '⬜';
      const deps = s.dependsOn?.length ? ` (depends on: ${s.dependsOn.join(', ')})` : '';
      const blocks = s.blocks?.length ? ` [blocks: ${s.blocks.join(', ')}]` : '';
      console.log(`      ${icon} ${s.id}: ${s.title}${deps}${blocks}`);
    }
    console.log('');
  }
}

async function main() {
  const action = process.argv[2] || 'list';
  const dryRun = process.argv.includes('--dry-run');
  const manifest = loadManifest();

  if (action === 'list') {
    printList(manifest);
    return;
  }

  if (action === 'verify') {
    const res = verifyManifest(manifest);
    if (!res.valid) {
      console.error('❌ Manifest verification failed:');
      for (const err of res.errors) console.error(`  - ${err}`);
      process.exit(1);
    }
    console.log(
      `✅ Manifest verified: ${res.stats.milestones} milestones, ${res.stats.epics} parent epics, ${res.stats.subIssues} sub-issues (${res.stats.completedSubIssues} completed), 0 dependency cycles.`
    );
    return;
  }

  if (action === 'sync') {
    const res = verifyManifest(manifest);
    if (!res.valid) {
      console.error('❌ Cannot sync invalid manifest:', res.errors);
      process.exit(1);
    }
    await syncWithGitHubApi(manifest, dryRun);
    return;
  }

  console.error(`Unknown command "${action}". Expected "list", "verify", or "sync".`);
  process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('sync-project-issues.mjs')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
