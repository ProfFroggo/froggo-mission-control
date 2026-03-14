// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export interface AuditEntry {
  id: number;
  key: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  timestamp: number;
}

// GET /api/settings/audit — returns the 10 most recent settings changes
export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, key, oldValue, newValue, changedBy, timestamp
         FROM settings_audit
         ORDER BY timestamp DESC
         LIMIT 10`
      )
      .all() as AuditEntry[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/settings/audit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
