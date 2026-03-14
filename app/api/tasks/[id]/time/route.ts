// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/[id]/time/route.ts
// GET: list time entries; POST: start/stop/log time

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface TimeEntryRow {
  id: string;
  taskId: string;
  startedAt: string | null;
  stoppedAt: string | null;
  duration: number | null;
  note: string | null;
  createdAt: string;
}

function ensureTimeTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      startedAt TEXT,
      stoppedAt TEXT,
      duration INTEGER,
      note TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
}

function calcTotalMinutes(entries: TimeEntryRow[]): number {
  return entries.reduce((sum, e) => {
    if (e.duration != null) return sum + Math.floor(e.duration / 60);
    if (e.startedAt && e.stoppedAt) {
      const ms = new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime();
      return sum + Math.floor(ms / 60000);
    }
    return sum;
  }, 0);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTimeTable(db);

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const entries = db.prepare(
      'SELECT * FROM time_entries WHERE taskId = ? ORDER BY createdAt DESC'
    ).all(id) as TimeEntryRow[];

    return NextResponse.json({
      entries,
      totalMinutes: calcTotalMinutes(entries),
    });
  } catch (error) {
    console.error('GET /api/tasks/[id]/time error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTimeTable(db);

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const body = await request.json();
    const { action, note, minutes } = body as {
      action: 'start' | 'stop' | 'log';
      note?: string;
      minutes?: number;
    };

    if (!['start', 'stop', 'log'].includes(action)) {
      return NextResponse.json({ error: 'action must be start, stop, or log' }, { status: 400 });
    }

    const entryId = randomUUID();
    const now = new Date().toISOString();

    if (action === 'start') {
      // Check if there's already an open (no stoppedAt) entry for this task
      const openEntry = db.prepare(
        "SELECT id FROM time_entries WHERE taskId = ? AND startedAt IS NOT NULL AND stoppedAt IS NULL AND duration IS NULL"
      ).get(id);
      if (openEntry) {
        return NextResponse.json({ error: 'Timer already running for this task' }, { status: 409 });
      }

      db.prepare(`
        INSERT INTO time_entries (id, taskId, startedAt, note)
        VALUES (?, ?, ?, ?)
      `).run(entryId, id, now, note ?? null);

      const created = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntryRow;
      return NextResponse.json(created, { status: 201 });
    }

    if (action === 'stop') {
      // Find the most recent open entry
      const openEntry = db.prepare(
        "SELECT * FROM time_entries WHERE taskId = ? AND startedAt IS NOT NULL AND stoppedAt IS NULL AND duration IS NULL ORDER BY createdAt DESC LIMIT 1"
      ).get(id) as TimeEntryRow | undefined;

      if (!openEntry) {
        return NextResponse.json({ error: 'No active timer found for this task' }, { status: 404 });
      }

      const durationMs = new Date(now).getTime() - new Date(openEntry.startedAt!).getTime();
      const durationSeconds = Math.floor(durationMs / 1000);

      db.prepare(`
        UPDATE time_entries SET stoppedAt = ?, duration = ?, note = COALESCE(?, note)
        WHERE id = ?
      `).run(now, durationSeconds, note ?? null, openEntry.id);

      const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(openEntry.id) as TimeEntryRow;
      return NextResponse.json(updated);
    }

    // action === 'log': manual time entry
    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      return NextResponse.json({ error: 'minutes must be a positive number for log action' }, { status: 400 });
    }

    const durationSeconds = Math.floor(minutes * 60);
    db.prepare(`
      INSERT INTO time_entries (id, taskId, startedAt, stoppedAt, duration, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entryId, id, now, now, durationSeconds, note ?? null);

    const created = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntryRow;
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/[id]/time error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
