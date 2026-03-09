// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { KEYCHAIN_KEYS, keychainGet, keychainSet, keychainDelete } from '@/lib/keychain';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;

    // For sensitive keys, try keychain first
    if (KEYCHAIN_KEYS.has(key)) {
      const keychainValue = await keychainGet(key);
      if (keychainValue !== null) {
        return NextResponse.json({ key, value: keychainValue });
      }
    }

    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;

    // Fall back to env vars for known keys if not in DB
    let value = row?.value ?? null;
    if (!value && key === 'gemini_api_key') {
      value = process.env.GEMINI_API_KEY ?? null;
    }
    if (!value && key === 'anthropic_api_key') {
      value = process.env.ANTHROPIC_API_KEY ?? null;
    }
    return NextResponse.json({ key, value });
  } catch (error) {
    console.error('GET /api/settings/[key] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();
    const body = await request.json();

    if (body.value === undefined) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);

    // For sensitive keys, save to keychain and remove from DB
    if (KEYCHAIN_KEYS.has(key)) {
      const saved = await keychainSet(key, value);
      if (saved) {
        // Remove from DB if it was previously stored there
        db.prepare('DELETE FROM settings WHERE key = ?').run(key);
        return NextResponse.json({ key, value });
      }
      // Fall through to DB storage if keychain unavailable
    }

    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `).run(key, value);

    return NextResponse.json({ key, value });
  } catch (error) {
    console.error('PUT /api/settings/[key] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();

    if (KEYCHAIN_KEYS.has(key)) {
      await keychainDelete(key);
    }

    // Always attempt DB delete too (in case it was stored there before migration)
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);

    return NextResponse.json({ key, deleted: true });
  } catch (error) {
    console.error('DELETE /api/settings/[key] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
