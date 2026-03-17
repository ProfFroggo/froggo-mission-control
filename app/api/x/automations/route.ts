// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// CRUD for social media automations — stored in x_automations table
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

function parseRow(row: any) {
  if (!row) return row;
  return {
    ...row,
    enabled: !!row.enabled,
    trigger_config: row.trigger_config ? JSON.parse(row.trigger_config) : {},
    conditions: row.conditions ? JSON.parse(row.conditions) : null,
    actions: row.actions ? JSON.parse(row.actions) : [],
  };
}

// GET — list all automations + recent execution log
export async function GET() {
  try {
    const db = getDb();
    const automations = db.prepare('SELECT * FROM x_automations ORDER BY created_at DESC').all() as any[];
    const recentLogs = db.prepare('SELECT * FROM x_automation_log ORDER BY executed_at DESC LIMIT 50').all() as any[];

    return NextResponse.json({
      automations: automations.map(parseRow),
      recentLogs: recentLogs.map((l: any) => ({
        ...l,
        trigger_data: l.trigger_data ? JSON.parse(l.trigger_data) : {},
        actions_taken: l.actions_taken ? JSON.parse(l.actions_taken) : [],
        approval_ids: l.approval_ids ? JSON.parse(l.approval_ids) : [],
      })),
    });
  } catch (error) {
    console.error('GET /api/x/automations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — create a new automation
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = `xa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO x_automations (id, name, description, enabled, trigger_type, trigger_config, conditions, actions, ai_engine, max_per_hour, max_per_day, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name || 'Untitled Automation',
      body.description || '',
      body.enabled !== false ? 1 : 0,
      body.trigger_type || 'mention',
      JSON.stringify(body.trigger_config || {}),
      body.conditions ? JSON.stringify(body.conditions) : null,
      JSON.stringify(body.actions || []),
      body.ai_engine || 'gemini',
      body.max_per_hour ?? 5,
      body.max_per_day ?? 20,
      now, now,
    );

    const created = db.prepare('SELECT * FROM x_automations WHERE id = ?').get(id);
    return NextResponse.json(parseRow(created), { status: 201 });
  } catch (error) {
    console.error('POST /api/x/automations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — update an automation (toggle enabled, edit config, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed: Record<string, (v: any) => any> = {
      name: (v) => v,
      description: (v) => v,
      enabled: (v) => v ? 1 : 0,
      trigger_type: (v) => v,
      trigger_config: (v) => JSON.stringify(v),
      conditions: (v) => v ? JSON.stringify(v) : null,
      actions: (v) => JSON.stringify(v),
      ai_engine: (v) => v,
      max_per_hour: (v) => v,
      max_per_day: (v) => v,
    };

    const sets: string[] = ['updated_at = ?'];
    const vals: any[] = [Date.now()];

    for (const [field, transform] of Object.entries(allowed)) {
      if (field in updates) {
        sets.push(`${field} = ?`);
        vals.push(transform(updates[field]));
      }
    }

    vals.push(id);
    const result = db.prepare(`UPDATE x_automations SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    if (result.changes === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updated = db.prepare('SELECT * FROM x_automations WHERE id = ?').get(id);
    return NextResponse.json(parseRow(updated));
  } catch (error) {
    console.error('PATCH /api/x/automations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — remove an automation
export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    db.prepare('DELETE FROM x_automations WHERE id = ?').run(id);
    db.prepare('DELETE FROM x_automation_log WHERE automation_id = ?').run(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/x/automations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
