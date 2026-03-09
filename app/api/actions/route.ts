// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Executor name → script file mapping
const EXECUTORS: Record<string, string> = {
  post_x:      'post_x.py',
  send_email:  'send_email.py',
  delete_file: 'delete_file.py',
  git_push:    'git_push.py',
};

// Human-readable content snippet per action type
function buildContent(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'post_x':
      return String(payload.text || '');
    case 'send_email':
      return `To: ${payload.to}\nSubject: ${payload.subject}\n\n${payload.body || ''}`;
    case 'delete_file':
      return String(payload.path || '');
    case 'git_push':
      return `Push ${payload.branch || 'main'} → ${payload.remote || 'origin'}\nRepo: ${payload.repo_path || ''}`;
    default:
      return JSON.stringify(payload, null, 2);
  }
}

function getAgentTrustTier(agentId: string | null): string {
  if (!agentId) return 'apprentice';
  try {
    const db = getDb();
    const row = db.prepare('SELECT trust_tier FROM agents WHERE id = ?').get(agentId) as { trust_tier: string } | undefined;
    return row?.trust_tier || 'apprentice';
  } catch { return 'apprentice'; }
}

// GET /api/actions — list pending_actions
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const scheduled = searchParams.get('scheduled');

    let sql = 'SELECT * FROM pending_actions';
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (status) { conditions.push('status = ?'); values.push(status); }
    if (scheduled === 'true') { conditions.push('scheduledFor IS NOT NULL'); }
    if (scheduled === 'false') { conditions.push('scheduledFor IS NULL'); }

    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC';

    const rows = db.prepare(sql).all(...values) as Record<string, unknown>[];
    return NextResponse.json(rows.map(r => ({
      ...r,
      payload: (() => { try { return JSON.parse(r.payload as string || '{}'); } catch { return {}; } })(),
    })));
  } catch (error) {
    console.error('GET /api/actions error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/actions — create a new pending action.
// Admin agents bypass the approval queue and execute immediately.
// All other tiers create an approval record that requires human approval first.
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const { type, agentId, description, payload = {}, scheduledFor } = body;
    if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 });

    const executor = EXECUTORS[type];
    if (!executor) {
      return NextResponse.json({ error: `Unknown action type: ${type}. Valid: ${Object.keys(EXECUTORS).join(', ')}` }, { status: 400 });
    }

    const trustTier = getAgentTrustTier(agentId ?? null);
    const isAdmin = trustTier === 'admin';

    const actionId = randomUUID();
    const now = Date.now();
    const payloadJson = JSON.stringify(payload);
    const content = buildContent(type, payload);

    if (isAdmin && !scheduledFor) {
      // Admin: execute immediately, no approval record needed
      db.prepare(`
        INSERT INTO pending_actions (id, type, agentId, description, payload, executor, status, scheduledFor, approvalId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'executing', NULL, NULL, ?, ?)
      `).run(actionId, type, agentId ?? null, description ?? null, payloadJson, executor, now, now);

      const executorPath = path.join(process.cwd(), 'tools', 'executors', executor);
      const result = spawnSync('python3', [executorPath, payloadJson], {
        encoding: 'utf-8',
        timeout: 60_000,
        env: { ...process.env },
      });

      const success = result.status === 0 && !result.error;
      let resultData: unknown;
      try { resultData = JSON.parse(result.stdout || '{}'); } catch {
        resultData = { ok: success, output: result.stdout, error: result.stderr };
      }

      const finalStatus = success ? 'completed' : 'failed';
      db.prepare('UPDATE pending_actions SET status = ?, result = ?, updatedAt = ? WHERE id = ?')
        .run(finalStatus, JSON.stringify(resultData), Date.now(), actionId);

      const action = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(actionId) as Record<string, unknown>;
      return NextResponse.json({
        ...action,
        payload: payload,
        bypassed: true,
        trustTier: 'admin',
        executed: true,
        result: resultData,
      }, { status: 201 });
    }

    // Non-admin (or scheduled): create approval record for human review
    const approvalId = randomUUID();
    const category = scheduledFor ? 'scheduled_action' : 'executable_action';

    db.prepare(`
      INSERT INTO pending_actions (id, type, agentId, description, payload, executor, status, scheduledFor, approvalId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(actionId, type, agentId ?? null, description ?? null, payloadJson, executor, scheduledFor ?? null, approvalId, now, now);

    const meta = { ...payload, actionRef: actionId, executor, scheduledFor: scheduledFor ?? null };
    db.prepare(`
      INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, category, actionRef, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 3, ?, ?, ?)
    `).run(
      approvalId, type,
      description || `${type.replace(/_/g, ' ')} action`,
      content, null,
      JSON.stringify(meta),
      agentId ?? null,
      category, actionId, now
    );

    const action = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(actionId) as Record<string, unknown>;
    return NextResponse.json({
      ...action,
      payload: payload,
      approvalId,
      bypassed: false,
      trustTier,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/actions error:', error);
    return NextResponse.json({ error: 'Failed to create action' }, { status: 500 });
  }
}
