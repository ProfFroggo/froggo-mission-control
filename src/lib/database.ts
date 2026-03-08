// src/lib/database.ts
// Shared database module — used by ALL API routes.
// Creates ~/mission-control/data/mission-control.db on first use, WAL mode, full schema.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ENV } from './env';
import { syncCatalogAgents, syncCatalogModules } from './catalogSync';
import { keychainSet } from './keychain';

// Database location — single source of truth via ENV wrapper
const DB_PATH = ENV.DB_PATH;

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
      role TEXT,
      emoji TEXT DEFAULT '🤖',
      color TEXT DEFAULT '#00BCD4',
      avatar TEXT,
      description TEXT,
      personality TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'offline',
      capabilities TEXT DEFAULT '[]',
      sessionKey TEXT,
      currentTaskId TEXT,
      lastActivity INTEGER,
      trust_tier TEXT DEFAULT 'apprentice',
      model TEXT DEFAULT 'sonnet',
      created_at INTEGER DEFAULT (unixepoch())
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
    -- LIBRARY
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS library_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder',
      sort_order INTEGER DEFAULT 0,
      createdAt INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS library_files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER,
      type TEXT,
      category TEXT,
      folder_id TEXT REFERENCES library_folders(id) ON DELETE SET NULL,
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
    -- TOKEN USAGE
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agentId TEXT NOT NULL,
      taskId TEXT,
      sessionId TEXT,
      model TEXT NOT NULL,
      inputTokens INTEGER NOT NULL DEFAULT 0,
      outputTokens INTEGER NOT NULL DEFAULT 0,
      costUsd REAL NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'stream',
      timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- ══════════════════════════════════════════
    -- CATALOG: AGENTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS catalog_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT DEFAULT '🤖',
      role TEXT,
      description TEXT,
      model TEXT DEFAULT 'sonnet',
      capabilities TEXT DEFAULT '[]',
      requiredApis TEXT DEFAULT '[]',
      requiredSkills TEXT DEFAULT '[]',
      requiredTools TEXT DEFAULT '[]',
      version TEXT DEFAULT '1.0.0',
      category TEXT DEFAULT 'general',
      avatar TEXT,
      color TEXT DEFAULT '#00BCD4',
      core INTEGER DEFAULT 0,
      defaultPersonality TEXT,
      installed INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- ══════════════════════════════════════════
    -- CATALOG: MODULES
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS catalog_modules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      version TEXT DEFAULT '1.0.0',
      category TEXT DEFAULT 'general',
      icon TEXT DEFAULT '📦',
      responsibleAgent TEXT,
      requiredAgents TEXT DEFAULT '[]',
      requiredNpm TEXT DEFAULT '[]',
      requiredApis TEXT DEFAULT '[]',
      requiredSkills TEXT DEFAULT '[]',
      requiredCli TEXT DEFAULT '[]',
      installed INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      core INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- ══════════════════════════════════════════
    -- PROJECTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366f1',
      goal TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      createdBy TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      projectId TEXT NOT NULL,
      agentId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      addedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (projectId, agentId),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════
    -- MODULE BUILDER DRAFTS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS modules_builder (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Module',
      description TEXT,
      category TEXT DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'in-progress',
      spec TEXT DEFAULT '{}',
      conversationState TEXT DEFAULT '{}',
      overallProgress REAL DEFAULT 0,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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
    CREATE INDEX IF NOT EXISTS idx_token_usage_agentId ON token_usage(agentId);
    CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
    CREATE INDEX IF NOT EXISTS idx_token_usage_taskId ON token_usage(taskId);
    CREATE INDEX IF NOT EXISTS idx_catalog_agents_installed ON catalog_agents(installed);
    CREATE INDEX IF NOT EXISTS idx_catalog_agents_category ON catalog_agents(category);
    CREATE INDEX IF NOT EXISTS idx_catalog_modules_installed ON catalog_modules(installed);
    CREATE INDEX IF NOT EXISTS idx_catalog_modules_category ON catalog_modules(category);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_createdAt ON projects(createdAt);
    CREATE INDEX IF NOT EXISTS idx_project_members_agentId ON project_members(agentId);
    CREATE INDEX IF NOT EXISTS idx_modules_builder_status ON modules_builder(status);
    CREATE INDEX IF NOT EXISTS idx_modules_builder_updatedAt ON modules_builder(updatedAt DESC);

    -- ── Performance indexes ──────────────────────────────────────────────
    -- Tasks: composite indexes for common dashboard queries
    CREATE INDEX IF NOT EXISTS idx_tasks_status_updated ON tasks(status, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignedTo_status ON tasks(assignedTo, status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority_status ON tasks(priority, status);

    -- Subtasks: position-ordered retrieval per task
    CREATE INDEX IF NOT EXISTS idx_subtasks_taskId_position ON subtasks(taskId, position);

    -- Task activity: agent timeline queries
    CREATE INDEX IF NOT EXISTS idx_activity_agentId_timestamp ON task_activity(agentId, timestamp DESC);

    -- Messages: session-ordered retrieval
    CREATE INDEX IF NOT EXISTS idx_messages_sessionKey_timestamp ON messages(sessionKey, timestamp DESC);

    -- Inbox: type and recency queries
    CREATE INDEX IF NOT EXISTS idx_inbox_type ON inbox(type);
    CREATE INDEX IF NOT EXISTS idx_inbox_createdAt ON inbox(createdAt DESC);

    -- Token usage: cost reporting
    CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model, timestamp DESC);

    -- Approvals: requester queries
    CREATE INDEX IF NOT EXISTS idx_approvals_requester ON approvals(requester, createdAt DESC);

    -- No default rooms seeded — rooms are created on demand
  `);

  // Add new columns to existing tables — safe to run on every startup
  const columnMigrations = [
    `ALTER TABLE chat_rooms ADD COLUMN agents TEXT DEFAULT '[]'`,
    `ALTER TABLE chat_rooms ADD COLUMN sessionKeys TEXT DEFAULT '{}'`,
    `ALTER TABLE chat_rooms ADD COLUMN updatedAt INTEGER DEFAULT 0`,
    `ALTER TABLE chat_room_messages ADD COLUMN role TEXT DEFAULT 'agent'`,
    `ALTER TABLE chat_room_messages ADD COLUMN mentionedAgents TEXT DEFAULT '[]'`,
    `ALTER TABLE chat_room_messages ADD COLUMN messageId TEXT`,
    // Projects FK columns
    `ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`,
    `ALTER TABLE chat_rooms ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`,
    `ALTER TABLE tasks ADD COLUMN recurrence TEXT`,
    `ALTER TABLE tasks ADD COLUMN recurrenceParentId TEXT`,
    `ALTER TABLE catalog_agents ADD COLUMN defaultPersonality TEXT`,
    `ALTER TABLE catalog_agents ADD COLUMN core INTEGER DEFAULT 0`,
    `ALTER TABLE catalog_agents ADD COLUMN avatar TEXT`,
    `ALTER TABLE catalog_agents ADD COLUMN color TEXT DEFAULT '#00BCD4'`,
    `ALTER TABLE catalog_agents ADD COLUMN enabled INTEGER DEFAULT 1`,
    `ALTER TABLE agents ADD COLUMN role TEXT`,
    `ALTER TABLE agents ADD COLUMN emoji TEXT DEFAULT '🤖'`,
    `ALTER TABLE agents ADD COLUMN color TEXT DEFAULT '#00BCD4'`,
    `ALTER TABLE agents ADD COLUMN personality TEXT DEFAULT ''`,
    `ALTER TABLE agents ADD COLUMN created_at INTEGER DEFAULT (unixepoch())`,
  ];
  for (const sql of columnMigrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  syncCatalogAgents(db);
  syncCatalogModules(db);

  // Migrate plaintext API keys from DB to OS keychain (fire-and-forget)
  migrateKeysToKeychain(db).catch(console.error);
}

async function migrateKeysToKeychain(db: Database.Database): Promise<void> {
  const keysToMigrate = ['gemini_api_key', 'anthropic_api_key'];
  for (const key of keysToMigrate) {
    try {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      if (row?.value) {
        const saved = await keychainSet(key, row.value);
        if (saved) {
          db.prepare('DELETE FROM settings WHERE key = ?').run(key);
          console.log(`[db] Migrated ${key} from SQLite to OS keychain`);
        }
      }
    } catch (err) {
      // Non-fatal — keytar may not be available in all environments
      console.warn(`[db] Could not migrate ${key} to keychain:`, err);
    }
  }
}

function seedAgents(db: Database.Database) {
  // Only seed the 5 core agents that are always present.
  // All other agents are installed via the onboarding wizard or Agents catalog — not auto-seeded.
  const agents = [
    { id: 'mission-control', name: 'Mission Control', description: 'Main orchestrator',           capabilities: '["coordination","task-management","delegation"]',              model: 'opus'   },
    { id: 'clara',           name: 'Clara',           description: 'Quality auditor',             capabilities: '["code-review","quality-validation","security"]',             model: 'opus'   },
    { id: 'coder',           name: 'Coder',           description: 'Software engineer',           capabilities: '["coding","debugging","typescript","python"]',               model: 'sonnet' },
    { id: 'hr',              name: 'HR',              description: 'Agent management',            capabilities: '["agent-creation","training","skill-gaps"]',                model: 'sonnet' },
    { id: 'inbox',           name: 'Inbox',           description: 'Message triage specialist',   capabilities: '["triage","routing","prioritization","monitoring"]',          model: 'sonnet' },
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
