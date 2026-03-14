// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id/milestones
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const milestones = db.prepare(
      'SELECT * FROM project_milestones WHERE projectId = ? ORDER BY createdAt ASC'
    ).all(id);

    return NextResponse.json(milestones);
  } catch (error) {
    console.error('GET /api/projects/:id/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects/:id/milestones
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    const { title, dueDate } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const milestoneId = `ms-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    db.prepare(
      'INSERT INTO project_milestones (id, projectId, title, dueDate, completed, createdAt) VALUES (?, ?, ?, ?, 0, ?)'
    ).run(milestoneId, id, title.trim(), dueDate ?? null, now);

    const milestone = db.prepare('SELECT * FROM project_milestones WHERE id = ?').get(milestoneId);
    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/:id/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/:id/milestones — update a single milestone by milestoneId in body
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();
    const { milestoneId, title, dueDate, completed } = body;

    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 });
    }

    const existing = db.prepare(
      'SELECT * FROM project_milestones WHERE id = ? AND projectId = ?'
    ).get(milestoneId, id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updates: string[] = [];
    const values: unknown[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (dueDate !== undefined) { updates.push('dueDate = ?'); values.push(dueDate); }
    if (completed !== undefined) {
      updates.push('completed = ?');
      values.push(completed ? 1 : 0);
      updates.push('completedAt = ?');
      values.push(completed ? Date.now() : null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(milestoneId);
    db.prepare(`UPDATE project_milestones SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM project_milestones WHERE id = ?').get(milestoneId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/:id/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/:id/milestones?milestoneId=...
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const milestoneId = searchParams.get('milestoneId');

    if (!milestoneId) {
      return NextResponse.json({ error: 'milestoneId query param is required' }, { status: 400 });
    }

    const existing = db.prepare(
      'SELECT * FROM project_milestones WHERE id = ? AND projectId = ?'
    ).get(milestoneId, id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare('DELETE FROM project_milestones WHERE id = ?').run(milestoneId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/:id/milestones error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
