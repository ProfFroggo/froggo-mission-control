#!/usr/bin/env node
/**
 * Mission Control Tiered Approval Hook (PreToolUse)
 *
 * Reads: { tool_name, tool_input } from stdin
 * Outputs: { decision: "approve" | "block", reason?: string }
 *
 * Tiers:
 * - Tier 0 (auto-approve): Read, Grep, Glob, test runs, MCP reads, memory reads
 * - Tier 1 (approve + log): File edits in src/, git commits, task status changes
 * - Tier 2 (approve + create approval record): Task → done, git push, file deletions
 * - Tier 3 (block — needs human): External actions, deploys, P0 completion
 */

const path = require('path');
const os = require('os');

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'mission-control/data/mission-control.db');

// Lazy-load better-sqlite3 — it may not be in PATH from hook context
let db = null;
function getDb() {
  if (!db) {
    try {
      const Database = require('better-sqlite3');
      db = new Database(DB_PATH);
    } catch (e) {
      // DB not available — default to approve for all tiers < 3
    }
  }
  return db;
}

function logAnalytics(toolName, tier, decision) {
  try {
    const database = getDb();
    if (database) {
      database.prepare(`
        INSERT INTO analytics_events (type, agentId, data, timestamp)
        VALUES ('hook_decision', 'system', ?, ?)
      `).run(JSON.stringify({ toolName, tier, decision }), Date.now());
    }
  } catch (e) {
    // Silently ignore — hooks must not crash
  }
}

function createApprovalRecord(toolName, toolInput) {
  try {
    const database = getDb();
    if (database) {
      const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      database.prepare(`
        INSERT INTO approvals (id, type, title, description, requestedBy, tier, status, createdAt)
        VALUES (?, ?, ?, ?, ?, 2, 'pending', ?)
      `).run(
        id,
        'tool_use',
        `Tool approval: ${toolName}`,
        JSON.stringify(toolInput),
        'agent',
        Date.now()
      );
    }
  } catch (e) {
    // Silently ignore
  }
}

// Tier 0: Always auto-approve (reads, tests, MCP reads)
const TIER_0_TOOLS = new Set([
  'Read', 'Glob', 'Grep', 'LS',
  'mcp__mission-control_db__task_list',
  'mcp__mission-control_db__approval_check',
  'mcp__mission-control_db__inbox_list',
  'mcp__mission-control_db__agent_status',
  'mcp__mission-control_db__chat_read',
  'mcp__mission-control_db__chat_rooms_list',
  'mcp__memory__memory_search',
  'mcp__memory__memory_recall',
]);

// Tier 3: Always block for human review
const TIER_3_PATTERNS = [
  /git push/i,
  /rm -rf/i,
  /sudo/i,
  /curl.*twitter|wget.*twitter/i,
  /deploy.*production/i,
];

function getTier(toolName, toolInput) {
  // Tier 0: explicit read/test tools
  if (TIER_0_TOOLS.has(toolName)) return 0;

  // Check bash commands
  if (toolName === 'Bash') {
    const cmd = (toolInput?.command || '').toLowerCase();

    // Tier 0: read-only bash
    if (/^(ls|cat|head|tail|grep|find|echo|wc|diff|git (status|log|diff|branch))/.test(cmd)) return 0;
    if (/npm (test|run (test|build|dev|lint))/.test(cmd)) return 0;
    if (/npx (vitest|tsc|playwright)/.test(cmd)) return 0;

    // Tier 3: dangerous
    if (TIER_3_PATTERNS.some(p => p.test(cmd))) return 3;
    if (/git push/.test(cmd)) return 3;

    // Tier 2: git commits, file deletions
    if (/git commit/.test(cmd)) return 2;
    if (/rm\s/.test(cmd)) return 2;

    // Tier 1: everything else in bash
    return 1;
  }

  // Tier 1: file edits
  if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) return 1;

  // MCP writes
  if (toolName === 'mcp__mission-control_db__task_update') {
    // Tier 2 if moving to 'done'
    const status = toolInput?.status;
    if (status === 'done') return 2;
    return 1;
  }
  if (toolName === 'mcp__mission-control_db__task_create') return 1;
  if (toolName === 'mcp__mission-control_db__task_add_activity') return 0;
  if (toolName === 'mcp__mission-control_db__approval_create') return 1;
  if (toolName === 'mcp__mission-control_db__chat_post') return 1;
  if (toolName === 'mcp__memory__memory_write') return 1;

  // Default: Tier 1
  return 1;
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let toolName = 'unknown';
  let toolInput = {};

  try {
    const parsed = JSON.parse(input);
    toolName = parsed.tool_name || parsed.toolName || 'unknown';
    toolInput = parsed.tool_input || parsed.toolInput || {};
  } catch (e) {
    // Malformed input — approve by default
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
    return;
  }

  const tier = getTier(toolName, toolInput);

  if (tier === 3) {
    createApprovalRecord(toolName, toolInput);
    logAnalytics(toolName, tier, 'block');
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Tier 3 action blocked: ${toolName} requires human approval. Check dashboard approvals queue.`
    }));
  } else {
    if (tier === 2) {
      createApprovalRecord(toolName, toolInput);
    }
    logAnalytics(toolName, tier, 'approve');
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
}

main().catch(() => {
  // Hooks must never crash — output approve on error
  process.stdout.write(JSON.stringify({ decision: 'approve' }));
});
