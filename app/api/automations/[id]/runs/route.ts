// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { handleApiError } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';

// Ensure automation_runs table has stepResults and duration columns
function ensureColumns(db: ReturnType<typeof getDb>) {
  try {
    db.exec(`ALTER TABLE automation_runs ADD COLUMN stepResults TEXT DEFAULT '[]'`);
  } catch (err) { console.warn('[automations/[id]/runs] Non-critical: column already exists:', err); }
  try {
    db.exec(`ALTER TABLE automation_runs ADD COLUMN duration INTEGER`);
  } catch (err) { console.warn('[automations/[id]/runs] Non-critical: column already exists:', err); }
  try {
    db.exec(`ALTER TABLE automation_runs ADD COLUMN triggeredBy TEXT DEFAULT 'manual'`);
  } catch (err) { console.warn('[automations/[id]/runs] Non-critical: column already exists:', err); }
}

// GET /api/automations/[id]/runs?limit=20
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureColumns(db);

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const rows = db
      .prepare(
        `SELECT * FROM automation_runs
         WHERE automationId = ?
         ORDER BY startedAt DESC
         LIMIT ?`
      )
      .all(id, limit) as Record<string, unknown>[];

    const runs = rows.map((row) => ({
      id: row.id,
      automationId: row.automationId,
      status: row.status,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? null,
      duration: row.duration ?? null,
      stepsRun: row.stepsRun ?? 0,
      triggeredBy: row.triggeredBy ?? 'manual',
      stepResults: (() => {
        try {
          return JSON.parse((row.stepResults as string) ?? '[]');
        } catch (err) {
          console.warn('[automations/[id]/runs] Non-critical:', err);
          return [];
        }
      })(),
    }));

    return NextResponse.json({ runs });
  } catch (err) {
    console.error(`GET /api/automations/runs error:`, err);
    return handleApiError(err);
  }
}
