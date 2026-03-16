// Twitter/X API v2 service — wraps authenticated calls to the X API
// All keys read from OS keychain via /api/settings endpoints

const API_BASE = 'https://api.twitter.com/2';

interface TwitterCredentials {
  apiKey?: string;
  apiSecret?: string;
  bearerToken?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
}

interface TwitterUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  description?: string;
  verified?: boolean;
}

interface Tweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
}

interface TwitterError {
  title?: string;
  detail?: string;
  status?: number;
  type?: string;
}

// ── Credential loading ──────────────────────────────────────────────────────────

export async function loadCredentials(): Promise<TwitterCredentials> {
  const keys = ['twitter_api_key', 'twitter_api_secret', 'twitter_bearer_token', 'twitter_oauth_client_id', 'twitter_oauth_client_secret'];
  const results = await Promise.allSettled(
    keys.map(k => fetch(`/api/settings/${k}`).then(r => r.json()))
  );
  return {
    apiKey: results[0].status === 'fulfilled' ? results[0].value?.value : undefined,
    apiSecret: results[1].status === 'fulfilled' ? results[1].value?.value : undefined,
    bearerToken: results[2].status === 'fulfilled' ? results[2].value?.value : undefined,
    oauthClientId: results[3].status === 'fulfilled' ? results[3].value?.value : undefined,
    oauthClientSecret: results[4].status === 'fulfilled' ? results[4].value?.value : undefined,
  };
}

// Server-side credential loading (for API routes)
export async function loadCredentialsServer(): Promise<TwitterCredentials> {
  const creds: TwitterCredentials = {};
  try {
    const { keychainGet } = await import('./keychain');
    creds.apiKey = await keychainGet('twitter_api_key') ?? undefined;
    creds.apiSecret = await keychainGet('twitter_api_secret') ?? undefined;
    creds.bearerToken = await keychainGet('twitter_bearer_token') ?? undefined;
    creds.oauthClientId = await keychainGet('twitter_oauth_client_id') ?? undefined;
    creds.oauthClientSecret = await keychainGet('twitter_oauth_client_secret') ?? undefined;
  } catch { /* fallback silently */ }

  // Fallback to env vars
  if (!creds.bearerToken) creds.bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!creds.apiKey) creds.apiKey = process.env.TWITTER_API_KEY;
  if (!creds.apiSecret) creds.apiSecret = process.env.TWITTER_API_SECRET;

  return creds;
}

// ── Bearer token API calls ──────────────────────────────────────────────────────

async function bearerFetch(path: string, bearerToken: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
}

// ── Public API methods ──────────────────────────────────────────────────────────

/**
 * Verify credentials — GET /2/users/me
 * Returns authenticated user info or throws on invalid credentials
 */
export async function verifyCredentials(bearerToken: string): Promise<{
  success: boolean;
  user?: TwitterUser;
  error?: string;
}> {
  try {
    const res = await bearerFetch(
      '/users/me?user.fields=profile_image_url,public_metrics,description,verified',
      bearerToken
    );
    const data = await res.json();

    if (data.errors) {
      const err = data.errors[0] as TwitterError;
      return { success: false, error: err.detail || err.title || 'Authentication failed' };
    }

    if (!data.data) {
      return { success: false, error: 'No user data returned — check your Bearer token permissions' };
    }

    return { success: true, user: data.data as TwitterUser };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Get recent tweets for the authenticated user
 */
export async function getRecentTweets(bearerToken: string, userId: string, maxResults = 10): Promise<{
  success: boolean;
  tweets?: Tweet[];
  error?: string;
}> {
  try {
    const res = await bearerFetch(
      `/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`,
      bearerToken
    );
    const data = await res.json();

    if (data.errors) {
      return { success: false, error: data.errors[0]?.detail || 'Failed to fetch tweets' };
    }

    return { success: true, tweets: (data.data ?? []) as Tweet[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

/**
 * Get mentions for the authenticated user
 */
export async function getMentions(bearerToken: string, userId: string, maxResults = 10): Promise<{
  success: boolean;
  tweets?: Tweet[];
  error?: string;
}> {
  try {
    const res = await bearerFetch(
      `/users/${userId}/mentions?max_results=${maxResults}&tweet.fields=created_at,public_metrics`,
      bearerToken
    );
    const data = await res.json();

    if (data.errors) {
      return { success: false, error: data.errors[0]?.detail || 'Failed to fetch mentions' };
    }

    return { success: true, tweets: (data.data ?? []) as Tweet[] };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

// ── Types export ────────────────────────────────────────────────────────────────

export type { TwitterCredentials, TwitterUser, Tweet };
