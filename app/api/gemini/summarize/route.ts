// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/gemini/summarize — Server-side proxy for Gemini meeting summarization.
// Keeps the Gemini API key on the server; clients send transcript text.
// Fixes F-02: Gemini API key browser exposure.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const MAX_TRANSCRIPT_LENGTH = 100_000; // ~100K chars

/** Get Gemini API key from keychain or env — never sent to client */
async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch (err) { console.warn('[gemini/summarize] Non-critical: keychain unavailable:', err); }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { transcript, meetingTitle } = body as {
      transcript?: string;
      meetingTitle?: string;
    };

    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return NextResponse.json({ error: 'transcript text is required' }, { status: 400 });
    }

    if (transcript.length > MAX_TRANSCRIPT_LENGTH) {
      return NextResponse.json(
        { error: `Transcript too long (${transcript.length} chars). Maximum is ${MAX_TRANSCRIPT_LENGTH}.` },
        { status: 413 }
      );
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Add it in Settings > API Keys.' },
        { status: 503 }
      );
    }

    const truncated = transcript.length > 30_000
      ? transcript.slice(0, 30_000) + '\n[truncated]'
      : transcript;

    const titleLine = meetingTitle ? `Meeting: ${meetingTitle}\n` : '';

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a meeting assistant. Analyse this meeting transcript and return a JSON object with:
- summary: 2-3 sentence overview
- actionItems: array of specific tasks/follow-ups identified
- decisions: array of decisions made
- keyDecisions: array of key decisions (same as decisions)
- keyTopics: array of main topics discussed
- participants: array of participant names detected

${titleLine}Transcript:
${truncated}

Return ONLY valid JSON, no markdown.`,
            }],
          }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[gemini/summarize] Gemini API error:', res.status, errBody.slice(0, 200));
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const parsed = JSON.parse(cleaned);
      // Normalize field names — ensure both formats are present
      return NextResponse.json({
        summary: parsed.summary || '',
        actionItems: parsed.actionItems || [],
        decisions: parsed.decisions || parsed.keyDecisions || [],
        keyDecisions: parsed.keyDecisions || parsed.decisions || [],
        keyTopics: parsed.keyTopics || [],
        participants: parsed.participants || [],
      });
    } catch (err) {
      console.warn('[gemini/summarize] Non-critical:', err);
      // Gemini returned non-JSON — return raw text as summary
      return NextResponse.json({
        summary: raw || 'Failed to generate summary',
        actionItems: [],
        decisions: [],
        keyDecisions: [],
        keyTopics: [],
        participants: [],
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini/summarize] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
