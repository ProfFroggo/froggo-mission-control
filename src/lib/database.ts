// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
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
      parentTaskId TEXT,
      moduleId TEXT
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
    -- PENDING ACTIONS (deferred executor queue)
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS pending_actions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      agentId TEXT,
      description TEXT,
      payload TEXT DEFAULT '{}',
      executor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      scheduledFor INTEGER,
      approvalId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
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
      wireframeHtml TEXT,
      taskIds TEXT DEFAULT '[]',
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

    -- Phase 79: additional composite indexes for Clara review and activity lookup
    CREATE INDEX IF NOT EXISTS idx_tasks_status_review ON tasks(status, reviewStatus);
    CREATE INDEX IF NOT EXISTS idx_task_activity_task_created ON task_activity(taskId, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_inbox_status_created ON inbox(status, createdAt DESC);

    -- ══════════════════════════════════════════
    -- CHAT MESSAGES (Phase 98 — SDK chat persistence)
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_key, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_agent ON chat_messages(agent_id, created_at);

    -- ══════════════════════════════════════════
    -- TELEMETRY (Phase 85)
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      event TEXT NOT NULL,
      data TEXT,
      agentId TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_telemetry_event_ts ON telemetry(event, ts DESC);

    -- No default rooms seeded — rooms are created on demand

    -- ══════════════════════════════════════════
    -- FINANCE
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS finance_accounts (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('checking','savings','credit','investment','crypto','other')),
      balance     REAL DEFAULT 0,
      currency    TEXT DEFAULT 'USD',
      institution TEXT,
      notes       TEXT,
      createdAt   INTEGER DEFAULT (unixepoch() * 1000),
      updatedAt   INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      accountId   TEXT NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
      amount      REAL NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
      category    TEXT,
      description TEXT,
      date        INTEGER NOT NULL,
      recurring   INTEGER DEFAULT 0,
      tags        TEXT DEFAULT '[]',
      createdAt   INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS finance_budgets (
      id        TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      category  TEXT NOT NULL,
      limit_amt REAL NOT NULL,
      spent     REAL DEFAULT 0,
      period    TEXT DEFAULT 'monthly' CHECK(period IN ('weekly','monthly','quarterly','yearly')),
      active    INTEGER DEFAULT 1,
      createdAt INTEGER DEFAULT (unixepoch() * 1000),
      updatedAt INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE TABLE IF NOT EXISTS finance_scenarios (
      id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      name       TEXT NOT NULL,
      projection TEXT DEFAULT '{}',
      notes      TEXT,
      createdAt  INTEGER DEFAULT (unixepoch() * 1000),
      updatedAt  INTEGER DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_finance_txns_account ON finance_transactions(accountId, date DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_txns_category ON finance_transactions(category, date DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_budgets_active ON finance_budgets(active, period);

    -- ══════════════════════════════════════════
    -- KNOWLEDGE BASE
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags TEXT NOT NULL DEFAULT '[]',
      scope TEXT NOT NULL DEFAULT 'all',
      pinned INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      createdBy TEXT NOT NULL DEFAULT 'human',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_links (
      id TEXT PRIMARY KEY,
      knowledgeId TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_assets (
      id TEXT PRIMARY KEY,
      knowledgeId TEXT NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
      filePath TEXT NOT NULL,
      fileName TEXT NOT NULL,
      mimeType TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_pinned ON knowledge_base(pinned, updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_scope ON knowledge_base(scope);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_links ON knowledge_base_links(knowledgeId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_base_assets ON knowledge_base_assets(knowledgeId);

    -- ══════════════════════════════════════════
    -- PROJECT MILESTONES
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      dueDate INTEGER,
      completed INTEGER DEFAULT 0,
      completedAt INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_milestones_projectId ON project_milestones(projectId, createdAt);

    -- ══════════════════════════════════════════
    -- CAMPAIGNS
    -- ══════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'general',
      goal TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      channels TEXT NOT NULL DEFAULT '[]',
      budget REAL,
      budgetSpent REAL DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      targetAudience TEXT,
      kpis TEXT NOT NULL DEFAULT '{}',
      startDate INTEGER,
      endDate INTEGER,
      briefContent TEXT,
      color TEXT DEFAULT '#6366f1',
      createdBy TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS campaign_members (
      campaignId TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      agentId TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      addedAt INTEGER NOT NULL,
      PRIMARY KEY (campaignId, agentId)
    );

    CREATE TABLE IF NOT EXISTS campaign_assets (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      filePath TEXT NOT NULL,
      fileName TEXT NOT NULL,
      assetType TEXT DEFAULT 'image',
      channel TEXT,
      status TEXT DEFAULT 'draft',
      createdBy TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
    CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
    CREATE INDEX IF NOT EXISTS idx_campaign_members_agentId ON campaign_members(agentId);
    CREATE INDEX IF NOT EXISTS idx_campaign_assets_campaignId ON campaign_assets(campaignId);
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
    `ALTER TABLE catalog_agents ADD COLUMN createdAt INTEGER DEFAULT (unixepoch() * 1000)`,
    `ALTER TABLE catalog_agents ADD COLUMN updatedAt INTEGER DEFAULT (unixepoch() * 1000)`,
    `ALTER TABLE agents ADD COLUMN role TEXT`,
    `ALTER TABLE agents ADD COLUMN emoji TEXT DEFAULT '🤖'`,
    `ALTER TABLE agents ADD COLUMN color TEXT DEFAULT '#00BCD4'`,
    `ALTER TABLE agents ADD COLUMN personality TEXT DEFAULT ''`,
    `ALTER TABLE agents ADD COLUMN created_at INTEGER DEFAULT (unixepoch())`,
    // Pending actions: category + executor back-ref on approvals
    `ALTER TABLE approvals ADD COLUMN category TEXT DEFAULT 'agent_approval'`,
    `ALTER TABLE approvals ADD COLUMN actionRef TEXT`,
    // Module Builder: wireframe + task linking
    `ALTER TABLE tasks ADD COLUMN moduleId TEXT`,
    `ALTER TABLE modules_builder ADD COLUMN wireframeHtml TEXT`,
    `ALTER TABLE modules_builder ADD COLUMN taskIds TEXT DEFAULT '[]'`,
  ];
  for (const sql of columnMigrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }

  // Module Builder: index for task-by-module queries
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_moduleId ON tasks(moduleId) WHERE moduleId IS NOT NULL`);
  } catch { /* non-critical */ }

  // Knowledge Base: FTS virtual table + triggers
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_base_fts USING fts5(
        title, content, tags, content='knowledge_base', content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS knowledge_base_ai AFTER INSERT ON knowledge_base BEGIN
        INSERT INTO knowledge_base_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS knowledge_base_au AFTER UPDATE ON knowledge_base BEGIN
        INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
        INSERT INTO knowledge_base_fts(rowid, title, content, tags) VALUES (new.rowid, new.title, new.content, new.tags);
      END;
      CREATE TRIGGER IF NOT EXISTS knowledge_base_ad AFTER DELETE ON knowledge_base BEGIN
        INSERT INTO knowledge_base_fts(knowledge_base_fts, rowid, title, content, tags) VALUES('delete', old.rowid, old.title, old.content, old.tags);
      END;
    `);
  } catch { /* FTS not available or already created */ }

  // Seed example knowledge base articles if empty
  try {
    const kbCount = db.prepare('SELECT COUNT(*) as c FROM knowledge_base').get() as { c: number };
    if (kbCount.c === 0) {
      const now = Date.now();
      const articles = [
        {
          id: `kb-${now}-1`,
          title: 'Brand Voice & Tone',
          category: 'brand',
          content: `# Brand Voice & Tone\n\nUpdate this article with your brand guidelines.\n\n## Voice\n- Clear and direct\n- Friendly but professional\n- Never condescending\n\n## Tone by context\n- **Marketing copy**: Energetic, aspirational\n- **Support**: Empathetic, patient\n- **Technical docs**: Precise, thorough`,
          tags: JSON.stringify(['brand', 'voice', 'tone', 'writing']),
          scope: 'all',
        },
        {
          id: `kb-${now}-2`,
          title: 'Company Context & Background',
          category: 'onboarding',
          content: `# Company Context\n\nUpdate this with your company's background, mission, values, and key facts that all agents should know.\n\n## Mission\n[Your mission here]\n\n## Key products/services\n[List here]\n\n## Target audience\n[Describe here]`,
          tags: JSON.stringify(['company', 'context', 'onboarding']),
          scope: 'all',
        },
        {
          id: `kb-${now}-3`,
          title: 'Design System Guidelines',
          category: 'guidelines',
          content: `# Design System Guidelines\n\nUpdate with your design standards.\n\n## Colors\n- Primary: [hex]\n- Secondary: [hex]\n\n## Typography\n- Headings: [font]\n- Body: [font]\n\n## Component rules\n[Add rules here]`,
          tags: JSON.stringify(['design', 'ui', 'brand', 'guidelines']),
          scope: 'all',
        },
      ];
      const insert = db.prepare(`INSERT OR IGNORE INTO knowledge_base (id, title, content, category, tags, scope, pinned, version, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, 1, 'system', ?, ?)`);
      for (const a of articles) {
        insert.run(a.id, a.title, a.content, a.category, a.tags, a.scope, now, now);
      }
    }
  } catch { /* non-critical */ }

  // Phase 79: WAL performance tuning
  try {
    db.pragma('wal_autocheckpoint = 400');
    db.pragma('synchronous = NORMAL');
  } catch { /* non-critical */ }

  // Clean up sessions older than 7 days
  try {
    db.prepare(`DELETE FROM agent_sessions WHERE createdAt < ?`).run(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } catch { /* non-critical */ }

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
