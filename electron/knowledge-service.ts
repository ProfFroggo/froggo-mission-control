/**
 * Knowledge Service
 *
 * IPC handlers for the shared knowledge feed.
 * Reads from the shared_knowledge table in froggo.db.
 */

import { registerHandler } from './ipc-registry';
import { prepare } from './database';
import { createLogger } from './utils/logger';

const logger = createLogger('Knowledge');

/**
 * Get recent shared knowledge entries with optional filters
 */
async function handleGetKnowledgeFeed(
  _event: Electron.IpcMainInvokeEvent,
  args?: { limit?: number; type?: string; agent?: string }
) {
  try {
    const limit = args?.limit || 50;
    let sql = 'SELECT id, publisher_agent, knowledge_type, topic, body, task_id, tags, confidence, created_at FROM shared_knowledge';
    const params: unknown[] = [];
    const where: string[] = [];

    if (args?.type) {
      where.push('knowledge_type = ?');
      params.push(args.type);
    }
    if (args?.agent) {
      where.push('publisher_agent = ?');
      params.push(args.agent);
    }
    if (where.length) {
      sql += ' WHERE ' + where.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = prepare(sql).all(...params);
    return rows;
  } catch (e: any) {
    logger.error('get-knowledge-feed error:', e);
    return [];
  }
}

/**
 * Get knowledge stats (counts by type and agent)
 */
async function handleGetKnowledgeStats(_event: Electron.IpcMainInvokeEvent) {
  try {
    const total = prepare('SELECT COUNT(*) as count FROM shared_knowledge').get() as any;
    const byType = prepare('SELECT knowledge_type, COUNT(*) as count FROM shared_knowledge GROUP BY knowledge_type').all();
    const byAgent = prepare('SELECT publisher_agent, COUNT(*) as count FROM shared_knowledge GROUP BY publisher_agent ORDER BY count DESC LIMIT 10').all();
    return {
      total: total?.count || 0,
      byType: byType || [],
      byAgent: byAgent || [],
    };
  } catch (e: any) {
    logger.error('get-knowledge-stats error:', e);
    return { total: 0, byType: [], byAgent: [] };
  }
}

/**
 * Register all knowledge IPC handlers
 */
export function registerKnowledgeHandlers(): void {
  registerHandler('get-knowledge-feed', handleGetKnowledgeFeed);
  registerHandler('get-knowledge-stats', handleGetKnowledgeStats);
}
