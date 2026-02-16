/**
 * Writing Chat Service — JSONL-based chat history persistence.
 *
 * Storage per project:
 *   ~/froggo/writing-projects/{projectId}/memory/chat-history.jsonl
 *
 * Each line is a JSON-encoded ChatMessage object.
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { writingMemoryPath } from './paths';
import { createLogger } from '../src/utils/logger';

const logger = createLogger('WritingChat');

// ── IPC Registration ──

export function registerWritingChatHandlers() {
  // Load chat history for a project
  ipcMain.handle('writing:chat:loadHistory', async (_, projectId: string) => {
    try {
      const filepath = writingMemoryPath(projectId, 'chat-history.jsonl');
      let raw: string;
      try {
        raw = await fs.promises.readFile(filepath, 'utf-8');
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          return { success: true, messages: [] };
        }
        throw err;
      }

      const messages = raw
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      return { success: true, messages };
    } catch (e: any) {
      logger.error('[writing-chat] loadHistory error:', e.message);
      return { success: false, error: e.message, messages: [] };
    }
  });

  // Append a single message to chat history
  ipcMain.handle('writing:chat:appendMessage', async (_, projectId: string, message: object) => {
    try {
      const filepath = writingMemoryPath(projectId, 'chat-history.jsonl');
      const dir = path.dirname(filepath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.appendFile(filepath, JSON.stringify(message) + '\n', 'utf-8');
      return { success: true };
    } catch (e: any) {
      logger.error('[writing-chat] appendMessage error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Clear chat history for a project
  ipcMain.handle('writing:chat:clearHistory', async (_, projectId: string) => {
    try {
      const filepath = writingMemoryPath(projectId, 'chat-history.jsonl');
      try {
        await fs.promises.unlink(filepath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') throw err;
        // File doesn't exist — nothing to clear
      }
      return { success: true };
    } catch (e: any) {
      logger.error('[writing-chat] clearHistory error:', e.message);
      return { success: false, error: e.message };
    }
  });

  logger.debug('[writing-chat] IPC handlers registered');
}
