// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/stt/token — Generate a single-use ElevenLabs token for real-time STT.
// Keeps the ElevenLabs API key server-side; clients get a short-lived scoped token.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

async function getElevenLabsKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('elevenlabs_api_key');
    if (val) return val;
  } catch (err) { console.warn('[stt/token] Non-critical: keychain unavailable:', err); }
  return process.env.ELEVENLABS_API_KEY ?? null;
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const apiKey = await getElevenLabsKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured. Add it in Settings > API Keys.' },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[stt/token] ElevenLabs error:', res.status, errBody.slice(0, 200));
      return NextResponse.json(
        { error: `ElevenLabs token error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stt/token] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
