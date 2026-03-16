// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// /api/social/schedule/[id] — PATCH and DELETE for a single scheduled post

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ApiError, handleApiError } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

// ─── PATCH /api/social/schedule/[id] ────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid JSON body');
    });

    const db = getDb();
    const existing = db.prepare('SELECT * FROM social_schedule WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Post not found');

    const fields: string[] = [];
    const values: unknown[] = [];

    if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
    if (body.scheduledAt !== undefined) { fields.push('scheduledAt = ?'); values.push(body.scheduledAt); }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.agentId !== undefined) { fields.push('agentId = ?'); values.push(body.agentId); }
    if (body.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(body.metadata)); }

    if (fields.length === 0) throw new ApiError(400, 'No fields to update');

    fields.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE social_schedule SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM social_schedule WHERE id = ?').get(id);
    return NextResponse.json({ post: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── DELETE /api/social/schedule/[id] ───────────────────────────────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM social_schedule WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Post not found');

    db.prepare('DELETE FROM social_schedule WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
