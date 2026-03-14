// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// /api/social/schedule — CRUD for X post schedule
// Stores posts in social_schedule SQLite table.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ApiError, handleApiError } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Schema bootstrap ────────────────────────────────────────────────────────

function ensureTable() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_schedule (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'x',
      scheduledAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      agentId TEXT,
      metadata TEXT DEFAULT '{}',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);
}

// ─── Parse ISO week string YYYY-WW ───────────────────────────────────────────

function weekBounds(weekStr: string): { start: string; end: string } | null {
  const match = weekStr.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // Jan 4 is always in week 1 (ISO standard)
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon..7=Sun
  const weekOneStart = new Date(jan4);
  weekOneStart.setDate(jan4.getDate() - (dayOfWeek - 1));

  const start = new Date(weekOneStart);
  start.setDate(weekOneStart.getDate() + (week - 1) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ─── GET /api/social/schedule?week=YYYY-WW ────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    ensureTable();
    const db = getDb();
    const week = req.nextUrl.searchParams.get('week');

    let posts: unknown[];
    if (week) {
      const bounds = weekBounds(week);
      if (!bounds) throw new ApiError(400, 'week must be YYYY-WW format');
      posts = db
        .prepare(
          `SELECT * FROM social_schedule
           WHERE date(scheduledAt) >= ? AND date(scheduledAt) < ?
           ORDER BY scheduledAt ASC`,
        )
        .all(bounds.start, bounds.end);
    } else {
      posts = db.prepare('SELECT * FROM social_schedule ORDER BY scheduledAt ASC').all();
    }

    return NextResponse.json({ posts });
  } catch (err) {
    return handleApiError(err);
  }
}

// ─── POST /api/social/schedule ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    ensureTable();
    const body = await req.json().catch(() => {
      throw new ApiError(400, 'Invalid JSON body');
    });

    if (!body.content || typeof body.content !== 'string') {
      throw new ApiError(400, 'content is required');
    }
    if (!body.scheduledAt) {
      throw new ApiError(400, 'scheduledAt is required');
    }

    const db = getDb();
    const id = `ss-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO social_schedule (id, content, platform, scheduledAt, status, agentId, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.content,
      body.platform ?? 'x',
      body.scheduledAt,
      body.status ?? 'draft',
      body.agentId ?? null,
      JSON.stringify(body.metadata ?? {}),
      now,
      now,
    );

    const post = db.prepare('SELECT * FROM social_schedule WHERE id = ?').get(id);
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
