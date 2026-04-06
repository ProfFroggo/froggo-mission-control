// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/gemini/live-token — Returns Gemini API key for authenticated WebSocket connections.
// Used by GeminiLiveService for real-time voice — requires auth, returns key server-side.
// Fixes F-02: removes getGeminiApiKey() from client components.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/** Get Gemini API key from keychain or env — never stored client-side */
async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch (err) { console.warn('[gemini/live-token] Non-critical: keychain unavailable:', err); }
  return process.env.GEMINI_API_KEY ?? null;
}

export async function GET(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;

  const apiKey = await getGeminiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key not configured. Add it in Settings > API Keys.' },
      { status: 503 }
    );
  }

  // Return key with cache-busting headers — should not be cached
  return NextResponse.json(
    { apiKey },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    }
  );
}
