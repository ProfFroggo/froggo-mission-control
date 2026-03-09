// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];

    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Body must be a key/value object' }, { status: 400 });
    }

    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    const upsertAll = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });

    upsertAll(Object.entries(body) as [string, string][]);
    return NextResponse.json({ success: true, updated: Object.keys(body).length });
  } catch (error) {
    console.error('PATCH /api/settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
