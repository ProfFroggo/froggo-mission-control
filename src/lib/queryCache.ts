/**
 * Query Cache - In-memory caching for database queries
 * 
 * Reduces database load by caching query results with TTL.
 * Automatically invalidates cache on mutations.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5000; // 5 seconds

  /**
   * Get cached value or execute query
   */
  async get<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached if valid
    if (cached && now - cached.timestamp < cached.ttl) {
      console.debug(`[QueryCache] HIT: ${key}`);
      return cached.data;
    }

    // Execute query
    console.debug(`[QueryCache] MISS: ${key}`);
    const data = await queryFn();

    // Store in cache
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl,
    });

    return data;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string) {
    console.debug(`[QueryCache] INVALIDATE: ${key}`);
    this.cache.delete(key);
  }

  /**
   * Invalidate keys matching pattern
   */
  invalidatePattern(pattern: RegExp) {
    const keys = Array.from(this.cache.keys());
    const matching = keys.filter(key => pattern.test(key));
    matching.forEach(key => this.cache.delete(key));
    console.debug(`[QueryCache] INVALIDATE PATTERN: ${pattern} (${matching.length} keys)`);
  }

  /**
   * Clear all cache
   */
  clear() {
    console.debug('[QueryCache] CLEAR ALL');
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Clean expired entries
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[QueryCache] CLEANUP: Removed ${cleaned} expired entries`);
    }

    return cleaned;
  }
}

export const queryCache = new QueryCache();

// Auto-cleanup every minute
setInterval(() => queryCache.cleanup(), 60000);

/**
 * Cache key builders
 */
export const cacheKeys = {
  tasks: (filters?: any) => `tasks:${JSON.stringify(filters || {})}`,
  task: (id: string) => `task:${id}`,
  sessions: () => 'sessions',
  session: (key: string) => `session:${key}`,
  messages: (sessionKey: string, page?: number) =>
    `messages:${sessionKey}:${page || 0}`,
  folders: () => 'folders',
  folderConversations: (folderId: number) => `folder:${folderId}:conversations`,
  conversationFolders: (conversationKey: string) =>
    `conversation:${conversationKey}:folders`,
  starredMessages: (filters?: any) => `starred:${JSON.stringify(filters || {})}`,
  activity: (taskId: string) => `activity:${taskId}`,
  approvals: () => 'approvals',
};

/**
 * Mutation helpers that auto-invalidate cache
 */
export const mutations = {
  /**
   * Task mutations
   */
  async updateTask(taskId: string, updateFn: () => Promise<any>) {
    const result = await updateFn();
    queryCache.invalidate(cacheKeys.task(taskId));
    queryCache.invalidatePattern(/^tasks:/);
    queryCache.invalidate(cacheKeys.activity(taskId));
    return result;
  },

  async createTask(createFn: () => Promise<any>) {
    const result = await createFn();
    queryCache.invalidatePattern(/^tasks:/);
    return result;
  },

  async deleteTask(taskId: string, deleteFn: () => Promise<any>) {
    const result = await deleteFn();
    queryCache.invalidate(cacheKeys.task(taskId));
    queryCache.invalidatePattern(/^tasks:/);
    queryCache.invalidate(cacheKeys.activity(taskId));
    return result;
  },

  /**
   * Folder mutations
   */
  async updateFolder(folderId: number, updateFn: () => Promise<any>) {
    const result = await updateFn();
    queryCache.invalidate(cacheKeys.folders());
    queryCache.invalidate(cacheKeys.folderConversations(folderId));
    return result;
  },

  async assignFolder(conversationKey: string, assignFn: () => Promise<any>) {
    const result = await assignFn();
    queryCache.invalidate(cacheKeys.conversationFolders(conversationKey));
    queryCache.invalidate(cacheKeys.sessions());
    queryCache.invalidatePattern(/^folder:\d+:conversations/);
    return result;
  },

  /**
   * Session mutations
   */
  async updateSession(sessionKey: string, updateFn: () => Promise<any>) {
    const result = await updateFn();
    queryCache.invalidate(cacheKeys.session(sessionKey));
    queryCache.invalidate(cacheKeys.sessions());
    return result;
  },

  /**
   * Message mutations
   */
  async sendMessage(sessionKey: string, sendFn: () => Promise<any>) {
    const result = await sendFn();
    queryCache.invalidatePattern(new RegExp(`^messages:${sessionKey}:`));
    return result;
  },
};

export default queryCache;
