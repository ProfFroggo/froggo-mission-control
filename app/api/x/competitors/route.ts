// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/competitors?handles=h1,h2 — returns mock competitor data
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface CompetitorData {
  handle: string;
  followerCount: number;
  postsPerWeek: number;
  avgEngagementRate: number;
  topContentTypes: string[];
  doingWell: string[];
  gapOpportunities: string[];
}

function mockCompetitorData(handle: string): CompetitorData {
  // Deterministic seed from handle so data is stable across requests
  const seed = handle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const r = (min: number, max: number) => min + ((seed * 1103515245 + 12345) & 0x7fffffff) % (max - min);

  const followerCount = r(1200, 85000);
  const postsPerWeek = r(3, 21);
  const avgEngagementRate = Number((1.5 + (seed % 40) / 10).toFixed(1));

  const allTypes = ['Threads', 'Short takes', 'How-to guides', 'Polls', 'Carousels', 'Videos', 'Memes', 'Hot takes', 'Case studies', 'Lists'];
  const topContentTypes = allTypes.slice(seed % 3, (seed % 3) + 3);

  const wellBullets = [
    'Consistent daily posting cadence keeps their feed active',
    'Strong thread storytelling drives high reply engagement',
    'Timely commentary on trending topics earns share spikes',
    'Simple visuals and memes generate outsized impressions',
    'Community-first replies build loyal follower relationships',
    'Short, punchy takes optimised for mobile scrolling',
  ];
  const gapBullets = [
    'Video/Reels format — they post almost no video content',
    'Educational long-form threads — their content is mostly promotional',
    'Poll-based engagement — they rarely ask audience questions',
    'Behind-the-scenes content — no authenticity layer',
    'Data-backed posts — they rarely share original research',
    'User stories and testimonials — social proof is missing',
  ];

  const doingWell = [wellBullets[seed % wellBullets.length], wellBullets[(seed + 2) % wellBullets.length]];
  const gapOpportunities = [gapBullets[seed % gapBullets.length], gapBullets[(seed + 3) % gapBullets.length]];

  return { handle, followerCount, postsPerWeek, avgEngagementRate, topContentTypes, doingWell, gapOpportunities };
}

// GET /api/x/competitors?handles=handle1,handle2
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('handles') ?? '';
  const handles = raw
    .split(',')
    .map(h => h.trim().replace(/^@/, ''))
    .filter(Boolean)
    .slice(0, 10);

  if (handles.length === 0) {
    return NextResponse.json({ competitors: [] });
  }

  const competitors = handles.map(mockCompetitorData);
  return NextResponse.json({ competitors });
}
