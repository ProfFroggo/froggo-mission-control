// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const runtime = 'nodejs';

// GET /api/x/search?q=query&max=20
export async function GET(req: NextRequest) {
  const client = await getTwitterClient();
  if (!client) {
    return NextResponse.json({ error: 'Twitter credentials not configured. Complete the setup wizard.', configured: false }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  const max = Math.max(10, Math.min(parseInt(searchParams.get('max') ?? '20'), 100));

  if (!query) return NextResponse.json({ error: 'q is required' }, { status: 400 });

  try {
    const results = await client.v2.search(query, {
      max_results: max,
      'tweet.fields': ['public_metrics', 'created_at', 'author_id'],
      'user.fields': ['name', 'username', 'public_metrics', 'profile_image_url'],
      expansions: ['author_id'],
    });

    return NextResponse.json({
      ok: true,
      tweets: results.data.data ?? [],
      includes: results.data.includes ?? {},
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[x/search] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
