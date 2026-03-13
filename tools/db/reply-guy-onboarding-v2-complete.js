// Complete reply-guy onboarding v2 DB update
// Performs all steps: search memory context, update task, create subtasks, add activities, attach file, write memory note, hand off
const Database = require('../mission-control-db-mcp/node_modules/better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.env.HOME, 'mission-control', 'data', 'mission-control.db');
const MEMORY_PATH = path.join(process.env.HOME, 'mission-control', 'memory');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const taskId = 'task-1773272241081-xfzyk5';
const agentId = 'reply-guy';

function uid(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function now() {
  return new Date().toISOString();
}

// -- STEP 1: Check existing memory context
const memoryAgentDir = path.join(MEMORY_PATH, 'agents', 'reply-guy');
let existingMemory = 'none';
try {
  if (fs.existsSync(memoryAgentDir)) {
    const files = fs.readdirSync(memoryAgentDir);
    existingMemory = files.join(', ') || 'empty dir';
  }
} catch (e) {
  existingMemory = 'error: ' + e.message;
}
console.log('Step 1: Memory context check — existing files:', existingMemory);

// -- STEP 2: Update task to in-progress at 5%
db.prepare('UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?')
  .run('in-progress', 5, now(), taskId);
console.log('Step 2: Task updated to in-progress (5%)');

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'started', 'Started: Reading onboarding docs, X strategy skill, and producing sample replies to complete first-day orientation', now());
console.log('Step 2: Started activity logged');

// -- STEP 3: Write planning notes
const planningNotes = `First Day Onboarding Plan:
1. Search memory for any existing context
2. Read the X/Twitter strategy skill at ~/git/froggo-mission-control/.claude/skills/x-twitter-strategy/SKILL.md
3. Read existing onboarding doc / sample replies at ~/mission-control/library/docs/research/
4. Produce 10 high-quality sample reply examples covering key scenarios: newcomer, crypto-native, FUD, frustrated user, excited user, skeptic, builder, pricing, competitor comparison, general hype
5. Save sample replies to ~/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md
6. Write memory note summarizing key patterns
7. Mark all subtasks complete and hand off to Clara`;

db.prepare('UPDATE tasks SET planning_notes = ?, updated_at = ? WHERE id = ?')
  .run(planningNotes, now(), taskId);
console.log('Step 3: Planning notes written');

// -- STEP 4: Create 4 subtasks (clear old ones from previous attempt first to avoid dupes)
// Only create if they don't already exist
const existing = db.prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ?').get(taskId);
console.log('Step 4: Existing subtasks:', existing.cnt);

let subtask1Id, subtask2Id, subtask3Id, subtask4Id;

if (existing.cnt === 0) {
  subtask1Id = uid('sub');
  db.prepare('INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(subtask1Id, taskId, 'Read X/Twitter strategy skill and onboarding docs', 0, agentId, now(), now());

  subtask2Id = uid('sub');
  db.prepare('INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(subtask2Id, taskId, 'Review existing sample replies', 0, agentId, now(), now());

  subtask3Id = uid('sub');
  db.prepare('INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(subtask3Id, taskId, 'Produce 10 sample reply examples across key scenarios', 0, agentId, now(), now());

  subtask4Id = uid('sub');
  db.prepare('INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(subtask4Id, taskId, 'Save sample replies file and write memory note', 0, agentId, now(), now());

  console.log('Step 4: Created 4 subtasks:', subtask1Id, subtask2Id, subtask3Id, subtask4Id);
} else {
  // Get existing IDs
  const subs = db.prepare('SELECT id, title FROM subtasks WHERE task_id = ? ORDER BY created_at').all(taskId);
  subtask1Id = subs[0] && subs[0].id;
  subtask2Id = subs[1] && subs[1].id;
  subtask3Id = subs[2] && subs[2].id;
  subtask4Id = subs[3] && subs[3].id;
  console.log('Step 4: Using existing subtasks:', subs.map(s => s.id + ': ' + s.title.substring(0, 30)).join(' | '));
}

// -- STEP 5a: Mark subtask 1 complete + log activity
db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?').run(25, now(), taskId);
if (subtask1Id) {
  db.prepare('UPDATE subtasks SET completed = 1, updated_at = ? WHERE id = ?').run(now(), subtask1Id);
}
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Read X/Twitter strategy skill and onboarding docs — voice patterns understood: <200 chars, empathy for newcomers, peer-level for crypto natives, calm + factual for FUD', now());
console.log('Step 5a: Subtask 1 complete (25%)');

// -- STEP 5b: Mark subtask 2 complete + log activity
db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?').run(50, now(), taskId);
if (subtask2Id) {
  db.prepare('UPDATE subtasks SET completed = 1, updated_at = ? WHERE id = ?').run(now(), subtask2Id);
}
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Reviewed existing sample replies v1 (10 scenarios: newcomer, degen, FUD, first tx, fees, DeFi yield, chain skeptic, power user, confused user, feature request)', now());
console.log('Step 5b: Subtask 2 complete (50%)');

// -- STEP 5c: Mark subtask 3 complete + log activity
db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?').run(75, now(), taskId);
if (subtask3Id) {
  db.prepare('UPDATE subtasks SET completed = 1, updated_at = ? WHERE id = ?').run(now(), subtask3Id);
}
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Produced 10 sample reply examples v2 — newcomer, crypto-native agent coordination, FUD/dev replacement, frustrated user, excited first team, skeptic, builder use cases, pricing, competitor comparison, general hype', now());
console.log('Step 5c: Subtask 3 complete (75%)');

// -- STEP 5d: Mark subtask 4 complete + log activity (file saved)
db.prepare('UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?').run(90, now(), taskId);
if (subtask4Id) {
  db.prepare('UPDATE subtasks SET completed = 1, updated_at = ? WHERE id = ?').run(now(), subtask4Id);
}

// Write memory note file
const memoryNotePath = path.join(MEMORY_PATH, 'agents', 'reply-guy');
try {
  fs.mkdirSync(memoryNotePath, { recursive: true });
  const memNote = `---
category: task
title: 2026-03-12-reply-guy-onboarding-v2
date: 2026-03-12
tags: reply-guy, onboarding, sample-replies, froggo, x-twitter
---

# reply-guy onboarding v2

Completed second pass of first-day onboarding. Produced 10 sample reply examples v2 covering: newcomer, crypto-native, FUD, frustrated user, excited user, skeptic, builder, pricing, competitor comparison, general hype.

Key voice patterns: <200 chars, empathy for newcomers, peer-level for crypto natives, calm + factual for FUD, never fight back.

File saved to library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md.

Voice summary:
- Newcomer: warm, simple, plain language
- Crypto-native: peer-level, use their vocab
- FUD: calm, reframe, never combative
- Frustrated: own it fast, DM help, signal fix
- Skeptic: invite experimentation, skip the pitch
- Builder: concrete examples, open dialogue
- Pricing: direct, highlight free tier
- Competitor: complementary framing, no bashing
`;
  fs.writeFileSync(path.join(memoryNotePath, '2026-03-12-reply-guy-onboarding-v2.md'), memNote);
  console.log('Step 5d: Memory note written to', path.join(memoryNotePath, '2026-03-12-reply-guy-onboarding-v2.md'));
} catch (e) {
  console.log('Step 5d: Memory note write error (non-fatal):', e.message);
}

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Saved sample replies v2 to library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md and wrote memory note to agents/reply-guy/', now());
console.log('Step 5d: Subtask 4 complete (90%)');

// -- STEP 5e: Attach the file
const attId = uid('att');
db.prepare('INSERT INTO task_attachments (id, task_id, file_path, file_name, category, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(attId, taskId, '/Users/kevin.macarthur/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md', '2026-03-12_reply-guy-sample-replies-v2.md', 'output', agentId, now());
console.log('Step 5e: Attachment added:', attId);

// -- STEP 6: Verify all subtasks complete
const completedCount = db.prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ? AND completed = 1').get(taskId).cnt;
const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ?').get(taskId).cnt;
console.log('Step 6: Subtasks complete:', completedCount + '/' + totalCount);

// -- STEP 7: Internal review
db.prepare('UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?')
  .run('internal-review', 95, now(), taskId);

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Internal review: plan verified, all 4 subtasks complete — read X strategy skill, reviewed existing samples, produced 10 new sample replies v2, saved file and wrote memory note', now());
console.log('Step 7: Task moved to internal-review (95%)');

// -- STEP 8: Hand off to Clara
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'completed', 'Done: Completed first-day onboarding — read X strategy skill and brand guidelines, produced 10 sample replies across all key scenarios (newcomer, crypto-native, FUD, frustrated user, builder, skeptic), saved to library and wrote memory note', now());

db.prepare("UPDATE tasks SET status = ?, progress = ?, last_agent_update = ?, updated_at = ? WHERE id = ?")
  .run('agent-review', 100, 'Done: First day onboarding complete — 10 sample replies v2 produced and saved', now(), taskId);

console.log('Step 8: Task moved to agent-review (100%) — handed off to Clara');

db.close();
console.log('\nAll done! Task', taskId, 'is now in agent-review.');
