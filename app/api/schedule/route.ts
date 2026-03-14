// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ApiError, handleApiError } from '@/lib/apiErrors';

export async function GET() {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM scheduled_items ORDER BY scheduledFor ASC').all();
    return NextResponse.json(items);
  } catch (error) {
    console.error('GET /api/schedule error:', error);
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      throw new ApiError(400, 'Invalid JSON body');
    });
    const db = getDb();
    const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    db.prepare(
      'INSERT INTO scheduled_items (id, type, content, scheduledFor, metadata, status, platform, recurrence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      body.type || 'task',
      body.content || body.title || '',
      body.scheduledFor || String(now),
      JSON.stringify(body.metadata || {}),
      'pending',
      body.platform || null,
      body.recurrence || 'none',
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error('POST /api/schedule error:', error);
    return handleApiError(error);
  }
}
