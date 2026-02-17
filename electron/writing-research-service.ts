/**
 * Writing Research Service -- per-project SQLite CRUD for research sources
 * and fact-source linking (junction table).
 *
 * Storage per project:
 *   ~/froggo/writing-projects/{projectId}/research.db
 *     sources        -- research source records
 *     fact_sources   -- many-to-many link between facts (JSON) and sources (SQLite)
 */

import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { writingResearchDbPath } from './paths';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('WritingResearch');

// -- Types --

export interface ResearchSource {
  id: string;
  title: string;
  author: string;
  type: 'book' | 'article' | 'interview' | 'website' | 'document' | 'other';
  url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface FactSourceLink {
  fact_id: string;
  source_id: string;
  notes: string;
  created_at: string;
}

// -- DB cache (one connection per project) --

const dbCache = new Map<string, Database.Database>();

function getDb(projectId: string): Database.Database {
  if (dbCache.has(projectId)) return dbCache.get(projectId)!;

  const dbPath = writingResearchDbPath(projectId);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);

  dbCache.set(projectId, db);
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other',
      url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fact_sources (
      fact_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY (fact_id, source_id),
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );
  `);
}

// -- Helpers --

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// -- Source CRUD --

function listSources(projectId: string) {
  try {
    const db = getDb(projectId);
    const sources = db.prepare('SELECT * FROM sources ORDER BY title').all() as ResearchSource[];
    return { success: true, sources };
  } catch (e: unknown) {
    logger.error('[writing-research] listSources error:', e.message);
    return { success: false, error: e.message, sources: [] };
  }
}

function createSource(projectId: string, data: Omit<ResearchSource, 'id' | 'created_at' | 'updated_at'>) {
  try {
    const db = getDb(projectId);
    const now = new Date().toISOString();
    const id = generateId('src');

    db.prepare(`
      INSERT INTO sources (id, title, author, type, url, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.title || '', data.author || '', data.type || 'other', data.url || '', data.notes || '', now, now);

    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as ResearchSource;
    return { success: true, source };
  } catch (e: unknown) {
    logger.error('[writing-research] createSource error:', e.message);
    return { success: false, error: e.message };
  }
}

function updateSource(projectId: string, id: string, data: Partial<ResearchSource>) {
  try {
    const db = getDb(projectId);
    const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as ResearchSource | undefined;
    if (!existing) return { success: false, error: 'Source not found' };

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE sources SET title = ?, author = ?, type = ?, url = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.title ?? existing.title,
      data.author ?? existing.author,
      data.type ?? existing.type,
      data.url ?? existing.url,
      data.notes ?? existing.notes,
      now,
      id,
    );

    const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as ResearchSource;
    return { success: true, source };
  } catch (e: unknown) {
    logger.error('[writing-research] updateSource error:', e.message);
    return { success: false, error: e.message };
  }
}

function deleteSource(projectId: string, id: string) {
  try {
    const db = getDb(projectId);
    const result = db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Source not found' };
    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing-research] deleteSource error:', e.message);
    return { success: false, error: e.message };
  }
}

// -- Fact-Source Link Operations --

function getSourcesForFact(projectId: string, factId: string) {
  try {
    const db = getDb(projectId);
    const sources = db.prepare(`
      SELECT s.*, fs.notes AS link_notes, fs.created_at AS linked_at
      FROM sources s
      JOIN fact_sources fs ON fs.source_id = s.id
      WHERE fs.fact_id = ?
      ORDER BY s.title
    `).all(factId);
    return { success: true, sources };
  } catch (e: unknown) {
    logger.error('[writing-research] getSourcesForFact error:', e.message);
    return { success: false, error: e.message, sources: [] };
  }
}

function getFactsForSource(projectId: string, sourceId: string) {
  try {
    const db = getDb(projectId);
    const facts = db.prepare(`
      SELECT fact_id, notes, created_at
      FROM fact_sources
      WHERE source_id = ?
      ORDER BY created_at DESC
    `).all(sourceId);
    return { success: true, facts };
  } catch (e: unknown) {
    logger.error('[writing-research] getFactsForSource error:', e.message);
    return { success: false, error: e.message, facts: [] };
  }
}

function linkSourceToFact(projectId: string, factId: string, sourceId: string, notes?: string) {
  try {
    const db = getDb(projectId);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO fact_sources (fact_id, source_id, notes, created_at)
      VALUES (?, ?, ?, ?)
    `).run(factId, sourceId, notes || '', now);
    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing-research] linkSourceToFact error:', e.message);
    return { success: false, error: e.message };
  }
}

function unlinkSourceFromFact(projectId: string, factId: string, sourceId: string) {
  try {
    const db = getDb(projectId);
    db.prepare('DELETE FROM fact_sources WHERE fact_id = ? AND source_id = ?').run(factId, sourceId);
    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing-research] unlinkSourceFromFact error:', e.message);
    return { success: false, error: e.message };
  }
}

function cleanOrphanedLinks(projectId: string, validFactIds: string[]) {
  try {
    const db = getDb(projectId);
    if (validFactIds.length === 0) {
      // No valid facts means all links are orphaned
      db.prepare('DELETE FROM fact_sources').run();
    } else {
      const placeholders = validFactIds.map(() => '?').join(', ');
      db.prepare(`DELETE FROM fact_sources WHERE fact_id NOT IN (${placeholders})`).run(...validFactIds);
    }
    return { success: true };
  } catch (e: unknown) {
    logger.error('[writing-research] cleanOrphanedLinks error:', e.message);
    return { success: false, error: e.message };
  }
}

// -- Connection management --

export function closeResearchDb(projectId: string): void {
  const db = dbCache.get(projectId);
  if (db) {
    try {
      db.close();
    } catch (e: unknown) {
      logger.error(`[writing-research] Failed to close research.db for ${projectId}:`, e.message);
    }
    dbCache.delete(projectId);
  }
}

export function closeAllResearchDbs(): void {
  for (const [projectId, db] of dbCache) {
    try {
      db.close();
    } catch (e: unknown) {
      logger.error(`[writing-research] Failed to close research.db for ${projectId}:`, e.message);
    }
  }
  dbCache.clear();
}

// -- IPC Registration --

export function registerWritingResearchHandlers(): void {
  // Sources CRUD
  ipcMain.handle('writing:research:sources:list', (_, projectId: string) =>
    listSources(projectId));
  ipcMain.handle('writing:research:sources:create', (_, projectId: string, data: any) =>
    createSource(projectId, data));
  ipcMain.handle('writing:research:sources:update', (_, projectId: string, id: string, data: any) =>
    updateSource(projectId, id, data));
  ipcMain.handle('writing:research:sources:delete', (_, projectId: string, id: string) =>
    deleteSource(projectId, id));

  // Fact-source linking
  ipcMain.handle('writing:research:links:forFact', (_, projectId: string, factId: string) =>
    getSourcesForFact(projectId, factId));
  ipcMain.handle('writing:research:links:forSource', (_, projectId: string, sourceId: string) =>
    getFactsForSource(projectId, sourceId));
  ipcMain.handle('writing:research:links:link', (_, projectId: string, factId: string, sourceId: string, notes?: string) =>
    linkSourceToFact(projectId, factId, sourceId, notes));
  ipcMain.handle('writing:research:links:unlink', (_, projectId: string, factId: string, sourceId: string) =>
    unlinkSourceFromFact(projectId, factId, sourceId));
  ipcMain.handle('writing:research:links:cleanup', (_, projectId: string, validFactIds: string[]) =>
    cleanOrphanedLinks(projectId, validFactIds));

  logger.debug('[writing-research] IPC handlers registered');
}
