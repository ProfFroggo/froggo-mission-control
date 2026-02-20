/**
 * x-api-handlers.ts — Extracted X/Twitter API IPC handlers.
 *
 * PoC for the IPC modularization pattern. These handlers were previously
 * inline in main.ts (~200 lines). They depend only on:
 *   - xApi (x-api-client.ts) — already a separate module
 *   - safeLog — passed via dependency injection
 *
 * Pattern: registerXyz(deps) function that takes shared dependencies
 * and registers ipcMain handlers. This avoids circular imports and
 * makes dependencies explicit.
 */

import { ipcMain } from 'electron';

interface XApiClient {
  searchRecent: (query: string, count: number) => Promise<any>;
  likeTweet: (tweetId: string) => Promise<any>;
  unlikeTweet: (tweetId: string) => Promise<any>;
  retweet: (tweetId: string) => Promise<any>;
  unretweet: (tweetId: string) => Promise<any>;
  getUserProfile: (username: string) => Promise<any>;
  followUser: (userId: string) => Promise<any>;
  unfollowUser: (userId: string) => Promise<any>;
  postTweet: (text: string, opts?: any) => Promise<any>;
  deleteTweet: (tweetId: string) => Promise<any>;
  sendDM: (participantId: string, text: string) => Promise<any>;
  getHomeTimeline: (limit: number) => Promise<any>;
  getFollowers: (userId?: string, count?: number) => Promise<any>;
  getFollowing: (userId?: string, count?: number) => Promise<any>;
}

interface Logger {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

interface XApiHandlerDeps {
  xApi: XApiClient;
  safeLog: Logger;
}

/**
 * Register X/Twitter API IPC handlers.
 * Call once during app startup, passing shared dependencies.
 */
export function registerXApiHandlers({ xApi, safeLog }: XApiHandlerDeps): void {

  ipcMain.handle('x:search', async (_, query: string, count?: number) => {
    safeLog.log('[X:Search] Query:', query, 'count:', count);
    try {
      const tweets = await xApi.searchRecent(query, count || 20);
      return { success: true, tweets };
    } catch (e: any) {
      safeLog.error('[X:Search] Error:', e.message);
      return { success: false, tweets: [], error: e.message };
    }
  });

  ipcMain.handle('x:like', async (_, tweetId: string) => {
    safeLog.log('[X:Like] Tweet ID:', tweetId);
    try {
      return await xApi.likeTweet(tweetId);
    } catch (e: any) {
      safeLog.error('[X:Like] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:unlike', async (_, tweetId: string) => {
    safeLog.log('[X:Unlike] Tweet ID:', tweetId);
    try {
      return await xApi.unlikeTweet(tweetId);
    } catch (e: any) {
      safeLog.error('[X:Unlike] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:retweet', async (_, tweetId: string) => {
    safeLog.log('[X:Retweet] Tweet ID:', tweetId);
    try {
      return await xApi.retweet(tweetId);
    } catch (e: any) {
      safeLog.error('[X:Retweet] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:unretweet', async (_, tweetId: string) => {
    safeLog.log('[X:Unretweet] Tweet ID:', tweetId);
    try {
      return await xApi.unretweet(tweetId);
    } catch (e: any) {
      safeLog.error('[X:Unretweet] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:follow', async (_, username: string) => {
    safeLog.log('[X:Follow] Username:', username);
    try {
      const profile = await xApi.getUserProfile(username);
      if (!profile?.id) return { success: false, error: 'User not found' };
      return await xApi.followUser(profile.id);
    } catch (e: any) {
      safeLog.error('[X:Follow] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:unfollow', async (_, username: string) => {
    safeLog.log('[X:Unfollow] Username:', username);
    try {
      const profile = await xApi.getUserProfile(username);
      if (!profile?.id) return { success: false, error: 'User not found' };
      return await xApi.unfollowUser(profile.id);
    } catch (e: any) {
      safeLog.error('[X:Unfollow] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:profile', async (_, username: string) => {
    safeLog.log('[X:Profile] Username:', username);
    try {
      const profile = await xApi.getUserProfile(username);
      return { success: true, profile };
    } catch (e: any) {
      safeLog.error('[X:Profile] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:post', async (_, text: string, options?: { replyTo?: string; quote?: string }) => {
    safeLog.log('[X:Post] Text length:', text.length);
    try {
      return await xApi.postTweet(text, {
        reply_to: options?.replyTo,
        quote: options?.quote,
      });
    } catch (e: any) {
      safeLog.error('[X:Post] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:delete', async (_, tweetId: string) => {
    safeLog.log('[X:Delete] Tweet ID:', tweetId);
    try {
      return await xApi.deleteTweet(tweetId);
    } catch (e: any) {
      safeLog.error('[X:Delete] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:dm', async (_, participantId: string, text: string) => {
    safeLog.log('[X:DM] Participant:', participantId);
    try {
      return await xApi.sendDM(participantId, text);
    } catch (e: any) {
      safeLog.error('[X:DM] Error:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('x:home', async (_, limit?: number) => {
    safeLog.log('[X:Home] Limit:', limit);
    try {
      const tweets = await xApi.getHomeTimeline(limit || 20);
      return { success: true, tweets };
    } catch (e: any) {
      safeLog.error('[X:Home] Error:', e.message);
      return { success: false, tweets: [], error: e.message };
    }
  });

  ipcMain.handle('x:followers', async (_, username?: string, count?: number) => {
    safeLog.log('[X:Followers] Username:', username, 'count:', count);
    try {
      let userId: string | undefined;
      if (username) {
        const profile = await xApi.getUserProfile(username);
        userId = profile?.id;
      }
      const followers = await xApi.getFollowers(userId, count || 100);
      return { success: true, followers };
    } catch (e: any) {
      safeLog.error('[X:Followers] Error:', e.message);
      return { success: false, followers: [], error: e.message };
    }
  });

  ipcMain.handle('x:following', async (_, username?: string, count?: number) => {
    safeLog.log('[X:Following] Username:', username, 'count:', count);
    try {
      let userId: string | undefined;
      if (username) {
        const profile = await xApi.getUserProfile(username);
        userId = profile?.id;
      }
      const following = await xApi.getFollowing(userId, count || 100);
      return { success: true, following };
    } catch (e: any) {
      safeLog.error('[X:Following] Error:', e.message);
      return { success: false, following: [], error: e.message };
    }
  });
}
