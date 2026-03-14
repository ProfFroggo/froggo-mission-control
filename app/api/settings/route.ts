// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// GET /api/settings                        — returns all settings as { [key]: value }
// GET /api/settings?key=some.key           — returns { key, value } for a single key
// GET /api/settings?namespace=automation   — returns all automation.* settings as { [key]: value }
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const key = searchParams.get('key');
    if (key) {
      const row = db.prepare('SELECT key, value FROM settings WHERE key = ?').get(key) as
        | { key: string; value: string }
        | undefined;
      const parsed = row ? tryParseJson(row.value) : null;
      return NextResponse.json({ key, value: parsed });
    }

    const namespace = searchParams.get('namespace');
    let rows: { key: string; value: string }[];
    if (namespace) {
      rows = db
        .prepare('SELECT key, value FROM settings WHERE key LIKE ?')
        .all(`${namespace}.%`) as { key: string; value: string }[];
    } else {
      rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    }

    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      settings[row.key] = tryParseJson(row.value);
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/settings — body: { [key]: value, ... } — upsert multiple settings
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (typeof body !== 'object' || Array.isArray(body) || body === null) {
      return NextResponse.json({ error: 'Body must be a key/value object' }, { status: 400 });
    }

    const entries = Object.entries(body) as [string, unknown][];
    if (entries.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const now = Date.now();
    const getOld = db.prepare('SELECT value FROM settings WHERE key = ?');
    const upsert = db.prepare(
      `INSERT INTO settings (key, value, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
    );
    const auditStmt = db.prepare(
      `INSERT INTO settings_audit (key, oldValue, newValue, changedBy, timestamp) VALUES (?, ?, ?, 'api', ?)`
    );

    const applyAll = db.transaction(() => {
      for (const [key, val] of entries) {
        const serialized = typeof val === 'string' ? val : JSON.stringify(val);
        const oldRow = getOld.get(key) as { value: string } | undefined;
        upsert.run(key, serialized, now);
        try {
          auditStmt.run(key, oldRow?.value ?? null, serialized, now);
        } catch {
          // audit is best-effort — do not fail the write
        }
      }
    });

    applyAll();

    return NextResponse.json({ success: true, updated: entries.length });
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
