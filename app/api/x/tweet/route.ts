// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { TwitterApi } from 'twitter-api-v2';

export const runtime = 'nodejs';

function getClient() {
  const { TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET } = process.env;
  if (!TWITTER_API_KEY || !TWITTER_API_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_TOKEN_SECRET) {
    return null;
  }
  return new TwitterApi({
    appKey: TWITTER_API_KEY,
    appSecret: TWITTER_API_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_TOKEN_SECRET,
  });
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
