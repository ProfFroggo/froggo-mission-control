// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/reports — list reports by type
// POST /api/x/reports — generate a new report (competitor analysis, weekly summary, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_FALLBACK = 'gemini-2.5-flash-preview-05-20';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch {}
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key') as { value: string } | undefined;
  return row?.value || process.env.GEMINI_API_KEY || null;
}

async function geminiGenerate(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8000, temperature: 0.3 },
          }),
        }
      );
      if (!res.ok) { if (model === GEMINI_MODEL) continue; return null; }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch { if (model === GEMINI_MODEL) continue; return null; }
  }
  return null;
}

// GET — list reports
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where = type ? 'WHERE type = ?' : '';
    const vals = type ? [type, limit] : [limit];
    const rows = db.prepare(`SELECT * FROM x_reports ${where} ORDER BY created_at DESC LIMIT ?`).all(...vals) as any[];

    const parsed = rows.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : {},
    }));

    return NextResponse.json({ reports: parsed, total: parsed.length });
  } catch (error) {
    console.error('GET /api/x/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — generate a new report
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const reportType = body.type || 'competitor-analysis';

    const apiKey = await getGeminiKey();
    if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 400 });

    // Load brand context from knowledge base
    let brandContext = '';
    try {
      const kbRows = db.prepare(
        `SELECT title, summary FROM knowledge_base WHERE scope IN ('agents', 'all') ORDER BY updated_at DESC LIMIT 5`
      ).all() as Array<{ title: string; summary: string }>;
      if (kbRows.length > 0) {
        brandContext = `\n\nBrand context:\n${kbRows.map(a => `- ${a.title}: ${(a.summary || '').slice(0, 200)}`).join('\n')}`;
      }
    } catch {}

    let prompt = '';
    let title = '';

    if (reportType === 'competitor-analysis') {
      // Load competitor handles
      let handles: string[] = body.handles || [];
      if (handles.length === 0) {
        try {
          const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('x-competitor-handles') as { value: string } | undefined;
          if (row?.value) handles = JSON.parse(row.value);
        } catch {}
      }

      // Fetch competitor tweets via X search
      let competitorData = '';
      if (handles.length > 0) {
        for (const handle of handles.slice(0, 5)) {
          try {
            const searchRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/search?q=from:${handle}&max=10`);
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              const tweets = searchData.tweets || [];
              if (tweets.length > 0) {
                const totalLikes = tweets.reduce((s: number, t: any) => s + (t.public_metrics?.like_count || 0), 0);
                const totalRTs = tweets.reduce((s: number, t: any) => s + (t.public_metrics?.retweet_count || 0), 0);
                competitorData += `\n\n@${handle} (${tweets.length} recent tweets, ${totalLikes} total likes, ${totalRTs} total RTs):\n`;
                competitorData += tweets.slice(0, 5).map((t: any) =>
                  `- "${(t.text || '').slice(0, 100)}" (likes: ${t.public_metrics?.like_count || 0}, RTs: ${t.public_metrics?.retweet_count || 0})`
                ).join('\n');
              }
            }
          } catch {}
        }
      }

      // Fetch our own recent performance
      let ourData = '';
      try {
        const analyticsRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/analytics`);
        if (analyticsRes.ok) {
          const analytics = await analyticsRes.json();
          const profile = analytics.profile?.public_metrics || {};
          const tweets = analytics.tweets || [];
          ourData = `\n\nOur account (@${analytics.profile?.username || 'BitsoOnchain'}):
Followers: ${profile.followers_count || 0}, Following: ${profile.following_count || 0}
Recent tweets: ${tweets.length}
Total recent likes: ${tweets.reduce((s: number, t: any) => s + (t.public_metrics?.like_count || 0), 0)}
Total recent RTs: ${tweets.reduce((s: number, t: any) => s + (t.public_metrics?.retweet_count || 0), 0)}`;
        }
      } catch {}

      title = `Competitor Analysis — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      prompt = `You are a social media strategist. Generate a comprehensive competitor analysis report in markdown.
${brandContext}${ourData}${competitorData}

Structure the report as:

## Executive Summary
3-5 bullet points of key findings.

## Competitor Breakdown
For each competitor, a section with:
- **Posting frequency** and content types
- **Engagement metrics** (avg likes, RTs per post)
- **Content themes** they focus on
- **Strengths** and **weaknesses**

## Comparative Table
| Metric | Us | Competitor 1 | Competitor 2 | ... |
|--------|-----|-------------|-------------|-----|

## Opportunities
What gaps can we exploit? What are they NOT doing that we could?

## Threats
What are they doing better? What should we watch out for?

## Recommended Actions
5 specific, actionable recommendations with priority (high/medium/low).

Be data-driven. Reference specific numbers. Be honest about our weaknesses.`;

    } else if (reportType === 'weekly-summary') {
      title = `Weekly Performance Summary — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

      let analyticsData = '';
      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/analytics`);
        if (res.ok) {
          const data = await res.json();
          analyticsData = JSON.stringify({ profile: data.profile?.public_metrics, tweetCount: data.tweets?.length, tweets: data.tweets?.slice(0, 10).map((t: any) => ({ text: t.text?.slice(0, 80), metrics: t.public_metrics })) });
        }
      } catch {}

      let mentionData = '';
      try {
        const mentions = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN reply_status = \'replied\' THEN 1 ELSE 0 END) as replied FROM x_mentions WHERE tweet_created_at > ?').get(Date.now() - 7 * 86400000) as any;
        mentionData = `Mentions this week: ${mentions?.total || 0}, Replied: ${mentions?.replied || 0}`;
      } catch {}

      prompt = `Generate a weekly social media performance report in markdown.
${brandContext}
Analytics: ${analyticsData}
${mentionData}

Structure:
## This Week at a Glance
Key metrics in a table.

## Top Performing Content
What worked and why.

## Engagement Summary
Mentions, replies, sentiment breakdown.

## Recommendations for Next Week
3-5 specific actions.`;
    } else {
      return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 });
    }

    const content = await geminiGenerate(prompt, apiKey);
    if (!content) return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });

    // Extract summary (first paragraph or first 200 chars)
    const summary = content.split('\n').find(l => l.trim() && !l.startsWith('#'))?.slice(0, 200) || title;

    const id = `xr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(`
      INSERT INTO x_reports (id, type, title, summary, content, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, reportType, title, summary, content, JSON.stringify({ handles: body.handles, generated_by: 'gemini' }), Date.now());

    return NextResponse.json({ ok: true, report: { id, type: reportType, title, summary, content } });
  } catch (error) {
    console.error('POST /api/x/reports error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
