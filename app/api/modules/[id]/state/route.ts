// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: module_id } = await params;
    const db = getDb();
    const body = await request.json();

    const enabled = body.enabled !== false ? 1 : 0;
    const last_toggled = Date.now();

    db.prepare(`
      INSERT INTO module_state (module_id, enabled, last_toggled)
      VALUES (?, ?, ?)
      ON CONFLICT (module_id) DO UPDATE SET
        enabled = excluded.enabled,
        last_toggled = excluded.last_toggled
    `).run(module_id, enabled, last_toggled);

    return NextResponse.json({ module_id, enabled: enabled === 1, last_toggled });
  } catch (error) {
    console.error('PATCH /api/modules/[id]/state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
