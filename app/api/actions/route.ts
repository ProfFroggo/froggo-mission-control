import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

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

// POST /api/actions — create a new pending action + matching approval record
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

    const actionId = randomUUID();
    const approvalId = randomUUID();
    const now = Date.now();
    const category = scheduledFor ? 'scheduled_action' : 'executable_action';
    const content = buildContent(type, payload);

    // Insert pending_action
    db.prepare(`
      INSERT INTO pending_actions (id, type, agentId, description, payload, executor, status, scheduledFor, approvalId, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(actionId, type, agentId ?? null, description ?? null, JSON.stringify(payload), executor, scheduledFor ?? null, approvalId, now, now);

    // Insert approval record (same queue, same UI)
    const meta = { ...payload, actionRef: actionId, executor, scheduledFor: scheduledFor ?? null };
    db.prepare(`
      INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, category, actionRef, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 3, ?, ?, ?)
    `).run(
      approvalId, type,
      description || `${type.replace(/_/g, ' ')} action`,
      content,
      null,
      JSON.stringify(meta),
      agentId ?? null,
      category,
      actionId,
      now
    );

    const action = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(actionId) as Record<string, unknown>;
    return NextResponse.json({
      ...action,
      payload: (() => { try { return JSON.parse(action.payload as string || '{}'); } catch { return {}; } })(),
      approvalId,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/actions error:', error);
    return NextResponse.json({ error: 'Failed to create action' }, { status: 500 });
  }
}
