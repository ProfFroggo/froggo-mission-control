import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;

    // Fall back to env vars for known keys if not in DB
    let value = row?.value ?? null;
    if (!value && key === 'gemini_api_key') {
      value = process.env.GEMINI_API_KEY ?? null;
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
