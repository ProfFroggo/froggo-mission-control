/**
 * Unified Search Service
 *
 * Provides a single `search:unified` IPC handler that fans out queries
 * across messages+facts (froggo-db CLI), tasks (in-process SQLite),
 * and agent context (froggo-db context-search CLI) in parallel using
 * Promise.allSettled().
 *
 * Each result carries a prefixed `id` (msg-, fact-, task-, ctx-) to
 * prevent cross-source collisions, and a `source` label for attribution.
 */

import { exec } from 'child_process';
import { registerHandler } from './ipc-registry';
import { prepare } from './database';
import { FROGGO_DB_CLI, SHELL_PATH } from './paths';
import { createLogger } from './utils/logger';

const logger = createLogger('Search');

interface UnifiedSearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  timestamp?: string;
  source: string;
  status?: string;
  relevance_score: number;
}

/**
 * Shell-escape a string for use in single-quoted CLI arguments.
 */
function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

/**
 * Run froggo-db CLI command and parse JSON output.
 */
function execCli(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10000, env: { ...process.env, PATH: SHELL_PATH } }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Search messages + facts via froggo-db search CLI.
 */
async function searchMessagesAndFacts(query: string): Promise<UnifiedSearchResult[]> {
  try {
    const escaped = shellEscape(query);
    const stdout = await execCli(`${FROGGO_DB_CLI} search '${escaped}' --limit 15 --json`);
    const data = JSON.parse(stdout);

    const messages: UnifiedSearchResult[] = (data.messages || []).map((r: any) => ({
      id: `msg-${r.id}`,
      type: 'message',
      title: r.title || (r.content ? r.content.slice(0, 80) : ''),
      snippet: r.snippet || r.content || '',
      timestamp: r.timestamp || r.created_at,
      source: 'Messages',
      relevance_score: r.relevance_score || 0,
    }));

    const facts: UnifiedSearchResult[] = (data.facts || []).map((r: any) => ({
      id: `fact-${r.id}`,
      type: 'fact',
      title: r.title || r.subject || '',
      snippet: r.snippet || r.content || '',
      timestamp: r.timestamp || r.created_at,
      source: 'Facts',
      relevance_score: r.relevance_score || 0,
    }));

    return [...messages, ...facts];
  } catch (error) {
    logger.error('[Search] Messages+Facts search failed:', error);
    return [];
  }
}

/**
 * Search tasks via in-process SQLite (shared db connection).
 */
async function searchTasks(query: string): Promise<UnifiedSearchResult[]> {
  try {
    const pattern = `%${query}%`;
    const rows = prepare(
      `SELECT id, title, description, status, assigned_to, created_at, updated_at
       FROM tasks
       WHERE (title LIKE ? OR description LIKE ?)
         AND (archived IS NULL OR archived = 0)
       ORDER BY updated_at DESC
       LIMIT 15`
    ).all(pattern, pattern) as any[];

    return rows.map((r) => ({
      id: `task-${r.id}`,
      type: 'task',
      title: r.title || '',
      snippet: (r.description || '').slice(0, 120),
      timestamp: r.updated_at || r.created_at,
      status: r.status,
      source: 'Tasks',
      relevance_score: 0,
    }));
  } catch (error) {
    logger.error('[Search] Tasks search failed:', error);
    return [];
  }
}

/**
 * Search agent context via froggo-db context-search CLI.
 */
async function searchAgentContext(query: string): Promise<UnifiedSearchResult[]> {
  try {
    const escaped = shellEscape(query);
    const stdout = await execCli(`${FROGGO_DB_CLI} context-search '${escaped}' --limit 15 --json`);
    const data = JSON.parse(stdout);
    const results = Array.isArray(data) ? data : (data.results || []);

    return results.map((r: any) => ({
      id: `ctx-${r.id}`,
      type: 'fact',
      title: r.title || '',
      snippet: (r.body || '').slice(0, 120),
      timestamp: r.created_at ? new Date(r.created_at).toISOString() : undefined,
      source: 'Agent Context',
      relevance_score: Math.abs(r.bm25_score || 0),
    }));
  } catch (error) {
    logger.error('[Search] Agent Context search failed:', error);
    return [];
  }
}

/**
 * Register all search-related IPC handlers.
 */
export function registerSearchHandlers(): void {
  registerHandler('search:unified', async (_: any, query: string) => {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { success: true, results: [] };
    }

    const trimmed = query.trim();

    const results = await Promise.allSettled([
      searchMessagesAndFacts(trimmed),
      searchTasks(trimmed),
      searchAgentContext(trimmed),
    ]);

    const merged: UnifiedSearchResult[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        merged.push(...result.value);
      }
    }

    return { success: true, results: merged };
  });
}
