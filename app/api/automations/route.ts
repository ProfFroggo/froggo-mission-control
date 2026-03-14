// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseAutomation(a: Record<string, unknown>): Record<string, unknown> {
  return {
    ...a,
    trigger_config: (() => { try { return JSON.parse(a.trigger_config as string); } catch { return {}; } })(),
    steps: (() => { try { return JSON.parse(a.steps as string); } catch { return []; } })(),
  };
}

// GET /api/automations — list all automations
export async function GET(_req: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM automations ORDER BY updated_at DESC').all() as Record<string, unknown>[];
    const automations = rows.map(parseAutomation);
    return NextResponse.json(automations);
  } catch (error) {
    console.error('GET /api/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/automations — create automation
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const {
      name,
      description = '',
      status = 'draft',
      trigger_type = 'manual',
      trigger_config = {},
      steps = [],
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
    }

    const now = Date.now();
    const id = `auto-${now}-${Math.random().toString(36).slice(2, 7)}`;

    db.prepare(`
      INSERT INTO automations (id, name, description, status, trigger_type, trigger_config, steps, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      description,
      status,
      trigger_type,
      JSON.stringify(trigger_config),
      JSON.stringify(steps),
      now,
      now,
    );

    const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseAutomation(row), { status: 201 });
  } catch (error) {
    console.error('POST /api/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/automations?id=... — update automation
export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const now = Date.now();

    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined)           { fields.push('name = ?');           params.push(body.name); }
    if (body.description !== undefined)    { fields.push('description = ?');    params.push(body.description); }
    if (body.status !== undefined)         { fields.push('status = ?');         params.push(body.status); }
    if (body.trigger_type !== undefined)   { fields.push('trigger_type = ?');   params.push(body.trigger_type); }
    if (body.trigger_config !== undefined) { fields.push('trigger_config = ?'); params.push(JSON.stringify(body.trigger_config)); }
    if (body.steps !== undefined)          { fields.push('steps = ?');          params.push(JSON.stringify(body.steps)); }
    if (body.last_run !== undefined)       { fields.push('last_run = ?');       params.push(body.last_run); }
    if (body.next_run !== undefined)       { fields.push('next_run = ?');       params.push(body.next_run); }

    fields.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(parseAutomation(row));
  } catch (error) {
    console.error('PATCH /api/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/automations?id=... — delete automation
export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    db.prepare('DELETE FROM automations WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/automations error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
