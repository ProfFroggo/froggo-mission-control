#!/usr/bin/env node
// tools/migrate-db.js
// Run ONCE if you have an existing mission-control.db.
// Adds new tables without dropping existing data.
// Usage: node tools/migrate-db.js

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.MC_DB_PATH
  || path.join(process.env.HOME, 'mission-control', 'data', 'mission-control.db');

console.log('Running DB migration on:', DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const migrations = [
  // Chat rooms (new columns for mission-control chat system)
  `CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    topic TEXT,
    agents TEXT DEFAULT '[]',
    sessionKeys TEXT DEFAULT '{}',
    createdAt INTEGER DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER DEFAULT (unixepoch() * 1000)
  )`,
  `CREATE TABLE IF NOT EXISTS chat_room_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomId TEXT NOT NULL,
    messageId TEXT,
    agentId TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    content TEXT NOT NULL,
    mentionedAgents TEXT DEFAULT '[]',
    replyTo INTEGER,
    timestamp INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    FOREIGN KEY (roomId) REFERENCES chat_rooms(id)
  )`,
  // Agent sessions
  `CREATE TABLE IF NOT EXISTS agent_sessions (
    agentId TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    model TEXT,
    createdAt INTEGER DEFAULT (unixepoch() * 1000),
    lastActivity INTEGER DEFAULT (unixepoch() * 1000),
    status TEXT DEFAULT 'active'
  )`,
  // Indexes
  `CREATE INDEX IF NOT EXISTS idx_chat_room_messages_room ON chat_room_messages(roomId, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status)`,
  // Seed chat rooms
  `INSERT OR IGNORE INTO chat_rooms (id, name, topic) VALUES
    ('general', 'General', 'Cross-team coordination'),
    ('code-review', 'Code Review', 'Review requests and discussions'),
    ('planning', 'Planning', 'Task decomposition and architecture'),
    ('incidents', 'Incidents', 'Bug reports and production issues')`,
];

for (const sql of migrations) {
  try {
    db.exec(sql);
    console.log('OK:', sql.slice(0, 60).replace(/\n/g, ' ') + '...');
  } catch (e) {
    console.log('Note:', e.message);
  }
}

console.log('Database migration complete.');
db.close();
