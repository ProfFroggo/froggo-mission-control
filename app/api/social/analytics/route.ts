// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/social/analytics?days=30 — engagement analytics (mock data based on schedule)

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { handleApiError } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function seededRand(seed: number, min: number, max: number): number {
  // Simple deterministic pseudo-random for consistent mock data
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

function generateDailyData(dateStr: string, postCount: number) {
  const seed = dateStr.split('-').reduce((s, n) => s + parseInt(n, 10), 0);
  const baseImpressions = postCount * seededRand(seed, 200, 800);
  const likes = Math.floor(baseImpressions * (seededRand(seed + 1, 2, 8) / 100));
  const retweets = Math.floor(likes * (seededRand(seed + 2, 10, 30) / 100));
  const replies = Math.floor(likes * (seededRand(seed + 3, 5, 20) / 100));
  return { impressions: baseImpressions, likes, retweets, replies };
}

export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get('days');
    const days = Math.min(Math.max(parseInt(daysParam ?? '30', 10), 1), 90);

    // Ensure table exists (in case social/schedule route hasn't been hit yet)
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS social_schedule (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'x',
        scheduledAt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        agentId TEXT,
        metadata TEXT DEFAULT '{}',
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    // Get scheduled post counts per day from DB
    const rows = db
      .prepare(
        `SELECT date(scheduledAt) as day, COUNT(*) as cnt
         FROM social_schedule
         WHERE scheduledAt >= date('now', ? || ' days')
         GROUP BY day`,
      )
      .all(`-${days}`) as { day: string; cnt: number }[];

    const postsByDay = new Map(rows.map((r) => [r.day, r.cnt]));

    // Build daily array for the requested range
    const daily: {
      date: string;
      posts: number;
      impressions: number;
      likes: number;
      retweets: number;
      replies: number;
    }[] = [];

    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const postCount = postsByDay.get(dateStr) ?? seededRand(i * 7 + 3, 0, 3);
      const metrics = generateDailyData(dateStr, Math.max(postCount, 1));
      daily.push({ date: dateStr, posts: postCount, ...metrics });
    }

    const totalPosts = daily.reduce((s, d) => s + d.posts, 0);
    const totalImpressions = daily.reduce((s, d) => s + d.impressions, 0);
    const totalLikes = daily.reduce((s, d) => s + d.likes, 0);
    const totalRetweets = daily.reduce((s, d) => s + d.retweets, 0);
    const avgEngagement =
      totalImpressions > 0
        ? ((totalLikes + totalRetweets) / totalImpressions) * 100
        : 0;

    const topDay = daily.reduce((best, d) =>
      d.impressions > best.impressions ? d : best,
      daily[0],
    );

    return NextResponse.json({
      summary: {
        totalPosts,
        avgEngagement: parseFloat(avgEngagement.toFixed(2)),
        topPost: {
          date: topDay?.date ?? null,
          impressions: topDay?.impressions ?? 0,
        },
        totalImpressions,
        totalLikes,
        totalRetweets,
      },
      daily,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
