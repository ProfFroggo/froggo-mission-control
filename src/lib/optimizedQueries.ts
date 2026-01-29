/**
 * Optimized Queries - Database query optimization layer
 * 
 * Provides optimized, cached database queries with batching support.
 * All queries go through queryCache for performance.
 */

import { queryCache, cacheKeys } from './queryCache';
import type { Task, TaskStatus, TaskPriority } from '../store/store';

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string;
  project?: string;
  search?: string;
}

interface SessionWithFolders {
  key: string;
  type: string;
  displayName: string;
  folders: Array<{ id: number; name: string; color: string }>;
  lastActivity: number;
  messageCount: number;
}

/**
 * Optimized task queries
 */
export const optimizedQueries = {
  /**
   * Get tasks with filters (cached)
   */
  async getTasks(filters: TaskFilters = {}): Promise<Task[]> {
    const cacheKey = cacheKeys.tasks(filters);

    return queryCache.get(cacheKey, async () => {
      // Build query
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const params: any[] = [];

      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.priority) {
        query += ' AND priority = ?';
        params.push(filters.priority);
      }

      if (filters.assignedTo) {
        query += ' AND assigned_to = ?';
        params.push(filters.assignedTo);
      }

      if (filters.project) {
        query += ' AND project = ?';
        params.push(filters.project);
      }

      if (filters.search) {
        query += ' AND (title LIKE ? OR description LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm);
      }

      query += ' ORDER BY updated_at DESC';

      // Execute via gateway
      const result = await window.clawdbot.froggo.query(query, params);
      return result.results || [];
    });
  },

  /**
   * Get single task (cached)
   */
  async getTask(id: string): Promise<Task | null> {
    const cacheKey = cacheKeys.task(id);

    return queryCache.get(cacheKey, async () => {
      const result = await window.clawdbot.froggo.query(
        'SELECT * FROM tasks WHERE id = ?',
        [id]
      );
      return result.results?.[0] || null;
    });
  },

  /**
   * Get sessions with folders (batched query, cached)
   */
  async getSessionsWithFolders(): Promise<SessionWithFolders[]> {
    const cacheKey = cacheKeys.sessions();

    return queryCache.get(cacheKey, async () => {
      // Get all sessions
      const sessions = await window.clawdbot.gateway.sessions();
      if (!sessions.success) return [];

      // Batch-load folder assignments
      const sessionKeys = sessions.sessions.map((s: any) => s.key);
      const folderAssignments = await Promise.all(
        sessionKeys.map(async (key: string) => {
          const result = await window.clawdbot.folders.forConversation(key);
          return {
            key,
            folders: result.success ? result.folders : [],
          };
        })
      );

      // Build folder map
      const folderMap = new Map(
        folderAssignments.map(f => [f.key, f.folders])
      );

      // Merge data
      return sessions.sessions.map((session: any) => ({
        key: session.key,
        type: session.type,
        displayName: session.displayName,
        folders: folderMap.get(session.key) || [],
        lastActivity: session.updatedAt,
        messageCount: session.messageCount || 0,
      }));
    }, 10000); // 10s cache for sessions
  },

  /**
   * Get task activity log (cached)
   */
  async getTaskActivity(taskId: string, limit: number = 50): Promise<any[]> {
    const cacheKey = cacheKeys.activity(taskId);

    return queryCache.get(cacheKey, async () => {
      const result = await window.clawdbot.froggo.query(
        'SELECT * FROM task_activity WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?',
        [taskId, limit]
      );
      return result.results || [];
    }, 3000); // 3s cache for activity
  },

  /**
   * Get starred messages (cached)
   */
  async getStarredMessages(filters?: {
    category?: string;
    search?: string;
    limit?: number;
  }): Promise<any[]> {
    const cacheKey = cacheKeys.starredMessages(filters);

    return queryCache.get(cacheKey, async () => {
      let query = 'SELECT * FROM starred_messages WHERE 1=1';
      const params: any[] = [];

      if (filters?.category) {
        query += ' AND category = ?';
        params.push(filters.category);
      }

      if (filters?.search) {
        query +=
          ' AND (note LIKE ? OR message_text LIKE ? OR message_id IN (SELECT rowid FROM starred_messages_fts WHERE starred_messages_fts MATCH ?))';
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, filters.search);
      }

      query += ' ORDER BY starred_at DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      const result = await window.clawdbot.froggo.query(query, params);
      return result.results || [];
    });
  },

  /**
   * Get approval queue (cached)
   */
  async getApprovals(): Promise<any[]> {
    const cacheKey = cacheKeys.approvals();

    return queryCache.get(cacheKey, async () => {
      const result = await window.clawdbot.inbox.list();
      return result.success ? result.items : [];
    }, 5000); // 5s cache
  },

  /**
   * Search across all entities (no cache - real-time)
   */
  async globalSearch(query: string, limit: number = 20): Promise<{
    tasks: Task[];
    messages: any[];
    sessions: any[];
  }> {
    const searchTerm = `%${query}%`;

    // Search tasks
    const taskQuery = `
      SELECT * FROM tasks
      WHERE title LIKE ? OR description LIKE ?
      ORDER BY updated_at DESC
      LIMIT ?
    `;
    const tasksResult = await window.clawdbot.froggo.query(taskQuery, [
      searchTerm,
      searchTerm,
      limit,
    ]);

    // Search messages (if FTS enabled)
    const messageQuery = `
      SELECT * FROM starred_messages
      WHERE note LIKE ? OR message_text LIKE ?
      ORDER BY starred_at DESC
      LIMIT ?
    `;
    const messagesResult = await window.clawdbot.froggo.query(messageQuery, [
      searchTerm,
      searchTerm,
      limit,
    ]);

    // Search sessions (in-memory)
    const sessions = await window.clawdbot.gateway.sessions();
    const filteredSessions = sessions.success
      ? sessions.sessions
          .filter((s: any) =>
            s.displayName.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, limit)
      : [];

    return {
      tasks: tasksResult.results || [],
      messages: messagesResult.results || [],
      sessions: filteredSessions,
    };
  },
};

/**
 * Batch query executor
 * Executes multiple queries in parallel for better performance
 */
export async function batchQuery<T>(
  queries: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(queries.map(q => q()));
}

/**
 * Query performance monitor
 */
export class QueryMonitor {
  private static metrics = new Map<string, { count: number; totalMs: number }>();

  static async measure<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await queryFn();
    const duration = performance.now() - start;

    const existing = this.metrics.get(label) || { count: 0, totalMs: 0 };
    this.metrics.set(label, {
      count: existing.count + 1,
      totalMs: existing.totalMs + duration,
    });

    if (duration > 100) {
      console.warn(`[Query] SLOW: ${label} took ${duration.toFixed(2)}ms`);
    }

    return result;
  }

  static getStats() {
    const stats: Array<{
      label: string;
      count: number;
      avgMs: number;
      totalMs: number;
    }> = [];

    for (const [label, metric] of this.metrics.entries()) {
      stats.push({
        label,
        count: metric.count,
        avgMs: metric.totalMs / metric.count,
        totalMs: metric.totalMs,
      });
    }

    return stats.sort((a, b) => b.totalMs - a.totalMs);
  }

  static reset() {
    this.metrics.clear();
  }
}

export default optimizedQueries;
