// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

import { createNotification } from '@/lib/notificationWriter';

function parseApproval(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.metadata === 'string') {
    try { parsed.metadata = JSON.parse(parsed.metadata as string); } catch { parsed.metadata = {}; }
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) { conditions.push('status = ?'); values.push(status); }
    if (category) { conditions.push('(category = ? OR (category IS NULL AND ? = \'agent_approval\'))'); values.push(category, category); }

    let sql = 'SELECT * FROM approvals';
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY createdAt DESC';

    const rows = db.prepare(sql).all(...values) as Record<string, unknown>[];
    return NextResponse.json(rows.map(parseApproval));
  } catch (error) {
    console.error('GET /api/approvals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


// PATCH /api/approvals — batch approve or reject
// Body: { ids: string[], action: 'approve' | 'reject', reason?: string }
export async function PATCH(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { ids, action, reason } = body as { ids: string[]; action: 'approve' | 'reject'; reason?: string };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    const respondedAt = Date.now();
    const notes = reason ?? null;

    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT id FROM approvals WHERE id IN (${placeholders}) AND status = 'pending'`
    ).all(...ids) as { id: string }[];

    const validIds = rows.map(r => r.id);
    if (validIds.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const updatePlaceholders = validIds.map(() => '?').join(',');
    db.prepare(
      `UPDATE approvals SET status = ?, respondedAt = ?, notes = ? WHERE id IN (${updatePlaceholders})`
    ).run(status, respondedAt, notes, ...validIds);

    // Emit approval_resolved notifications
    try {
      const resolvedRows = db.prepare(
        `SELECT id, title, requester FROM approvals WHERE id IN (${updatePlaceholders})`
      ).all(...validIds) as Array<{ id: string; title: string; requester: string | null }>;
      for (const row of resolvedRows) {
        createNotification({
          type: 'approval_resolved',
          title: `Approval ${status}: ${row.title}`,
          userId: row.requester ?? undefined,
          metadata: { approvalId: row.id, action, status },
        }).catch(() => {});
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ updated: validIds.length });
  } catch (error) {
    console.error('PATCH /api/approvals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const id = randomUUID();
    const now = Date.now();
    const { type, title, content, context, metadata = {}, requester, tier = 3, category = 'agent_approval', actionRef } = body;

    db.prepare(`
      INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, category, actionRef, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(id, type, title, content, context ?? null, JSON.stringify(metadata), requester ?? null, tier, category, actionRef ?? null, now);

    const approval = db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseApproval(approval), { status: 201 });
  } catch (error) {
    console.error('POST /api/approvals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
