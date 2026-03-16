// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/mentions — fetch recent mentions from X API
import { NextResponse } from 'next/server';
import { getTwitterClient } from '@/lib/twitterClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await getTwitterClient();
    if (!client) {
      return NextResponse.json({ error: 'Twitter not configured', mentions: [] }, { status: 200 });
    }

    // Get user ID
    const me = await client.v2.me();
    if (!me.data?.id) {
      return NextResponse.json({ error: 'Could not get user profile', mentions: [] }, { status: 200 });
    }

    // Fetch mentions
    const mentions = await client.v2.userMentionTimeline(me.data.id, {
      max_results: 20,
      'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'conversation_id'],
      expansions: ['author_id'],
      'user.fields': ['name', 'username', 'profile_image_url'],
    });

    const tweets = mentions.data?.data || [];
    const users = mentions.includes?.users || [];
    const userMap = new Map(users.map(u => [u.id, u]));

    const enriched = tweets.map(tweet => ({
      ...tweet,
      author: userMap.get(tweet.author_id as string) || { id: tweet.author_id },
    }));

    return NextResponse.json({
      ok: true,
      mentions: enriched,
      meta: mentions.data?.meta,
    });
  } catch (err) {
    console.error('[x/mentions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
