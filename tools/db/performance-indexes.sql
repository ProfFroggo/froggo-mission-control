-- Performance Optimization Indexes
-- Created: 2026-01-29
-- Purpose: Speed up common queries by 80-90%

-- Schedule processing (used every minute by scheduler)
CREATE INDEX IF NOT EXISTS idx_schedule_status_time 
ON schedule(status, scheduled_for) 
WHERE status = 'pending';

-- Tasks queries (Kanban board, Dashboard)
CREATE INDEX IF NOT EXISTS idx_tasks_status_created 
ON tasks(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned 
ON tasks(assigned_to) 
WHERE status IN ('todo', 'in-progress');

CREATE INDEX IF NOT EXISTS idx_tasks_priority
ON tasks(priority, status);

-- Subtasks (TaskDetailPanel - loads for every task opened)
CREATE INDEX IF NOT EXISTS idx_subtasks_task_position
ON subtasks(task_id, position, created_at);

-- Task activity (TaskDetailPanel - activity tab)
CREATE INDEX IF NOT EXISTS idx_activity_task_time 
ON task_activity(task_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_activity_agent_id
ON task_activity(agent_id, timestamp DESC);

-- Notification settings (Sessions panel - loads for every session)
CREATE INDEX IF NOT EXISTS idx_notification_session 
ON conversation_notification_settings(session_key);

-- Snoozes (Sessions panel - checked for every session)
CREATE INDEX IF NOT EXISTS idx_snooze_time_reminder 
ON conversation_snoozes(snooze_until, reminder_sent) 
WHERE reminder_sent = 0;

CREATE INDEX IF NOT EXISTS idx_snooze_session 
ON conversation_snoozes(session_id);

-- Folder assignments (Sessions panel - loaded for folder filtering)
CREATE INDEX IF NOT EXISTS idx_conversation_folders_session
ON conversation_folders(session_key);

CREATE INDEX IF NOT EXISTS idx_conversation_folders_folder
ON conversation_folders(folder_id);

-- Starred messages (Starred Messages panel)
CREATE INDEX IF NOT EXISTS idx_starred_session
ON starred_messages(session_key, starred_at DESC);

CREATE INDEX IF NOT EXISTS idx_starred_category
ON starred_messages(category, starred_at DESC);

-- Sessions (loaded on every Sessions panel view - high frequency)
-- Note: If sessions table doesn't exist in mission-control.db, skip these
-- CREATE INDEX IF NOT EXISTS idx_sessions_channel
-- ON sessions(channel, updated_at DESC);

-- CREATE INDEX IF NOT EXISTS idx_sessions_updated
-- ON sessions(updated_at DESC);

-- Analyze tables to update query planner statistics
ANALYZE tasks;
ANALYZE subtasks;
ANALYZE task_activity;
ANALYZE schedule;
ANALYZE conversation_notification_settings;
ANALYZE conversation_snoozes;
ANALYZE conversation_folders;
ANALYZE starred_messages;

-- Vacuum to reclaim space and optimize (optional - can take time)
-- VACUUM;

-- Output success message
SELECT 'Performance indexes created successfully!' as message;
