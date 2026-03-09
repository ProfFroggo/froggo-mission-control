// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

// POST /api/setup/permissions-confirm
// Sets a flag in the settings table confirming the user reviewed agent tool permissions.
export async function POST() {
  try {
    const db = getDb();
    const confirmedAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES ('setup_permissions_confirmed', ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value
    `).run(confirmedAt);

    return NextResponse.json({ confirmed: true, confirmedAt });
  } catch (error) {
    console.error('POST /api/setup/permissions-confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'setup_permissions_confirmed'").get() as
      | { value: string }
      | undefined;

    return NextResponse.json({ confirmed: !!row?.value, confirmedAt: row?.value ?? null });
  } catch (error) {
    console.error('GET /api/setup/permissions-confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
