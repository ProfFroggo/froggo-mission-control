// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_completed',
  'approval_needed',
  'approval_resolved',
  'agent_alert',
  'system_info',
  'mention',
] as const;

const DEFAULT_PREFS = NOTIFICATION_TYPES.map(type => ({
  type,
  email: 1,
  inApp: 1,
}));

// GET /api/notifications/preferences
export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT type, email, inApp FROM notification_preferences').all() as Array<{
      type: string;
      email: number;
      inApp: number;
    }>;

    const rowMap = new Map(rows.map(r => [r.type, r]));

    const prefs = DEFAULT_PREFS.map(def => {
      const saved = rowMap.get(def.type);
      return {
        type: def.type,
        email: saved ? Boolean(saved.email) : true,
        inApp: saved ? Boolean(saved.inApp) : true,
      };
    });

    return NextResponse.json({ preferences: prefs });
  } catch (error) {
    console.error('GET /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/notifications/preferences
// Body: { type: string, email?: boolean, inApp?: boolean }
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { type, email, inApp } = body as { type: string; email?: boolean; inApp?: boolean };

    if (!type || !(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
      return NextResponse.json({ error: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}` }, { status: 400 });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notification_preferences (type, email, inApp, updatedAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(type) DO UPDATE SET
        email = COALESCE(excluded.email, email),
        inApp = COALESCE(excluded.inApp, inApp),
        updatedAt = excluded.updatedAt
    `).run(
      type,
      email !== undefined ? (email ? 1 : 0) : 1,
      inApp !== undefined ? (inApp ? 1 : 0) : 1,
      now
    );

    const updated = db.prepare('SELECT type, email, inApp FROM notification_preferences WHERE type = ?').get(type) as {
      type: string;
      email: number;
      inApp: number;
    };

    return NextResponse.json({
      type: updated.type,
      email: Boolean(updated.email),
      inApp: Boolean(updated.inApp),
    });
  } catch (error) {
    console.error('PATCH /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
