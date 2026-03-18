// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/gemini/transcribe — Server-side proxy for Gemini audio transcription.
// Keeps the Gemini API key on the server; clients send audio via FormData.
// Fixes F-02: Gemini API key browser exposure.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

/** Get Gemini API key from keychain or env — never sent to client */
async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* keychain unavailable */ }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const mimeType = (formData.get('mimeType') as string) || 'audio/webm';

    if (!audioFile) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return NextResponse.json(
        { error: `Audio file too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Maximum is 25MB.` },
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

    // Convert audio to base64 for Gemini inline data
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType, data: base64 } },
              {
                text: 'Transcribe this audio accurately. Include speaker labels if multiple speakers are detected. Format as a clean transcript with timestamps where possible.',
              },
            ],
          }],
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[gemini/transcribe] Gemini API error:', res.status, errBody.slice(0, 200));
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return NextResponse.json({ transcript });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini/transcribe] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
