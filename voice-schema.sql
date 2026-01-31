-- Multi-Agent Voice System Database Schema for Froggo Dashboard
-- Database: ~/clawd/data/froggo.db
-- Version: 2.0.0 (Ported from Ox, adapted for Froggo)
-- Created: 2025-02-01 | Updated: 2026-02-01

-- Voice Sessions Table
CREATE TABLE IF NOT EXISTS voice_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL CHECK(agent IN ('coder', 'writer', 'researcher', 'hr', 'chief', 'froggo')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration INTEGER,
  message_count INTEGER DEFAULT 0,
  screen_share_used BOOLEAN DEFAULT 0,
  webcam_used BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Voice Actions Table
CREATE TABLE IF NOT EXISTS voice_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  agent TEXT NOT NULL CHECK(agent IN ('coder', 'writer', 'researcher', 'hr', 'chief', 'froggo')),
  action_type TEXT NOT NULL CHECK(action_type IN (
    'session_start', 'session_end', 'agent_switch',
    'user_input', 'agent_response',
    'listening_start', 'listening_stop',
    'screen_share_start', 'screen_share_stop',
    'webcam_start', 'webcam_stop',
    'transcription_start', 'transcription_complete',
    'meeting_summarize',
    'error', 'warning', 'info'
  )),
  metadata TEXT,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES voice_sessions(id) ON DELETE CASCADE
);

-- Meeting Transcriptions Table (NEW - Gemini-powered)
CREATE TABLE IF NOT EXISTS meeting_transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  transcript TEXT NOT NULL,
  summary TEXT,
  action_items TEXT, -- JSON array
  key_decisions TEXT, -- JSON array
  participants TEXT, -- JSON array
  duration_seconds INTEGER,
  audio_mime_type TEXT,
  session_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES voice_sessions(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_sessions_agent ON voice_sessions(agent);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_started ON voice_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_ended ON voice_sessions(ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_actions_session ON voice_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_actions_agent ON voice_actions(agent);
CREATE INDEX IF NOT EXISTS idx_voice_actions_type ON voice_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_voice_actions_timestamp ON voice_actions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_transcriptions_created ON meeting_transcriptions(created_at DESC);

-- Views

CREATE VIEW IF NOT EXISTS voice_agent_stats AS
SELECT
  agent,
  COUNT(*) as total_sessions,
  SUM(message_count) as total_messages,
  AVG(duration) as avg_duration_ms,
  SUM(CASE WHEN screen_share_used = 1 THEN 1 ELSE 0 END) as screen_share_count,
  SUM(CASE WHEN webcam_used = 1 THEN 1 ELSE 0 END) as webcam_count,
  MIN(started_at) as first_session,
  MAX(started_at) as last_session
FROM voice_sessions
WHERE ended_at IS NOT NULL
GROUP BY agent;

CREATE VIEW IF NOT EXISTS voice_daily_usage AS
SELECT
  DATE(started_at / 1000, 'unixepoch') as date,
  agent,
  COUNT(*) as sessions,
  SUM(message_count) as messages,
  SUM(duration) / 1000 / 60 as total_minutes
FROM voice_sessions
WHERE ended_at IS NOT NULL
GROUP BY date, agent
ORDER BY date DESC;

CREATE VIEW IF NOT EXISTS voice_recent_sessions AS
SELECT
  vs.*,
  COUNT(va.id) as action_count
FROM voice_sessions vs
LEFT JOIN voice_actions va ON vs.id = va.session_id
GROUP BY vs.id
ORDER BY vs.started_at DESC
LIMIT 50;

-- Triggers

CREATE TRIGGER IF NOT EXISTS voice_session_duration_update
AFTER UPDATE OF ended_at ON voice_sessions
WHEN NEW.ended_at IS NOT NULL AND NEW.duration IS NULL
BEGIN
  UPDATE voice_sessions
  SET duration = NEW.ended_at - NEW.started_at
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS voice_session_cleanup
AFTER DELETE ON voice_sessions
BEGIN
  DELETE FROM voice_actions WHERE session_id = OLD.id;
END;

-- ============================================================
-- MIGRATION SCRIPT: Run this if upgrading from Ox schema v1.0
-- ============================================================

-- Step 1: Add 'froggo' to agent CHECK constraints
-- SQLite doesn't support ALTER CHECK, so we recreate tables

-- Migration: voice_sessions
-- ALTER TABLE voice_sessions RENAME TO voice_sessions_old;
-- CREATE TABLE voice_sessions ( ... with froggo in CHECK ... );
-- INSERT INTO voice_sessions SELECT * FROM voice_sessions_old;
-- DROP TABLE voice_sessions_old;

-- Migration: voice_actions (add new action types)
-- ALTER TABLE voice_actions RENAME TO voice_actions_old;
-- CREATE TABLE voice_actions ( ... with new action_types ... );
-- INSERT INTO voice_actions SELECT * FROM voice_actions_old;
-- DROP TABLE voice_actions_old;

-- Step 2: Create new meeting_transcriptions table (safe - IF NOT EXISTS)
-- Already handled above.

-- Step 3: Verify
-- SELECT DISTINCT agent FROM voice_sessions;
-- SELECT DISTINCT action_type FROM voice_actions;
-- SELECT name FROM sqlite_master WHERE type='table' AND name='meeting_transcriptions';
