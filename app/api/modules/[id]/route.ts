// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

type ModuleRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  spec: string;
  conversationState: string;
  overallProgress: number;
  createdAt: number;
  updatedAt: number;
};

function parseRow(row: ModuleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    spec: (() => { try { return JSON.parse(row.spec || '{}'); } catch { return {}; } })(),
    conversationState: (() => { try { return JSON.parse(row.conversationState || '{}'); } catch { return {}; } })(),
    overallProgress: row.overallProgress,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /api/modules/:id — load a single module draft
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM modules_builder WHERE id = ?').get(id) as ModuleRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseRow(row));
  } catch (error) {
    console.error('GET /api/modules/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/modules/:id — auto-save / full update
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM modules_builder WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const now = Date.now();

    const updates: string[] = ['updatedAt = ?'];
    const values: unknown[] = [now];

    if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
    if (body.description !== undefined) { updates.push('description = ?'); values.push(body.description); }
    if (body.category !== undefined) { updates.push('category = ?'); values.push(body.category); }
    if (body.status !== undefined) { updates.push('status = ?'); values.push(body.status); }
    if (body.spec !== undefined) { updates.push('spec = ?'); values.push(JSON.stringify(body.spec)); }
    if (body.conversationState !== undefined) { updates.push('conversationState = ?'); values.push(JSON.stringify(body.conversationState)); }
    if (body.overallProgress !== undefined) { updates.push('overallProgress = ?'); values.push(body.overallProgress); }

    values.push(id);
    db.prepare(`UPDATE modules_builder SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM modules_builder WHERE id = ?').get(id) as ModuleRow;
    return NextResponse.json(parseRow(row));
  } catch (error) {
    console.error('PUT /api/modules/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/modules/:id — delete a module draft
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const existing = db.prepare('SELECT id FROM modules_builder WHERE id = ?').get(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    db.prepare('DELETE FROM modules_builder WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/modules/:id error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
