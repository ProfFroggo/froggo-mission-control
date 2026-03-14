// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { executeAutomation } from '@/lib/automationExecutor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/automations/[id]/run — trigger a manual run of an automation
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await executeAutomation(params.id, body.payload);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    return NextResponse.json({ success: false, message: String(err) }, { status: 500 });
  }
}

// GET /api/automations/[id]/run — return run history for this automation
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { getDb } = await import('@/lib/database');
    const db = getDb();
    const runs = db.prepare('SELECT * FROM automation_runs WHERE automationId = ? ORDER BY startedAt DESC LIMIT 20').all(params.id);
    return NextResponse.json(runs);
  } catch {
    return NextResponse.json([]);
  }
}
