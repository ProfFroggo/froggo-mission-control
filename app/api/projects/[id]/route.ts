import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const members = db.prepare(`
      SELECT pm.*, a.name AS agentName, a.emoji AS agentEmoji
      FROM project_members pm
      LEFT JOIN agents a ON a.id = pm.agentId
      WHERE pm.projectId = ?
      ORDER BY pm.addedAt ASC
    `).all(id);

    const taskCounts = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
        SUM(CASE WHEN status IN ('in-progress','internal-review','review','human-review') THEN 1 ELSE 0 END) AS inProgress,
        SUM(CASE WHEN status IN ('todo','blocked') THEN 1 ELSE 0 END) AS todo
      FROM tasks WHERE project_id = ?
    `).get(id);

    return NextResponse.json({ ...project as object, members, taskCounts });
  } catch (error) {
    console.error('GET /api/projects/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/projects/:id
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const body = await request.json();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowed = ['name', 'description', 'emoji', 'color', 'goal', 'status'];
    const updates: string[] = [];
    const values: unknown[] = [];

    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.push('updatedAt = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/projects/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/:id — archives the project
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare(`UPDATE projects SET status = 'archived', updatedAt = ? WHERE id = ?`).run(Date.now(), id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/projects/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
