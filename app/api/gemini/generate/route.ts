// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/gemini/generate — Server-side proxy for general Gemini generateContent calls.
// Keeps the Gemini API key on the server; clients send prompt content only.
// Fixes F-02: Gemini API key browser exposure.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 200_000; // ~200K chars

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
    const body = await req.json();
    const { contents, generationConfig, model } = body as {
      contents?: unknown;
      generationConfig?: Record<string, unknown>;
      model?: string;
    };

    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return NextResponse.json({ error: 'contents array is required' }, { status: 400 });
    }

    // Basic size check on serialized content
    const serialized = JSON.stringify(contents);
    if (serialized.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content too large (${serialized.length} chars). Maximum is ${MAX_CONTENT_LENGTH}.` },
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

    const geminiModel = model || 'gemini-2.0-flash';

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          ...(generationConfig ? { generationConfig } : {}),
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[gemini/generate] Gemini API error:', res.status, errBody.slice(0, 200));
      return NextResponse.json(
        { error: `Gemini API error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gemini/generate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
