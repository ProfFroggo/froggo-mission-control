/**
 * X Analytics Service
 *
 * Real X API analytics backend for the Froggo dashboard.
 * Provides profile metrics (followers/following/tweet count) and
 * own tweet data (likes/retweets/replies/impressions) via the x-api CLI.
 *
 * All data comes from live X API v2 endpoints using OAuth 1.0a credentials
 * stored in ~/.openclaw/x-api.env (managed by x-api CLI internally).
 *
 * IPC channels registered:
 *   x:analytics:profile      — real follower/following/tweet counts
 *   x:analytics:tweets       — own recent tweets with public_metrics
 *   x:analytics:summary:real — aggregated engagement summary from real data
 */

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { X_API_CLI, SHELL_PATH } from './paths';
import { safeLog } from './logger';

const execFileAsync = promisify(execFile);

/**
 * Run x-api CLI with given args and parse JSON response.
 */
async function runXApi(args: string[]): Promise<any> {
  const { stdout } = await execFileAsync(X_API_CLI, args, {
    env: { ...process.env, PATH: SHELL_PATH },
    timeout: 15000,
  });
  return JSON.parse(stdout.trim());
}

/**
 * GET /2/users/by/username/:username
 * Returns real follower/following/tweet counts via public_metrics.
 */
async function getOwnProfile(): Promise<any> {
  try {
    const result = await runXApi(['profile', 'Prof_Frogo']);
    return { success: true, data: result?.data || result };
  } catch (e: any) {
    safeLog.error('[XAnalytics] Profile error:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * GET /2/users/:id/tweets
 * Returns own recent tweets with public_metrics (likes, retweets, replies, impressions).
 * Excludes retweets and replies — own original content only.
 */
async function getMyTweets(count: number = 20): Promise<any> {
  try {
    const result = await runXApi(['my-tweets', '--count', String(count)]);
    return { success: true, data: result?.data || [] };
  } catch (e: any) {
    safeLog.error('[XAnalytics] My-tweets error:', e.message);
    return { success: false, data: [], error: e.message };
  }
}

/**
 * Register all X analytics IPC handlers.
 * Call once during app startup, after registerXPublishingHandlers().
 */
export function registerXAnalyticsHandlers(): void {
  // Real profile data: followers, following, tweet_count
  ipcMain.handle('x:analytics:profile', async () => {
    return getOwnProfile();
  });

  // Real tweet list with public_metrics
  ipcMain.handle('x:analytics:tweets', async (_, count: number = 20) => {
    return getMyTweets(count);
  });

  // Summary using real API data (replaces fake multiplier version in main.ts)
  ipcMain.handle('x:analytics:summary:real', async () => {
    try {
      const [profileResult, tweetsResult] = await Promise.all([
        getOwnProfile(),
        getMyTweets(50),
      ]);

      const profile = profileResult?.data?.public_metrics || {};
      const tweets = tweetsResult?.data || [];

      const totalLikes = tweets.reduce((sum: number, t: any) => sum + (t.public_metrics?.like_count || 0), 0);
      const totalRetweets = tweets.reduce((sum: number, t: any) => sum + (t.public_metrics?.retweet_count || 0), 0);
      const totalReplies = tweets.reduce((sum: number, t: any) => sum + (t.public_metrics?.reply_count || 0), 0);
      const totalImpressions = tweets.reduce((sum: number, t: any) => sum + (t.public_metrics?.impression_count || 0), 0);

      const followers = profile.followers_count || 0;
      const totalEngagements = totalLikes + totalRetweets + totalReplies;
      const engagementRate = followers > 0 && tweets.length > 0
        ? ((totalEngagements / tweets.length) / followers * 100).toFixed(2)
        : 0;

      return {
        success: true,
        followers: profile.followers_count || 0,
        following: profile.following_count || 0,
        tweetCount: profile.tweet_count || 0,
        totalLikes,
        totalRetweets,
        totalReplies,
        totalImpressions,
        engagementRate: Number(engagementRate),
        recentTweetCount: tweets.length,
      };
    } catch (e: any) {
      safeLog.error('[XAnalytics] Summary error:', e.message);
      return { success: false, error: e.message };
    }
  });

  safeLog.debug('[XAnalytics] IPC handlers registered: x:analytics:profile, x:analytics:tweets, x:analytics:summary:real');
}
