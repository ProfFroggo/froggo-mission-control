-- Performance Indexes for Froggo Dashboard
-- Run this script to optimize database queries
-- Usage: sqlite3 ~/clawd/data/froggo.db < add-performance-indexes.sql

-- Task queries (most common)
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_status_updated ON tasks(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo_status ON tasks(assigned_to, status);

-- Subtask queries
CREATE INDEX IF NOT EXISTS idx_subtasks_taskId ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_completed ON subtasks(completed);
CREATE INDEX IF NOT EXISTS idx_subtasks_position ON subtasks(task_id, position);

-- Task activity queries
CREATE INDEX IF NOT EXISTS idx_activity_taskId ON task_activity(task_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON task_activity(timestamp DESC);

-- Session queries (gateway_sessions)
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON gateway_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_channel ON gateway_sessions(channel_type);
CREATE INDEX IF NOT EXISTS idx_sessions_key ON gateway_sessions(session_key);

-- Message queries
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id);

-- Starred messages
CREATE INDEX IF NOT EXISTS idx_starred_timestamp ON starred_messages(starred_at DESC);
CREATE INDEX IF NOT EXISTS idx_starred_category ON starred_messages(category);
CREATE INDEX IF NOT EXISTS idx_starred_session ON starred_messages(session_key);

-- Folder assignments
CREATE INDEX IF NOT EXISTS idx_conversation_folders_conv ON conversation_folders(conversation_key);
CREATE INDEX IF NOT EXISTS idx_conversation_folders_folder ON conversation_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_conversation_folders_both ON conversation_folders(conversation_key, folder_id);

-- Message folders
CREATE INDEX IF NOT EXISTS idx_folders_name ON message_folders(name);

-- Snooze queries
CREATE INDEX IF NOT EXISTS idx_snooze_conversation ON conversation_snoozes(conversation_key);
CREATE INDEX IF NOT EXISTS idx_snooze_until ON conversation_snoozes(snooze_until);
CREATE INDEX IF NOT EXISTS idx_snooze_active ON conversation_snoozes(conversation_key, snooze_until);

-- Notification settings
CREATE INDEX IF NOT EXISTS idx_notification_settings ON notification_settings(session_key);

-- Pin queries
CREATE INDEX IF NOT EXISTS idx_pins_session ON pinned_conversations(session_key);
CREATE INDEX IF NOT EXISTS idx_pins_order ON pinned_conversations(pin_order);

-- Approval inbox
CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_timestamp ON inbox(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_type ON inbox(type);

-- Analyze tables for query planner
ANALYZE;

-- Vacuum to reclaim space and rebuild indexes
VACUUM;

-- Display index info
SELECT 
  'Indexes created successfully!' as status,
  COUNT(*) as total_indexes
FROM sqlite_master 
WHERE type = 'index' 
  AND name LIKE 'idx_%';

-- Show table stats
SELECT 
  name as table_name,
  (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
FROM sqlite_master m
WHERE type = 'table'
  AND name NOT LIKE 'sqlite_%'
ORDER BY name;
