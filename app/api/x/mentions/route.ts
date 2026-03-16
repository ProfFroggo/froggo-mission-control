// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/mentions — fetch recent mentions from X API
import { NextResponse } from 'next/server';
import { loadCredentialsServer } from '@/lib/twitterApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const creds = await loadCredentialsServer();
    if (!creds.bearerToken) {
      return NextResponse.json({ error: 'Bearer token not configured' }, { status: 501 });
    }

    // First get authenticated user ID
    const meRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${creds.bearerToken}` },
    });
    if (!meRes.ok) {
      return NextResponse.json({ error: 'Failed to get user profile' }, { status: 502 });
    }
    const meData = await meRes.json();
    const userId = meData.data?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Could not determine user ID' }, { status: 500 });
    }

    // Fetch mentions
    const mentionsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/mentions?max_results=20&tweet.fields=created_at,public_metrics,author_id,conversation_id&expansions=author_id&user.fields=name,username,profile_image_url`,
      { headers: { Authorization: `Bearer ${creds.bearerToken}` } }
    );

    if (!mentionsRes.ok) {
      const err = await mentionsRes.text();
      return NextResponse.json({ error: `Mentions API error: ${err.slice(0, 200)}` }, { status: 502 });
    }

    const mentionsData = await mentionsRes.json();
    const tweets = mentionsData.data || [];
    const users = mentionsData.includes?.users || [];
    const userMap = new Map(users.map((u: Record<string, unknown>) => [u.id, u]));

    // Enrich tweets with author info
    const enriched = tweets.map((tweet: Record<string, unknown>) => ({
      ...tweet,
      author: userMap.get(tweet.author_id) || { id: tweet.author_id },
    }));

    return NextResponse.json({
      ok: true,
      mentions: enriched,
      meta: mentionsData.meta,
    });
  } catch (err) {
    console.error('[x/mentions]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
