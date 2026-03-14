// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAutomation(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of ['trigger_config', 'steps']) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = field === 'steps' ? [] : {};
      }
    }
  }
  return parsed;
}

// ─── GET — list all automations ───────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Parse endpoint — NL description → structured automation (stub)
  if (action === 'parse') {
    return NextResponse.json({ error: 'Use POST /api/automations?action=parse' }, { status: 405 });
  }

  try {
    const db = getDb();
    const status = searchParams.get('status');
    let rows: Record<string, unknown>[];
    if (status) {
      rows = db.prepare('SELECT * FROM automations WHERE status = ? ORDER BY createdAt DESC').all(status) as Record<string, unknown>[];
    } else {
      rows = db.prepare('SELECT * FROM automations ORDER BY createdAt DESC').all() as Record<string, unknown>[];
    }
    return NextResponse.json(rows.map(parseAutomation));
  } catch (err) {
    console.error('[automations GET]', err);
    return NextResponse.json([], { status: 200 }); // return empty array if table not ready
  }
}

// ─── POST — create a new automation OR parse NL description ──────────────────

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    const body = await request.json();

    // NL parse stub — in production this would call an AI agent
    if (action === 'parse') {
      const description: string = body.description ?? '';
      // Basic heuristic parse for demo purposes
      const isSchedule = /every|daily|weekly|monday|morning|night|at \d/i.test(description);
      const isEvent = /when|trigger|created|approved|rejected/i.test(description);
      const trigger_type = isSchedule ? 'schedule' : isEvent ? 'event' : 'manual';
      const trigger_config = trigger_type === 'schedule'
        ? { time: '09:00', frequency: 'daily' }
        : trigger_type === 'event'
        ? { event: 'task.created' }
        : {};

      // Extract a reasonable name from the first sentence
      const name = description.split(/[.!?]/)[0].trim().slice(0, 80);

      const steps = [
        {
          id: 'step-1',
          type: 'run-agent',
          label: 'Agent: ' + description.slice(0, 60),
          config: { agentRole: 'researcher', prompt: description },
        },
      ];

      return NextResponse.json({ name, description, trigger_type, trigger_config, steps });
    }

    // Check if this is a run-now action
    if (action === 'run') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      const db = getDb();
      const now = Date.now();
      db.prepare('UPDATE automations SET lastRun = ?, updatedAt = ? WHERE id = ?').run(now, now, id);
      return NextResponse.json({ ok: true, lastRun: now });
    }

    // Create automation
    const db = getDb();
    const id = randomUUID();
    const now = Date.now();
    const {
      name,
      description = '',
      trigger_type,
      trigger_config = {},
      steps = [],
      status = 'draft',
    } = body;

    if (!name || !trigger_type) {
      return NextResponse.json({ error: 'name and trigger_type are required' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO automations (id, name, description, trigger_type, trigger_config, steps, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description,
      trigger_type,
      JSON.stringify(trigger_config),
      JSON.stringify(steps),
      status,
      now,
      now,
    );

    const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseAutomation(row), { status: 201 });
  } catch (err) {
    console.error('[automations POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH — update an existing automation ───────────────────────────────────

export async function PATCH(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const db = getDb();
    const body = await request.json();
    const now = Date.now();

    const fields: string[] = [];
    const values: unknown[] = [];

    const allowed = ['name', 'description', 'trigger_type', 'trigger_config', 'steps', 'status', 'nextRun', 'lastRun'];
    for (const key of allowed) {
      if (key in body) {
        fields.push(`${key} = ?`);
        const val = body[key];
        values.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const row = db.prepare('SELECT * FROM automations WHERE id = ?').get(id) as Record<string, unknown>;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseAutomation(row));
  } catch (err) {
    console.error('[automations PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — remove an automation ───────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM automations WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[automations DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
