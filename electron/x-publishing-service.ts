/**
 * X Publishing Service
 *
 * Bridges the Electron dashboard to the x-api CLI for posting tweets and threads.
 * Uses OAuth 1.0a credentials (handled internally by x-api CLI) instead of
 * Bearer token auth — required for all write operations on X API v2.
 *
 * Rate limit: 17 posts per rolling 24-hour window (X API free tier).
 * Tracked in-memory via timestamp array — resets naturally as timestamps age out.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ipcMain } from 'electron';
import { X_API_CLI, SHELL_PATH } from './paths';
import { prepare, db } from './database';
import { createLogger } from './utils/logger';

const logger = createLogger('XPublishing');
const execFileAsync = promisify(execFile);

// ── Rate limit tracker ──────────────────────────────────────────────────────

const DAILY_POST_LIMIT = 17;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

/** Rolling array of post timestamps (epoch ms). One entry per tweet, including thread tweets. */
let postTimestamps: number[] = [];

/**
 * Filter out timestamps older than 24h and return current rate limit status.
 */
function canPost(count: number = 1): { allowed: boolean; remaining: number; resetAt: number | null } {
  const now = Date.now();
  postTimestamps = postTimestamps.filter(ts => now - ts < WINDOW_MS);

  const used = postTimestamps.length;
  const remaining = Math.max(0, DAILY_POST_LIMIT - used);
  const allowed = remaining >= count;

  // resetAt = when the oldest timestamp in window will expire (giving back a slot)
  const resetAt = postTimestamps.length > 0
    ? postTimestamps[0] + WINDOW_MS
    : null;

  return { allowed, remaining, resetAt };
}

/**
 * Record N posts in the rate limit tracker.
 * Call AFTER a successful CLI post.
 */
function recordPost(count: number = 1): void {
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    postTimestamps.push(now);
  }
}

/**
 * Public rate limit info for IPC handler.
 */
function getRateLimitInfo(): { remaining: number; used: number; limit: number; resetAt: number | null } {
  const now = Date.now();
  postTimestamps = postTimestamps.filter(ts => now - ts < WINDOW_MS);
  const used = postTimestamps.length;
  const remaining = Math.max(0, DAILY_POST_LIMIT - used);
  const resetAt = postTimestamps.length > 0
    ? postTimestamps[0] + WINDOW_MS
    : null;
  return { remaining, used, limit: DAILY_POST_LIMIT, resetAt };
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface PublishResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
  rateLimitRemaining: number;
}

export interface ThreadResult {
  success: boolean;
  threadCount?: number;
  tweets?: Array<{ id: string; text: string }>;
  error?: string;
  rateLimitRemaining: number;
}

// ── CLI bridge ───────────────────────────────────────────────────────────────

/**
 * Post a single tweet via x-api CLI.
 * CLI command: x-api post "text"
 * Returns JSON: { "data": { "id": "...", "text": "..." } }
 */
export async function postTweet(text: string): Promise<PublishResult> {
  // Check rate limit before calling CLI
  const limit = canPost(1);
  if (!limit.allowed) {
    const resetDate = limit.resetAt ? new Date(limit.resetAt).toLocaleTimeString() : 'unknown';
    logger.warn(`[XPublish] Rate limit exhausted (${DAILY_POST_LIMIT}/day). Resets at ${resetDate}`);
    return {
      success: false,
      error: `Daily rate limit exhausted (${DAILY_POST_LIMIT} posts/24h). Next slot available at ${resetDate}.`,
      rateLimitRemaining: 0,
    };
  }

  logger.debug(`[XPublish] Posting tweet (${limit.remaining} remaining after this)`);

  try {
    const { stdout, stderr } = await execFileAsync(X_API_CLI, ['post', text], {
      env: { PATH: SHELL_PATH },
      timeout: 30_000,
    });

    if (stderr) {
      logger.debug(`[XPublish] x-api stderr: ${stderr}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      throw new Error(`Failed to parse x-api response: ${stdout.slice(0, 200)}`);
    }

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    // Record post only after confirmed success
    recordPost(1);

    const afterLimit = canPost(0);
    const tweetId = parsed?.data?.id ?? parsed?.id ?? undefined;
    const tweetUrl = tweetId ? `https://x.com/i/web/status/${tweetId}` : undefined;

    logger.debug(`[XPublish] Tweet posted: ${tweetId}`);
    return {
      success: true,
      tweetId,
      tweetUrl,
      rateLimitRemaining: afterLimit.remaining,
    };
  } catch (err: any) {
    logger.error(`[XPublish] Post failed: ${err.message}`);
    return {
      success: false,
      error: err.message ?? String(err),
      rateLimitRemaining: canPost(0).remaining,
    };
  }
}

/**
 * Post a thread via x-api CLI.
 * CLI command: x-api thread "tweet1" "tweet2" ...
 * Returns JSON: { "success": true, "thread_count": N, "tweets": [...] }
 */
export async function postThread(tweets: string[]): Promise<ThreadResult> {
  if (!tweets || tweets.length === 0) {
    return {
      success: false,
      error: 'Thread must contain at least one tweet.',
      rateLimitRemaining: canPost(0).remaining,
    };
  }

  // Check rate limit for entire thread (each tweet counts as 1 post)
  const limit = canPost(tweets.length);
  if (!limit.allowed) {
    const resetDate = limit.resetAt ? new Date(limit.resetAt).toLocaleTimeString() : 'unknown';
    logger.warn(`[XPublish] Rate limit insufficient for thread of ${tweets.length} tweets. ${limit.remaining} remaining.`);
    return {
      success: false,
      error: `Insufficient rate limit for ${tweets.length}-tweet thread. Only ${limit.remaining} posts remain (limit ${DAILY_POST_LIMIT}/24h). Resets at ${resetDate}.`,
      rateLimitRemaining: limit.remaining,
    };
  }

  logger.debug(`[XPublish] Posting thread of ${tweets.length} tweets (${limit.remaining} remaining after this)`);

  try {
    const { stdout, stderr } = await execFileAsync(X_API_CLI, ['thread', ...tweets], {
      env: { PATH: SHELL_PATH },
      timeout: 60_000, // threads take longer
    });

    if (stderr) {
      logger.debug(`[XPublish] x-api thread stderr: ${stderr}`);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(stdout.trim());
    } catch {
      throw new Error(`Failed to parse x-api thread response: ${stdout.slice(0, 200)}`);
    }

    if (parsed.error) {
      throw new Error(parsed.error);
    }

    // Record posts only after confirmed success
    const tweetCount = parsed?.thread_count ?? tweets.length;
    recordPost(tweetCount);

    const afterLimit = canPost(0);
    logger.debug(`[XPublish] Thread posted: ${tweetCount} tweets`);

    return {
      success: true,
      threadCount: tweetCount,
      tweets: parsed?.tweets ?? [],
      rateLimitRemaining: afterLimit.remaining,
    };
  } catch (err: any) {
    logger.error(`[XPublish] Thread post failed: ${err.message}`);
    return {
      success: false,
      error: err.message ?? String(err),
      rateLimitRemaining: canPost(0).remaining,
    };
  }
}

// ── Schema migration ─────────────────────────────────────────────────────────

/**
 * Ensure scheduled_posts table has a metadata column.
 * The table may have been created without it by the legacy x:schedule handler.
 */
function ensureScheduledPostsMetadata(): void {
  try {
    const cols = (db.prepare("PRAGMA table_info(scheduled_posts)").all() as Array<{ name: string }>);
    const hasMetadata = cols.some(c => c.name === 'metadata');
    if (!hasMetadata) {
      db.exec("ALTER TABLE scheduled_posts ADD COLUMN metadata TEXT");
      logger.debug('[XPublish] Added metadata column to scheduled_posts table');
    }
  } catch (e: any) {
    logger.warn('[XPublish] ensureScheduledPostsMetadata error (non-fatal):', e.message);
  }
}

// ── Media upload ─────────────────────────────────────────────────────────────

/**
 * Upload a media file via x-api CLI and return its media_id.
 */
async function uploadMedia(filePath: string): Promise<{ success: boolean; mediaId?: string; error?: string }> {
  try {
    const { stdout } = await execFileAsync(X_API_CLI, ['media-upload', filePath], {
      env: { ...process.env, PATH: SHELL_PATH },
      timeout: 30_000,
    });
    const result = JSON.parse(stdout.trim()) as { success: boolean; media_id?: string; error?: string };
    return result.success
      ? { success: true, mediaId: result.media_id }
      : { success: false, error: result.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── Schedule functions ────────────────────────────────────────────────────────

/**
 * Schedule a single tweet (with optional attached media) for future posting.
 */
async function scheduleTweet(text: string, scheduledAt: number, mediaId?: string): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = `xsched-${Date.now()}`;
    const now = Date.now();
    prepare(`
      INSERT INTO scheduled_posts (id, content, scheduled_time, status, created_at, metadata)
      VALUES (?, ?, ?, 'pending', ?, json(?))
    `).run(id, text, scheduledAt, now, JSON.stringify({ mediaId: mediaId || null, type: 'single' }));
    logger.debug(`[XPublish] Scheduled tweet ${id} for ${new Date(scheduledAt).toISOString()}`);
    return { success: true, id };
  } catch (e: any) {
    logger.error('[XPublish] scheduleTweet error:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Schedule a thread (array of tweet texts) for future posting.
 */
async function scheduleThread(tweets: string[], scheduledAt: number): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = `xsched-thread-${Date.now()}`;
    const now = Date.now();
    prepare(`
      INSERT INTO scheduled_posts (id, content, scheduled_time, status, created_at, metadata)
      VALUES (?, ?, ?, 'pending', ?, json(?))
    `).run(id, tweets[0], scheduledAt, now, JSON.stringify({ tweets, type: 'thread' }));
    logger.debug(`[XPublish] Scheduled thread ${id} (${tweets.length} tweets) for ${new Date(scheduledAt).toISOString()}`);
    return { success: true, id };
  } catch (e: any) {
    logger.error('[XPublish] scheduleThread error:', e.message);
    return { success: false, error: e.message };
  }
}

// ── IPC registration ─────────────────────────────────────────────────────────

/**
 * Register all X publishing IPC handlers.
 * Call once during app startup, after initXApiTokens().
 */
export function registerXPublishingHandlers(): void {
  // Ensure DB schema is up to date
  ensureScheduledPostsMetadata();

  // Post a single tweet
  ipcMain.handle('x:publish:post', async (_event, text: string) => {
    return postTweet(text);
  });

  // Post a thread (array of tweet texts)
  ipcMain.handle('x:publish:thread', async (_event, tweets: string[]) => {
    return postThread(tweets);
  });

  // Get current rate limit status
  ipcMain.handle('x:publish:rateLimit', () => {
    return getRateLimitInfo();
  });

  // Media upload — uploads a file to X and returns media_id
  ipcMain.handle('x:publish:mediaUpload', async (_event, filePath: string) => {
    return uploadMedia(filePath);
  });

  // Schedule single tweet (with optional media)
  ipcMain.handle('x:publish:schedule', async (_event, text: string, scheduledAt: number, mediaId?: string) => {
    return scheduleTweet(text, scheduledAt, mediaId);
  });

  // Schedule thread
  ipcMain.handle('x:publish:scheduleThread', async (_event, tweets: string[], scheduledAt: number) => {
    return scheduleThread(tweets, scheduledAt);
  });

  // List pending/posting scheduled posts
  ipcMain.handle('x:publish:scheduledList', async () => {
    try {
      const rows = prepare(`
        SELECT id, content, scheduled_time, status, created_at, metadata
        FROM scheduled_posts
        WHERE status IN ('pending', 'posting')
        ORDER BY scheduled_time ASC
      `).all();
      return { success: true, scheduled: rows };
    } catch (e: any) {
      return { success: false, scheduled: [], error: e.message };
    }
  });

  // Cancel a pending scheduled post
  ipcMain.handle('x:publish:scheduledCancel', async (_event, id: string) => {
    try {
      const result = prepare(
        `UPDATE scheduled_posts SET status = 'cancelled' WHERE id = ? AND status = 'pending'`
      ).run(id);
      if (result.changes === 0) return { success: false, error: 'Post not found or already sent' };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  logger.debug('[XPublish] IPC handlers registered: post, thread, rateLimit, mediaUpload, schedule, scheduleThread, scheduledList, scheduledCancel');
}
