/**
 * Writing Memory Service — file-based CRUD for characters, timeline, and facts.
 *
 * Storage per project:
 *   ~/froggo/writing-projects/{projectId}/memory/
 *     characters.json   — CharacterProfile[]
 *     timeline.json     — TimelineEvent[]
 *     facts.json        — VerifiedFact[]
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writingMemoryPath } from './paths';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('WritingMemory');

// ── Types ──

interface CharacterProfile {
  id: string;
  name: string;
  relationship: string;
  description: string;
  traits: string[];
  createdAt: string;
  updatedAt: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  description: string;
  chapterRefs: string[];
  position: number;
  createdAt: string;
  updatedAt: string;
}

interface VerifiedFact {
  id: string;
  claim: string;
  source: string;
  status: 'unverified' | 'verified' | 'disputed' | 'needs-source';
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ──

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readJsonArray<T>(filepath: string): Promise<T[]> {
  try {
    const raw = await fs.promises.readFile(filepath, 'utf-8');
    return JSON.parse(raw) as T[];
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJson(filepath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filepath));
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Characters CRUD ──

async function listCharacters(projectId: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'characters.json');
    const characters = await readJsonArray<CharacterProfile>(filepath);
    return { success: true, characters };
  } catch (e: any) {
    logger.error('[writing-memory] listCharacters error:', e.message);
    return { success: false, error: e.message, characters: [] };
  }
}

async function createCharacter(projectId: string, data: Omit<CharacterProfile, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const filepath = writingMemoryPath(projectId, 'characters.json');
    const characters = await readJsonArray<CharacterProfile>(filepath);
    const now = new Date().toISOString();

    const character: CharacterProfile = {
      id: generateId('char'),
      name: data.name || '',
      relationship: data.relationship || '',
      description: data.description || '',
      traits: data.traits || [],
      createdAt: now,
      updatedAt: now,
    };

    characters.push(character);
    await writeJson(filepath, characters);
    return { success: true, character };
  } catch (e: any) {
    logger.error('[writing-memory] createCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateCharacter(projectId: string, id: string, updates: Partial<CharacterProfile>) {
  try {
    const filepath = writingMemoryPath(projectId, 'characters.json');
    const characters = await readJsonArray<CharacterProfile>(filepath);
    const idx = characters.findIndex(c => c.id === id);

    if (idx === -1) return { success: false, error: 'Character not found' };

    const now = new Date().toISOString();
    characters[idx] = { ...characters[idx], ...updates, id, updatedAt: now };
    await writeJson(filepath, characters);
    return { success: true, character: characters[idx] };
  } catch (e: any) {
    logger.error('[writing-memory] updateCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteCharacter(projectId: string, id: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'characters.json');
    const characters = await readJsonArray<CharacterProfile>(filepath);
    const filtered = characters.filter(c => c.id !== id);

    if (filtered.length === characters.length) {
      return { success: false, error: 'Character not found' };
    }

    await writeJson(filepath, filtered);
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteCharacter error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Timeline CRUD ──

async function listTimeline(projectId: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'timeline.json');
    const timeline = await readJsonArray<TimelineEvent>(filepath);
    return { success: true, timeline };
  } catch (e: any) {
    logger.error('[writing-memory] listTimeline error:', e.message);
    return { success: false, error: e.message, timeline: [] };
  }
}

async function createTimelineEvent(projectId: string, data: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const filepath = writingMemoryPath(projectId, 'timeline.json');
    const timeline = await readJsonArray<TimelineEvent>(filepath);
    const now = new Date().toISOString();

    const event: TimelineEvent = {
      id: generateId('evt'),
      date: data.date || '',
      description: data.description || '',
      chapterRefs: data.chapterRefs || [],
      position: data.position ?? timeline.length,
      createdAt: now,
      updatedAt: now,
    };

    timeline.push(event);
    await writeJson(filepath, timeline);
    return { success: true, event };
  } catch (e: any) {
    logger.error('[writing-memory] createTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateTimelineEvent(projectId: string, id: string, updates: Partial<TimelineEvent>) {
  try {
    const filepath = writingMemoryPath(projectId, 'timeline.json');
    const timeline = await readJsonArray<TimelineEvent>(filepath);
    const idx = timeline.findIndex(e => e.id === id);

    if (idx === -1) return { success: false, error: 'Timeline event not found' };

    const now = new Date().toISOString();
    timeline[idx] = { ...timeline[idx], ...updates, id, updatedAt: now };
    await writeJson(filepath, timeline);
    return { success: true, event: timeline[idx] };
  } catch (e: any) {
    logger.error('[writing-memory] updateTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteTimelineEvent(projectId: string, id: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'timeline.json');
    const timeline = await readJsonArray<TimelineEvent>(filepath);
    const filtered = timeline.filter(e => e.id !== id);

    if (filtered.length === timeline.length) {
      return { success: false, error: 'Timeline event not found' };
    }

    await writeJson(filepath, filtered);
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteTimelineEvent error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── Facts CRUD ──

async function listFacts(projectId: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'facts.json');
    const facts = await readJsonArray<VerifiedFact>(filepath);
    return { success: true, facts };
  } catch (e: any) {
    logger.error('[writing-memory] listFacts error:', e.message);
    return { success: false, error: e.message, facts: [] };
  }
}

async function createFact(projectId: string, data: Omit<VerifiedFact, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const filepath = writingMemoryPath(projectId, 'facts.json');
    const facts = await readJsonArray<VerifiedFact>(filepath);
    const now = new Date().toISOString();

    const fact: VerifiedFact = {
      id: generateId('fact'),
      claim: data.claim || '',
      source: data.source || '',
      status: data.status || 'unverified',
      createdAt: now,
      updatedAt: now,
    };

    facts.push(fact);
    await writeJson(filepath, facts);
    return { success: true, fact };
  } catch (e: any) {
    logger.error('[writing-memory] createFact error:', e.message);
    return { success: false, error: e.message };
  }
}

async function updateFact(projectId: string, id: string, updates: Partial<VerifiedFact>) {
  try {
    const filepath = writingMemoryPath(projectId, 'facts.json');
    const facts = await readJsonArray<VerifiedFact>(filepath);
    const idx = facts.findIndex(f => f.id === id);

    if (idx === -1) return { success: false, error: 'Fact not found' };

    const now = new Date().toISOString();
    facts[idx] = { ...facts[idx], ...updates, id, updatedAt: now };
    await writeJson(filepath, facts);
    return { success: true, fact: facts[idx] };
  } catch (e: any) {
    logger.error('[writing-memory] updateFact error:', e.message);
    return { success: false, error: e.message };
  }
}

async function deleteFact(projectId: string, id: string) {
  try {
    const filepath = writingMemoryPath(projectId, 'facts.json');
    const facts = await readJsonArray<VerifiedFact>(filepath);
    const filtered = facts.filter(f => f.id !== id);

    if (filtered.length === facts.length) {
      return { success: false, error: 'Fact not found' };
    }

    await writeJson(filepath, filtered);
    return { success: true };
  } catch (e: any) {
    logger.error('[writing-memory] deleteFact error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC Registration ──

export function registerWritingMemoryHandlers() {
  // Characters
  ipcMain.handle('writing:memory:characters:list', async (_, projectId: string) =>
    listCharacters(projectId));
  ipcMain.handle('writing:memory:characters:create', async (_, projectId: string, data: any) =>
    createCharacter(projectId, data));
  ipcMain.handle('writing:memory:characters:update', async (_, projectId: string, id: string, updates: any) =>
    updateCharacter(projectId, id, updates));
  ipcMain.handle('writing:memory:characters:delete', async (_, projectId: string, id: string) =>
    deleteCharacter(projectId, id));

  // Timeline
  ipcMain.handle('writing:memory:timeline:list', async (_, projectId: string) =>
    listTimeline(projectId));
  ipcMain.handle('writing:memory:timeline:create', async (_, projectId: string, data: any) =>
    createTimelineEvent(projectId, data));
  ipcMain.handle('writing:memory:timeline:update', async (_, projectId: string, id: string, updates: any) =>
    updateTimelineEvent(projectId, id, updates));
  ipcMain.handle('writing:memory:timeline:delete', async (_, projectId: string, id: string) =>
    deleteTimelineEvent(projectId, id));

  // Facts
  ipcMain.handle('writing:memory:facts:list', async (_, projectId: string) =>
    listFacts(projectId));
  ipcMain.handle('writing:memory:facts:create', async (_, projectId: string, data: any) =>
    createFact(projectId, data));
  ipcMain.handle('writing:memory:facts:update', async (_, projectId: string, id: string, updates: any) =>
    updateFact(projectId, id, updates));
  ipcMain.handle('writing:memory:facts:delete', async (_, projectId: string, id: string) =>
    deleteFact(projectId, id));

  logger.debug('[writing-memory] IPC handlers registered');
}
