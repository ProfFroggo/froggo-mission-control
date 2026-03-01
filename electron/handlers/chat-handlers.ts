/**
 * Chat & Starred Messages Handlers Module
 *
 * Channels: chat:saveMessage/loadMessages/clearMessages/suggestReplies,
 * starred:star/unstar/list/search/stats/check
 *
 * 10 registerHandler calls total.
 */

import { exec } from 'child_process';
import { registerHandler } from '../ipc-registry';
import { prepare } from '../database';
import { safeLog } from '../logger';
import { FROGGO_DB, CLAUDE_CLI } from '../paths';

export function registerChatHandlers(): void {
  registerHandler('chat:saveMessage', async (_event, msg: { role: string; content: string; timestamp: number; sessionKey?: string; channel?: string }) => {
    const session = msg.sessionKey || 'dashboard';
    const channel = msg.channel || 'dashboard';
    const ts = new Date(msg.timestamp).toISOString();
    try {
      prepare('INSERT INTO messages (timestamp, session_key, channel, role, content) VALUES (?, ?, ?, ?, ?)').run(ts, session, channel, msg.role, msg.content);
      return { success: true };
    } catch (error: unknown) { return { success: false, error: error.message }; }
  });

  registerHandler('chat:loadMessages', async (_event, limit: number = 50, sessionKey?: string, channel?: string) => {
    const session = sessionKey || 'dashboard';
    const ch = channel || 'dashboard';
    try {
      const rows = prepare('SELECT id, timestamp, role, content FROM messages WHERE session_key = ? AND channel = ? ORDER BY timestamp DESC LIMIT ?').all(session, ch, limit) as Record<string, unknown>[];
      const messages = rows.reverse().map((r) => ({ id: `db-${r['id']}`, role: r['role'], content: r['content'], timestamp: new Date(r['timestamp'] as string).getTime() }));
      return { success: true, messages };
    } catch { return { success: true, messages: [] }; }
  });

  registerHandler('chat:clearMessages', async (_event, sessionKey?: string, channel?: string) => {
    const session = sessionKey || 'dashboard';
    const ch = channel || 'dashboard';
    try {
      prepare('DELETE FROM messages WHERE session_key = ? AND channel = ?').run(session, ch);
      return { success: true };
    } catch (error: unknown) {
      safeLog.error('[Chat] clearMessages error:', error.message);
      return { success: false, error: error.message };
    }
  });

  registerHandler('chat:suggestReplies', async (_event, context: { role: string; content: string }[]) => {
    return new Promise((resolve) => {
      const recentMessages = context.slice(-10);
      const conversationContext = recentMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
      const prompt = `Based on this conversation, suggest 2-3 brief, contextually appropriate reply options (each under 15 words). Provide ONLY the suggestions, one per line, no numbering or explanations.\n\nConversation:\n${conversationContext}\n\nSuggestions:`;
      const claudeCmd = `${CLAUDE_CLI} --print "${prompt.replace(/"/g, '\\"')}"`;
      safeLog.log('[SuggestedReplies] Generating suggestions...');
      exec(claudeCmd, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          safeLog.error('[SuggestedReplies] Error:', error.message);
          resolve({ success: false, error: 'Failed to generate suggestions', suggestions: [] });
          return;
        }
        try {
          const suggestions = stdout.trim().split('\n').map(s => s.trim()).filter(s => s.length > 0 && s.length < 200).slice(0, 3);
          safeLog.log('[SuggestedReplies] Generated', suggestions.length, 'suggestions');
          resolve(suggestions.length === 0 ? { success: false, error: 'No valid suggestions generated', suggestions: [] } : { success: true, suggestions });
        } catch (parseError: unknown) {
          safeLog.error('[SuggestedReplies] Parse error:', parseError.message);
          resolve({ success: false, error: 'Failed to parse suggestions', suggestions: [] });
        }
      });
    });
  });

  registerHandler('starred:star', async (_event, messageId: number, note?: string, category?: string) => {
    const noteArg = note ? `--note "${note.replace(/"/g, '\\"')}"` : '';
    const catArg = category ? `--category "${category}"` : '';
    const cmd = `froggo-db star-message ${messageId} ${noteArg} ${catArg}`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error, _stdout, stderr) => {
        if (error) { safeLog.error('[Starred] Star error:', stderr || error.message); resolve({ success: false, error: stderr || error.message }); }
        else { safeLog.log('[Starred] Message starred:', messageId); resolve({ success: true }); }
      });
    });
  });

  registerHandler('starred:unstar', async (_event, identifier: number) => {
    const cmd = `froggo-db unstar-message ${identifier}`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error, _stdout, stderr) => {
        if (error) { safeLog.error('[Starred] Unstar error:', stderr || error.message); resolve({ success: false, error: stderr || error.message }); }
        else { safeLog.log('[Starred] Message unstarred:', identifier); resolve({ success: true }); }
      });
    });
  });

  registerHandler('starred:list', async (_event, options?: { category?: string; sessionKey?: string; limit?: number }) => {
    const catArg = options?.category ? `--category "${options.category}"` : '';
    const sessionArg = options?.sessionKey ? `--session "${options.sessionKey}"` : '';
    const limitArg = options?.limit ? `--limit ${options.limit}` : '';
    const cmd = `froggo-db starred-list ${catArg} ${sessionArg} ${limitArg} --json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { safeLog.error('[Starred] List error:', stderr || error.message); resolve({ success: false, error: stderr || error.message, starred: [] }); }
        else { try { resolve({ success: true, starred: JSON.parse(stdout) }); } catch (e: unknown) { resolve({ success: false, error: e.message, starred: [] }); } }
      });
    });
  });

  registerHandler('starred:search', async (_event, query: string, limit?: number) => {
    const limitArg = limit ? `--limit ${limit}` : '';
    const cmd = `froggo-db starred-search "${query.replace(/"/g, '\\"')}" ${limitArg} --json`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) { safeLog.error('[Starred] Search error:', stderr || error.message); resolve({ success: false, error: stderr || error.message, results: [] }); }
        else { try { resolve({ success: true, results: JSON.parse(stdout) }); } catch (e: unknown) { resolve({ success: false, error: e.message, results: [] }); } }
      });
    });
  });

  registerHandler('starred:stats', async () => {
    const cmd = `sqlite3 "${FROGGO_DB}" "SELECT COUNT(*) as total FROM starred_messages; SELECT category, COUNT(*) as count FROM starred_messages GROUP BY category;"`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 5000 }, (error, stdout) => {
        if (error) { resolve({ success: false, stats: { total: 0, byCategory: [] } }); }
        else { const lines = stdout.trim().split('\n'); const total = parseInt(lines[0]) || 0; resolve({ success: true, stats: { total } }); }
      });
    });
  });

  registerHandler('starred:check', async (_event, messageId: number) => {
    const cmd = `sqlite3 "${FROGGO_DB}" "SELECT id FROM starred_messages WHERE message_id=${messageId}"`;
    return new Promise((resolve) => {
      exec(cmd, { timeout: 2000 }, (error, stdout) => {
        const isStarred = !error && stdout.trim().length > 0;
        resolve({ success: true, isStarred });
      });
    });
  });
}
