// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { executeAutomation } from '@/lib/automationExecutor';
import { ApiError, handleApiError } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/automations/[id]/run — trigger a manual run of an automation
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      throw new ApiError(400, 'Automation id is required', 'MISSING_ID');
    }
    const body = await request.json().catch(() => ({}));
    const result = await executeAutomation(id, body.payload);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (err) {
    console.error(`POST /api/automations run error:`, err);
    return handleApiError(err);
  }
}

// GET /api/automations/[id]/run — return run history for this automation
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      throw new ApiError(400, 'Automation id is required', 'MISSING_ID');
    }
    const { getDb } = await import('@/lib/database');
    const db = getDb();
    const runs = db.prepare('SELECT * FROM automation_runs WHERE automationId = ? ORDER BY startedAt DESC LIMIT 20').all(id);
    return NextResponse.json(runs);
  } catch (error) {
    console.error(`GET /api/automations/run error:`, error);
    return handleApiError(error);
  }
}
