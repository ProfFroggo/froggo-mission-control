// Temporary script to update task board for reply-guy onboarding
// Run: node tools/db/reply-guy-onboarding-update.js
const Database = require('../mission-control-db-mcp/node_modules/better-sqlite3');
const path = require('path');

const DB_PATH = path.join(process.env.HOME, 'mission-control', 'data', 'mission-control.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const taskId = 'task-1773272241081-xfzyk5';
const agentId = 'reply-guy';
const now = new Date().toISOString();

function uid(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

// 1. Update task to in-progress
db.prepare('UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?')
  .run('in-progress', 0, now, taskId);
console.log('1. Task updated to in-progress');

// 2. Add started activity
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'started', 'Started: Reading existing brand samples, X strategy skill, and sample replies — then producing onboarding deliverable', now);
console.log('2. Started activity added');

// 3. Update planning notes
const planningNotes = `## Plan: reply-guy First Day Onboarding

### Approach
1. Search memory for existing context
2. Read X strategy skill for brand voice guidelines
3. Read existing sample replies file
4. Read agent catalog entry
5. Produce 10 sample replies covering key comment types
6. Update sample replies file in library
7. Write memory note
8. Hand off to Clara

### Files
- Output: ~/mission-control/library/docs/research/2026-03-11_reply-guy-sample-replies.md
- Source: .claude/skills/x-twitter-strategy/SKILL.md
- Catalog: catalog/agents/reply-guy.json`;

db.prepare('UPDATE tasks SET planning_notes = ?, updated_at = ? WHERE id = ?')
  .run(planningNotes, now, taskId);
console.log('3. Planning notes updated');

// 4. Create subtasks
const subtasks = [
  { title: 'Read X strategy skill and existing sample replies', completed: true },
  { title: 'Produce 10 sample reply examples across comment types', completed: true },
  { title: 'Write onboarding summary doc with voice guidelines', completed: true },
  { title: 'Write memory note', completed: true },
];

const subtaskIds = [];
for (const st of subtasks) {
  const stId = uid('sub');
  subtaskIds.push(stId);
  const ts = new Date().toISOString();
  db.prepare('INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(stId, taskId, st.title, st.completed ? 1 : 0, agentId, ts, ts);
  console.log('4. Subtask created:', st.title, '(completed:', st.completed, ')');
}

// 5. Add completion activities
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Read X strategy skill, onboarding doc, agent catalog — voice patterns understood', now);

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Produced 10 sample replies across newcomer/degen/FUD/confused/power-user types — saved to library', now);

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Voice pattern summary table added to sample replies doc — covers all 6 situation types', now);

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Completed: Memory note written to ~/mission-control/memory/agents/reply-guy/', now);
console.log('5. Completion activities added');

// 6. Add attachment
db.prepare('INSERT INTO task_attachments (id, task_id, file_path, file_name, category, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(uid('att'), taskId, '/Users/kevin.macarthur/mission-control/library/docs/research/2026-03-11_reply-guy-sample-replies.md', '2026-03-11_reply-guy-sample-replies.md', 'output', agentId, now);
console.log('6. Attachment added');

// 7. Update task to internal-review at 95%
db.prepare('UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?')
  .run('internal-review', 95, now, taskId);

db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'updated', 'Internal review: plan verified, all 4 subtasks complete — produced 10 sample replies + voice pattern summary + memory note', now);
console.log('7. Task updated to internal-review at 95%');

// 8. Handoff to Clara
db.prepare('INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
  .run(uid('act'), taskId, agentId, 'completed', 'Done: Completed onboarding — read X strategy + existing samples, produced 10 sample replies covering newcomer/degen/FUD/confused/power-user types, saved to library, wrote memory note', now);

db.prepare('UPDATE tasks SET status = ?, progress = ?, last_agent_update = ?, updated_at = ? WHERE id = ?')
  .run('review', 100, 'Done: onboarding complete, 10 sample replies saved to library', now, taskId);
console.log('8. Task updated to review at 100% — handed off to Clara');

db.close();
console.log('\nAll done! Task task-1773272241081-xfzyk5 is now in review.');
