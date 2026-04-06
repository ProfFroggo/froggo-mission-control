// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const runtime = 'nodejs';

// POST /api/x/tweet — post a tweet via X API v2
export async function POST(req: NextRequest) {
  // Force fresh credentials on every write operation
  const { invalidateTwitterClient } = await import('@/lib/twitterClient');
  invalidateTwitterClient();
  const client = await getTwitterClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Twitter credentials not configured. Complete the setup wizard.' },
      { status: 501 }
    );
  }

  try {
    let body: { text?: string; reply_to?: string };
    try { body = await req.json(); } catch (err) {
      console.warn('[x/tweet] Non-critical:', err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { text, reply_to } = body;
    if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

    const params: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
    if (reply_to) params.reply = { in_reply_to_tweet_id: String(reply_to) };

    const result = await client.v2.tweet(params);
    return NextResponse.json({ ok: true, id: result.data.id, text: result.data.text });
  } catch (err: any) {
    const msg = err?.message || String(err);
    const detail = err?.data?.detail || err?.data?.errors?.[0]?.message || err?.errors?.[0]?.message || '';
    const code = err?.code || err?.data?.status || 500;
    console.error('[x/tweet] Error:', msg, detail ? `Detail: ${detail}` : '', err?.data ? JSON.stringify(err.data) : '');
    return NextResponse.json({ error: msg, detail, apiCode: code }, { status: 500 });
  }
}
