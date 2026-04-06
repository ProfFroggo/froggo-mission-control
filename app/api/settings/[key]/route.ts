// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { KEYCHAIN_KEYS, keychainGet, keychainSet, keychainDelete } from '@/lib/keychain';

// Sensitive keys that must not be returned in full via GET.
// Values are masked to confirm presence without exposing the secret.
const SENSITIVE_KEY_PATTERNS = [
  '_api_key', '_api_secret', '_secret', '_token', '_bearer',
  '_password', '_credential', '_private_key',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(p => lower.includes(p));
}

function maskValue(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return '••••••••';
  return value.slice(0, 4) + '••••' + value.slice(-4);
}

// Keys that agents/system can write but must not be writable via arbitrary POST.
// These control security-critical behavior.
const PROTECTED_WRITE_KEYS = new Set([
  'security.disallowedTools',
  'security.keys',
]);

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
        // Mask sensitive values — return presence confirmation, not the secret
        if (isSensitiveKey(key)) {
          return NextResponse.json({ key, value: maskValue(keychainValue), masked: true, hasValue: true });
        }
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

    // Mask sensitive values
    if (isSensitiveKey(key) && value) {
      return NextResponse.json({ key, value: maskValue(value), masked: true, hasValue: true });
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

    // Block writes to security-critical keys via the API
    if (PROTECTED_WRITE_KEYS.has(key)) {
      return NextResponse.json({ error: 'This setting cannot be modified via API' }, { status: 403 });
    }

    const value = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);

    // ALWAYS save to DB (reliable). Also try keychain as secondary store.
    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `).run(key, value);

    // Try keychain too (best-effort, non-blocking)
    if (KEYCHAIN_KEYS.has(key)) {
      await keychainSet(key, value).catch(err => console.warn('[settings/[key]] Non-critical:', err));
    }

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
