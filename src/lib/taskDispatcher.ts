// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Task Dispatcher — spawns a Claude agent process to work a task autonomously.
 * Called automatically when a task is created/assigned with an assignedTo agent.
 */

import { getDb } from './database';
import { calcCostUsd, ENV } from './env';
import { trackEvent } from './telemetry';
import { emitSSEEvent } from './sseEmitter';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn } from 'child_process';

const CLAUDE_BIN    = ENV.CLAUDE_BIN;
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;
const HOME = homedir();

// ── Model resolution ─────────────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  'sonnet': 'claude-sonnet-4-6',
  'opus':   'claude-opus-4-6',
  'haiku':  'claude-haiku-4-5-20251001',
};

function resolveModel(short: string): string {
  return MODEL_MAP[short] ?? (short.startsWith('claude-') ? short : 'claude-sonnet-4-6');
}

// ── Task-to-skill keyword map ──────────────────────────────────────────────────
// Maps task title/description keywords → skill slugs to auto-inject.
// Extend this map as new skills are added to .claude/skills/.

const TASK_SKILL_MAP: Record<string, string[]> = {
  react:        ['react-best-practices'],
  component:    ['react-best-practices', 'composition-patterns'],
  hook:         ['react-best-practices'],
  nextjs:       ['nextjs-patterns'],
  'next.js':    ['nextjs-patterns'],
  route:        ['nextjs-patterns'],
  api:          ['nextjs-patterns'],
  typescript:   ['froggo-coding-standards'],
  refactor:     ['froggo-coding-standards', 'code-review-checklist'],
  review:       ['code-review-checklist'],
  test:         ['froggo-testing-patterns'],
  testing:      ['froggo-testing-patterns'],
  security:     ['security-checklist'],
  auth:         ['security-checklist'],
  git:          ['git-workflow'],
  branch:       ['git-workflow'],
  commit:       ['git-workflow'],
  ui:           ['web-design-guidelines'],
  design:       ['web-design-guidelines'],
  accessibility: ['web-design-guidelines'],
  social:       ['x-twitter-strategy'],
  twitter:      ['x-twitter-strategy'],
  tweet:        ['x-twitter-strategy'],
  routing:      ['agent-routing'],
  dispatch:     ['agent-routing'],
  decompose:    ['task-decomposition'],
  subtask:      ['task-decomposition'],
  composition:  ['composition-patterns'],
  compound:     ['composition-patterns'],
};

/**
 * Extract skill slugs that are relevant to the task title and description.
 * Returns deduplicated skill slugs only (no content).
 */
function getAutoSkills(taskTitle: string, taskDescription?: string | null): string[] {
  const text = `${taskTitle} ${taskDescription || ''}`.toLowerCase();
  const found = new Set<string>();
  for (const [keyword, skills] of Object.entries(TASK_SKILL_MAP)) {
    if (text.includes(keyword)) {
      skills.forEach(s => found.add(s));
    }
  }
  return [...found];
}

// ── Per-tier allowed tool sets ─────────────────────────────────────────────────
// No --dangerously-skip-permissions ever. Each tier explicitly states what it may use.

const MCP_DB = [
  'mcp__mission-control_db__task_list',
  'mcp__mission-control_db__task_get',
  'mcp__mission-control_db__task_create',
  'mcp__mission-control_db__task_update',
  'mcp__mission-control_db__task_add_activity',
  'mcp__mission-control_db__task_add_attachment',
  'mcp__mission-control_db__approval_create',
  'mcp__mission-control_db__approval_check',
  'mcp__mission-control_db__inbox_list',
  'mcp__mission-control_db__agent_status',
  'mcp__mission-control_db__chat_post',
  'mcp__mission-control_db__chat_read',
  'mcp__mission-control_db__chat_rooms_list',
  'mcp__mission-control_db__subtask_create',
  'mcp__mission-control_db__subtask_update',
  'mcp__mission-control_db__schedule_create',
  'mcp__mission-control_db__schedule_list',
];

const MCP_MEMORY = [
  'mcp__memory__memory_search',
  'mcp__memory__memory_recall',
  'mcp__memory__memory_write',
  'mcp__memory__memory_read',
];

const MCP_GOOGLE = [
  // Auth
  'mcp__google-workspace__auth_clear',
  'mcp__google-workspace__auth_refreshToken',
  // Calendar
  'mcp__google-workspace__calendar_createEvent',
  'mcp__google-workspace__calendar_deleteEvent',
  'mcp__google-workspace__calendar_findFreeTime',
  'mcp__google-workspace__calendar_getEvent',
  'mcp__google-workspace__calendar_list',
  'mcp__google-workspace__calendar_listEvents',
  'mcp__google-workspace__calendar_respondToEvent',
  'mcp__google-workspace__calendar_updateEvent',
  // Chat
  'mcp__google-workspace__chat_findDmByEmail',
  'mcp__google-workspace__chat_findSpaceByName',
  'mcp__google-workspace__chat_getMessages',
  'mcp__google-workspace__chat_listSpaces',
  'mcp__google-workspace__chat_listThreads',
  'mcp__google-workspace__chat_sendDm',
  'mcp__google-workspace__chat_sendMessage',
  'mcp__google-workspace__chat_setUpSpace',
  // Docs
  'mcp__google-workspace__docs_appendText',
  'mcp__google-workspace__docs_create',
  'mcp__google-workspace__docs_extractIdFromUrl',
  'mcp__google-workspace__docs_find',
  'mcp__google-workspace__docs_getText',
  'mcp__google-workspace__docs_insertText',
  'mcp__google-workspace__docs_move',
  'mcp__google-workspace__docs_replaceText',
  // Drive
  'mcp__google-workspace__drive_downloadFile',
  'mcp__google-workspace__drive_findFolder',
  'mcp__google-workspace__drive_search',
  // Gmail
  'mcp__google-workspace__gmail_createDraft',
  'mcp__google-workspace__gmail_downloadAttachment',
  'mcp__google-workspace__gmail_get',
  'mcp__google-workspace__gmail_listLabels',
  'mcp__google-workspace__gmail_modify',
  'mcp__google-workspace__gmail_search',
  'mcp__google-workspace__gmail_send',
  'mcp__google-workspace__gmail_sendDraft',
  // People
  'mcp__google-workspace__people_getMe',
  'mcp__google-workspace__people_getUserProfile',
  // Sheets
  'mcp__google-workspace__sheets_find',
  'mcp__google-workspace__sheets_getMetadata',
  'mcp__google-workspace__sheets_getRange',
  'mcp__google-workspace__sheets_getText',
  // Slides
  'mcp__google-workspace__slides_find',
  'mcp__google-workspace__slides_getMetadata',
  'mcp__google-workspace__slides_getText',
  // Time
  'mcp__google-workspace__time_getCurrentDate',
  'mcp__google-workspace__time_getCurrentTime',
  'mcp__google-workspace__time_getTimeZone',
];

const BASH_SAFE = [
  'Bash(npm run *)', 'Bash(npm test *)', 'Bash(npx vitest *)', 'Bash(npx playwright *)',
  'Bash(tsc *)', 'Bash(node *)',
  'Bash(git status)', 'Bash(git diff *)', 'Bash(git add *)', 'Bash(git commit *)',
  'Bash(git log *)', 'Bash(git branch *)', 'Bash(git checkout *)', 'Bash(git stash *)',
  'Bash(cat *)', 'Bash(ls *)', 'Bash(mkdir *)', 'Bash(cp *)', 'Bash(mv *)',
  'Bash(head *)', 'Bash(tail *)', 'Bash(wc *)', 'Bash(grep *)', 'Bash(find *)',
  'Bash(echo *)', 'Bash(qmd *)', 'Bash(sqlite3 *)', 'Bash(tmux *)',
  'Bash(bash tools/*)', 'Bash(sh tools/*)',
];

export const TIER_PERMISSIONS_MAP: Record<number, { allowedTools: string[]; maxPriority: string; requiresApproval: boolean }> = {
  1: { allowedTools: ['mcp__mission-control_db__*'], maxPriority: 'p3', requiresApproval: true },
  2: { allowedTools: ['mcp__mission-control_db__*', 'mcp__memory__*', 'WebSearch', 'WebFetch'], maxPriority: 'p2', requiresApproval: false },
  3: { allowedTools: ['*'], maxPriority: 'p0', requiresApproval: false },
};

export const TIER_TOOLS: Record<string, string[]> = {
  // restricted: read-only files, task tracking only, no writes, no bash, no web
  restricted: [
    'Read', 'Glob', 'Grep',
    ...MCP_DB.filter(t => t !== 'mcp__mission-control_db__task_create'),
    'mcp__memory__memory_search',
    'mcp__memory__memory_recall',
    'mcp__memory__memory_read',
  ],
  // apprentice: can read/write files, full MCP access, web search, no bash
  apprentice: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch',
    ...MCP_DB,
    ...MCP_MEMORY,
  ],
  // worker: + safe bash commands + WebFetch + Agent subagents + Google Workspace
  worker: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
  ],
  // trusted: + notebook editing; same bash as worker (deny list in settings.json still applies)
  trusted: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent', 'NotebookEdit',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
  ],
  // admin: identical to trusted — destructive ops still blocked by settings.json deny list
  admin: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent', 'NotebookEdit',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
  ],
};

// ── Default disallowed tools (seeded into DB on first use) ───────────────────

const DEFAULT_DISALLOWED = [
  'Bash(rm -rf *)',
  'Bash(sudo *)',
  'Bash(curl *)',
  'Bash(wget *)',
  'Bash(git push --force *)',
  'Bash(git reset --hard *)',
  'Bash(chmod *)',
  'Bash(chown *)',
  'Bash(kill *)',
  'Bash(pkill *)',
];

// ── API key injection ─────────────────────────────────────────────────────────
// Reads the agent's assigned key IDs, looks them up in security.keys,
// and returns them as { ENV_VAR_NAME: value } pairs for process injection.

function loadAgentApiKeyEnv(agentId: string): Record<string, string> {
  try {
    const db = getDb();

    // Which key IDs are assigned to this agent?
    const assignedRow = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get(`agent.${agentId}.apiKeys`) as { value: string } | undefined;
    if (!assignedRow?.value) return {};
    const assignedIds: string[] = JSON.parse(assignedRow.value);
    if (!Array.isArray(assignedIds) || assignedIds.length === 0) return {};

    // Full key store
    const keysRow = db.prepare('SELECT value FROM settings WHERE key = ?')
      .get('security.keys') as { value: string } | undefined;
    if (!keysRow?.value) return {};
    const allKeys: { id: string; name: string; service: string; key: string }[] = JSON.parse(keysRow.value);
    if (!Array.isArray(allKeys)) return {};

    const env: Record<string, string> = {};
    for (const keyEntry of allKeys) {
      if (!assignedIds.includes(keyEntry.id)) continue;
      // Derive env var name from service: "OpenAI" → "OPENAI_API_KEY", "Anthropic" → "ANTHROPIC_API_KEY"
      const envName = keyEntry.service
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '') + '_API_KEY';
      env[envName] = keyEntry.key;
    }
    return env;
  } catch { return {}; }
}

export function loadDisallowedTools(agentId: string): string[] {
  try {
    const db = getDb();
    // Global deny list — seed defaults on first use
    const globalRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('security.disallowedTools') as { value: string } | undefined;
    let global: string[];
    if (!globalRow) {
      global = DEFAULT_DISALLOWED;
      db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`).run('security.disallowedTools', JSON.stringify(global));
    } else {
      try { global = JSON.parse(globalRow.value) ?? []; } catch { global = []; }
    }

    // Per-agent additions
    const agentRow = db.prepare('SELECT value FROM settings WHERE key = ?').get(`agent.${agentId}.disallowedTools`) as { value: string } | undefined;
    let perAgent: string[] = [];
    if (agentRow?.value) {
      try { perAgent = JSON.parse(agentRow.value) ?? []; } catch { perAgent = []; }
    }

    // Merge, deduplicate
    return [...new Set([...global, ...perAgent])];
  } catch { return DEFAULT_DISALLOWED; }
}

// ── Task suffix ───────────────────────────────────────────────────────────────

const TASK_SUFFIX = `\n\n---
You are in autonomous task mode. Work through the assigned task using the MCP tools.
Task management: Use mcp__mission-control_db__task_* tools — NOT built-in TaskCreate/TaskList/TaskUpdate.
Do not ask for clarification — interpret and execute. Log activity frequently.

## Before starting — MANDATORY
Re-read planningNotes in full before doing anything. All acceptance criteria are in there.
Call task_activity_create immediately: action="started", message="Started: [one sentence plan]".

## Task pipeline
todo → internal-review (Pre-review) → in-progress → review → done
- You work in the **in-progress** stage.
- When you finish, set status to **review** (NOT done — only Clara can approve done).
- If blocked by something only a human can resolve, use **human-review** (NOT blocked — that status does not exist).
- Never set status to internal-review — the system manages that automatically.

## Activity logging — MANDATORY
Call mcp__mission-control_db__task_add_activity after every meaningful decision or step — this is your audit trail.
- When you start a subtask: action="subtask_started"
- When you complete a subtask: action="subtask_completed", message names what you did
- When you make a significant decision: action="decision"
- When you save a file: action="file_saved", message includes the path
- When you hit an obstacle and resolve it: action="obstacle_resolved"
Minimum: one activity entry per subtask completed.

## Subtask rules — CRITICAL
When creating subtasks, make them specific and checkable (not vague like "implement feature").
Every subtask MUST be executable by a Claude agent using only:
- MCP tools (mcp__mission-control_db__*, mcp__memory__*)
- Filesystem tools (Read, Write, Edit, Glob, Grep)
- Shell (Bash) if your tier allows
- Web tools (WebSearch, WebFetch) if your tier allows

NEVER create subtasks that require:
- Opening a UI, clicking buttons, or viewing a browser
- Human manual review (use human-review task status instead)
- Vague instructions like "review X" without specifying the exact MCP call or file path

Each subtask description must name the exact tool call or file path the agent will use to complete it.

## Done criteria — check ALL before moving to review
Before setting status="review", verify every item:
- [ ] Every subtask is marked complete (not just most — ALL of them, or document why one is N/A)
- [ ] All output files are saved to ~/mission-control/library/ with descriptive names and attached via task_add_attachment
- [ ] task_activity has meaningful entries — not just status changes but real work logs
- [ ] lastAgentUpdate is a brief summary: what you did, what files you created, any caveats

When setting review, set lastAgentUpdate to:
"Completed: [brief summary]. Output: [file paths or 'no files']. Notes: [any caveats]."

## When stuck protocol
After 2 failed attempts at the same approach → try a completely different approach.
After 3 failed approaches total → move the task to 'human-review' immediately.
In lastAgentUpdate describe: (1) each approach tried, (2) the specific error each produced, (3) the exact blocker, (4) what would unblock you.
Do NOT keep looping on a stuck problem — silent looping wastes time. Move to human-review so the human can help.

## Library file routing — ALWAYS use the correct path when saving output files:
| File type | Save to |
|-----------|---------|
| Research docs, analysis, skill maps, notes | ~/mission-control/library/docs/research/ |
| Strategy, plans, roadmaps | ~/mission-control/library/docs/strategies/ |
| Presentations, reports | ~/mission-control/library/docs/presentations/ |
| Platform/technical docs | ~/mission-control/library/docs/platform/ |
| Code, scripts, snippets | ~/mission-control/library/code/ |
| UI designs, mockups | ~/mission-control/library/design/ui/ |
| Images, graphics | ~/mission-control/library/design/images/ |
| Video, media | ~/mission-control/library/design/media/ |
| Campaign assets | ~/mission-control/library/campaigns/campaign-{name}-{date}/ |
| Project deliverables | ~/mission-control/library/projects/project-{name}-{date}/ |

File naming: YYYY-MM-DD_description.ext (e.g. 2026-03-06_research-findings.md)
After saving any file, add it as an attachment: mcp__mission-control_db__task_add_attachment

## Memory Protocol

When your task is complete (before marking review):
Write a memory note using mcp__memory__memory_write:
- category: 'task'
- title: 'YYYY-MM-DD-{brief-slug-of-what-you-built}'
- content: What you built, what worked, what was hard, key patterns discovered, tags

This note helps you and other agents learn from your work.`;

// ── Skills loader ─────────────────────────────────────────────────────────────

function loadAgentSkills(agentId: string, extraSlugs: string[] = []): string {
  try {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(`agent.${agentId}.skills`) as { value: string } | undefined;
    let manualSlugs: string[] = [];
    if (row?.value) {
      try { manualSlugs = JSON.parse(row.value); } catch { manualSlugs = []; }
    }
    if (!Array.isArray(manualSlugs)) manualSlugs = [];

    // Merge manual + auto slugs, deduplicate
    const allSlugs = [...new Set([...manualSlugs, ...extraSlugs])];
    if (allSlugs.length === 0) return '';

    const skillsDir = join(process.cwd(), '.claude', 'skills');
    const blocks: string[] = [];
    for (const slug of allSlugs) {
      const skillPath = join(skillsDir, slug, 'SKILL.md');
      if (existsSync(skillPath)) {
        const content = readFileSync(skillPath, 'utf-8').trim();
        blocks.push(`### Skill: ${slug}\n${content}`);
      }
    }
    if (blocks.length === 0) return '';
    return `\n\n## Your Active Skills\nThe following skills are loaded into your context. Apply them automatically when relevant:\n\n${blocks.join('\n\n---\n\n')}`;
  } catch { return ''; }
}

// ── Permissions loader ────────────────────────────────────────────────────────

function loadPermissionPrompt(agentId: string, trustTier: string): string {
  const lines: string[] = [];

  if (trustTier === 'restricted') {
    lines.push('\n\n## ⚠️ RESTRICTED MODE');
    lines.push('You are operating in restricted mode. Follow these rules strictly:');
    lines.push('- Do NOT execute shell commands');
    lines.push('- Do NOT access files outside the project directory');
    lines.push('- Do NOT make external API calls unless explicitly stated in the task');
    lines.push('- Limit actions to reading files and updating task state via MCP tools');
  } else if (trustTier === 'apprentice') {
    lines.push('\n\n## Operating Mode: Apprentice');
    lines.push('You have standard tool access. Prefer safe, reversible operations. Avoid destructive actions.');
  }

  // Per-action overrides stored as { [action]: 'allow'|'deny'|'reset' }
  try {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(`agent.${agentId}.permissions`) as { value: string } | undefined;
    if (row?.value) {
      const overrides = JSON.parse(row.value) as Record<string, string>;
      const denied = Object.entries(overrides).filter(([, v]) => v === 'deny').map(([k]) => k);
      const allowed = Object.entries(overrides).filter(([, v]) => v === 'allow').map(([k]) => k);
      if (denied.length) lines.push(`\nDenied actions — do NOT perform: ${denied.join(', ')}`);
      if (allowed.length) lines.push(`Explicitly permitted actions: ${allowed.join(', ')}`);
    }
  } catch { /* non-critical */ }

  return lines.join('\n');
}

// ── Memory injection ──────────────────────────────────────────────────────────

/**
 * Search the memory vault for notes relevant to this task.
 * Returns a formatted section string (empty string if no results or error).
 */
function loadRelevantMemory(agentId: string, taskTitle: string, taskDescription?: string | null): string {
  try {
    const vaultDir = join(HOME, 'mission-control', 'memory');
    const agentDir = join(vaultDir, 'agents', agentId);

    if (!existsSync(agentDir)) return '';

    const files = readdirSync(agentDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({ name: f, path: join(agentDir, f), mtime: statSync(join(agentDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20); // Check last 20 notes

    if (files.length === 0) return '';

    // Simple relevance: keyword overlap between task title/desc and note filename/content
    const queryWords = new Set(
      `${taskTitle} ${taskDescription || ''}`.toLowerCase()
        .split(/\W+/).filter(w => w.length > 3)
    );

    const scored = files.map(f => {
      const content = readFileSync(f.path, 'utf-8');
      const nameWords = f.name.toLowerCase().split(/[-_.\s]+/);
      const contentWords = content.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      const score = [...queryWords].filter(w => nameWords.includes(w) || contentWords.slice(0, 200).includes(w)).length;
      return { ...f, content: content.slice(0, 600), score };
    }).filter(f => f.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    if (scored.length === 0) return '';

    // Token budget guard: ~1500 token limit (chars / 4)
    const TOKEN_BUDGET = 1500 * 4; // chars
    let totalChars = 0;
    const capped = scored.filter(f => {
      totalChars += f.content.length;
      return totalChars <= TOKEN_BUDGET;
    });

    if (capped.length === 0) return '';

    const sections = capped.map(f => `### ${f.name.replace('.md', '')}\n${f.content}`).join('\n\n---\n\n');
    return `\n\n## Your Relevant Memory\n_Found ${capped.length} note(s) related to this task:_\n\n${sections}\n\n---\n`;
  } catch {
    return ''; // Non-critical — never block dispatch
  }
}

/**
 * Check for a handoff note from a previous agent assignment.
 * Returns formatted handoff section or empty string.
 */
function loadHandoffNote(taskId: string, agentId: string): string {
  try {
    const agentsDir = join(HOME, 'mission-control', 'memory', 'agents');
    if (!existsSync(agentsDir)) return '';

    const agentFolders = readdirSync(agentsDir);

    for (const folder of agentFolders) {
      if (folder === agentId) continue; // Skip self
      const handoffPath = join(agentsDir, folder, 'handoffs', `${taskId}.md`);
      if (existsSync(handoffPath)) {
        const content = readFileSync(handoffPath, 'utf-8');
        return `\n\n## Handoff from Previous Agent\n${content.slice(0, 800)}\n`;
      }
    }
  } catch {}
  return '';
}

// ── Project context injection ─────────────────────────────────────────────────

function buildProjectContext(projectId: string): string {
  try {
    const projectDir = join(HOME, 'mission-control', 'library', 'projects', projectId);
    const readFile = (name: string): string | null => {
      const p = join(projectDir, name);
      return existsSync(p) ? readFileSync(p, 'utf-8').trim() : null;
    };

    const goal    = readFile('GOAL.md');
    const status  = readFile('STATUS.md');
    const context = readFile('CONTEXT.md');

    const lines = [
      `\n\n## Project Context`,
      `**Project directory**: \`${projectDir}\``,
      `**IMPORTANT**: Save ALL output files (code, designs, docs, scripts) to this directory.`,
      `Use descriptive filenames: \`YYYY-MM-DD_brief-description.ext\``,
      `After saving any file, log it: \`mcp__mission-control_db__task_add_attachment\``,
    ];
    if (goal)    lines.push(`\n### GOAL.md\n${goal}`);
    if (status)  lines.push(`\n### STATUS.md\n${status}`);
    if (context) lines.push(`\n### CONTEXT.md\n${context}`);
    lines.push(`\nUpdate STATUS.md whenever you make significant progress.`);

    lines.push(`\n## Project Room Updates — MANDATORY`);
    lines.push(`Post progress updates to the project chat room as you work.`);
    lines.push(`Room ID: \`project-${projectId}\``);
    lines.push(`Call this at task start, each major milestone, blockers, and completion:`);
    lines.push(`\`\`\`json`);
    lines.push(`mcp__mission-control_db__chat_post {`);
    lines.push(`  "roomId": "project-${projectId}",`);
    lines.push(`  "agentId": "<your-agent-id>",`);
    lines.push(`  "content": "<your update message>"`);
    lines.push(`}`);
    lines.push(`\`\`\``);
    lines.push(`Keep updates concise: what you just did, what you're doing next, or any blockers.`);

    return lines.join('\n');
  } catch { return ''; }
}

// ── Soul file / system prompt ─────────────────────────────────────────────────

function buildApiKeyPrompt(apiKeyEnv: Record<string, string>): string {
  const names = Object.keys(apiKeyEnv);
  if (names.length === 0) return '';
  return `\n\n## Available API Keys\nThe following API keys are available as environment variables:\n${names.map(n => `- \`process.env.${n}\``).join('\n')}`;
}

function buildTaskSystemPrompt(
  agentId: string,
  trustTier: string,
  apiKeyEnv: Record<string, string>,
  task?: Record<string, unknown>
): string | null {
  // Auto-detect relevant skills from task keywords
  const autoSkillSlugs = task
    ? getAutoSkills(task.title as string, task.description as string | null)
    : [];

  const skills = loadAgentSkills(agentId, autoSkillSlugs);
  const permPrompt = loadPermissionPrompt(agentId, trustTier);
  const apiKeyPrompt = buildApiKeyPrompt(apiKeyEnv);

  // Inject relevant memory and handoff notes if task context available
  const relevantMemory = task
    ? loadRelevantMemory(agentId, task.title as string, task.description as string | null)
    : '';
  const handoffNote = task
    ? loadHandoffNote(task.id as string, agentId)
    : '';

  if (relevantMemory && task) {
    trackEvent('memory.injected', { agentId, taskId: task.id as string, noteCount: (relevantMemory.match(/###/g) || []).length });
  }

  // Log auto-assigned skills to task activity (non-critical)
  if (autoSkillSlugs.length > 0 && task?.id) {
    try {
      getDb().prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(task.id as string, 'system', 'skill_auto_assigned', `Auto-skills: ${autoSkillSlugs.join(', ')}`, Date.now());
    } catch { /* non-critical */ }
  }

  // Inject project context if this task belongs to a project
  const projectContext = task?.project_id ? buildProjectContext(task.project_id as string) : '';

  const dir = join(HOME, 'mission-control', 'agents', agentId);
  const soulPath = join(dir, 'SOUL.md');
  if (existsSync(soulPath)) {
    const soul = readFileSync(soulPath, 'utf-8').trim();
    return soul + skills + relevantMemory + handoffNote + projectContext + apiKeyPrompt + permPrompt + TASK_SUFFIX;
  }
  // Fall back to DB personality
  try {
    const agent = getDb().prepare('SELECT name, role, personality FROM agents WHERE id = ?').get(agentId) as {
      personality?: string; role?: string; name?: string;
    } | undefined;
    if (agent) {
      const parts: string[] = [];
      if (agent.role) parts.push(`You are ${agent.name || agentId}, a ${agent.role}.`);
      if (agent.personality) parts.push(agent.personality);
      if (skills) parts.push(skills);
      if (relevantMemory) parts.push(relevantMemory);
      if (handoffNote) parts.push(handoffNote);
      if (apiKeyPrompt) parts.push(apiKeyPrompt);
      if (permPrompt) parts.push(permPrompt);
      parts.push(TASK_SUFFIX.trim());
      return parts.join('\n');
    }
  } catch { /* DB not available */ }
  return null;
}

// ── Session management ────────────────────────────────────────────────────────
// Uses agentId + ':task' as key to avoid colliding with chat sessions.

function loadTaskSession(taskId: string): string | null {
  try {
    const row = getDb().prepare(
      'SELECT sessionId, lastActivity FROM agent_sessions WHERE agentId = ? AND status = ?'
    ).get('task:' + taskId, 'active') as { sessionId: string; lastActivity: number } | undefined;
    if (!row?.sessionId) return null;
    // Expire sessions older than 24 hours
    if (Date.now() - row.lastActivity > 24 * 60 * 60 * 1000) return null;
    return row.sessionId;
  } catch { return null; }
}

function persistTaskSession(taskId: string, sessionId: string, model: string) {
  try {
    const now = Date.now();
    getDb().prepare(`
      INSERT OR REPLACE INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM agent_sessions WHERE agentId = ?), ?), ?, 'active')
    `).run('task:' + taskId, sessionId, model, 'task:' + taskId, now, now);
  } catch { /* non-critical */ }
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildTaskMessage(task: Record<string, unknown>): string {
  const status = task.status as string;
  const lines: string[] = [];

  // ── Context header ──────────────────────────────────────────────────────────
  lines.push(
    `**Task ID**: ${task.id}`,
    `**Title**: ${task.title}`,
    `**Status**: ${status}`,
  );
  if (task.description) lines.push(`**Description**: ${task.description}`);
  if (task.priority) lines.push(`**Priority**: ${task.priority}`);
  if (task.project) lines.push(`**Project**: ${task.project}`);
  if (task.dueDate) lines.push(`**Due**: ${new Date(task.dueDate as number).toLocaleDateString()}`);
  lines.push(``);

  // ── Status-aware instructions ───────────────────────────────────────────────

  if (status === 'internal-review') {
    // Agent set internal-review but session ended before handing off to Clara
    lines.push(
      `## ACTION REQUIRED — Internal review was interrupted, complete it now`,
      ``,
      `Your task is at internal-review. You verified the plan/subtasks but your session ended before handing off to Clara.`,
      ``,
      `Complete the handoff NOW:`,
      ``,
      `1. Re-verify all subtasks are marked complete:`,
      `   mcp__mission-control_db__task_get { "id": "${task.id}" }`,
      `   → Check the "subtasks" array. For any with completed=0 or completed=false:`,
      `   mcp__mission-control_db__subtask_update { "id": "<sub-id>", "completed": true }`,
      ``,
      `2. Hand off to Clara immediately (do this now):`,
      `   mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "action": "completed", "message": "Done: <1-2 sentence summary of deliverables>" }`,
      `   mcp__mission-control_db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <brief label>" }`,
    );
    return lines.join('\n');
  }

  if (status === 'in-progress' && task.reviewNotes) {
    // Task was rejected by Clara and returned for rework
    lines.push(
      `## ACTION REQUIRED — Task returned for rework`,
      ``,
      `Clara has reviewed this task and requested changes:`,
      `**Review feedback**: ${task.reviewNotes}`,
      ``,
      `1. Look up current state:`,
      `   mcp__mission-control_db__task_get { "id": "${task.id}" }`,
      ``,
      `2. Address the feedback. Update subtasks as needed and mark them complete.`,
      ``,
      `3. When all fixes are done, hand off again:`,
      `   mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "action": "completed", "message": "Fixed: <what you changed>" }`,
      `   mcp__mission-control_db__task_update { "id": "${task.id}", "status": "internal-review", "progress": 95 }`,
      `   — Then self-check and immediately move to review:`,
      `   mcp__mission-control_db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <brief label>" }`,
    );
    return lines.join('\n');
  }

  // ── Fresh task / normal flow ─────────────────────────────────────────────────
  lines.push(
    `**First step:** Search your memory for relevant context before starting:`,
    `\`mcp__memory__memory_search\` with query: "${task.title}"`,
    `If you find relevant notes, incorporate them. If not, proceed with fresh context.`,
    ``,
    `You have been assigned a new task. Work on it autonomously now.`,
    ``,
    `## REQUIRED workflow — follow every step in order:`,
    ``,
    `### STEP 1 — Confirm your status (task is already in-progress — the dispatcher set it):`,
    `mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "action": "started", "message": "Started: <one sentence plan>" }`,
    ``,
    `### STEP 2 — Plan and create subtasks:`,
    `- Check for relevant skill: Read ~/git/mission-control-nextjs/.claude/skills/{skill-name}/SKILL.md`,
    `- Write your FULL plan in planningNotes (NOT in description — description is read-only summary):`,
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "planningNotes": "<your full plan, steps, file paths, approach>" }`,
    `- Break into subtasks — one per concrete deliverable. NOTE THE RETURNED ID for each:`,
    `  mcp__mission-control_db__subtask_create { "taskId": "${task.id}", "title": "<step name>", "assignedTo": "<your-id>" }`,
    `  → Returns { "success": true, "id": "sub-xxxx" } — use this ID to mark complete in STEP 3`,
    `  To look up subtask IDs at any time: mcp__mission-control_db__task_get { "id": "${task.id}" }`,
    ``,
    `### STEP 3 — Do the work, updating as you go:`,
    `After EACH subtask is completed, immediately mark it:`,
    `  mcp__mission-control_db__subtask_update { "id": "<subtask-id>", "completed": true }`,
    `  mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "message": "Completed: <subtask name> — <what you did>" }`,
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "progress": <updated 0-100> }`,
    ``,
    `After each file created:`,
    `  mcp__mission-control_db__task_add_attachment { "taskId": "${task.id}", "filePath": "<absolute path>", "fileName": "<name>", "category": "<output|report|code|design|data>", "uploadedBy": "<your-id>" }`,
    ``,
    `If blocked at any point:`,
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "human-review", "lastAgentUpdate": "Blocked: <reason>" }`,
    ``,
    `### STEP 4 — Self-check then hand off to Clara:`,
    `Before handing off, verify locally (do NOT set status to internal-review — that column is for Clara's pre-work gate, not you):`,
    `  mcp__mission-control_db__task_get { "id": "${task.id}" }`,
    `  → Check: planningNotes exist, all subtasks are created, all subtasks marked complete.`,
    `  → If any subtasks are incomplete — complete them first, then mark them done.`,
    `Once all subtasks are done:`,
    `  mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "action": "completed", "message": "Done: <1-2 sentence summary of deliverables>" }`,
    `  mcp__mission-control_db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <brief label>" }`,
    `  (Clara verifies the work was actually completed. Approved → done. Rejected → you get re-dispatched with feedback.)`,
    ``,
    `## Status flow: todo → pre-review → in-progress → review → done`,
    `- "pre-review" (internal-review) → Clara's gate before work starts. You already passed this — you are now in-progress.`,
    `- "in-progress"                  → you are actively working right now`,
    `- "review"                       → Clara verifying your completed work`,
    `- "human-review"                 → need human input (blocker/decision)`,
    ``,
    `IMPORTANT: Do NOT set status to "internal-review" yourself — that is Clara's Pre-review column.`,
    ``,
    `Work autonomously. Do not ask for clarification — interpret and execute.`,
  );

  return lines.join('\n');
}

// ── Re-dispatch deduplication ─────────────────────────────────────────────────
// Prevents scheduling multiple re-dispatch timeouts for the same task.
const _redispatchTimeouts = new Map<string, NodeJS.Timeout>();

// ── Concurrency semaphore ─────────────────────────────────────────────────────
// Limits the number of simultaneous Claude CLI process dispatches.
let activeDispatches = 0;
const MAX_CONCURRENT_DISPATCHES = 5;

// ── Circuit breaker (Phase 85) ─────────────────────────────────────────────────
// Tracks consecutive failures per agent and locks out repeated failures.
const agentFailureCounts = new Map<string, { count: number; lockedUntil?: number }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 10 * 60 * 1000; // 10 minutes

function isAgentCircuitOpen(agentId: string): boolean {
  const record = agentFailureCounts.get(agentId);
  if (!record) return false;
  if (record.lockedUntil) {
    if (Date.now() < record.lockedUntil) return true;
    // Lock expired — reset and notify
    agentFailureCounts.delete(agentId);
    emitSSEEvent('circuit.closed', { agentId });
    return false;
  }
  return record.count >= CIRCUIT_BREAKER_THRESHOLD;
}

function recordAgentFailure(agentId: string) {
  const existing = agentFailureCounts.get(agentId) || { count: 0 };
  const newCount = existing.count + 1;
  agentFailureCounts.set(agentId, {
    count: newCount,
    lockedUntil: newCount >= CIRCUIT_BREAKER_THRESHOLD
      ? Date.now() + CIRCUIT_BREAKER_RESET_MS
      : undefined,
  });

  if (newCount >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[taskDispatcher] Circuit OPEN for agent ${agentId} — locked for 10 minutes`);
    trackEvent('circuit.open', { agentId, failures: newCount }, agentId);
    emitSSEEvent('circuit.open', { agentId, failures: newCount, lockedUntil: agentFailureCounts.get(agentId)?.lockedUntil ?? null });
    try {
      getDb().prepare(`UPDATE agents SET status = 'offline' WHERE id = ?`).run(agentId);
    } catch { /* non-critical */ }
  }
}

/** Export circuit breaker state for API routes / health checks */
export function getCircuitBreakerState(): Record<string, { open: boolean; failures: number; lockedUntil: number | null }> {
  const result: Record<string, { open: boolean; failures: number; lockedUntil: number | null }> = {};
  for (const [agentId, record] of agentFailureCounts.entries()) {
    const open = isAgentCircuitOpen(agentId);
    result[agentId] = {
      open,
      failures: record.count,
      lockedUntil: record.lockedUntil ?? null,
    };
  }
  return result;
}

function recordAgentSuccess(agentId: string) {
  const hadRecord = agentFailureCounts.has(agentId);
  agentFailureCounts.delete(agentId);
  if (hadRecord) {
    emitSSEEvent('circuit.closed', { agentId });
  }
}

// ── Dispatch debounce ────────────────────────────────────────────────────────
// Prevents rapid-fire dispatches to the same agent within 100ms.
// Uses a simple in-memory last-dispatch timestamp per agent.
type DG = typeof globalThis & { _lastDispatch?: Map<string, number> };
const lastDispatch: Map<string, number> = (globalThis as DG)._lastDispatch
  ?? ((globalThis as DG)._lastDispatch = new Map());
const DEBOUNCE_MS = 100;

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Dispatch a task to its assigned agent.
 * Spawns a detached Claude CLI process with full agent context.
 * Returns true if dispatch succeeded, false if skipped (no assignedTo, etc).
 */
export function dispatchTask(taskId: string): boolean {
  // Warn if Claude binary missing — don't throw, let spawn fail gracefully
  if (!existsSync(CLAUDE_BIN)) {
    console.warn(`[taskDispatcher] WARNING: Claude binary not found at ${CLAUDE_BIN}`);
  }

  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;

    if (!task) {
      console.warn(`[taskDispatcher] Task ${taskId} not found`);
      return false;
    }

    const agentId = task.assignedTo as string | null;
    if (!agentId) {
      return false; // No agent assigned — nothing to dispatch
    }

    // Debounce: skip if we dispatched to this agent within 100ms
    const now = Date.now();
    const last = lastDispatch.get(agentId) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      console.log(`[taskDispatcher] Debounced dispatch to ${agentId} (too rapid)`);
      return false;
    }
    lastDispatch.set(agentId, now);

    // Get per-agent model and trust tier from DB
    const agentRow = db.prepare('SELECT model, trust_tier FROM agents WHERE id = ?').get(agentId) as
      { model?: string; trust_tier?: string } | undefined;
    // Priority-based model override: P0/P1 tasks use opus for higher reasoning capacity.
    // Per-agent model from DB can still override this if explicitly set to opus/sonnet/haiku.
    const taskPriority = (task.priority as string | null) ?? 'p2';
    const agentModelPref = agentRow?.model ?? 'sonnet';
    let effectiveModel = agentModelPref;
    if (agentModelPref === 'sonnet' || agentModelPref === 'claude-sonnet-4-6') {
      // Auto-upgrade to opus for P0/P1 unless the agent explicitly prefers a different tier
      if (taskPriority === 'p0' || taskPriority === 'p1') {
        effectiveModel = 'opus';
        console.log(`[taskDispatcher] Auto-upgrading model to opus for ${taskPriority} task ${taskId}`);
      }
    }
    const model = resolveModel(effectiveModel);
    const trustTier = agentRow?.trust_tier ?? 'apprentice';

    // Resolve allowed tools for this trust tier
    const allowedTools = TIER_TOOLS[trustTier] ?? TIER_TOOLS['worker'];
    // Resolve disallowed tools (global + per-agent from DB)
    const disallowedTools = loadDisallowedTools(agentId);
    // Resolve API key env vars for this agent
    const apiKeyEnv = loadAgentApiKeyEnv(agentId);

    // Build args — use --resume if session exists, otherwise --system-prompt with soul file
    const existingSession = loadTaskSession(taskId);
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', model,
      '--allowedTools', allowedTools.join(','),
      '--disallowedTools', disallowedTools.join(','),
    ];

    if (existingSession) {
      args.push('--resume', existingSession);
      // Session already has context — don't add --system-prompt
    } else {
      const systemPrompt = buildTaskSystemPrompt(agentId, trustTier, apiKeyEnv, task);
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
    }

    const message = buildTaskMessage(task);

    // Strip Claude session env vars so nested spawn is allowed
    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } =
      process.env as Record<string, string | undefined>;

    // cwd = project root (not agent workspace) so .claude/settings.json MCP config is loaded
    const cwd = process.cwd();

    // Circuit breaker check — escalate to human-review instead of silently dropping
    if (isAgentCircuitOpen(agentId)) {
      console.warn(`[taskDispatcher] Circuit open for ${agentId} — escalating task ${taskId} to human-review`);
      trackEvent('dispatch.blocked.circuit', { taskId, agentId }, agentId);
      try {
        db.prepare(`UPDATE tasks SET status = 'human-review', updatedAt = ? WHERE id = ?`).run(Date.now(), taskId);
        db.prepare(`INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`)
          .run(taskId, 'system', 'circuit_open_escalation',
            `Agent circuit breaker is open (too many recent failures). Task moved to human-review.`, Date.now());
        // Post to mission-control room so the human sees it
        try {
          db.prepare(`INSERT INTO chat_room_messages (roomId, agentId, content, timestamp) VALUES (?, ?, ?, ?)`)
            .run('mission-control', 'system',
              `Task "${task.title}" was escalated to human-review: agent ${agentId} circuit breaker is open (too many recent failures).`,
              Date.now());
        } catch { /* non-critical */ }
      } catch (e) {
        console.error('[taskDispatcher] Failed to escalate circuit-open task:', e);
      }
      return false;
    }

    // Concurrency check — skip if at limit
    if (activeDispatches >= MAX_CONCURRENT_DISPATCHES) {
      console.warn(`[taskDispatcher] Concurrency limit reached (${MAX_CONCURRENT_DISPATCHES}). Task ${taskId} skipped.`);
      return false;
    }
    activeDispatches++;

    // Telemetry: dispatch started
    trackEvent('dispatch.start', { taskId, agentId });

    const proc = spawn(NODE_BIN, [CLAUDE_SCRIPT, ...args], {
      cwd,
      env: { ...cleanEnv, CLAUDE_AGENT_ID: agentId, ...apiKeyEnv } as unknown as NodeJS.ProcessEnv,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Capture stderr for error reporting
    let stderrBuf = '';
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    // Write message to stdin
    proc.stdin!.write(message);
    proc.stdin!.end();

    // Parse stdout for session_id (from stream-json "result" event)
    let outBuf = '';
    proc.stdout!.on('data', (data: Buffer) => {
      outBuf += data.toString();
      const lines = outBuf.split('\n');
      outBuf = lines.pop() ?? '';
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.trim()) as {
            type?: string; session_id?: string;
            input_tokens?: number; output_tokens?: number;
          };
          if (parsed.type === 'result') {
            if (parsed.session_id) {
              persistTaskSession(taskId, parsed.session_id, model);
            }
            // Log token usage
            const inputT  = parsed.input_tokens  ?? 0;
            const outputT = parsed.output_tokens ?? 0;
            if (inputT > 0 || outputT > 0) {
              try {
                const costUsd = calcCostUsd(model, inputT, outputT);
                getDb().prepare(
                  `INSERT INTO token_usage (agentId, taskId, sessionId, model, inputTokens, outputTokens, costUsd, source, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'dispatch', ?)`
                ).run(agentId, taskId, parsed.session_id ?? null, model, inputT, outputT, costUsd, Date.now());
              } catch { /* non-critical */ }
            }
          }
        } catch { /* not JSON, ignore */ }
      }
    });

    // Log exit code and update task status on failure
    proc.on('close', (code) => {
      activeDispatches = Math.max(0, activeDispatches - 1);

      // Circuit breaker tracking
      if (code === 0) {
        recordAgentSuccess(agentId);
        trackEvent('dispatch.complete', { taskId, agentId, exitCode: code });
      } else {
        recordAgentFailure(agentId);
        const stderrSnippet = stderrBuf.slice(0, 200);
        trackEvent('dispatch.error', { taskId, agentId, exitCode: code, stderr: stderrSnippet }, agentId);
      }

      // Log stderr on non-zero exit
      if (code !== 0 && stderrBuf) {
        const errorSnippet = stderrBuf.slice(0, 500);
        console.error(`[taskDispatcher] Agent ${agentId} task ${taskId} failed (exit ${code}): ${errorSnippet}`);
        try {
          getDb().prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(taskId, 'system', 'dispatch_stderr', `Dispatch failed (exit ${code}): ${errorSnippet}`, Date.now());
        } catch { /* non-critical */ }
      }

      try {
        const exitMsg = code === 0
          ? `Agent ${agentId} completed task dispatch (exit 0)`
          : `Agent ${agentId} exited with code ${code}`;
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(taskId, agentId, 'dispatch_exit', exitMsg, Date.now());

        if (code !== 0) {
          const current = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
          if (current && (current.status === 'todo' || current.status === 'in-progress')) {
            db.prepare(
              `UPDATE tasks SET status = 'human-review', lastAgentUpdate = ? WHERE id = ?`
            ).run(`Dispatch process exited with code ${code}. Needs human review to unblock.`, taskId);
          }
        }

        // If agent exited cleanly but task is still mid-flight, re-dispatch
        // to complete the handoff (agent's session ended mid-step)
        if (code === 0) {
          const current = db.prepare('SELECT status, assignedTo FROM tasks WHERE id = ?')
            .get(taskId) as { status: string; assignedTo: string | null } | undefined;
          // Only re-dispatch from in-progress — internal-review is Clara's pre-work gate,
          // not a state an agent can be stuck in during dispatch.
          const stuckInFlight = current?.assignedTo && current.status === 'in-progress';
          if (stuckInFlight) {
            // Count prior auto-redispatch attempts to prevent infinite loops
            const redispatchCount = (db.prepare(
              `SELECT COUNT(*) as cnt FROM task_activity WHERE taskId = ? AND action = 'auto_redispatch'`
            ).get(taskId) as { cnt: number } | undefined)?.cnt ?? 0;

            if (redispatchCount < 3) {
              db.prepare(
                `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
              ).run(taskId, 'system', 'auto_redispatch',
                `Task left in ${current.status} after agent exit — re-dispatching to complete handoff (attempt ${redispatchCount + 1}/3)`,
                Date.now());
              if (!_redispatchTimeouts.has(taskId)) {
                const t = setTimeout(() => {
                  _redispatchTimeouts.delete(taskId);
                  dispatchTask(taskId);
                }, 5000);
                _redispatchTimeouts.set(taskId, t);
              }
            } else {
              // Too many retries — escalate to human
              db.prepare(
                `UPDATE tasks SET status = 'human-review', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`
              ).run(
                `Agent exited without completing task after 3 re-dispatch attempts. Needs human review.`,
                Date.now(), taskId
              );
              db.prepare(
                `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
              ).run(taskId, 'system', 'auto_redispatch_failed',
                'Moved to human-review after 3 failed re-dispatch attempts', Date.now());
            }
          }
        }
      } catch { /* non-critical */ }
    });

    // Handle spawn errors (e.g. ENOENT if claude binary not found)
    proc.on('error', (err) => {
      activeDispatches = Math.max(0, activeDispatches - 1);
      console.error(`[taskDispatcher] Spawn error for task ${taskId}:`, err);
      try {
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(taskId, agentId, 'dispatch_error', `Spawn failed: ${err.message}`, Date.now());
        db.prepare(
          `UPDATE tasks SET status = 'human-review', lastAgentUpdate = ? WHERE id = ?`
        ).run(`Could not start agent: ${err.message}. Needs human review to unblock.`, taskId);
      } catch { /* non-critical */ }
    });

    proc.unref();

    // Auto-advance task to in-progress on dispatch — only from internal-review (Clara's gate).
    // Tasks in todo have not passed the quality gate yet; the dispatcher should not skip it.
    const now2 = Date.now();
    try {
      const cur = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
      if (cur?.status === 'internal-review') {
        db.prepare('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?').run('in-progress', now2, taskId);
      }
      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(
        taskId,
        agentId,
        'dispatch',
        `Task dispatched to ${agentId} (model: ${model}, ${existingSession ? 'resumed session' : 'new session'})`,
        now2
      );
    } catch { /* non-critical */ }

    console.log(`[taskDispatcher] Dispatched task ${taskId} to agent ${agentId} (model: ${model}, tier: ${trustTier}, cwd: ${cwd})`);
    return true;
  } catch (err) {
    console.error('[taskDispatcher] Error:', err);
    return false;
  }
}

// ── Startup recovery ──────────────────────────────────────────────────────────
// Re-queues tasks stuck in 'in-progress' from a previous server session.
// After a restart, no active dispatch processes exist, so any in-progress task
// must be re-dispatched to resume work.
type GD = typeof globalThis & { _dispatcherStartupDone?: boolean };

export function recoverStuckInProgressTasks(): void {
  const g = globalThis as GD;
  if (g._dispatcherStartupDone) return;
  g._dispatcherStartupDone = true;

  try {
    const db = getDb();
    const stuck = db.prepare(
      `SELECT id, assignedTo FROM tasks WHERE status = 'in-progress' AND assignedTo IS NOT NULL`
    ).all() as { id: string; assignedTo: string }[];

    if (stuck.length === 0) return;

    console.log(`[taskDispatcher] Recovering ${stuck.length} task(s) stuck in in-progress from previous session`);
    let staggerIndex = 0;
    for (const task of stuck) {
      // Skip if already queued for re-dispatch (prevents double-dispatch on concurrent callers)
      if (_redispatchTimeouts.has(task.id)) continue;

      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(task.id, 'system', 'auto_redispatch',
        'Task was in-progress at server startup — re-dispatching to resume work (attempt 1/3)', Date.now());

      // Exponential backoff stagger: 5s, 15s, 30s, 60s, then 60s for any beyond 4
      const backoffMs = [5_000, 15_000, 30_000, 60_000];
      const delay = backoffMs[Math.min(staggerIndex, backoffMs.length - 1)];
      staggerIndex++;

      const t = setTimeout(() => {
        _redispatchTimeouts.delete(task.id);
        dispatchTask(task.id);
      }, delay);
      _redispatchTimeouts.set(task.id, t);
    }
  } catch (err) {
    console.error('[taskDispatcher] Startup recovery error:', err);
  }
}
