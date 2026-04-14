// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/setup/validate-gemini — Onboarding-safe Gemini key validation.
// No auth required — called from the wizard before INTERNAL_API_TOKEN is configured.
// Saves the key to keychain/DB and validates it with a test request.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const key = typeof body?.key === 'string' ? body.key.trim() : '';

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    // Save key to keychain (best-effort) and settings DB
    try {
      const { keychainSet } = await import('@/lib/keychain');
      await keychainSet('gemini_api_key', key);
    } catch (err) {
      console.warn('[setup/validate-gemini] Non-critical: keychain unavailable:', err);
    }

    // Also persist to settings table so it survives restarts without keychain
    try {
      const { getDb } = await import('@/lib/database');
      const db = getDb();
      db.prepare(
        `INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(key);
    } catch (err) {
      console.warn('[setup/validate-gemini] Non-critical: DB unavailable:', err);
    }

    // Validate by making a minimal test request directly with the provided key
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Reply with OK' }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[setup/validate-gemini] Gemini API rejected key:', res.status, errText.slice(0, 200));
      return NextResponse.json(
        { error: 'Invalid API key — please check and try again' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[setup/validate-gemini] Error:', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
