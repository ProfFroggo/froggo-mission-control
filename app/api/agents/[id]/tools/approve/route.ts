// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { sessionToolGrants } from '@/lib/toolPermissions';
import { emitSSEEvent } from '@/lib/sseEmitter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/agents/[id]/tools/approve
 *
 * Body: {
 *   toolName: string;
 *   approvalId: string;
 *   action: 'grant' | 'grant_session' | 'reject';
 *   reason?: string;        // for reject_with_reason
 *   sessionKey?: string;    // for session-scoped grants
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { toolName, approvalId, action, reason, sessionKey } = await request.json();

  if (!toolName || !approvalId || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = getDb();

  if (action === 'grant' || action === 'grant_session') {
    if (action === 'grant') {
      // Permanently add to agent's granted tools in settings
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(`agent.${id}.grantedTools`) as { value: string } | undefined;
      let current: string[] = [];
      if (row?.value) { try { current = JSON.parse(row.value); } catch { /* ignore */ } }
      if (!current.includes(toolName)) {
        current.push(toolName);
        db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
          .run(`agent.${id}.grantedTools`, JSON.stringify(current));
      }
    } else {
      // Session-scoped grant — stored in memory
      const key = sessionKey ?? id;
      if (!sessionToolGrants.has(key)) sessionToolGrants.set(key, new Set());
      sessionToolGrants.get(key)!.add(toolName);
    }

    // Update approval record to approved
    const existingApproval = db.prepare('SELECT metadata FROM approvals WHERE id = ?').get(approvalId) as { metadata: string } | undefined;
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(existingApproval?.metadata ?? '{}'); } catch { /* ignore */ }
    meta.resolvedAt = Date.now(); meta.resolvedBy = 'user'; meta.action = action;
    db.prepare(`UPDATE approvals SET status = 'approved', metadata = ? WHERE id = ?`)
      .run(JSON.stringify(meta), approvalId);

    emitSSEEvent('tool.granted', { agentId: id, toolName, scope: action === 'grant' ? 'permanent' : 'session', approvalId });
    return NextResponse.json({ ok: true, granted: true, scope: action === 'grant' ? 'permanent' : 'session' });
  }

  if (action === 'reject' || action === 'reject_reason') {
    const existingRej = db.prepare('SELECT metadata FROM approvals WHERE id = ?').get(approvalId) as { metadata: string } | undefined;
    let rejMeta: Record<string, unknown> = {};
    try { rejMeta = JSON.parse(existingRej?.metadata ?? '{}'); } catch { /* ignore */ }
    rejMeta.resolvedAt = Date.now(); rejMeta.resolvedBy = 'user'; rejMeta.action = action; rejMeta.reason = reason ?? null;
    db.prepare(`UPDATE approvals SET status = 'rejected', metadata = ? WHERE id = ?`)
      .run(JSON.stringify(rejMeta), approvalId);

    emitSSEEvent('tool.rejected', { agentId: id, toolName, approvalId, reason: reason ?? null });
    return NextResponse.json({ ok: true, granted: false });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
