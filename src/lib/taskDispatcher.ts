// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Task Dispatcher — spawns a Claude agent process to work a task autonomously.
 * Called automatically when a task is created/assigned with an assignedTo agent.
 */

import { getDb } from './database';
import { calcCostUsd, ENV } from './env';
import { trackEvent } from './telemetry';
import { existsSync, readFileSync } from 'fs';
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

## Library file routing — ALWAYS use the correct path when saving output files:
| File type | Save to |
|-----------|---------|
| Research docs, analysis, skill maps, notes | ~/mission-control/library/docs/research/ |
| Strategy, plans, roadmaps | ~/mission-control/library/docs/stratagies/ |
| Presentations, reports | ~/mission-control/library/docs/presentations/ |
| Platform/technical docs | ~/mission-control/library/docs/platform/ |
| Code, scripts, snippets | ~/mission-control/library/code/ |
| UI designs, mockups | ~/mission-control/library/design/ui/ |
| Images, graphics | ~/mission-control/library/design/images/ |
| Video, media | ~/mission-control/library/design/media/ |
| Campaign assets | ~/mission-control/library/campaigns/campaign-{name}-{date}/ |
| Project deliverables | ~/mission-control/library/projects/project-{name}-{date}/ |

File naming: YYYY-MM-DD_description.ext (e.g. 2026-03-06_research-findings.md)
After saving any file, add it as an attachment: mcp__mission-control_db__task_add_attachment`;

// ── Skills loader ─────────────────────────────────────────────────────────────

function loadAgentSkills(agentId: string): string {
  try {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(`agent.${agentId}.skills`) as { value: string } | undefined;
    if (!row?.value) return '';
    const slugs: string[] = JSON.parse(row.value);
    if (!Array.isArray(slugs) || slugs.length === 0) return '';

    const skillsDir = join(process.cwd(), '.claude', 'skills');
    const blocks: string[] = [];
    for (const slug of slugs) {
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

// ── Soul file / system prompt ─────────────────────────────────────────────────

function buildApiKeyPrompt(apiKeyEnv: Record<string, string>): string {
  const names = Object.keys(apiKeyEnv);
  if (names.length === 0) return '';
  return `\n\n## Available API Keys\nThe following API keys are available as environment variables:\n${names.map(n => `- \`process.env.${n}\``).join('\n')}`;
}

function buildTaskSystemPrompt(agentId: string, trustTier: string, apiKeyEnv: Record<string, string>): string | null {
  const skills = loadAgentSkills(agentId);
  const permPrompt = loadPermissionPrompt(agentId, trustTier);
  const apiKeyPrompt = buildApiKeyPrompt(apiKeyEnv);

  const dir = join(HOME, 'mission-control', 'agents', agentId);
  const soulPath = join(dir, 'SOUL.md');
  if (existsSync(soulPath)) {
    const soul = readFileSync(soulPath, 'utf-8').trim();
    return soul + skills + apiKeyPrompt + permPrompt + TASK_SUFFIX;
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
    // Expire sessions older than 2 hours
    if (Date.now() - row.lastActivity > 2 * 60 * 60 * 1000) return null;
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
    `You have been assigned a new task. Work on it autonomously now.`,
    ``,
    `## REQUIRED workflow — follow every step in order:`,
    ``,
    `### STEP 1 — Claim immediately:`,
    `mcp__mission-control_db__task_update { "id": "${task.id}", "status": "in-progress", "progress": 0 }`,
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
    `### STEP 4 — Internal review (verify plan & subtasks are complete):`,
    `Before handing off, verify: planningNotes exist, all subtasks are created, all subtasks are marked complete.`,
    `Verify with: mcp__mission-control_db__task_get { "id": "${task.id}" }`,
    `If any subtasks are incomplete — complete them first, then mark them done.`,
    `Once verified:`,
    `mcp__mission-control_db__task_update { "id": "${task.id}", "status": "internal-review", "progress": 95 }`,
    `mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "message": "Internal review: plan verified, all <N> subtasks complete — <summary>" }`,
    ``,
    `### STEP 5 — Hand off to Clara (do this IMMEDIATELY after STEP 4 in the same session):`,
    `Do NOT end your session after setting internal-review. Continue immediately:`,
    `mcp__mission-control_db__task_add_activity { "taskId": "${task.id}", "agentId": "<your-id>", "action": "completed", "message": "Done: <1-2 sentence summary of deliverables>" }`,
    `mcp__mission-control_db__task_update { "id": "${task.id}", "status": "review", "progress": 100, "lastAgentUpdate": "Done: <brief label>" }`,
    `(Clara verifies the work was actually completed. Approved → done. Rejected → you get re-dispatched with feedback.)`,
    ``,
    `## Status flow: todo → in-progress → internal-review → review → done`,
    `- "in-progress"     → actively working`,
    `- "internal-review" → verifying plan + all subtasks exist and are marked complete`,
    `- "review"          → Clara verifying work was done`,
    `- "human-review"    → need Kevin's input (blocker/decision)`,
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
    // Lock expired — reset
    agentFailureCounts.delete(agentId);
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
    try {
      getDb().prepare(`UPDATE agents SET status = 'offline' WHERE id = ?`).run(agentId);
    } catch { /* non-critical */ }
  }
}

function recordAgentSuccess(agentId: string) {
  agentFailureCounts.delete(agentId);
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
    const model = resolveModel(agentRow?.model ?? 'sonnet');
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
      const systemPrompt = buildTaskSystemPrompt(agentId, trustTier, apiKeyEnv);
      if (systemPrompt) args.push('--system-prompt', systemPrompt);
    }

    const message = buildTaskMessage(task);

    // Strip Claude session env vars so nested spawn is allowed
    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } =
      process.env as Record<string, string | undefined>;

    // cwd = project root (not agent workspace) so .claude/settings.json MCP config is loaded
    const cwd = process.cwd();

    // Circuit breaker check
    if (isAgentCircuitOpen(agentId)) {
      console.warn(`[taskDispatcher] Circuit open for ${agentId} — skipping dispatch of task ${taskId}`);
      trackEvent('dispatch.blocked.circuit', { taskId, agentId }, agentId);
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
    proc.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    // Write message to stdin
    proc.stdin.write(message);
    proc.stdin.end();

    // Parse stdout for session_id (from stream-json "result" event)
    let outBuf = '';
    proc.stdout.on('data', (data: Buffer) => {
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

        // If agent exited cleanly but task is still at internal-review, re-dispatch
        // to complete the handoff (agent's session ended mid-step)
        if (code === 0) {
          const current = db.prepare('SELECT status, assignedTo FROM tasks WHERE id = ?')
            .get(taskId) as { status: string; assignedTo: string | null } | undefined;
          if (current?.status === 'internal-review' && current?.assignedTo) {
            db.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(taskId, 'system', 'auto_redispatch',
              'Task left in internal-review after agent exit — re-dispatching to complete handoff', Date.now());
            if (!_redispatchTimeouts.has(taskId)) {
              const t = setTimeout(() => {
                _redispatchTimeouts.delete(taskId);
                dispatchTask(taskId);
              }, 2000);
              _redispatchTimeouts.set(taskId, t);
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

    // Auto-advance task to in-progress on dispatch — don't wait for agent to do it
    const now2 = Date.now();
    try {
      const cur = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
      if (cur?.status === 'todo' || cur?.status === 'internal-review') {
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
