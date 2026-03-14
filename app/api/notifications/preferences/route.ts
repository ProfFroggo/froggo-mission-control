// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET  /api/notifications/preferences
// PATCH /api/notifications/preferences

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

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM notification_preferences').all() as Array<{
      type: string;
      email: number;
      inApp: number;
    }>;

    const byType = Object.fromEntries(rows.map(r => [r.type, { email: r.email === 1, inApp: r.inApp === 1 }]));

    const preferences: Record<string, { email: boolean; inApp: boolean }> = {};
    for (const t of NOTIFICATION_TYPES) {
      preferences[t] = byType[t] ?? { email: true, inApp: true };
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('GET /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { type, email, inApp } = body as { type: string; email?: boolean; inApp?: boolean };

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const existing = db.prepare('SELECT * FROM notification_preferences WHERE type = ?').get(type) as
      | { email: number; inApp: number }
      | undefined;

    const now = new Date().toISOString();
    const newEmail = email !== undefined ? (email ? 1 : 0) : (existing?.email ?? 1);
    const newInApp = inApp !== undefined ? (inApp ? 1 : 0) : (existing?.inApp ?? 1);

    if (existing) {
      db.prepare(
        'UPDATE notification_preferences SET email = ?, inApp = ?, updatedAt = ? WHERE type = ?'
      ).run(newEmail, newInApp, now, type);
    } else {
      db.prepare(
        'INSERT INTO notification_preferences (type, email, inApp, updatedAt) VALUES (?, ?, ?, ?)'
      ).run(type, newEmail, newInApp, now);
    }

    return NextResponse.json({ type, email: newEmail === 1, inApp: newInApp === 1 });
  } catch (error) {
    console.error('PATCH /api/notifications/preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
