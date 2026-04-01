// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Task Dispatcher — spawns a Claude agent process to work a task autonomously.
 * Called automatically when a task is created/assigned with an assignedTo agent.
 */

import { getDb } from './database';
import { calcCostUsd, ENV } from './env';
import { trackEvent } from './telemetry';
import { emitSSEEvent } from './sseEmitter';
import { periodStartMs as budgetPeriodStartMs } from './budgetAlerts';
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { spawn, type ChildProcess } from 'child_process';

const CLAUDE_BIN    = ENV.CLAUDE_BIN;
const CLAUDE_SCRIPT = ENV.CLAUDE_SCRIPT;
const NODE_BIN      = process.execPath;
const HOME = homedir();
const SCRATCHPAD_DIR = join(HOME, 'mission-control', 'scratchpad');

// Ensure scratchpad directory exists on module load
try { mkdirSync(SCRATCHPAD_DIR, { recursive: true }); } catch { /* ignore */ }

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
  workflow:     ['workflow-automator'],
  automation:   ['workflow-automator'],
  pipeline:     ['workflow-automator'],
  dag:          ['workflow-automator'],
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
  'mcp__mission-control_db__project_phase_list',
  'mcp__mission-control_db__project_phase_create',
  'mcp__mission-control_db__project_phase_update',
  'mcp__mission-control_db__task_add_dependency',
];

const MCP_SOCIAL = [
  'mcp__mission-control_db__x_mentions_list',
  'mcp__mission-control_db__x_mention_update',
  'mcp__mission-control_db__x_posts_list',
  'mcp__mission-control_db__x_post_create',
  'mcp__mission-control_db__x_analytics',
  'mcp__mission-control_db__x_reply_queue',
  'mcp__mission-control_db__x_search',
  'mcp__mission-control_db__x_campaign_create',
];

const MCP_MEMORY = [
  'mcp__memory__memory_search',
  'mcp__memory__memory_recall',
  'mcp__memory__memory_write',
  'mcp__memory__memory_read',
  'mcp__memory__memory_list',
];

const MCP_MIXPANEL = [
  'mcp__mixpanel__Get-Projects',
  'mcp__mixpanel__Get-Events',
  'mcp__mixpanel__Edit-Event',
  'mcp__mixpanel__Get-Event-Details',
  'mcp__mixpanel__Get-Property-Names',
  'mcp__mixpanel__Get-Property-Values',
  'mcp__mixpanel__Edit-Property',
  'mcp__mixpanel__Get-Property',
  'mcp__mixpanel__Create-Tag',
  'mcp__mixpanel__Get-Issues',
  'mcp__mixpanel__Dismiss-Issues',
  'mcp__mixpanel__Rename-Tag',
  'mcp__mixpanel__Delete-Tag',
  'mcp__mixpanel__Get-Lexicon-URL',
  'mcp__mixpanel__Get-User-Replays-Data',
  'mcp__mixpanel__Get-Query-Schema',
  'mcp__mixpanel__Get-Report',
  'mcp__mixpanel__Run-Query',
  'mcp__mixpanel__Create-Dashboard',
  'mcp__mixpanel__List-Dashboards',
  'mcp__mixpanel__Get-Dashboard',
  'mcp__mixpanel__Update-Dashboard',
  'mcp__mixpanel__Duplicate-Dashboard',
  'mcp__mixpanel__Delete-Dashboard',
  'mcp__mixpanel__Search-Entities',
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
    ...MCP_SOCIAL,
    ...MCP_MEMORY,
  ],
  // worker: + safe bash commands + WebFetch + Agent subagents + Google Workspace + Mixpanel
  worker: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_SOCIAL,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
    ...MCP_MIXPANEL,
  ],
  // trusted: + notebook editing; same bash as worker (deny list in settings.json still applies)
  trusted: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent', 'NotebookEdit',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_SOCIAL,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
    ...MCP_MIXPANEL,
  ],
  // admin: identical to trusted — destructive ops still blocked by settings.json deny list
  admin: [
    'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Agent', 'NotebookEdit',
    ...BASH_SAFE,
    ...MCP_DB,
    ...MCP_SOCIAL,
    ...MCP_MEMORY,
    ...MCP_GOOGLE,
    ...MCP_MIXPANEL,
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

export function loadAgentApiKeyEnv(agentId: string): Record<string, string> {
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
You are working on a task in Mission Control. Your job is to complete it fully and hand it off to Clara for review.

## WHAT DONE LOOKS LIKE
Before you set status="review", every one of these must be true:
- Every subtask is marked complete — call task_get and verify incompleteSubtasks is empty
- All output files are saved to ~/mission-control/library/ with YYYY-MM-DD_name.ext names and attached via task_add_attachment
- task_activity has entries describing what you built at each step
- lastAgentUpdate contains: "Completed: [summary]. Output: [file paths or 'no files']. Notes: [caveats]."
- progress is 100

## CROSS-AGENT SCRATCHPAD
Before starting, check ~/mission-control/scratchpad/ for notes from other agents working on related tasks.
When you discover something useful for other agents (API patterns, gotchas, shared config), write it to:
  ~/mission-control/scratchpad/{project or topic}/your-finding.md
Keep files short (< 50 lines). Delete your scratchpad files when no longer relevant.

## BUILT-IN SUBAGENTS
You have access to Claude's built-in Agent tool for spawning subagents. Use them instead of doing everything yourself:
- **Explore agent** (subagent_type: "Explore"): Use for codebase research, finding files, searching for patterns, understanding architecture. Read-only — cannot edit files. Faster than doing multiple grep/glob calls yourself.
- **Plan agent** (subagent_type: "Plan"): Use for designing implementation plans, identifying critical files, considering trade-offs. Read-only research + plan output.
- Launch multiple subagents in parallel when tasks are independent (e.g., research two different parts of the codebase simultaneously).
- Keep subagent prompts focused and specific — "Find all API routes that handle authentication" not "look around the codebase".
- After completing code changes, spawn an Explore agent to verify the changes compile and the affected files are consistent.

## WORKING PROTOCOL
0. notes_list({ since: Date.now() - 86400000 }) — MANDATORY: check human notes from the last 24 hours for relevant instructions, context, or priorities before starting ANY work
0b. knowledge_search("{task topic}") — check for relevant brand guidelines, tone of voice, or context before starting
1. task_get({id}) — read planningNotes and incompleteSubtasks carefully. These define what done looks like.
2. Check prior context: mcp__memory__memory_recall({ topic: "<task title>" })
3. Work through subtasks ONE BY ONE in order:
   a. Do the work for the current subtask
   b. IMMEDIATELY mark it complete: subtask_update({ id: "<subtask-id>", completed: true })
   c. Log what you did: task_add_activity({ taskId, agentId, action: "progress", message: "Completed: <subtask title>" })
   d. Move to the next subtask
   CRITICAL: Do NOT batch subtask completions at the end. Mark each one done AS you finish it.
4. Save outputs to ~/mission-control/library/. Attach via task_add_attachment.
5. When ALL subtasks done: task_update({ status: "review", progress: 100, lastAgentUpdate: "Completed: ..." })

## IF BLOCKED
After 2 real attempts to solve something, move to human-review immediately:
task_update({ status: "human-review", lastAgentUpdate: "Blocked: <reason>. Tried: <approach 1>, <approach 2>. Need: <what would unblock you>." })
Do not loop silently — move to human-review so the human can help.

## FILE ROUTING — CRITICAL
**NEVER save files to ~/Downloads/, ~/Desktop/, /tmp/, or any path outside ~/mission-control/library/.**
**ALWAYS use absolute paths starting with ~/mission-control/library/.**

**If this task has a project_id, ALL files MUST go in the project directory:**
  ~/mission-control/library/projects/{project_id}/
  Use subdirectories: images/, docs/, code/, design/
  For image_generate: ALWAYS pass projectId parameter.
  For HTML: reference images as images/filename.png (relative path).

**ONLY if there is NO project_id**, use the general library:
| File type | Save to |
|-----------|---------|
| Research, analysis, notes | ~/mission-control/library/docs/research/ |
| Strategy, plans, roadmaps | ~/mission-control/library/docs/strategies/ |
| Code, scripts, HTML | ~/mission-control/library/code/ |
| Images, visuals | ~/mission-control/library/design/images/ |
| Design specs | ~/mission-control/library/design/ui/ |

After saving any file: task_add_attachment({ taskId, filePath, fileName, category, uploadedBy })

## TOOLS AVAILABLE
task_get, task_update, task_add_activity, task_add_attachment, subtask_create, subtask_update, chat_post, image_generate, image_remove_background, approval_create, mcp__memory__memory_write, mcp__memory__memory_recall, mcp__memory__memory_list, knowledge_search, knowledge_read, knowledge_write, project_phase_list, project_phase_create, project_phase_update, notes_list, notes_create, scratchpad_list, scratchpad_read, scratchpad_write

## PROJECT PLANNING
For tasks tied to a project, use structured planning:
- project_phase_list({projectId}) — see existing phases
- project_phase_create({projectId, title, description, assignedTo}) — add a phase
- project_phase_update({phaseId, projectId, status}) — mark phases in-progress/complete
Break large work into 3-5 ordered phases. Update phase status as you progress.

## PIPELINE
todo → pre-review → in-progress → review → done
You are in-progress. Set review when done — Clara verifies then approves to done.
Never set internal-review yourself. Never set done — only Clara can.

## SUBTASK RULES
Make subtasks specific and checkable. Each must be executable using MCP tools, filesystem tools, or Bash.
Never create subtasks requiring UI interaction, vague review steps, or human action — use human-review status instead.`;

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
    const agentDir = join(HOME, 'mission-control', 'agents', agentId, 'memory');

    if (!existsSync(agentDir)) return '';

    const MAX_FILE_SIZE = 2048; // Skip files > 2KB
    const files = readdirSync(agentDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const p = join(agentDir, f);
        const s = statSync(p);
        return { name: f, path: p, mtime: s.mtimeMs, size: s.size };
      })
      .filter(f => f.size <= MAX_FILE_SIZE) // Skip large files
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

    // Token budget guard: capped at 8KB total injection
    const TOKEN_BUDGET = 8000;
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
    const agentsDir = join(HOME, 'mission-control', 'agents');
    if (!existsSync(agentsDir)) return '';

    const agentFolders = readdirSync(agentsDir).filter(f => !f.startsWith('.') && f !== '_archive');

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

// ── Dispatch context enrichment ───────────────────────────────────────────────

/**
 * Build a structured context block injected into the agent's system prompt
 * at dispatch time: project name, parent task title, and blocking task titles.
 * Returns an empty string if no enrichment is possible (non-critical).
 */
function buildDispatchContextEnrichment(task: Record<string, unknown>): string {
  try {
    const db = getDb();
    const lines: string[] = [];

    // Project name (prefer DB lookup so we always get the canonical name)
    const projectId = task.project_id as string | undefined;
    if (projectId && !projectId.startsWith('cmp-')) {
      try {
        const proj = db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId) as
          { name: string } | undefined;
        if (proj?.name) lines.push(`Project: ${proj.name}`);
      } catch { /* non-critical */ }
    }

    // Parent task title
    const parentTaskId = task.parentTaskId as string | undefined;
    if (parentTaskId) {
      try {
        const parent = db.prepare('SELECT title FROM tasks WHERE id = ?').get(parentTaskId) as
          { title: string } | undefined;
        if (parent?.title) lines.push(`Parent task: ${parent.title}`);
      } catch { /* non-critical */ }
    }

    // Blocking task titles — blockedBy is stored as a JSON array of task IDs
    const blockedByRaw = task.blockedBy as string | undefined;
    if (blockedByRaw) {
      try {
        const blockedByIds: string[] = JSON.parse(blockedByRaw);
        if (Array.isArray(blockedByIds) && blockedByIds.length > 0) {
          const placeholders = blockedByIds.map(() => '?').join(', ');
          const blockers = db.prepare(
            `SELECT title FROM tasks WHERE id IN (${placeholders})`
          ).all(...blockedByIds) as Array<{ title: string }>;
          if (blockers.length > 0) {
            lines.push(`Blocked by: ${blockers.map(b => b.title).join(', ')}`);
          }
        }
      } catch { /* non-critical */ }
    }

    // Completed dependency outputs — inject files and context from tasks this one depends on
    try {
      const deps = db.prepare(
        `SELECT d.dependsOnId, t.title, t.assignedTo, t.lastAgentUpdate, t.status
         FROM task_dependencies d
         JOIN tasks t ON t.id = d.dependsOnId
         WHERE d.taskId = ?`
      ).all(task.id as string) as Array<{ dependsOnId: string; title: string; assignedTo: string; lastAgentUpdate: string; status: string }>;

      if (deps.length > 0) {
        lines.push(`\n### Dependencies`);
        for (const dep of deps) {
          const status = dep.status === 'done' ? 'COMPLETED' : `IN PROGRESS (${dep.status})`;
          lines.push(`- **${dep.title}** (${dep.assignedTo}) — ${status}`);
          if (dep.status === 'done' && dep.lastAgentUpdate) {
            lines.push(`  Output: ${dep.lastAgentUpdate.slice(0, 200)}`);
          }

          // Get files/attachments from the dependency task
          const attachments = db.prepare(
            `SELECT fileName, filePath, category FROM task_attachments WHERE taskId = ?`
          ).all(dep.dependsOnId) as Array<{ fileName: string; filePath: string; category: string }>;

          if (attachments.length > 0) {
            lines.push(`  Files produced:`);
            for (const att of attachments) {
              lines.push(`  - ${att.fileName} (${att.category}) → ${att.filePath}`);
            }
            lines.push(`  **Use these exact file paths in your work.**`);
          }
        }
      }
    } catch { /* non-critical */ }

    if (lines.length === 0) return '';
    return `\n\n## Task Context\n${lines.join('\n')}`;
  } catch {
    return ''; // Never block dispatch
  }
}

// ── Knowledge Base injection ──────────────────────────────────────────────────

/**
 * Load pinned KB articles (always injected) + keyword-relevant articles.
 * Returns a formatted section string (empty string if no results or error).
 */
function loadRelevantKnowledge(taskTitle: string, taskDesc?: string | null): string {
  try {
    const db = getDb();
    const query = `${taskTitle} ${taskDesc || ''}`.slice(0, 200);

    // Search pinned articles first (always inject, max 3)
    const pinned = db.prepare(
      "SELECT id, title, category, content FROM knowledge_base WHERE pinned = 1 AND scope = 'all' ORDER BY updatedAt DESC LIMIT 3"
    ).all() as Array<{ id: string; title: string; category: string; content: string }>;

    // Then search by relevance using LIKE keyword match
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    let relevant: Array<{ id: string; title: string; category: string; content: string }> = [];
    if (keywords.length > 0) {
      const conditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(tags) LIKE ?)').join(' OR ');
      const params = keywords.flatMap(k => [`%${k}%`, `%${k}%`]);
      relevant = db.prepare(
        `SELECT id, title, category, content FROM knowledge_base WHERE (${conditions}) AND pinned = 0 ORDER BY updatedAt DESC LIMIT 3`
      ).all(...params) as Array<{ id: string; title: string; category: string; content: string }>;
    }

    const pinnedIds = new Set(pinned.map(p => p.id));
    const all = [...pinned, ...relevant.filter(r => !pinnedIds.has(r.id))].slice(0, 4);
    if (all.length === 0) return '';

    // Token budget guard: capped at 3000 chars for faster agent processing
    const TOKEN_BUDGET = 3000;
    let totalChars = 0;
    const capped = all.filter(a => {
      totalChars += a.content.length;
      return totalChars <= TOKEN_BUDGET;
    });
    if (capped.length === 0) return '';

    const lines = capped.map(a =>
      `### ${a.title} (${a.category})\n${a.content.slice(0, 400)}${a.content.length > 400 ? `\n[...use knowledge_read(${a.id}) for full content]` : ''}`
    );
    return `\n\n## Workspace Knowledge Base\nThe following guidelines from your team's knowledge base are relevant to this task:\n\n${lines.join('\n\n---\n\n')}\n\nFor more KB articles: use knowledge_search(query) to find what you need.\n`;
  } catch {
    return ''; // Non-critical — never block dispatch
  }
}

// ── Project context injection ─────────────────────────────────────────────────

function buildGeneralLibraryContext(): string {
  return `

## FILE ROUTING — MANDATORY (No Project Assigned)

This task has no project_id. **ALL output files MUST go in the general library using absolute paths.**

| File Type | Save To (absolute path) |
|-----------|------------------------|
| Code, scripts, HTML | \`~/mission-control/library/code/\` |
| Images, visuals | \`~/mission-control/library/design/images/\` |
| Design specs, mockups | \`~/mission-control/library/design/ui/\` |
| Research, analysis | \`~/mission-control/library/docs/research/\` |
| Strategy, plans | \`~/mission-control/library/docs/strategies/\` |

**Rules:**
- ALWAYS use absolute paths starting with \`~/mission-control/library/\`
- NEVER save to ~/Downloads/, ~/Desktop/, /tmp/, or any other location
- Use descriptive filenames: \`YYYY-MM-DD_brief-description.ext\`
- After saving any file: \`mcp__mission-control_db__task_add_attachment { "taskId": "<id>", "filePath": "~/mission-control/library/...", "fileName": "...", "category": "...", "uploadedBy": "<your-id>" }\`
`;
}

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
      `**CRITICAL**: ALL files for this project go in this directory. No exceptions.`,
      `- Code/HTML/CSS → \`${projectDir}/\``,
      `- Images → \`${projectDir}/images/\``,
      `- Docs → \`${projectDir}/docs/\``,
      `- Design → \`${projectDir}/design/\``,
      `- For image_generate: pass \`projectId: "${projectId}"\` so images save to the project.`,
      `- Use the Write tool to save files — it works anywhere in ~/mission-control/.`,
      `- Use descriptive filenames: \`YYYY-MM-DD_brief-description.ext\``,
      `- After saving any file, log it: \`mcp__mission-control_db__task_add_attachment\``,
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

// ── Campaign context injection ────────────────────────────────────────────────

function buildCampaignContext(campaignId: string): string {
  try {
    const db = getDb();
    const campaign = db.prepare(
      `SELECT name, type, goal, channels, targetAudience, briefContent FROM campaigns WHERE id = ?`
    ).get(campaignId) as {
      name: string; type: string; goal: string | null;
      channels: string; targetAudience: string | null; briefContent: string | null;
    } | undefined;

    if (!campaign) return '';

    let channels: string[] = [];
    try { channels = JSON.parse(campaign.channels || '[]'); } catch { /* ignore */ }

    const campaignDir = join(HOME, 'mission-control', 'library', 'campaigns', campaignId);

    const lines = [
      `\n\n## Campaign Context`,
      `**Campaign**: ${campaign.name}`,
      `**Type**: ${campaign.type}`,
    ];
    if (campaign.goal)           lines.push(`**Goal**: ${campaign.goal}`);
    if (channels.length > 0)     lines.push(`**Channels**: ${channels.join(', ')}`);
    if (campaign.targetAudience) lines.push(`**Target Audience**: ${campaign.targetAudience}`);
    lines.push(`**Campaign directory**: \`${campaignDir}\``);
    lines.push(`**IMPORTANT**: Save ALL output files (copy, assets, reports, scripts) to this directory.`);
    lines.push(`Use descriptive filenames: \`YYYY-MM-DD_brief-description.ext\``);
    lines.push(`After saving any file, log it: \`mcp__mission-control_db__task_add_attachment\``);
    if (campaign.briefContent) {
      const brief = campaign.briefContent.slice(0, 800);
      lines.push(`\n### Campaign Brief\n${brief}${campaign.briefContent.length > 800 ? '\n[...truncated]' : ''}`);
    }

    lines.push(`\n## Campaign Room Updates — MANDATORY`);
    lines.push(`Post progress updates to the campaign chat room as you work.`);
    lines.push(`Room ID: \`campaign-${campaignId}\``);
    lines.push(`Call this at task start, each major milestone, blockers, and completion:`);
    lines.push('```json');
    lines.push(`mcp__mission-control_db__chat_post {`);
    lines.push(`  "roomId": "campaign-${campaignId}",`);
    lines.push(`  "agentId": "<your-agent-id>",`);
    lines.push(`  "content": "<your update message>"`);
    lines.push(`}`);
    lines.push('```');
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

  // Inject relevant Knowledge Base articles
  const kbContext = task
    ? loadRelevantKnowledge(task.title as string, task.description as string | null)
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

  // Inject project or campaign context depending on which this task belongs to
  const projectId = task?.project_id as string | undefined;
  const projectContext = projectId
    ? (projectId.startsWith('cmp-')
        ? buildCampaignContext(projectId)
        : buildProjectContext(projectId))
    : buildGeneralLibraryContext();

  // Structured dispatch context: project name, parent task, blockers
  const dispatchContext = task ? buildDispatchContextEnrichment(task) : '';

  const dir = join(HOME, 'mission-control', 'agents', agentId);
  const soulPath = join(dir, 'SOUL.md');
  if (existsSync(soulPath)) {
    const soul = readFileSync(soulPath, 'utf-8').trim();
    return soul + skills + relevantMemory + handoffNote + kbContext + dispatchContext + projectContext + apiKeyPrompt + permPrompt + TASK_SUFFIX;
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
      if (kbContext) parts.push(kbContext);
      if (dispatchContext) parts.push(dispatchContext);
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

function loadTaskSession(taskId: string, agentId: string): string | null {
  try {
    const sessionKey = 'task:' + taskId + ':' + agentId;
    const row = getDb().prepare(
      'SELECT sessionId, lastActivity FROM agent_sessions WHERE agentId = ? AND status = ?'
    ).get(sessionKey, 'active') as { sessionId: string; lastActivity: number } | undefined;
    if (!row?.sessionId) return null;
    // Expire sessions older than 24 hours
    if (Date.now() - row.lastActivity > 24 * 60 * 60 * 1000) return null;
    return row.sessionId;
  } catch { return null; }
}

function persistTaskSession(taskId: string, agentId: string, sessionId: string, model: string) {
  try {
    const sessionKey = 'task:' + taskId + ':' + agentId;
    const now = Date.now();
    getDb().prepare(`
      INSERT OR REPLACE INTO agent_sessions (agentId, sessionId, model, createdAt, lastActivity, status)
      VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM agent_sessions WHERE agentId = ?), ?), ?, 'active')
    `).run(sessionKey, sessionId, model, sessionKey, now, now);
  } catch (err) {
    console.error(`[taskDispatcher] persistTaskSession failed for task=${taskId} agent=${agentId}:`, err instanceof Error ? err.message : String(err));
  }
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildTaskMessage(task: Record<string, unknown>): string {
  const status = task.status as string;
  const taskId = task.id as string;
  const lines: string[] = [];

  // ── TASK CONTEXT ANCHOR — always at the very top ─────────────────────────
  // This anchor ensures the agent knows exactly what task it's on, even if the
  // session context window is stale or full of unrelated earlier work.
  let subtasks: Array<{ id: string; title: string; completed: number }> = [];
  try {
    subtasks = getDb()
      .prepare('SELECT id, title, completed FROM subtasks WHERE taskId = ? ORDER BY position ASC')
      .all(taskId) as Array<{ id: string; title: string; completed: number }>;
  } catch { /* non-critical */ }

  const subtaskLines = subtasks.length > 0
    ? subtasks.map(s => `  [${s.completed ? 'x' : ' '}] ${s.title} (id: ${s.id})`).join('\n')
    : '  (no subtasks yet — create them with subtask_create)';

  // Determine output directory — project-specific or general library
  const projectId = task.project_id as string | undefined;
  const outputDir = projectId
    ? `~/mission-control/library/projects/${projectId}/`
    : '~/mission-control/library/ (see routing table in system prompt)';

  lines.push(
    `=== TASK CONTEXT ANCHOR ===`,
    `Task ID: ${taskId}`,
    `Title: ${task.title}`,
    `Priority: ${task.priority || 'p2'}`,
    `Assigned to: ${task.assignedTo || '(you)'}`,
    `Status: ${status}`,
    `Output directory: ${outputDir}`,
    `Planning notes: ${task.planningNotes ? String(task.planningNotes).slice(0, 500) + (String(task.planningNotes).length > 500 ? '… (call task_get for full notes)' : '') : '(none — add with task_update)'}`,
    `Subtasks (${subtasks.length}):`,
    subtaskLines,
    `===========================`,
    ``,
    `**SAVE ALL FILES TO: ${outputDir}** — never ~/Downloads/, ~/Desktop/, /tmp/, or CWD.`,
    ``,
  );

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

  if (status === 'todo' && (task.reviewStatus === 'pre-rejected' || task.reviewNotes)) {
    // Task was rejected by Clara's PRE-review — agent needs to fix planning, not start work
    let latestFeedback = task.reviewNotes as string || '';
    if (!latestFeedback) {
      try {
        const act = getDb().prepare(
          `SELECT message FROM task_activity WHERE taskId = ? AND action = 'pre-review-rejected' ORDER BY timestamp DESC LIMIT 1`
        ).get(taskId) as { message: string } | undefined;
        if (act?.message) latestFeedback = act.message;
      } catch { /* non-critical */ }
    }
    lines.push(
      `## ACTION REQUIRED — Fix your task planning`,
      ``,
      `Clara has REJECTED your task plan. You cannot start implementation yet.`,
      `Your job right now is to FIX THE PLANNING, not write code.`,
      ``,
      `**Clara's feedback:**`,
      latestFeedback.slice(0, 800),
      ``,
      `## What you must do NOW:`,
      ``,
      `1. Read the full feedback above carefully`,
      `2. Read your current task state:`,
      `   mcp__mission-control_db__task_get { "id": "${task.id}" }`,
      ``,
      `3. Fix the description if it is missing or vague (1-2 sentences, what this task IS):`,
      `   mcp__mission-control_db__task_update { "id": "${task.id}", "description": "<clear 1-2 sentence summary of what this task does>" }`,
      ``,
      `4. Fix the planning notes — make DECISIONS, not questions:`,
      `   mcp__mission-control_db__task_update { "id": "${task.id}", "planningNotes": "<your complete, concrete plan with decisions made>" }`,
      ``,
      `5. Create subtasks (if missing or insufficient):`,
      `   mcp__mission-control_db__subtask_create { "taskId": "${task.id}", "title": "<specific deliverable>" }`,
      `   Create 4-6 concrete, verifiable subtasks.`,
      ``,
      `Once you update description or planningNotes, Clara will automatically be re-queued to review your task.`,
      `Do NOT set status manually — the system handles re-queuing automatically.`,
      ``,
      `## Rules:`,
      `- Do NOT start implementation — only fix the plan`,
      `- Make DECISIONS in planning notes, not open questions`,
      `- Each subtask must be a concrete, verifiable unit of work`,
      `- Include acceptance criteria in planning notes`,
      `- If you need info you don't have, use human-review to ask`,
    );
    return lines.join('\n');
  }

  if (status === 'in-progress' && (task.reviewNotes || task.reviewStatus === 'rejected')) {
    // Task was rejected by Clara and returned for rework
    // Also fetch latest rejection activity for full context
    let latestFeedback = task.reviewNotes as string || '';
    if (!latestFeedback) {
      try {
        const act = getDb().prepare(
          `SELECT message FROM task_activity WHERE taskId = ? AND action = 'review-rejected' ORDER BY timestamp DESC LIMIT 1`
        ).get(taskId) as { message: string } | undefined;
        if (act?.message) latestFeedback = act.message;
      } catch { /* non-critical */ }
    }
    lines.push(
      `## ACTION REQUIRED — Task returned for rework`,
      ``,
      `Clara has reviewed this task and requested changes:`,
      `**Review feedback**: ${latestFeedback}`,
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
const activeDispatchSet = new Set<string>();
const MAX_CONCURRENT_DISPATCHES = 2;

// ── Active process tracking ──────────────────────────────────────────────────
// Maps taskId → child process, used for P0 preemption (kill lower-priority work)
const activeProcesses = new Map<string, ChildProcess>();

/** Export for health API */
export function getActiveDispatchCount(): number { return activeDispatchSet.size; }

// ── Process timeout ──────────────────────────────────────────────────────────
// Kills hung Claude CLI processes after 30 minutes.
const PROCESS_TIMEOUT_MS = 30 * 60 * 1000;
const processTimeouts = new Map<string, NodeJS.Timeout>();

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

/** Reset all circuit breakers — clears failure counts and lock times for all agents */
export function resetAllCircuits(): void {
  const agentIds = [...agentFailureCounts.keys()];
  agentFailureCounts.clear();
  for (const agentId of agentIds) {
    emitSSEEvent('circuit.closed', { agentId });
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

// ── Smart dispatch routing ───────────────────────────────────────────────────

interface AgentCandidate {
  id: string;
  status: string;
  capabilities: string[];
  model: string;
  activeTaskCount: number;
  score: number;
}

/**
 * Select the best available agent for a task based on capability match,
 * workload, and availability. Returns null if no suitable agent is found.
 */
function selectBestAgent(
  db: ReturnType<typeof getDb>,
  task: Record<string, unknown>,
): string | null {
  try {
    const agents = db.prepare(
      `SELECT id, status, capabilities, model FROM agents WHERE status IN ('idle', 'busy')`
    ).all() as Array<{ id: string; status: string; capabilities: string; model: string }>;

    if (agents.length === 0) return null;

    // Parse task tags/keywords for capability matching
    const taskTitle = ((task.title as string) ?? '').toLowerCase();
    const taskDesc = ((task.description as string) ?? '').toLowerCase();
    const taskText = taskTitle + ' ' + taskDesc;

    const candidates: AgentCandidate[] = agents.map(agent => {
      let caps: string[] = [];
      try { caps = JSON.parse(agent.capabilities || '[]'); } catch { caps = []; }

      // Count active tasks for this agent
      const activeCount = (db.prepare(
        `SELECT COUNT(*) as cnt FROM tasks WHERE assignedTo = ? AND status = 'in-progress'`
      ).get(agent.id) as { cnt: number } | undefined)?.cnt ?? 0;

      // Score: higher is better
      let score = 0;

      // 1. Status preference: idle agents strongly preferred
      if (agent.status === 'idle') score += 50;

      // 2. Workload: fewer active tasks = better
      score -= activeCount * 20;

      // 3. Capability match: each matching capability adds points
      for (const cap of caps) {
        if (taskText.includes(cap.toLowerCase())) score += 15;
      }

      // 4. Circuit breaker: penalize agents with recent failures
      if (isAgentCircuitOpen(agent.id)) score -= 100;

      return {
        id: agent.id,
        status: agent.status,
        capabilities: caps,
        model: agent.model,
        activeTaskCount: activeCount,
        score,
      };
    });

    // Sort by score descending, pick the best non-circuit-broken agent
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates.find(c => !isAgentCircuitOpen(c.id));

    return best?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * P0 preemption: when a P0 task arrives and all agents are busy with lower-priority work,
 * pause the lowest-priority in-progress task and free its agent for the P0 task.
 * Returns the freed agent ID, or null if preemption isn't possible.
 */
function preemptForP0(
  db: ReturnType<typeof getDb>,
  p0TaskId: string,
): string | null {
  try {
    // Find in-progress tasks with lower priority (p1-p3), ordered by lowest priority first
    const preemptable = db.prepare(`
      SELECT t.id, t.assignedTo, t.priority, t.title
      FROM tasks t
      JOIN agents a ON a.id = t.assignedTo
      WHERE t.status = 'in-progress'
        AND t.assignedTo IS NOT NULL
        AND t.id != ?
        AND t.priority IN ('p1', 'p2', 'p3')
      ORDER BY
        CASE t.priority WHEN 'p3' THEN 0 WHEN 'p2' THEN 1 WHEN 'p1' THEN 2 END ASC
      LIMIT 1
    `).get(p0TaskId) as { id: string; assignedTo: string; priority: string; title: string } | undefined;

    if (!preemptable) return null;

    const freedAgentId = preemptable.assignedTo;

    // Pause the preempted task — move to todo so it can be re-dispatched later
    db.prepare(
      `UPDATE tasks SET status = 'todo', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`
    ).run(
      `Preempted by P0 task ${p0TaskId}. Will be re-dispatched when agent becomes available.`,
      Date.now(), preemptable.id
    );

    db.prepare(
      `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).run(preemptable.id, 'system', 'preempted',
      `Task paused — agent ${freedAgentId} reassigned to P0 task ${p0TaskId}`,
      Date.now());

    // Kill the running process for the preempted task if it exists
    const preemptedProc = activeProcesses.get(preemptable.id);
    if (preemptedProc) {
      try { preemptedProc.kill('SIGTERM'); } catch { /* may already be dead */ }
      activeProcesses.delete(preemptable.id);
      activeDispatchSet.delete(preemptable.id);
    }

    // Free the agent
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(freedAgentId);

    console.log(`[taskDispatcher] P0 preemption: freed ${freedAgentId} from ${preemptable.priority} task "${preemptable.title}" for P0 task ${p0TaskId}`);

    emitSSEEvent('dispatch.preemption', {
      p0TaskId,
      preemptedTaskId: preemptable.id,
      preemptedPriority: preemptable.priority,
      freedAgentId,
    });

    return freedAgentId;
  } catch (err) {
    console.error('[taskDispatcher] P0 preemption error:', err);
    return null;
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Dispatch a task to its assigned agent.
 * Spawns a detached Claude CLI process with full agent context.
 * If no agent is assigned, attempts smart routing to find the best available agent.
 * P0 tasks can preempt lower-priority work when all agents are busy.
 * Returns true if dispatch succeeded, false if skipped.
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

    // Only dispatch tasks in valid dispatch states
    const status = task.status as string;
    const reviewStatus = task.reviewStatus as string | null;
    // Allow todo dispatch only when pre-rejected (agent needs to fix planning)
    const isTodoPreRejected = status === 'todo' && (reviewStatus === 'pre-rejected' || !!(task.reviewNotes as string)?.trim());
    if (status !== 'in-progress' && status !== 'internal-review' && !isTodoPreRejected) {
      return false;
    }

    let agentId = task.assignedTo as string | null;
    const taskPriority = (task.priority as string | null) ?? 'p2';

    // ── Smart routing: auto-assign if no agent specified ──
    if (!agentId) {
      const bestAgent = selectBestAgent(db, task);
      if (bestAgent) {
        agentId = bestAgent;
        db.prepare(`UPDATE tasks SET assignedTo = ?, updatedAt = ? WHERE id = ?`).run(agentId, Date.now(), taskId);
        try {
          db.prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(taskId, 'system', 'auto_routed',
            `Smart routing: auto-assigned to ${agentId} (best available agent by capability/workload score)`,
            Date.now());
        } catch { /* non-critical */ }
        console.log(`[taskDispatcher] Smart routing: auto-assigned ${taskId} to ${agentId}`);
        emitSSEEvent('dispatch.auto_routed', { taskId, agentId });
      } else {
        // No suitable agent — if P0, try preemption
        let preemptionUsed = false;
        if (taskPriority === 'p0') {
          const freedAgent = preemptForP0(db, taskId);
          if (freedAgent) {
            preemptionUsed = true;
            agentId = freedAgent;
            db.prepare(`UPDATE tasks SET assignedTo = ?, updatedAt = ? WHERE id = ?`).run(agentId, Date.now(), taskId);
            try {
              db.prepare(
                `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
              ).run(taskId, 'system', 'p0_preemption',
                `P0 preemption: reassigned agent ${agentId} from lower-priority work`,
                Date.now());
            } catch { /* non-critical */ }
          }
        }
        if (!agentId) return false; // No agent available — nothing to dispatch

        // ── P0 preemption for concurrency: if at limit and P0, preempt (only if not already used) ──
        if (!preemptionUsed && activeDispatchSet.size >= MAX_CONCURRENT_DISPATCHES && taskPriority === 'p0') {
          const freedAgent = preemptForP0(db, taskId);
          if (freedAgent && freedAgent !== agentId) {
            console.log(`[taskDispatcher] P0 preemption freed a dispatch slot for ${taskId}`);
          }
        }
      }
    }

    // Debounce: skip if we dispatched to this agent within 100ms
    const now = Date.now();
    const last = lastDispatch.get(agentId) ?? 0;
    if (now - last < DEBOUNCE_MS) {
      console.log(`[taskDispatcher] Debounced dispatch to ${agentId} (too rapid)`);
      return false;
    }
    lastDispatch.set(agentId, now);

    // ── Fleet budget enforcement gate ──
    // Check agent-specific and global budgets before allowing dispatch.
    // P0 tasks bypass budget limits — critical work must always proceed.
    if (taskPriority !== 'p0') {
      try {
        const budgets = db.prepare(
          'SELECT * FROM budgets WHERE agentId = ? OR agentId IS NULL'
        ).all(agentId) as Array<{
          name: string; agentId: string | null; period: string;
          limitUsd: number; alertAt: number;
        }>;

        for (const budget of budgets) {
          const periodStart = budgetPeriodStartMs(budget.period as 'daily' | 'weekly' | 'monthly');
          const agentFilter = budget.agentId ? 'AND agentId = ?' : '';
          const queryArgs: unknown[] = budget.agentId ? [periodStart, budget.agentId] : [periodStart];

          const row = db.prepare(
            `SELECT COALESCE(SUM(costUsd), 0) AS spend FROM token_usage WHERE timestamp >= ? ${agentFilter}`
          ).get(...queryArgs) as { spend: number } | undefined;

          const spent = row?.spend ?? 0;
          if (spent >= budget.limitUsd) {
            console.warn(
              `[taskDispatcher] Budget exceeded for ${budget.agentId ?? 'global'} (${budget.name}): $${spent.toFixed(2)} / $${budget.limitUsd.toFixed(2)} ${budget.period} — blocking dispatch of ${taskId}`
            );
            try {
              db.prepare(
                `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
              ).run(taskId, 'system', 'budget_blocked',
                `Dispatch blocked: ${budget.name} budget exceeded ($${spent.toFixed(2)} / $${budget.limitUsd.toFixed(2)} ${budget.period}). Task remains queued.`,
                Date.now());
            } catch { /* non-critical */ }
            emitSSEEvent('budget.dispatch_blocked', {
              taskId, agentId, budgetName: budget.name,
              spent, limit: budget.limitUsd, period: budget.period,
            });
            return false;
          }
        }
      } catch { /* budget check failure is non-fatal — allow dispatch */ }
    }

    // Get per-agent model and trust tier from DB
    const agentRow = db.prepare('SELECT model, trust_tier FROM agents WHERE id = ?').get(agentId) as
      { model?: string; trust_tier?: string } | undefined;
    // Priority-based model override: P0/P1 tasks use opus for higher reasoning capacity.
    // Per-agent model from DB can still override this if explicitly set to opus/sonnet/haiku.
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
    const existingSession = loadTaskSession(taskId, agentId);
    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--model', model,
      '--dangerously-skip-permissions',
      '--allowedTools', allowedTools.join(','),
      ...(disallowedTools.length > 0 ? ['--disallowedTools', disallowedTools.join(',')] : []),
    ];

    // Try --resume first. If it fails (stale session), spawnAttempt will detect
    // exit code 1 with no output and retry WITHOUT --resume on the next attempt.
    let useResume = false;
    if (existingSession) {
      useResume = true;
      args.push('--resume', existingSession);
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

    // Per-agent gate — max 1 in-progress task per agent at a time
    // Exclude the current task from the count so dispatching the task itself doesn't self-block.
    try {
      const otherInProgress = (db.prepare(
        `SELECT COUNT(*) as cnt FROM tasks WHERE assignedTo = ? AND status = 'in-progress' AND id != ?`
      ).get(agentId, taskId) as { cnt: number } | undefined)?.cnt ?? 0;

      if (otherInProgress >= 1) {
        console.log(`[taskDispatcher] Agent ${agentId} already has ${otherInProgress} other in-progress task(s) — skipping ${taskId} until slot opens`);
        return false;
      }
    } catch { /* non-critical — never block dispatch */ }

    // Concurrency check — skip if at limit
    if (activeDispatchSet.size >= MAX_CONCURRENT_DISPATCHES) {
      console.warn(`[taskDispatcher] Concurrency limit reached (${MAX_CONCURRENT_DISPATCHES}). Task ${taskId} skipped.`);
      return false;
    }
    activeDispatchSet.add(taskId);

    // Telemetry: dispatch started
    trackEvent('dispatch.start', { taskId, agentId });

    // ── Spawn with retry + exponential backoff ────────────────────────────────
    // Up to 3 total attempts (2 retries). Backoff: 2s then 4s between attempts.
    // On all retries exhausted, task is moved to human-review.
    const MAX_DISPATCH_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [2000, 4000]; // delay before attempt 2 and 3

    const spawnAttempt = (attemptNumber: number): void => {
      console.log(`[taskDispatcher] Spawning: ${NODE_BIN} ${CLAUDE_SCRIPT} (attempt ${attemptNumber}/${MAX_DISPATCH_ATTEMPTS}) for ${taskId} → ${agentId}`);
      console.log(`[taskDispatcher] Args: ${args.slice(0, 6).join(' ')} ... (${args.length} total)`);
      const proc = spawn(NODE_BIN, [CLAUDE_SCRIPT, ...args], {
        cwd,
        env: { ...cleanEnv, CLAUDE_AGENT_ID: agentId, ...apiKeyEnv } as unknown as NodeJS.ProcessEnv,
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Track process for P0 preemption
      activeProcesses.set(taskId, proc);

      // Capture stderr for error reporting
      let stderrBuf = '';
      proc.stderr!.on('data', (chunk: Buffer) => {
        stderrBuf += chunk.toString();
      });

      // Write message to stdin
      proc.stdin!.write(message);
      proc.stdin!.end();

      // Parse stdout stream-json events — live visibility into agent activity
      let outBuf = '';
      let lastToolName = '';
      let toolRepeatCount = 0;
      const LOOP_THRESHOLD = 5; // same tool 5x in a row = likely stuck
      let lastActivityTs = Date.now();

      proc.stdout!.on('data', (data: Buffer) => {
        outBuf += data.toString();
        const lines = outBuf.split('\n');
        outBuf = lines.pop() ?? '';
        for (const line of lines) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parsed = JSON.parse(line.trim()) as any;
            const eventType = parsed.type as string | undefined;

            // ── Result event — session + token tracking (existing logic) ──
            if (eventType === 'result') {
              if (parsed.session_id) {
                persistTaskSession(taskId, agentId, parsed.session_id, model);
              }
              const inputT  = parsed.input_tokens  ?? 0;
              const outputT = parsed.output_tokens ?? 0;
              if (inputT > 0 || outputT > 0) {
                try {
                  const costUsd = calcCostUsd(model, inputT, outputT);
                  const db2 = getDb();
                  db2.prepare(
                    `INSERT INTO token_usage (agentId, taskId, sessionId, model, inputTokens, outputTokens, costUsd, source, timestamp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 'dispatch', ?)`
                  ).run(agentId, taskId, parsed.session_id ?? null, model, inputT, outputT, costUsd, Date.now());
                  import('@/lib/budgetAlerts').then(({ checkBudgetAlerts }) => {
                    checkBudgetAlerts(db2, agentId);
                  }).catch(() => { /* non-critical */ });
                } catch { /* non-critical */ }
              }
            }

            // ── Assistant event — agent is thinking/responding ──
            else if (eventType === 'assistant') {
              lastActivityTs = Date.now();
              // Check for tool_use blocks in the message
              const toolUses = parsed.message?.content?.filter?.(
                (b: { type?: string }) => b.type === 'tool_use'
              ) ?? [];
              for (const tu of toolUses) {
                const toolName = tu.name as string ?? 'unknown';
                // Emit live tool-use event for dashboard
                emitSSEEvent('agent.tool_use', {
                  taskId, agentId, tool: toolName, timestamp: Date.now(),
                });

                // Loop detection: same tool called repeatedly
                if (toolName === lastToolName) {
                  toolRepeatCount++;
                  if (toolRepeatCount >= LOOP_THRESHOLD) {
                    console.warn(`[taskDispatcher] Loop detected: ${agentId} called ${toolName} ${toolRepeatCount}x in a row on task ${taskId}`);
                    try {
                      getDb().prepare(
                        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
                      ).run(taskId, 'system', 'loop_detected',
                        `Agent may be stuck: called ${toolName} ${toolRepeatCount} times consecutively`, Date.now());
                    } catch { /* non-critical */ }
                    emitSSEEvent('agent.loop_detected', {
                      taskId, agentId, tool: toolName, count: toolRepeatCount,
                    });
                    // Reset so we don't spam — will fire again at 2x threshold
                    toolRepeatCount = 0;
                  }
                } else {
                  lastToolName = toolName;
                  toolRepeatCount = 1;
                }
              }
            }

            // ── System event — errors, compaction ──
            else if (eventType === 'system') {
              lastActivityTs = Date.now();
              const sysMsg = parsed.message ?? parsed.error ?? '';
              if (typeof sysMsg === 'string' && sysMsg.length > 0) {
                emitSSEEvent('agent.system', { taskId, agentId, message: sysMsg.slice(0, 200) });
              }
            }

          } catch { /* not JSON, ignore */ }
        }
      });

      // Shared failure handler — retries on non-zero exit or spawn error
      const handleFailure = (errorMsg: string): void => {
        if (attemptNumber < MAX_DISPATCH_ATTEMPTS) {
          const delay = RETRY_DELAYS_MS[attemptNumber - 1] ?? 4000;
          console.warn(`[taskDispatcher] Attempt ${attemptNumber}/${MAX_DISPATCH_ATTEMPTS} failed for task ${taskId} — retrying in ${delay}ms: ${errorMsg}`);
          try {
            db.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(
              taskId, 'system', 'dispatch_retry',
              `Dispatch attempt ${attemptNumber}/${MAX_DISPATCH_ATTEMPTS} failed — retrying in ${delay / 1000}s: ${errorMsg.slice(0, 200)}`,
              Date.now()
            );
          } catch { /* non-critical */ }
          setTimeout(() => spawnAttempt(attemptNumber + 1), delay);
        } else {
          // All attempts exhausted — move back to todo for retry (not human-review)
          activeDispatchSet.delete(taskId);
          console.error(`[taskDispatcher] Dispatch failed after ${MAX_DISPATCH_ATTEMPTS} attempts for task ${taskId}: ${errorMsg}`);
          try {
            db.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(
              taskId, 'system', 'dispatch_failed',
              `Dispatch failed after ${MAX_DISPATCH_ATTEMPTS} attempts: ${errorMsg.slice(0, 300)}. Task returned to todo for retry.`,
              Date.now()
            );
            db.prepare(
              `UPDATE tasks SET status = 'todo', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`
            ).run(
              `Dispatch failed after ${MAX_DISPATCH_ATTEMPTS} attempts: ${errorMsg.slice(0, 200)}. Returned to todo.`,
              Date.now(), taskId
            );
          } catch { /* non-critical */ }
          recordAgentFailure(agentId);
          trackEvent('dispatch.error', { taskId, agentId, attempts: MAX_DISPATCH_ATTEMPTS, error: errorMsg.slice(0, 200) }, agentId);
          // Set agent idle on final failure (circuit breaker may override to 'offline')
          try { db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agentId); } catch { /* */ }
        }
      };

      // Log exit code and update task status on failure
      proc.on('close', (code) => {
        // Clean up process tracking
        activeProcesses.delete(taskId);
        // Clear process timeout on any exit
        const pendingTimeout = processTimeouts.get(taskId);
        if (pendingTimeout) { clearTimeout(pendingTimeout); processTimeouts.delete(taskId); }

        if (code === 0) {
          // Success path — remove from active dispatch set
          activeDispatchSet.delete(taskId);
          recordAgentSuccess(agentId);
          trackEvent('dispatch.complete', { taskId, agentId, exitCode: code });

          // Set agent idle on clean exit (unless still has other in-progress tasks)
          try {
            const otherTasks = (db.prepare(
              `SELECT COUNT(*) as cnt FROM tasks WHERE assignedTo = ? AND status = 'in-progress' AND id != ?`
            ).get(agentId, taskId) as { cnt: number } | undefined)?.cnt ?? 0;
            if (otherTasks === 0) {
              db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agentId);
            }
          } catch { /* non-critical */ }

          try {
            db.prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(taskId, agentId, 'dispatch_exit', `Agent ${agentId} completed task dispatch (exit 0)`, Date.now());

            // If agent exited cleanly but task is still mid-flight, re-dispatch
            // to complete the handoff (agent's session ended mid-step)
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
          } catch { /* non-critical */ }
        } else {
          // ── Non-zero exit — classify error and apply category-specific recovery ──
          const stderrSnippet = stderrBuf.slice(0, 500);
          const stdoutSnippet = outBuf.slice(0, 500);
          const combined = (stderrSnippet + ' ' + stdoutSnippet).toLowerCase();

          console.error(`[taskDispatcher] Agent ${agentId} task ${taskId} attempt ${attemptNumber} failed (exit ${code})`);
          if (stderrSnippet) console.error(`[taskDispatcher]   stderr: ${stderrSnippet}`);
          if (stdoutSnippet) console.error(`[taskDispatcher]   stdout: ${stdoutSnippet}`);

          // Classify the failure into a category for targeted recovery
          type ErrorCategory = 'stale_session' | 'rate_limit' | 'context_overflow' | 'oom_killed' | 'auth_error' | 'generic';
          let category: ErrorCategory = 'generic';

          if (!stderrSnippet && !stdoutSnippet) {
            // No output at all — almost always a stale --resume session
            category = 'stale_session';
          } else if (code === 137 || code === 9) {
            // SIGKILL (137 = 128+9) or raw signal 9 — OOM killer or system kill
            category = 'oom_killed';
          } else if (combined.includes('rate limit') || combined.includes('rate_limit') || combined.includes('429') || combined.includes('too many requests') || combined.includes('overloaded')) {
            category = 'rate_limit';
          } else if (combined.includes('context') && (combined.includes('overflow') || combined.includes('too long') || combined.includes('maximum') || combined.includes('exceeded') || combined.includes('too large'))) {
            category = 'context_overflow';
          } else if (combined.includes('unauthorized') || combined.includes('invalid api key') || combined.includes('authentication') || combined.includes('forbidden') || combined.includes('invalid_api_key') || combined.includes('permission denied')) {
            category = 'auth_error';
          } else if (code === 1 && (!stderrSnippet && !stdoutSnippet)) {
            category = 'stale_session';
          }

          // Emit SSE event with classification for dashboard visibility
          emitSSEEvent('agent.exit_error', {
            taskId, agentId, exitCode: code, category,
            stderr: stderrSnippet.slice(0, 200),
            attempt: attemptNumber,
          });

          // Log activity with category
          try {
            getDb().prepare(
              `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
            ).run(taskId, 'system', 'dispatch_error_classified',
              `Exit ${code} [${category}] attempt ${attemptNumber}: ${(stderrSnippet || stdoutSnippet || '(no output)').slice(0, 300)}`,
              Date.now());
          } catch { /* non-critical */ }

          // Apply category-specific recovery
          switch (category) {
            case 'stale_session': {
              // Clear stale session and retry with fresh dispatch immediately
              console.log(`[taskDispatcher] [stale_session] Clearing session for ${taskId} — fresh dispatch on retry`);
              try { getDb().prepare('DELETE FROM agent_sessions WHERE agentId = ?').run('task:' + taskId + ':' + agentId); } catch { /* */ }
              if (useResume) {
                const resumeIdx = args.indexOf('--resume');
                if (resumeIdx !== -1) args.splice(resumeIdx, 2);
                useResume = false;
                const freshPrompt = buildTaskSystemPrompt(agentId, trustTier, apiKeyEnv, task);
                if (freshPrompt) args.push('--system-prompt', freshPrompt);
              }
              handleFailure(`[stale_session] exit ${code}: session expired, retrying fresh`);
              break;
            }

            case 'rate_limit': {
              // Rate limited — use longer exponential backoff before retry
              const rateLimitDelay = Math.min(30000 * Math.pow(2, attemptNumber - 1), 120000); // 30s, 60s, 120s
              console.warn(`[taskDispatcher] [rate_limit] Backing off ${rateLimitDelay}ms before retry for ${taskId}`);
              if (attemptNumber < MAX_DISPATCH_ATTEMPTS) {
                try {
                  db.prepare(
                    `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
                  ).run(taskId, 'system', 'dispatch_retry',
                    `Rate limited — backing off ${rateLimitDelay / 1000}s before attempt ${attemptNumber + 1}`,
                    Date.now());
                } catch { /* */ }
                setTimeout(() => spawnAttempt(attemptNumber + 1), rateLimitDelay);
              } else {
                // All attempts exhausted with rate limits — return to todo with longer cooldown
                activeDispatchSet.delete(taskId);
                try {
                  db.prepare(`UPDATE tasks SET status = 'todo', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`)
                    .run('Rate limited after all retry attempts. Returned to queue — will retry on next dispatch cycle.', Date.now(), taskId);
                  db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agentId);
                } catch { /* */ }
                recordAgentFailure(agentId);
                trackEvent('dispatch.rate_limited', { taskId, agentId, attempts: MAX_DISPATCH_ATTEMPTS }, agentId);
              }
              break;
            }

            case 'context_overflow': {
              // Context too large — clear session, add instruction to work in smaller chunks
              console.warn(`[taskDispatcher] [context_overflow] Clearing session and adding scope reduction note for ${taskId}`);
              try { getDb().prepare('DELETE FROM agent_sessions WHERE agentId = ?').run('task:' + taskId + ':' + agentId); } catch { /* */ }
              if (useResume) {
                const resumeIdx = args.indexOf('--resume');
                if (resumeIdx !== -1) args.splice(resumeIdx, 2);
                useResume = false;
                const freshPrompt = buildTaskSystemPrompt(agentId, trustTier, apiKeyEnv, task);
                if (freshPrompt) args.push('--system-prompt', freshPrompt);
              }
              // Append a note to task so the next dispatch knows to work smaller
              try {
                db.prepare(
                  `UPDATE tasks SET planningNotes = COALESCE(planningNotes, '') || ? WHERE id = ?`
                ).run('\n\n[SYSTEM] Previous attempt hit context overflow. Work in smaller chunks — use subagents for large file reads and break work into focused steps.', taskId);
              } catch { /* */ }
              handleFailure(`[context_overflow] exit ${code}: context exceeded, retrying with scope reduction`);
              break;
            }

            case 'oom_killed': {
              // OOM/SIGKILL — the process was killed by the OS. Clear everything and retry fresh
              console.error(`[taskDispatcher] [oom_killed] Process killed by system (exit ${code}) for ${taskId}`);
              try { getDb().prepare('DELETE FROM agent_sessions WHERE agentId = ?').run('task:' + taskId + ':' + agentId); } catch { /* */ }
              if (useResume) {
                const resumeIdx = args.indexOf('--resume');
                if (resumeIdx !== -1) args.splice(resumeIdx, 2);
                useResume = false;
                const freshPrompt = buildTaskSystemPrompt(agentId, trustTier, apiKeyEnv, task);
                if (freshPrompt) args.push('--system-prompt', freshPrompt);
              }
              // Append scope-reduction note — OOM often means too-large files or too many concurrent reads
              try {
                db.prepare(
                  `UPDATE tasks SET planningNotes = COALESCE(planningNotes, '') || ? WHERE id = ?`
                ).run('\n\n[SYSTEM] Previous attempt was killed by OS (likely OOM). Use subagents for large file operations and avoid reading entire large files at once.', taskId);
              } catch { /* */ }
              handleFailure(`[oom_killed] exit ${code}: process killed by system, retrying fresh with scope notes`);
              break;
            }

            case 'auth_error': {
              // Auth failure — do NOT retry, escalate immediately. Retrying with bad credentials is pointless
              console.error(`[taskDispatcher] [auth_error] Authentication failure for ${taskId} — escalating to human-review`);
              activeDispatchSet.delete(taskId);
              try {
                db.prepare(`UPDATE tasks SET status = 'human-review', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`)
                  .run(`Authentication error during dispatch: ${stderrSnippet.slice(0, 200)}. API key may be invalid or expired.`, Date.now(), taskId);
                db.prepare(
                  `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
                ).run(taskId, 'system', 'dispatch_auth_failed',
                  `Authentication error — task moved to human-review. Check API key configuration.`, Date.now());
                db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agentId);
              } catch { /* */ }
              recordAgentFailure(agentId);
              trackEvent('dispatch.auth_error', { taskId, agentId, error: stderrSnippet.slice(0, 200) }, agentId);
              break;
            }

            default: {
              // Generic/unknown error — use standard retry with original delays
              handleFailure(`exit code ${code}: ${stderrSnippet.slice(0, 200)}`);
              break;
            }
          }
        }
      });

      // Handle spawn errors (e.g. ENOENT if claude binary not found)
      proc.on('error', (err) => {
        console.error(`[taskDispatcher] Spawn error attempt ${attemptNumber} for task ${taskId}:`, err);
        handleFailure(`spawn error: ${err.message}`);
      });

      // Process timeout — kill hung processes after 30 minutes
      const timeoutRef = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch { /* may already be dead */ }
        setTimeout(() => {
          try { proc.kill('SIGKILL'); } catch { /* may already be dead */ }
        }, 5000); // Force kill 5s after SIGTERM

        processTimeouts.delete(taskId);
        activeDispatchSet.delete(taskId);

        console.error(`[taskDispatcher] Process timeout: killed hung dispatch for task ${taskId} after 30 minutes`);

        try {
          db.prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(taskId, 'system', 'dispatch_timeout',
            `Claude CLI process killed after 30-minute timeout. Task returned to todo for retry.`, Date.now());
          db.prepare(
            `UPDATE tasks SET status = 'todo', lastAgentUpdate = ?, updatedAt = ? WHERE id = ?`
          ).run('Dispatch timed out after 30 minutes. Returned to todo.', Date.now(), taskId);
          db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agentId);
        } catch { /* non-critical */ }

        recordAgentFailure(agentId);
        trackEvent('dispatch.timeout', { taskId, agentId }, agentId);
      }, PROCESS_TIMEOUT_MS);
      processTimeouts.set(taskId, timeoutRef);

      proc.unref();
    };

    // Set agent to busy on dispatch
    try {
      db.prepare(`UPDATE agents SET status = 'busy' WHERE id = ?`).run(agentId);
    } catch { /* non-critical */ }

    spawnAttempt(1);

    // Auto-advance task to in-progress on dispatch — only from internal-review (Clara's gate).
    // Tasks in todo have not passed the quality gate yet; the dispatcher should not skip it.
    const now2 = Date.now();
    try {
      const cur = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
      if (cur?.status === 'internal-review') {
        db.prepare('UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?').run('in-progress', now2, taskId);
      }
      // Task 1 — Telemetry: rich dispatch activity log including priority and estimatedHours
      const estimatedHours = task.estimatedHours != null ? `${task.estimatedHours}h` : 'unset';
      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(
        taskId,
        agentId,
        'dispatched',
        `Task dispatched to ${agentId} — priority ${taskPriority}, estimated ${estimatedHours}`,
        now2
      );
    } catch { /* non-critical */ }

    // Task 5 — Post-dispatch agent status confirmation
    // Check agent status after dispatch; warn if still idle (may not have received signal)
    try {
      const agentStatusRow = db.prepare('SELECT status FROM agents WHERE id = ?').get(agentId) as
        { status: string } | undefined;
      if (agentStatusRow && agentStatusRow.status === 'idle') {
        console.warn(`[taskDispatcher] Agent ${agentId} status is still 'idle' after dispatch — may not have received signal`);
        try {
          db.prepare(
            `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
          ).run(
            taskId, 'system', 'agent_status_warning',
            `Agent ${agentId} may not have received dispatch signal (status is still 'idle').`,
            Date.now()
          );
        } catch { /* non-critical */ }
      }
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
    const MAX_STARTUP_REDISPATCHES = 5;
    let staggerIndex = 0;
    for (const task of stuck) {
      // Skip if already queued for re-dispatch (prevents double-dispatch on concurrent callers)
      if (_redispatchTimeouts.has(task.id)) continue;

      // Cap total auto_redispatch attempts — escalate to human-review if exhausted
      const priorAttempts = (db.prepare(
        `SELECT COUNT(*) as cnt FROM task_activity WHERE taskId = ? AND action = 'auto_redispatch'`
      ).get(task.id) as { cnt: number } | undefined)?.cnt ?? 0;

      if (priorAttempts >= MAX_STARTUP_REDISPATCHES) {
        console.warn(`[taskDispatcher] Task ${task.id} has ${priorAttempts} prior auto_redispatch attempts — escalating to human-review`);
        db.prepare(`UPDATE tasks SET status = 'human-review', updatedAt = ? WHERE id = ?`).run(Date.now(), task.id);
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
        ).run(task.id, 'system', 'auto_redispatch_exhausted',
          `Escalated to human-review: ${priorAttempts} startup re-dispatch attempts with no progress.`, Date.now());
        continue;
      }

      db.prepare(
        `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
      ).run(task.id, 'system', 'auto_redispatch',
        `Task was in-progress at server startup — re-dispatching to resume work (attempt ${priorAttempts + 1}/${MAX_STARTUP_REDISPATCHES})`, Date.now());

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
