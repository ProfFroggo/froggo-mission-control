/**
 * X API v2 Client — Bearer token auth for all operations.
 * Tokens loaded from secret store (Electron safeStorage) or env vars.
 */

import { getSecret } from './secret-store';

const X_API_BASE = 'https://api.x.com/2';

let bearerToken: string | null = null;
let accessToken: string | null = null;

/**
 * Initialize X API tokens from secret store or env vars.
 * Call after app.ready.
 */
export function initXApiTokens(): void {
  bearerToken = process.env.X_BEARER_TOKEN || getSecret('x-bearer-token') || null;
  accessToken = process.env.X_ACCESS_TOKEN || getSecret('x-access-token') || null;
  if (bearerToken) {
    console.log('[X API] Bearer token loaded');
  }
  if (accessToken) {
    console.log('[X API] Access token loaded');
  }
}

let cachedUserId: string | null = null;

// --- Helpers ---

function getBearerHeaders(): Record<string, string> {
  if (!bearerToken) {
    throw new Error('X API bearer token not configured. Add it in Settings > API Keys.');
  }
  return {
    'Authorization': `Bearer ${bearerToken}`,
  };
}

async function bearerFetch(endpoint: string, params?: Record<string, string>): Promise<any> {
  const headers = getBearerHeaders();
  const url = new URL(`${X_API_BASE}${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function bearerPost(endpoint: string, body: any): Promise<any> {
  const headers = getBearerHeaders();
  const res = await fetch(`${X_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function bearerDelete(endpoint: string): Promise<any> {
  const headers = getBearerHeaders();
  const res = await fetch(`${X_API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`X API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// --- User ID ---

export async function getUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  if (!accessToken) {
    throw new Error('X API access token not configured. Add it in Settings > API Keys.');
  }

  // Extract user ID from access token (format: userId-randomString)
  const parts = accessToken.split('-');
  if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
    cachedUserId = parts[0];
    return cachedUserId;
  }

  // Fallback: look up via API
  const data = await bearerFetch('/users/me');
  cachedUserId = data.data.id;
  return cachedUserId || '';
}

// --- Tweet helpers for mapping response data ---

function mapTweets(data: any): any[] {
  const users: Record<string, any> = {};
  for (const u of (data.includes?.users || [])) {
    users[u.id] = u;
  }

  return (data.data || []).map((tweet: any) => ({
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at,
    author: users[tweet.author_id] || { id: tweet.author_id },
    metrics: tweet.public_metrics,
    conversation_id: tweet.conversation_id,
  }));
}

const TWEET_FIELDS = 'created_at,public_metrics,author_id,conversation_id';
const USER_FIELDS = 'name,username,profile_image_url';

// --- Read endpoints ---

export async function getMentions(count = 20): Promise<any[]> {
  try {
    const userId = await getUserId();
    const data = await bearerFetch(`/users/${userId}/mentions`, {
      max_results: Math.min(count, 100).toString(),
      'tweet.fields': TWEET_FIELDS,
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
    });
    return mapTweets(data);
  } catch (err: any) {
    console.error('[X API] getMentions error:', err.message);
    return [];
  }
}

export async function getHomeTimeline(count = 20): Promise<any[]> {
  try {
    const userId = await getUserId();
    const data = await bearerFetch(`/users/${userId}/timelines/reverse_chronological`, {
      max_results: Math.min(count, 100).toString(),
      'tweet.fields': TWEET_FIELDS,
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
    });
    return mapTweets(data);
  } catch (err: any) {
    console.error('[X API] getHomeTimeline error:', err.message);
    return [];
  }
}

export async function searchRecent(query: string, count = 20): Promise<any[]> {
  try {
    const data = await bearerFetch('/tweets/search/recent', {
      query,
      max_results: Math.min(Math.max(count, 10), 100).toString(),
      'tweet.fields': TWEET_FIELDS,
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
    });
    return mapTweets(data);
  } catch (err: any) {
    console.error('[X API] searchRecent error:', err.message);
    return [];
  }
}

export async function getUserProfile(username: string): Promise<any> {
  const data = await bearerFetch(`/users/by/username/${username}`, {
    'user.fields': 'created_at,description,public_metrics,profile_image_url',
  });
  return data.data;
}

export async function getThread(conversationId: string, count = 100): Promise<any[]> {
  try {
    const data = await bearerFetch('/tweets/search/recent', {
      query: `conversation_id:${conversationId}`,
      max_results: Math.min(Math.max(count, 10), 100).toString(),
      'tweet.fields': TWEET_FIELDS,
      expansions: 'author_id',
      'user.fields': USER_FIELDS,
    });
    return mapTweets(data);
  } catch (err: any) {
    console.error('[X API] getThread error:', err.message);
    return [];
  }
}

export async function getFollowers(userId?: string, count = 100): Promise<any[]> {
  try {
    const id = userId || await getUserId();
    const data = await bearerFetch(`/users/${id}/followers`, {
      max_results: Math.min(Math.max(count, 1), 1000).toString(),
      'user.fields': 'name,username,profile_image_url,public_metrics,description',
    });
    return data.data || [];
  } catch (err: any) {
    console.error('[X API] getFollowers error:', err.message);
    return [];
  }
}

export async function getFollowing(userId?: string, count = 100): Promise<any[]> {
  try {
    const id = userId || await getUserId();
    const data = await bearerFetch(`/users/${id}/following`, {
      max_results: Math.min(Math.max(count, 1), 1000).toString(),
      'user.fields': 'name,username,profile_image_url,public_metrics,description',
    });
    return data.data || [];
  } catch (err: any) {
    console.error('[X API] getFollowing error:', err.message);
    return [];
  }
}

// --- Write endpoints ---

export async function postTweet(
  text: string,
  options?: { reply_to?: string; quote?: string; media_ids?: string[] }
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const body: any = { text };

    if (options?.reply_to) {
      body.reply = { in_reply_to_tweet_id: options.reply_to };
    }
    if (options?.quote) {
      body.quote_tweet_id = options.quote;
    }
    if (options?.media_ids?.length) {
      body.media = { media_ids: options.media_ids };
    }

    const data = await bearerPost('/tweets', body);
    return { success: true, id: data.data?.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteTweet(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await bearerDelete(`/tweets/${id}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reply(
  tweetId: string,
  text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  return postTweet(text, { reply_to: tweetId });
}

export async function likeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerPost(`/users/${userId}/likes`, { tweet_id: tweetId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function unlikeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerDelete(`/users/${userId}/likes/${tweetId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function retweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerPost(`/users/${userId}/retweets`, { tweet_id: tweetId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function unretweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerDelete(`/users/${userId}/retweets/${tweetId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function followUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerPost(`/users/${userId}/following`, { target_user_id: targetUserId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function unfollowUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerDelete(`/users/${userId}/following/${targetUserId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function blockUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const userId = await getUserId();
    await bearerPost(`/users/${userId}/blocking`, { target_user_id: targetUserId });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function sendDM(
  participantId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await bearerPost(`/dm_conversations/with/${participantId}/messages`, { text });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
