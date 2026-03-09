// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT module_id, enabled FROM module_state').all() as { module_id: string; enabled: number }[];

    const state: Record<string, boolean> = {};
    for (const row of rows) {
      state[row.module_id] = row.enabled === 1;
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error('GET /api/modules/state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
