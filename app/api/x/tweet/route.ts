// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const runtime = 'nodejs';

// POST /api/x/tweet — post a tweet via X API v2
export async function POST(req: NextRequest) {
  const client = await getTwitterClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Twitter credentials not configured. Complete the setup wizard.' },
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
