// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/gemini/tts — Server-side proxy for Gemini text-to-speech (Chirp 3).
// Keeps the Gemini API key on the server; clients send text + voiceName only.
// Fixes F-02: Gemini API key browser exposure.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Get Gemini API key from keychain or env — never sent to client */
async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch (err) { console.warn('[gemini/tts] Non-critical: keychain unavailable:', err); }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { text, voiceName } = body as { text?: string; voiceName?: string };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }
    if (!voiceName) {
      return NextResponse.json({ error: 'voiceName is required' }, { status: 400 });
    }

    const apiKey = await getGeminiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured. Add it in Settings > API Keys.' },
        { status: 503 }
      );
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }], role: 'user' }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[gemini/tts] Gemini API error:', res.status, errBody.slice(0, 200));
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini/tts] Error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
