/**
 * Per-book SQLite database manager.
 *
 * Each writing project gets its own `book.db` inside its project directory.
 * Connections are cached by projectId and closed on app shutdown.
 *
 * Schema tables: project, chapters, characters, timeline, facts, notes, sessions
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { writingBookDbPath, writingProjectPath } from './paths';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingDB');

// Connection cache: projectId → Database instance
const dbCache = new Map<string, Database.Database>();

const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  genre TEXT DEFAULT '',
  premise TEXT DEFAULT '',
  themes TEXT DEFAULT '[]',
  story_arc TEXT DEFAULT '',
  wizard_complete INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  position INTEGER NOT NULL,
  synopsis TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'supporting',
  description TEXT DEFAULT '',
  traits TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT DEFAULT '',
  chapter_refs TEXT DEFAULT '[]',
  position INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,
  source TEXT DEFAULT '',
  status TEXT DEFAULT 'unverified',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  chapter_id TEXT,
  title TEXT DEFAULT '',
  content TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS writing_sessions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  words_start INTEGER DEFAULT 0,
  words_end INTEGER DEFAULT 0,
  duration_sec INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);
`;

/**
 * Open or create a book database for the given project.
 * Connections are cached — subsequent calls return the same instance.
 */
export function getBookDb(projectId: string): Database.Database {
  const cached = dbCache.get(projectId);
  if (cached) return cached;

  const dbPath = writingBookDbPath(projectId);
  const projectDir = writingProjectPath(projectId);

  // Ensure project directory exists
  fs.mkdirSync(projectDir, { recursive: true });

  const isNew = !fs.existsSync(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('wal_autocheckpoint = 1000');

  if (isNew) {
    db.exec(SCHEMA_SQL);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    logger.debug(`[writing-db] Created book.db for ${projectId}`);
  } else {
    // Ensure all tables exist (idempotent)
    db.exec(SCHEMA_SQL);
  }

  dbCache.set(projectId, db);
  return db;
}

/**
 * Close a specific book database connection.
 */
export function closeBookDb(projectId: string): void {
  const db = dbCache.get(projectId);
  if (db) {
    try { db.close(); } catch (e: any) {
      logger.error(`[writing-db] Failed to close ${projectId}:`, e.message);
    }
    dbCache.delete(projectId);
  }
}

/**
 * Close all open book database connections. Call on app shutdown.
 */
export function closeAllBookDbs(): void {
  for (const [projectId, db] of dbCache) {
    try { db.close(); } catch (e: any) {
      logger.error(`[writing-db] Failed to close ${projectId}:`, e.message);
    }
  }
  dbCache.clear();
  logger.debug('[writing-db] All book databases closed');
}

// ── Migration: JSON files → book.db ──

interface JsonProjectMeta {
  id: string;
  title: string;
  type: string;
  genre?: string;
  premise?: string;
  themes?: string[];
  storyArc?: string;
  wizardComplete?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface JsonChapterMeta {
  id: string;
  title: string;
  filename: string;
  position: number;
  synopsis?: string;
  createdAt: string;
  updatedAt: string;
}

interface JsonCharacter {
  id: string;
  name: string;
  relationship?: string;
  role?: string;
  description?: string;
  traits?: string[];
  createdAt: string;
  updatedAt: string;
}

interface JsonTimelineEvent {
  id: string;
  date: string;
  description: string;
  chapterRefs?: string[];
  position?: number;
  createdAt: string;
  updatedAt: string;
}

interface JsonFact {
  id: string;
  claim: string;
  source?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

function readJsonSafe<T>(filepath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/**
 * Migrate existing JSON files into book.db for a project.
 * Safe to call multiple times — skips if project row already exists.
 */
export function migrateJsonToDb(projectId: string): void {
  const db = getBookDb(projectId);
  const projectDir = writingProjectPath(projectId);

  // Check if already migrated
  const existing = db.prepare('SELECT id FROM project WHERE id = ?').get(projectId);
  if (existing) return;

  logger.debug(`[writing-db] Migrating JSON → DB for ${projectId}`);

  const projectJson = readJsonSafe<JsonProjectMeta>(path.join(projectDir, 'project.json'));
  if (!projectJson) {
    logger.error(`[writing-db] No project.json for ${projectId}, skipping migration`);
    return;
  }

  const migrate = db.transaction(() => {
    // Project metadata
    db.prepare(`
      INSERT OR REPLACE INTO project (id, title, type, genre, premise, themes, story_arc, wizard_complete, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectJson.id,
      projectJson.title,
      projectJson.type,
      projectJson.genre || '',
      projectJson.premise || '',
      JSON.stringify(projectJson.themes || []),
      projectJson.storyArc || '',
      projectJson.wizardComplete ? 1 : 0,
      projectJson.createdAt,
      projectJson.updatedAt,
    );

    // Chapters
    const chapters = readJsonSafe<JsonChapterMeta[]>(path.join(projectDir, 'chapters.json'));
    if (chapters) {
      const insertCh = db.prepare(`
        INSERT OR REPLACE INTO chapters (id, title, filename, position, synopsis, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const ch of chapters) {
        insertCh.run(ch.id, ch.title, ch.filename, ch.position, ch.synopsis || '', ch.createdAt, ch.updatedAt);
      }
    }

    // Characters
    const memoryDir = path.join(projectDir, 'memory');
    const characters = readJsonSafe<JsonCharacter[]>(path.join(memoryDir, 'characters.json'));
    if (characters) {
      const insertChar = db.prepare(`
        INSERT OR REPLACE INTO characters (id, name, role, description, traits, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of characters) {
        insertChar.run(c.id, c.name, c.relationship || c.role || 'supporting', c.description || '', JSON.stringify(c.traits || []), c.createdAt, c.updatedAt);
      }
    }

    // Timeline
    const timeline = readJsonSafe<JsonTimelineEvent[]>(path.join(memoryDir, 'timeline.json'));
    if (timeline) {
      const insertEvt = db.prepare(`
        INSERT OR REPLACE INTO timeline (id, date, description, chapter_refs, position, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const t of timeline) {
        insertEvt.run(t.id, t.date, t.description, JSON.stringify(t.chapterRefs || []), t.position ?? 0, t.createdAt, t.updatedAt);
      }
    }

    // Facts
    const facts = readJsonSafe<JsonFact[]>(path.join(memoryDir, 'facts.json'));
    if (facts) {
      const insertFact = db.prepare(`
        INSERT OR REPLACE INTO facts (id, claim, source, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const f of facts) {
        insertFact.run(f.id, f.claim, f.source || '', f.status || 'unverified', f.createdAt, f.updatedAt);
      }
    }
  });

  migrate();
  logger.debug(`[writing-db] Migration complete for ${projectId}`);
}
