// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const runtime = 'nodejs';

// GET /api/x/analytics — fetch profile metrics + recent tweets for analytics views
export async function GET() {
  const client = await getTwitterClient();
  if (!client) {
    return NextResponse.json({ error: 'Twitter credentials not configured. Complete the setup wizard.', configured: false }, { status: 501 });
  }

  try {
    const me = await client.v2.me({
      'user.fields': ['public_metrics', 'description', 'profile_image_url'],
    });

    const timeline = await client.v2.userTimeline(me.data.id, {
      max_results: 100,
      'tweet.fields': ['public_metrics', 'created_at', 'text'],
    });

    return NextResponse.json({
      ok: true,
      profile: me.data,
      tweets: timeline.data.data ?? [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[x/analytics] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
