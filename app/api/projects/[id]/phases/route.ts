// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const db = getDb();
    const phases = db.prepare(
      'SELECT * FROM project_phases WHERE projectId = ? ORDER BY "order" ASC'
    ).all(projectId);
    return NextResponse.json(phases);
  } catch (err) {
    console.error('[project-phases GET]', err);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const db = getDb();
    const body = await request.json();
    const { title, description, assignedTo, status } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const id = `phase-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    // Auto-determine order
    const maxOrder = (db.prepare(
      'SELECT MAX("order") as mx FROM project_phases WHERE projectId = ?'
    ).get(projectId) as { mx: number | null } | undefined)?.mx ?? -1;

    db.prepare(`
      INSERT INTO project_phases (id, projectId, title, description, status, assignedTo, "order", createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, projectId, title, description || null, status || 'planned', assignedTo || null, maxOrder + 1, now, now);

    const phase = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(id);
    return NextResponse.json(phase, { status: 201 });
  } catch (err) {
    console.error('[project-phases POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const phaseId = searchParams.get('phaseId');
  if (!phaseId) return NextResponse.json({ error: 'Missing phaseId' }, { status: 400 });

  try {
    const db = getDb();
    const body = await request.json();
    const now = Date.now();

    const fields: string[] = [];
    const values: unknown[] = [];

    for (const key of ['title', 'description', 'status', 'assignedTo', 'order']) {
      if (key in body) {
        fields.push(`"${key}" = ?`);
        values.push(body[key]);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(phaseId);

    db.prepare(`UPDATE project_phases SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const phase = db.prepare('SELECT * FROM project_phases WHERE id = ?').get(phaseId);
    if (!phase) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(phase);
  } catch (err) {
    console.error('[project-phases PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
