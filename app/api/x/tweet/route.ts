// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';
import { getDb } from '@/lib/database';

export const runtime = 'nodejs';

/** Load a setting from DB, fall back to process.env */
function getSetting(key: string, envKey: string): string {
  // Check DB settings first
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (row?.value) return row.value;
  } catch { /* DB not ready */ }
  return process.env[envKey] || '';
}

function getClient() {
  const appKey = getSetting('twitter_api_key', 'TWITTER_API_KEY');
  const appSecret = getSetting('twitter_api_secret', 'TWITTER_API_SECRET');
  const bearer = getSetting('twitter_bearer_token', 'TWITTER_BEARER_TOKEN');

  // Try OAuth 1.0a (user-context: can post tweets)
  const accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET || '';

  if (appKey && appSecret && accessToken && accessSecret) {
    return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
  }

  // Fall back to Bearer token (app-only: read-only, can't post)
  if (bearer) {
    return new TwitterApi(bearer);
  }

  // Fall back to OAuth 2.0 client credentials
  const clientId = getSetting('twitter_oauth_client_id', 'TWITTER_OAUTH_CLIENT_ID');
  const clientSecret = getSetting('twitter_oauth_client_secret', 'TWITTER_OAUTH_CLIENT_SECRET');
  if (clientId && clientSecret) {
    return new TwitterApi({ clientId, clientSecret });
  }

  return null;
}

// POST /api/x/tweet — post a tweet via X API v2
export async function POST(req: NextRequest) {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Twitter credentials not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET.' },
      { status: 501 }
    );
  }

  try {
    const { text, reply_to } = await req.json();
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const params: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
    if (reply_to) params.reply = { in_reply_to_tweet_id: String(reply_to) };

    const result = await client.v2.tweet(params);
    return NextResponse.json({ ok: true, id: result.data.id, text: result.data.text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[x/tweet] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
