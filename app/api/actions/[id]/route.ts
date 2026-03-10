// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { spawnSync } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type ActionRow = {
  id: string; type: string; agentId: string | null; description: string | null;
  payload: string; executor: string; status: string; result: string | null;
  scheduledFor: number | null; approvalId: string | null;
  createdAt: number; updatedAt: number;
};

function parseAction(row: ActionRow) {
  return {
    ...row,
    payload: (() => { try { return JSON.parse(row.payload || '{}'); } catch { return {}; } })(),
    result: (() => {
      if (!row.result) return null;
      try { return JSON.parse(row.result); } catch { return row.result; }
    })(),
  };
}

// GET /api/actions/:id — fetch a single pending action
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as ActionRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseAction(row));
  } catch (error) {
    console.error('GET /api/actions/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/actions/:id/execute — fire the executor script
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const row = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as ActionRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!['pending', 'approved'].includes(row.status)) {
      return NextResponse.json({ error: `Cannot execute — action is ${row.status}` }, { status: 409 });
    }

    // Optionally accept an overridden payload (e.g. edited tweet text)
    let payload: Record<string, unknown>;
    try {
      const body = await req.json().catch(() => ({}));
      payload = Object.keys(body).length > 0 ? body : JSON.parse(row.payload || '{}');
    } catch {
      payload = JSON.parse(row.payload || '{}');
    }

    const ALLOWED_EXECUTORS_DIR = path.join(process.cwd(), 'tools', 'executors');
    const executorPath = path.join(ALLOWED_EXECUTORS_DIR, row.executor);
    const resolvedExecutorPath = path.resolve(executorPath);
    if (!resolvedExecutorPath.startsWith(ALLOWED_EXECUTORS_DIR)) {
      return NextResponse.json({ error: 'Invalid executor path' }, { status: 400 });
    }
    if (!existsSync(resolvedExecutorPath)) {
      return NextResponse.json({ error: 'Executor not found' }, { status: 404 });
    }

    const now = Date.now();

    db.prepare('UPDATE pending_actions SET status = ?, updatedAt = ? WHERE id = ?')
      .run('executing', now, id);

    const result = spawnSync('python3', [resolvedExecutorPath, JSON.stringify(payload)], {
      encoding: 'utf-8',
      timeout: 60_000,
      env: { ...process.env },
    });

    const success = result.status === 0 && !result.error;
    let resultData: unknown;
    try {
      resultData = JSON.parse(result.stdout || '{}');
    } catch {
      resultData = { ok: success, output: result.stdout, error: result.stderr };
    }

    const finalStatus = success ? 'completed' : 'failed';
    db.prepare('UPDATE pending_actions SET status = ?, result = ?, updatedAt = ? WHERE id = ?')
      .run(finalStatus, JSON.stringify(resultData), Date.now(), id);

    // Sync approval status
    if (row.approvalId) {
      db.prepare('UPDATE approvals SET status = ?, respondedAt = ? WHERE id = ?')
        .run(success ? 'approved' : 'rejected', Date.now(), row.approvalId);
    }

    // Log to task activity if agentId present
    if (row.agentId) {
      try {
        db.prepare(
          `INSERT INTO task_activity (taskId, agentId, action, message, timestamp)
           VALUES (?, ?, ?, ?, ?)`
        ).run('system', row.agentId, `action_${finalStatus}`,
          `${row.type} action ${finalStatus}: ${row.description || row.id}`, Date.now());
      } catch { /* non-critical */ }
    }

    const updated = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(id) as ActionRow;
    return NextResponse.json({
      ...parseAction(updated),
      executorLog: { stdout: result.stdout, stderr: result.stderr },
    });
  } catch (error) {
    console.error('POST /api/actions/:id/execute error:', error);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}

// Keep ENV import used (resolveClaudeScript used elsewhere — just suppress unused warning)
void ENV;
