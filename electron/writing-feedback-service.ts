/**
 * Writing Feedback Service — JSONL logging for inline feedback interactions.
 *
 * Storage per chapter:
 *   ~/froggo/writing-projects/{projectId}/memory/feedback-{chapterId}.jsonl
 *
 * Each line is a JSON object representing one feedback interaction
 * (agent, selection, instructions, alternatives, accepted, timestamp).
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writingMemoryPath } from './paths';
import { createLogger } from './utils/logger';

const logger = createLogger('WritingFeedback');

// ── Types ──

interface FeedbackEntry {
  chapterId: string;
  agent: string;
  selectedText: string;
  instructions: string;
  alternatives: string[];
  accepted: string | null;  // which alternative was accepted, or null if dismissed
  timestamp: string;
  selectionRange?: { from: number; to: number };
}

// ── Helpers ──

async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

// ── Feedback operations ──

async function logFeedback(projectId: string, entry: FeedbackEntry) {
  try {
    const filename = `feedback-${entry.chapterId}.jsonl`;
    const logPath = writingMemoryPath(projectId, filename);

    // Ensure memory directory exists
    await ensureDir(path.dirname(logPath));

    const line = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    }) + '\n';

    await fs.promises.appendFile(logPath, line, 'utf-8');

    return { success: true };
  } catch (e: any) {
    logger.error('[writing-feedback] logFeedback error:', e.message);
    return { success: false, error: e.message };
  }
}

async function getFeedbackHistory(projectId: string, chapterId: string) {
  try {
    const filename = `feedback-${chapterId}.jsonl`;
    const logPath = writingMemoryPath(projectId, filename);

    try {
      const raw = await fs.promises.readFile(logPath, 'utf-8');
      const entries = raw
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return { success: true, entries };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // No feedback yet for this chapter
        return { success: true, entries: [] };
      }
      throw err;
    }
  } catch (e: any) {
    logger.error('[writing-feedback] getFeedbackHistory error:', e.message);
    return { success: false, error: e.message, entries: [] };
  }
}

// ── IPC Registration ──

export function registerWritingFeedbackHandlers() {
  ipcMain.handle('writing:feedback:log', async (_, projectId: string, entry: FeedbackEntry) =>
    logFeedback(projectId, entry));

  ipcMain.handle('writing:feedback:history', async (_, projectId: string, chapterId: string) =>
    getFeedbackHistory(projectId, chapterId));

  logger.debug('[writing-feedback] IPC handlers registered');
}
