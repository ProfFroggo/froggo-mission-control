// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/x/predict — mock content performance predictor
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PredictionResult {
  estimatedReach: number;
  estimatedEngagement: number;
  engagementRate: string;
  optimalPostTime: string;
  confidenceScore: number;
  improvements: string[];
  contentSignals: {
    label: string;
    score: number;
    verdict: 'good' | 'neutral' | 'improve';
  }[];
}

const OPTIMAL_TIMES = [
  'Tuesday 9:00 AM',
  'Wednesday 12:00 PM',
  'Thursday 6:00 PM',
  'Friday 8:00 AM',
  'Monday 11:00 AM',
  'Wednesday 7:00 PM',
  'Thursday 8:30 AM',
];

const IMPROVEMENTS: string[] = [
  'Add a question at the end to drive replies',
  'Include a relevant hashtag (1–2 max for best reach)',
  'Open with a bold claim or surprising stat to hook readers',
  'Break into a thread if over 200 characters for better readability',
  'Tag 1 relevant person to extend reach',
  'Use a concrete number — specificity drives credibility',
  'Trim filler words; punchy posts outperform verbose ones',
  'Add a call-to-action in the last line',
];

function scoreContent(text: string): PredictionResult {
  const len = text.trim().length;
  const wordCount = text.trim().split(/\s+/).length;
  const hasQuestion = /\?/.test(text);
  const hasHashtag = /#\w+/.test(text);
  const hasMention = /@\w+/.test(text);
  const hasNumber = /\d/.test(text);
  const hasLink = /https?:\/\//.test(text);

  // Simple heuristic scoring
  let baseReach = 800;
  if (len > 50) baseReach += 400;
  if (len > 120) baseReach += 300;
  if (len > 220) baseReach -= 200;
  if (hasHashtag) baseReach += 600;
  if (hasMention) baseReach += 300;
  if (hasNumber) baseReach += 200;
  if (hasQuestion) baseReach += 250;
  if (hasLink) baseReach += 150;

  const jitter = (text.length * 37 + wordCount * 13) % 500;
  const estimatedReach = Math.max(300, baseReach + jitter);

  let engBase = 1.2;
  if (hasQuestion) engBase += 1.1;
  if (len >= 60 && len <= 200) engBase += 0.8;
  if (hasNumber) engBase += 0.4;
  const engagementRate = Math.min(8.5, engBase + (jitter % 100) / 50).toFixed(1);
  const estimatedEngagement = Math.round((estimatedReach * parseFloat(engagementRate)) / 100);

  const confidenceScore = Math.min(95, 55 + Math.floor((len / 280) * 30) + (hasQuestion ? 10 : 0));

  const timeIdx = (text.length + wordCount) % OPTIMAL_TIMES.length;
  const optimalPostTime = OPTIMAL_TIMES[timeIdx];

  // Pick 2–3 relevant improvements
  const improvements: string[] = [];
  if (!hasQuestion) improvements.push(IMPROVEMENTS[0]);
  if (!hasHashtag) improvements.push(IMPROVEMENTS[1]);
  if (len < 60) improvements.push(IMPROVEMENTS[2]);
  if (improvements.length < 2) improvements.push(IMPROVEMENTS[(text.length % IMPROVEMENTS.length)]);

  const contentSignals = [
    { label: 'Length', score: len < 40 ? 40 : len <= 220 ? 85 : 60, verdict: (len < 40 ? 'improve' : len <= 220 ? 'good' : 'neutral') as 'good' | 'neutral' | 'improve' },
    { label: 'Readability', score: wordCount > 5 && wordCount < 35 ? 80 : 55, verdict: (wordCount > 5 && wordCount < 35 ? 'good' : 'improve') as 'good' | 'neutral' | 'improve' },
    { label: 'Engagement hook', score: hasQuestion ? 90 : 45, verdict: (hasQuestion ? 'good' : 'improve') as 'good' | 'neutral' | 'improve' },
    { label: 'Discoverability', score: hasHashtag ? 80 : 35, verdict: (hasHashtag ? 'good' : 'improve') as 'good' | 'neutral' | 'improve' },
    { label: 'Credibility signals', score: hasNumber ? 75 : 50, verdict: (hasNumber ? 'good' : 'neutral') as 'good' | 'neutral' | 'improve' },
  ];

  return {
    estimatedReach,
    estimatedEngagement,
    engagementRate: `${engagementRate}%`,
    optimalPostTime,
    confidenceScore,
    improvements: improvements.slice(0, 3),
    contentSignals,
  };
}

// POST /api/x/predict — body: { content: string }
export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json();
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    const prediction = scoreContent(content);
    return NextResponse.json({ ok: true, prediction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
