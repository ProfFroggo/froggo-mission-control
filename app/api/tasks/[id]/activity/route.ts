// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const activities = db.prepare(
      'SELECT * FROM task_activity WHERE taskId = ? ORDER BY timestamp DESC LIMIT 50'
    ).all(id);

    return NextResponse.json(activities);
  } catch (error) {
    console.error('GET /api/tasks/[id]/activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const db = getDb();
    const body = await request.json();

    const { agentId, action = 'update', message, details } = body;

    const result = db.prepare(`
      INSERT INTO task_activity (taskId, agentId, action, message, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(taskId, agentId ?? null, action, message, details ?? null, Date.now());

    const activity = db.prepare('SELECT * FROM task_activity WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/[id]/activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
