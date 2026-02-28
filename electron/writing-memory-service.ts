/**
 * Writing Memory Service — DB-backed CRUD for characters, timeline, and facts.
 *
 * Data stored in per-book SQLite: {projectId}/book.db
 * Auto-migrates from legacy JSON files on first access.
 */

import { registerHandler } from './ipc-registry';
import * as fs from 'fs';
import { writingBookDbPath, writingProjectPath } from './paths';
import { getBookDb, migrateJsonToDb } from './writing-db';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingMemory');

// ── Helpers ──

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function ensureBookDb(projectId: string) {
  const dbPath = writingBookDbPath(projectId);
  if (!fs.existsSync(dbPath)) {
    const hasJson = fs.existsSync(`${writingProjectPath(projectId)}/project.json`);
    if (hasJson) migrateJsonToDb(projectId);
  }
  return getBookDb(projectId);
}

// ── Characters CRUD ──

async function listCharacters(projectId: string) {
  try {
    const db = ensureBookDb(projectId);
    const rows = db.prepare('SELECT id, name, role, description, traits, created_at, updated_at FROM characters ORDER BY name').all() as any[];
    const characters = rows.map(r => ({
      id: r.id,
      name: r.name,
      relationship: r.role,
      description: r.description,
      traits: JSON.parse(r.traits || '[]'),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return { success: true, characters };
  } catch (e: any) {
    logger.error('[writing-memory] listCharacters error:', e.message);
    return { success: false, error: e.message, characters: [] };
  }
}

async function createCharacter(projectId: string, data: { name?: string; relationship?: string; description?: string; traits?: string[] }) {
  try {
    const db = ensureBookDb(projectId);
    const now = new Date().toISOString();
    const id = generateId('char');

    db.prepare(`
      INSERT INTO characters (id, name, role, description, traits, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name || '', data.relationship || 'supporting', data.description || '', JSON.stringify(data.traits || []), now, now);

    return {
      success: true,
      character: { id, name: data.name || '', relationship: data.relationship || 'supporting', description: data.description || '', traits: data.traits || [], createdAt: now, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] createCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateCharacter(projectId: string, id: string, updates: Record<string, any>) {
  try {
    const db = ensureBookDb(projectId);
    const existing = db.prepare('SELECT id, name, role, description, traits, created_at, updated_at FROM characters WHERE id = ?').get(id) as any;
    if (!existing) return { success: false, error: 'Character not found' };

    const now = new Date().toISOString();
    const name = updates.name ?? existing.name;
    const role = updates.relationship ?? existing.role;
    const description = updates.description ?? existing.description;
    const traits = updates.traits ? JSON.stringify(updates.traits) : existing.traits;

    db.prepare('UPDATE characters SET name = ?, role = ?, description = ?, traits = ?, updated_at = ? WHERE id = ?')
      .run(name, role, description, traits, now, id);

    return {
      success: true,
      character: { id, name, relationship: role, description, traits: JSON.parse(traits), createdAt: existing.created_at, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] updateCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteCharacter(projectId: string, id: string) {
  try {
    const db = ensureBookDb(projectId);
    const result = db.prepare('DELETE FROM characters WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Character not found' };
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Timeline CRUD ──

async function listTimeline(projectId: string) {
  try {
    const db = ensureBookDb(projectId);
    const rows = db.prepare('SELECT id, date, description, chapter_refs, position, created_at, updated_at FROM timeline ORDER BY position').all() as any[];
    const timeline = rows.map(r => ({
      id: r.id,
      date: r.date,
      description: r.description,
      chapterRefs: JSON.parse(r.chapter_refs || '[]'),
      position: r.position,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return { success: true, timeline };
  } catch (e: any) {
    logger.error('[writing-memory] listTimeline error:', e.message);
    return { success: false, error: e.message, timeline: [] };
  }
}

async function createTimelineEvent(projectId: string, data: { date?: string; description?: string; chapterRefs?: string[]; position?: number }) {
  try {
    const db = ensureBookDb(projectId);
    const now = new Date().toISOString();
    const id = generateId('evt');

    const maxRow = db.prepare('SELECT MAX(position) as max_pos FROM timeline').get() as any;
    const position = data.position ?? ((maxRow?.max_pos || 0) + 1);

    db.prepare(`
      INSERT INTO timeline (id, date, description, chapter_refs, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.date || '', data.description || '', JSON.stringify(data.chapterRefs || []), position, now, now);

    return {
      success: true,
      event: { id, date: data.date || '', description: data.description || '', chapterRefs: data.chapterRefs || [], position, createdAt: now, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] createTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateTimelineEvent(projectId: string, id: string, updates: Record<string, any>) {
  try {
    const db = ensureBookDb(projectId);
    const existing = db.prepare('SELECT id, date, description, chapter_refs, position, created_at, updated_at FROM timeline WHERE id = ?').get(id) as any;
    if (!existing) return { success: false, error: 'Timeline event not found' };

    const now = new Date().toISOString();
    const date = updates.date ?? existing.date;
    const description = updates.description ?? existing.description;
    const chapterRefs = updates.chapterRefs ? JSON.stringify(updates.chapterRefs) : existing.chapter_refs;
    const position = updates.position ?? existing.position;

    db.prepare('UPDATE timeline SET date = ?, description = ?, chapter_refs = ?, position = ?, updated_at = ? WHERE id = ?')
      .run(date, description, chapterRefs, position, now, id);

    return {
      success: true,
      event: { id, date, description, chapterRefs: JSON.parse(chapterRefs), position, createdAt: existing.created_at, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] updateTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteTimelineEvent(projectId: string, id: string) {
  try {
    const db = ensureBookDb(projectId);
    const result = db.prepare('DELETE FROM timeline WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Timeline event not found' };
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Facts CRUD ──

async function listFacts(projectId: string) {
  try {
    const db = ensureBookDb(projectId);
    const rows = db.prepare('SELECT id, claim, source, status, created_at, updated_at FROM facts ORDER BY created_at').all() as any[];
    const facts = rows.map(r => ({
      id: r.id,
      claim: r.claim,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return { success: true, facts };
  } catch (e: any) {
    logger.error('[writing-memory] listFacts error:', e.message);
    return { success: false, error: e.message, facts: [] };
  }
}

async function createFact(projectId: string, data: { claim?: string; source?: string; status?: string }) {
  try {
    const db = ensureBookDb(projectId);
    const now = new Date().toISOString();
    const id = generateId('fact');

    db.prepare(`
      INSERT INTO facts (id, claim, source, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.claim || '', data.source || '', data.status || 'unverified', now, now);

    return {
      success: true,
      fact: { id, claim: data.claim || '', source: data.source || '', status: data.status || 'unverified', createdAt: now, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] createFact error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateFact(projectId: string, id: string, updates: Record<string, any>) {
  try {
    const db = ensureBookDb(projectId);
    const existing = db.prepare('SELECT id, claim, source, status, created_at, updated_at FROM facts WHERE id = ?').get(id) as any;
    if (!existing) return { success: false, error: 'Fact not found' };

    const now = new Date().toISOString();
    const claim = updates.claim ?? existing.claim;
    const source = updates.source ?? existing.source;
    const status = updates.status ?? existing.status;

    db.prepare('UPDATE facts SET claim = ?, source = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(claim, source, status, now, id);

    return {
      success: true,
      fact: { id, claim, source, status, createdAt: existing.created_at, updatedAt: now },
    };
  } catch (e: any) {
    logger.error('[writing-memory] updateFact error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteFact(projectId: string, id: string) {
  try {
    const db = ensureBookDb(projectId);
    const result = db.prepare('DELETE FROM facts WHERE id = ?').run(id);
    if (result.changes === 0) return { success: false, error: 'Fact not found' };
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteFact error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC Registration ──

export function registerWritingMemoryHandlers() {
  // Characters
  registerHandler('writing:memory:characters:list', async (_, projectId: string) =>
    listCharacters(projectId));
  registerHandler('writing:memory:characters:create', async (_, projectId: string, data: any) =>
    createCharacter(projectId, data));
  registerHandler('writing:memory:characters:update', async (_, projectId: string, id: string, updates: any) =>
    updateCharacter(projectId, id, updates));
  registerHandler('writing:memory:characters:delete', async (_, projectId: string, id: string) =>
    deleteCharacter(projectId, id));

  // Timeline
  registerHandler('writing:memory:timeline:list', async (_, projectId: string) =>
    listTimeline(projectId));
  registerHandler('writing:memory:timeline:create', async (_, projectId: string, data: any) =>
    createTimelineEvent(projectId, data));
  registerHandler('writing:memory:timeline:update', async (_, projectId: string, id: string, updates: any) =>
    updateTimelineEvent(projectId, id, updates));
  registerHandler('writing:memory:timeline:delete', async (_, projectId: string, id: string) =>
    deleteTimelineEvent(projectId, id));

  // Facts
  registerHandler('writing:memory:facts:list', async (_, projectId: string) =>
    listFacts(projectId));
  registerHandler('writing:memory:facts:create', async (_, projectId: string, data: any) =>
    createFact(projectId, data));
  registerHandler('writing:memory:facts:update', async (_, projectId: string, id: string, updates: any) =>
    updateFact(projectId, id, updates));
  registerHandler('writing:memory:facts:delete', async (_, projectId: string, id: string) =>
    deleteFact(projectId, id));

  logger.debug('[writing-memory] IPC handlers registered');
}
