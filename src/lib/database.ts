// src/lib/database.ts
// Shared database module — used by ALL API routes.
// Creates ~/froggo/data/froggo.db on first use, WAL mode, full schema.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database location — configurable via env var
const DB_PATH = process.env.FROGGO_DB_PATH
  || path.join(process.env.HOME || '/tmp', 'froggo', 'data', 'froggo.db');

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- ══════════════════════════════════════════
    -- TASKS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT DEFAULT 'p2',
      project TEXT,
      assignedTo TEXT,
      reviewerId TEXT,
      reviewStatus TEXT,
      reviewNotes TEXT,
      tags TEXT DEFAULT '[]',
      labels TEXT DEFAULT '[]',
      planningNotes TEXT,
      dueDate INTEGER,
      estimatedHours REAL,
      blockedBy TEXT DEFAULT '[]',
      blocks TEXT DEFAULT '[]',
      progress INTEGER DEFAULT 0,
      lastAgentUpdate TEXT,
      completedAt INTEGER,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      projectName TEXT,
      stageNumber INTEGER,
      stageName TEXT,
      nextStage TEXT,
      parentTaskId TEXT
    );

    -- ══════════════════════════════════════════
    -- SUBTASKS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0,
      assignedTo TEXT,
      completedAt INTEGER,
      completedBy TEXT,
      position INTEGER,
      createdAt INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════
    -- TASK ACTIVITY
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS task_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      agentId TEXT,
      action TEXT NOT NULL DEFAULT 'update',
      message TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════
    -- TASK LABELS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS task_labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL
    );

    -- ══════════════════════════════════════════
    -- TASK ATTACHMENTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId TEXT NOT NULL,
      filePath TEXT NOT NULL,
      fileName TEXT,
      category TEXT,
      uploadedBy TEXT,
      createdAt INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (taskId) REFERENCES tasks(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════
    -- AGENTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'offline',
      capabilities TEXT DEFAULT '[]',
      sessionKey TEXT,
      currentTaskId TEXT,
      lastActivity INTEGER,
      trust_tier TEXT DEFAULT 'apprentice',
      model TEXT DEFAULT 'sonnet'
    );

    -- ══════════════════════════════════════════
    -- SESSIONS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sessions (
      key TEXT PRIMARY KEY,
      agentId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      lastActivity INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      messageCount INTEGER DEFAULT 0,
      FOREIGN KEY (agentId) REFERENCES agents(id)
    );

    -- ══════════════════════════════════════════
    -- MESSAGES
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionKey TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      channel TEXT DEFAULT 'dashboard',
      streaming INTEGER DEFAULT 0,
      FOREIGN KEY (sessionKey) REFERENCES sessions(key) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════
    -- APPROVALS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      context TEXT,
      metadata TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      requester TEXT,
      adjustedContent TEXT,
      notes TEXT,
      tier INTEGER DEFAULT 3,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      respondedAt INTEGER
    );

    -- ══════════════════════════════════════════
    -- INBOX
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      context TEXT,
      channel TEXT,
      source_channel TEXT,
      status TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      metadata TEXT DEFAULT '{}',
      starred INTEGER DEFAULT 0,
      isRead INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      project TEXT
    );

    -- ══════════════════════════════════════════
    -- CHAT ROOMS (inter-agent communication)
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      topic TEXT,
      createdAt INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS chat_room_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId TEXT NOT NULL,
      agentId TEXT NOT NULL,
      content TEXT NOT NULL,
      replyTo INTEGER,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (roomId) REFERENCES chat_rooms(id),
      FOREIGN KEY (replyTo) REFERENCES chat_room_messages(id)
    );

    -- ══════════════════════════════════════════
    -- AGENT SESSIONS (persistent session tracking)
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS agent_sessions (
      agentId TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      model TEXT,
      createdAt INTEGER DEFAULT (unixepoch() * 1000),
      lastActivity INTEGER DEFAULT (unixepoch() * 1000),
      status TEXT DEFAULT 'active'
    );

    -- ══════════════════════════════════════════
    -- SCHEDULED ITEMS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS scheduled_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      scheduledFor TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      platform TEXT
    );

    -- ══════════════════════════════════════════
    -- MODULE STATE
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS module_state (
      module_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      last_toggled INTEGER
    );

    -- ══════════════════════════════════════════
    -- ANALYTICS EVENTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      metadata TEXT DEFAULT '{}'
    );

    -- ══════════════════════════════════════════
    -- LIBRARY FILES
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS library_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      category TEXT,
      createdAt INTEGER DEFAULT (unixepoch() * 1000)
    );

    -- ══════════════════════════════════════════
    -- SETTINGS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- ══════════════════════════════════════════
    -- INDEXES
    -- ══════════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo ON tasks(assignedTo);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
    CREATE INDEX IF NOT EXISTS idx_task_activity_taskId ON task_activity(taskId);
    CREATE INDEX IF NOT EXISTS idx_task_activity_timestamp ON task_activity(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_sessionKey ON messages(sessionKey);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);
    CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room ON chat_room_messages(roomId, timestamp);
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp);

    -- ══════════════════════════════════════════
    -- SEED DATA
    -- ══════════════════════════════════════════
    INSERT OR IGNORE INTO chat_rooms (id, name, topic) VALUES
      ('general', 'General', 'Cross-team coordination'),
      ('code-review', 'Code Review', 'Review requests and discussions'),
      ('planning', 'Planning', 'Task decomposition and architecture'),
      ('incidents', 'Incidents', 'Bug reports and production issues');
  `);

  seedAgents(db);
}

function seedAgents(db: Database.Database) {
  const agents = [
    { id: 'froggo',              name: 'Froggo',               description: 'Main orchestrator',        capabilities: '["coordination","task-management","delegation"]',          model: 'opus'   },
    { id: 'coder',               name: 'Coder',                description: 'Software engineer',        capabilities: '["coding","debugging","typescript","python"]',              model: 'sonnet' },
    { id: 'researcher',          name: 'Researcher',           description: 'Research & analysis',      capabilities: '["research","analysis","web-search"]',                      model: 'sonnet' },
    { id: 'writer',              name: 'Writer',               description: 'Content creation',         capabilities: '["writing","editing","documentation"]',                     model: 'sonnet' },
    { id: 'chief',               name: 'Chief',                description: 'Lead engineer',            capabilities: '["architecture","code-review","mentoring"]',                model: 'opus'   },
    { id: 'clara',               name: 'Clara',                description: 'Quality auditor',          capabilities: '["code-review","quality-validation","security"]',           model: 'opus'   },
    { id: 'designer',            name: 'Designer',             description: 'UI/UX designer',           capabilities: '["ui-design","ux-design","prototyping"]',                   model: 'sonnet' },
    { id: 'social_media_manager',name: 'Social Media Manager', description: 'X/Twitter strategy',      capabilities: '["content-ideation","tweet-drafting","engagement"]',        model: 'sonnet' },
    { id: 'growth_director',     name: 'Growth Director',      description: 'Strategic growth',         capabilities: '["strategy","growth","marketing","gtm"]',                   model: 'opus'   },
    { id: 'hr',                  name: 'HR',                   description: 'Agent management',         capabilities: '["agent-creation","training","skill-gaps"]',                model: 'sonnet' },
    { id: 'onchain_worker',      name: 'Onchain Worker',       description: 'Blockchain operations',    capabilities: '["blockchain","crypto","defi","web3"]',                     model: 'sonnet' },
    { id: 'degen-frog',          name: 'Degen Frog',           description: 'Crypto trading',           capabilities: '["crypto-trading","perps","dex","risk"]',                   model: 'sonnet' },
    { id: 'voice',               name: 'Voice',                description: 'Voice agent',              capabilities: '["tts","voice","audio"]',                                   model: 'sonnet' },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO agents (id, name, description, capabilities, model, status)
     VALUES (?, ?, ?, ?, ?, 'offline')`
  );
  for (const a of agents) {
    stmt.run(a.id, a.name, a.description, a.capabilities, a.model);
  }
}

export default getDb;
