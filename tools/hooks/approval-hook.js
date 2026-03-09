#!/usr/bin/env node
// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Mission Control Tiered Approval Hook (PreToolUse)
 *
 * Reads: { tool_name, tool_input, session_id? } from stdin
 * Outputs: { decision: "approve" | "block", reason?: string }
 *
 * Trust tiers (agent setting) override default tier behavior:
 *   restricted  — Tier 0 only; all writes blocked
 *   apprentice  — Tier 0-1 auto; Tier 2 queued; Tier 3 blocked
 *   worker      — Tier 0-2 auto; Tier 3 blocked
 *   trusted     — Tier 0-3 auto (Tier 3 external = queued, not blocked)
 *   admin       — Full autonomy; all tiers auto-approved
 *
 * Default (no agent / unknown): apprentice behavior
 */

const path = require('path');
const os = require('os');

const DB_PATH = process.env.DB_PATH || path.join(os.homedir(), 'mission-control/data/mission-control.db');

let db = null;
function getDb() {
  if (!db) {
    try {
      const Database = require('better-sqlite3');
      db = new Database(DB_PATH);
    } catch (e) { /* DB not available — default to approve */ }
  }
  return db;
}

// Look up the trust tier for an agent by session ID
function getTrustTierForSession(sessionId) {
  if (!sessionId) return 'apprentice';
  try {
    const database = getDb();
    if (!database) return 'apprentice';
    const row = database.prepare(`
      SELECT a.trust_tier FROM agent_sessions s
      JOIN agents a ON a.id = s.agentId
      WHERE s.sessionId = ?
      LIMIT 1
    `).get(sessionId);
    return row?.trust_tier || 'apprentice';
  } catch { return 'apprentice'; }
}

function logAnalytics(toolName, tier, decision, agentTrustTier) {
  try {
    const database = getDb();
    if (database) {
      database.prepare(`
        INSERT INTO analytics_events (type, agentId, data, timestamp)
        VALUES ('hook_decision', 'system', ?, ?)
      `).run(JSON.stringify({ toolName, tier, decision, agentTrustTier }), Date.now());
    }
  } catch (e) { /* non-critical */ }
}

function createApprovalRecord(toolName, toolInput) {
  try {
    const database = getDb();
    if (database) {
      const id = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      database.prepare(`
        INSERT INTO approvals (id, type, title, content, metadata, status, requester, tier, category, createdAt)
        VALUES (?, 'tool_use', ?, ?, ?, 'pending', 'agent', 2, 'agent_approval', ?)
      `).run(
        id,
        `Tool: ${toolName}`,
        JSON.stringify(toolInput),
        JSON.stringify({ toolName, toolInput }),
        Date.now()
      );
    }
  } catch (e) { /* non-critical */ }
}

// ── Tool tier classification ──────────────────────────────────────────────────

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

const TIER_3_BASH_PATTERNS = [
  /rm -rf/i,
  /sudo /i,
  /curl.*twitter|wget.*twitter/i,
  /deploy.*production/i,
];

function getToolTier(toolName, toolInput) {
  if (TIER_0_TOOLS.has(toolName)) return 0;

  if (toolName === 'Bash') {
    const cmd = (toolInput?.command || '').toLowerCase();
    if (/^(ls|cat|head|tail|grep|find|echo|wc|diff|git (status|log|diff|branch))/.test(cmd)) return 0;
    if (/npm (test|run (test|build|dev|lint))/.test(cmd)) return 0;
    if (/npx (vitest|tsc|playwright)/.test(cmd)) return 0;
    if (TIER_3_BASH_PATTERNS.some(p => p.test(cmd))) return 3;
    if (/git push/.test(cmd)) return 3;
    if (/git commit/.test(cmd)) return 2;
    if (/rm\s/.test(cmd)) return 2;
    return 1;
  }

  if (['Edit', 'Write', 'MultiEdit'].includes(toolName)) return 1;

  if (toolName === 'mcp__mission-control_db__task_update') {
    return toolInput?.status === 'done' ? 2 : 1;
  }
  if (toolName === 'mcp__mission-control_db__task_create') return 1;
  if (toolName === 'mcp__mission-control_db__task_add_activity') return 0;
  if (toolName === 'mcp__mission-control_db__approval_create') return 1;
  if (toolName === 'mcp__mission-control_db__chat_post') return 1;
  if (toolName === 'mcp__memory__memory_write') return 1;

  return 1;
}

// ── Trust tier → decision logic ───────────────────────────────────────────────
//
// Returns: 'approve' | 'block' | 'queue'
//
// Only 'restricted' ever returns 'block' — all other tiers use 'queue' at their
// ceiling (tool still runs, but an approval record is created for human review).

function makeDecision(toolTier, trustTier) {
  switch (trustTier) {
    case 'admin':
      return 'approve';

    case 'trusted':
      if (toolTier <= 2) return 'approve';
      return 'queue';

    case 'worker':
      if (toolTier <= 1) return 'approve';
      return 'queue';

    case 'apprentice':
      if (toolTier === 0) return 'approve';
      return 'queue';

    case 'restricted':
      // Only tier that hard-blocks — prevents execution entirely
      return toolTier === 0 ? 'approve' : 'block';

    default:
      if (toolTier === 0) return 'approve';
      return 'queue';
  }
}

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;

  let toolName = 'unknown';
  let toolInput = {};
  let sessionId = process.env.CLAUDE_CODE_SESSION_ID || null;

  try {
    const parsed = JSON.parse(input);
    toolName = parsed.tool_name || parsed.toolName || 'unknown';
    toolInput = parsed.tool_input || parsed.toolInput || {};
    if (parsed.session_id) sessionId = parsed.session_id;
  } catch (e) {
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
    return;
  }

  const trustTier = getTrustTierForSession(sessionId);
  const toolTier = getToolTier(toolName, toolInput);
  const decision = makeDecision(toolTier, trustTier);

  if (decision === 'block') {
    createApprovalRecord(toolName, toolInput);
    logAnalytics(toolName, toolTier, 'block', trustTier);
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Action requires human review: ${toolName} (Tier ${toolTier}) is not permitted for restricted agents. Check the Approval Queue in Mission Control.`,
    }));

  } else if (decision === 'queue') {
    createApprovalRecord(toolName, toolInput);
    logAnalytics(toolName, toolTier, 'queue', trustTier);
    process.stdout.write(JSON.stringify({ decision: 'approve' }));

  } else {
    logAnalytics(toolName, toolTier, 'approve', trustTier);
    process.stdout.write(JSON.stringify({ decision: 'approve' }));
  }
}

main().catch((err) => {
  process.stderr.write(`[approval-hook] Unexpected crash: ${err}\n`);
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: 'Approval hook crashed unexpectedly. Check hook logs and retry.',
  }));
});
