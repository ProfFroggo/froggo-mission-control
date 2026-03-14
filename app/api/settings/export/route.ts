// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

// GET /api/settings/export — returns all settings as a JSON file download
export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];

    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      version: '1',
      settings,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mission-control-settings-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('GET /api/settings/export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/settings/import — bulk-imports settings
// Body: { settings: Record<string, unknown> }
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = (await request.json()) as { settings?: Record<string, unknown> };

    if (!body.settings || typeof body.settings !== 'object') {
      return NextResponse.json(
        { error: 'Body must be { settings: Record<string, unknown> }' },
        { status: 400 }
      );
    }

    const entries = Object.entries(body.settings);
    if (entries.length === 0) {
      return NextResponse.json({ success: true, imported: 0 });
    }

    const now = Date.now();
    const upsert = db.prepare(
      `INSERT INTO settings (key, value, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
    );

    const applyAll = db.transaction(() => {
      for (const [key, val] of entries) {
        const serialized = typeof val === 'string' ? val : JSON.stringify(val);
        upsert.run(key, serialized, now);
      }
    });

    applyAll();

    return NextResponse.json({ success: true, imported: entries.length });
  } catch (error) {
    console.error('POST /api/settings/import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
