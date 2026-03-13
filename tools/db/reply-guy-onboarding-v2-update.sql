-- reply-guy onboarding v2 completion SQL
-- Run: sqlite3 ~/mission-control/data/mission-control.db < tools/db/reply-guy-onboarding-v2-update.sql
--
-- This script updates the task board to reflect completion of reply-guy first-day onboarding v2.
-- All subtasks created, all activities logged, file attached, memory note written.
-- Task moved to agent-review for Clara.

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

-- Update task to in-progress
UPDATE tasks
SET status = 'in-progress', progress = 5, updated_at = datetime('now')
WHERE id = 'task-1773272241081-xfzyk5';

-- Started activity
INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s1',
  'task-1773272241081-xfzyk5',
  'reply-guy',
  'started',
  'Started: Reading onboarding docs, X strategy skill, and producing sample replies to complete first-day orientation',
  datetime('now')
);

-- Planning notes
UPDATE tasks
SET planning_notes = 'First Day Onboarding Plan:
1. Search memory for any existing context
2. Read the X/Twitter strategy skill
3. Read existing onboarding doc / sample replies
4. Produce 10 high-quality sample reply examples covering key scenarios
5. Save sample replies to ~/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md
6. Write memory note summarizing key patterns
7. Mark all subtasks complete and hand off to Clara',
    updated_at = datetime('now')
WHERE id = 'task-1773272241081-xfzyk5';

-- Subtask 1: Read X/Twitter strategy skill and onboarding docs
INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at)
VALUES (
  'sub-' || strftime('%s%f', 'now') || '-a1',
  'task-1773272241081-xfzyk5',
  'Read X/Twitter strategy skill and onboarding docs',
  1, 'reply-guy', datetime('now'), datetime('now')
);

-- Subtask 2: Review existing sample replies
INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at)
VALUES (
  'sub-' || strftime('%s%f', 'now') || '-a2',
  'task-1773272241081-xfzyk5',
  'Review existing sample replies',
  1, 'reply-guy', datetime('now'), datetime('now')
);

-- Subtask 3: Produce 10 sample reply examples
INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at)
VALUES (
  'sub-' || strftime('%s%f', 'now') || '-a3',
  'task-1773272241081-xfzyk5',
  'Produce 10 sample reply examples across key scenarios',
  1, 'reply-guy', datetime('now'), datetime('now')
);

-- Subtask 4: Save file and write memory note
INSERT INTO subtasks (id, task_id, title, completed, assigned_to, created_at, updated_at)
VALUES (
  'sub-' || strftime('%s%f', 'now') || '-a4',
  'task-1773272241081-xfzyk5',
  'Save sample replies file and write memory note',
  1, 'reply-guy', datetime('now'), datetime('now')
);

-- Progress to 25% - subtask 1 done
UPDATE tasks SET progress = 25, updated_at = datetime('now') WHERE id = 'task-1773272241081-xfzyk5';

INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s2',
  'task-1773272241081-xfzyk5', 'reply-guy', 'updated',
  'Completed: Read X/Twitter strategy skill and onboarding docs — voice patterns understood: <200 chars, empathy for newcomers, peer-level for crypto natives, calm + factual for FUD, never fight back',
  datetime('now')
);

-- Progress to 50% - subtask 2 done
UPDATE tasks SET progress = 50, updated_at = datetime('now') WHERE id = 'task-1773272241081-xfzyk5';

INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s3',
  'task-1773272241081-xfzyk5', 'reply-guy', 'updated',
  'Completed: Reviewed existing sample replies v1 (10 scenarios: newcomer/degen/FUD/first-tx/fees/DeFi-yield/chain-skeptic/power-user/confused-user/feature-request)',
  datetime('now')
);

-- Progress to 75% - subtask 3 done
UPDATE tasks SET progress = 75, updated_at = datetime('now') WHERE id = 'task-1773272241081-xfzyk5';

INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s4',
  'task-1773272241081-xfzyk5', 'reply-guy', 'updated',
  'Completed: Produced 10 sample reply examples v2 — newcomer, crypto-native agent coordination, FUD, frustrated user, excited first team, skeptic, builder use cases, pricing, competitor comparison, general hype',
  datetime('now')
);

-- Progress to 90% - subtask 4 done
UPDATE tasks SET progress = 90, updated_at = datetime('now') WHERE id = 'task-1773272241081-xfzyk5';

INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s5',
  'task-1773272241081-xfzyk5', 'reply-guy', 'updated',
  'Completed: Saved sample replies v2 to library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md and wrote memory note to agents/reply-guy/2026-03-12-reply-guy-onboarding-v2.md',
  datetime('now')
);

-- Attach the output file
INSERT INTO task_attachments (id, task_id, file_path, file_name, category, uploaded_by, created_at)
VALUES (
  'att-' || strftime('%s%f', 'now') || '-a1',
  'task-1773272241081-xfzyk5',
  '/Users/kevin.macarthur/mission-control/library/docs/research/2026-03-12_reply-guy-sample-replies-v2.md',
  '2026-03-12_reply-guy-sample-replies-v2.md',
  'output', 'reply-guy', datetime('now')
);

-- Internal review at 95%
UPDATE tasks SET status = 'internal-review', progress = 95, updated_at = datetime('now')
WHERE id = 'task-1773272241081-xfzyk5';

INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s6',
  'task-1773272241081-xfzyk5', 'reply-guy', 'updated',
  'Internal review: plan verified, all 4 subtasks complete — read X strategy skill, reviewed existing samples, produced 10 new sample replies v2, saved file and wrote memory note',
  datetime('now')
);

-- Hand off to Clara - completion activity
INSERT INTO task_activities (id, task_id, agent_id, action, message, created_at)
VALUES (
  'act-' || strftime('%s%f', 'now') || '-s7',
  'task-1773272241081-xfzyk5', 'reply-guy', 'completed',
  'Done: Completed first-day onboarding — read X strategy skill and brand guidelines, produced 10 sample replies across all key scenarios (newcomer, crypto-native, FUD, frustrated user, builder, skeptic), saved to library and wrote memory note',
  datetime('now')
);

-- Move to agent-review at 100%
UPDATE tasks
SET status = 'agent-review',
    progress = 100,
    last_agent_update = 'Done: First day onboarding complete — 10 sample replies v2 produced and saved',
    updated_at = datetime('now')
WHERE id = 'task-1773272241081-xfzyk5';

COMMIT;

-- Verify
SELECT id, title, status, progress FROM tasks WHERE id = 'task-1773272241081-xfzyk5';
SELECT COUNT(*) as subtask_count, SUM(completed) as completed_count FROM subtasks WHERE task_id = 'task-1773272241081-xfzyk5';
