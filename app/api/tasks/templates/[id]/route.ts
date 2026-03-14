// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/templates/[id]/route.ts
// DELETE a task template by id

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Ensure the table exists (may not exist yet if templates were never used)
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium',
        tags TEXT,
        subtasks TEXT,
        createdAt TEXT DEFAULT (datetime('now'))
      )
    `);

    const existing = db.prepare('SELECT id FROM task_templates WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM task_templates WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/templates/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
