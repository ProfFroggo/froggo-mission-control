// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500);
    const sinceMs = Number(searchParams.get('since')) || 0;

    let query = 'SELECT * FROM notes';
    const params: unknown[] = [];

    if (sinceMs) {
      query += ' WHERE createdAt >= ?';
      params.push(sinceMs);
    }

    query += ' ORDER BY pinned DESC, createdAt DESC LIMIT ?';
    params.push(limit);

    const notes = db.prepare(query).all(...params);
    return NextResponse.json(notes);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { content, color } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    db.prepare(
      'INSERT INTO notes (id, content, color, pinned, createdAt, updatedAt) VALUES (?, ?, ?, 0, ?, ?)'
    ).run(id, content.trim(), color || 'default', now, now);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    return NextResponse.json(note, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
