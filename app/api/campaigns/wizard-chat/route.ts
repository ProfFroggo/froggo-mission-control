// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/campaigns/wizard-chat — conversational AI for campaign creation wizard
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are helping set up a new marketing campaign in Mission Control, an AI-powered command center.

Have a natural conversation to collect:
- Campaign name (required)
- Goal (awareness|lead_gen|conversion|retention|revenue|engagement|launch, required)
- Campaign types (from: paid, organic, social, email, content, pr, influencer, seo)
- Target channels (instagram, x, tiktok, linkedin, youtube, email, seo, google_ads, meta_ads)
- Target audience description
- Budget (optional)
- Timeline/dates (optional)
- A brief description of what the campaign will do

Ask 1-2 questions at a time. Be direct and conversational.

After your response text, if the question maps to one of these topics add a widget tag on its own line at the very end:
[WIDGET:types] — when asking about campaign type (paid, organic, social, etc.)
[WIDGET:goal] — when asking about the campaign goal
[WIDGET:channels] — when asking about which channels to use
[WIDGET:dates] — when asking about timeline or start/end dates
[WIDGET:budget] — when asking about budget
Only ONE widget tag per response. Put it as the very last line. Never include a widget tag when outputting [CONTEXT_READY].

When ready (have name, goal, and at least some channels or types), output:
[CONTEXT_READY]
{"name":"...","goal":"...","types":["..."],"channels":["..."],"targetAudience":"...","budget":"...","brief":"..."}`;

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'gemini_api_key'").get() as { value: string } | undefined;
    if (row?.value) return row.value;
  } catch { /* ignore */ }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages as Array<{ role: 'user' | 'model'; text: string }>;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 400 });
    }

    // Build contents array from messages
    const contents = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Gemini error: ${res.status} ${err.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const fullResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

    // Parse CONTEXT_READY marker
    if (fullResponse.includes('[CONTEXT_READY]')) {
      const markerIndex = fullResponse.indexOf('[CONTEXT_READY]');
      const textBefore = fullResponse.slice(0, markerIndex).trim();
      const afterMarker = fullResponse.slice(markerIndex + '[CONTEXT_READY]'.length).trim();
      try {
        const jsonStart = afterMarker.indexOf('{');
        const jsonEnd = afterMarker.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const structuredData = JSON.parse(afterMarker.slice(jsonStart, jsonEnd + 1));
          return NextResponse.json({ text: textBefore, structuredData, ready: true });
        }
      } catch { /* fall through */ }
    }

    // Parse WIDGET marker (last line of response)
    let widget: string | undefined;
    let displayText = fullResponse;
    const widgetMatch = fullResponse.match(/\[WIDGET:(\w+)\]\s*$/);
    if (widgetMatch) {
      widget = widgetMatch[1];
      displayText = fullResponse.slice(0, fullResponse.lastIndexOf(widgetMatch[0])).trim();
    }

    return NextResponse.json({ text: displayText, widget, ready: false });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
