// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/templates/route.ts
// Task template CRUD: GET list, POST create

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface TemplateRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  priority: string;
  tags: string | null;
  subtasks: string | null;
  createdAt: string;
}

function parseTemplate(row: TemplateRow) {
  return {
    ...row,
    tags: row.tags ? (() => { try { return JSON.parse(row.tags!); } catch { return []; } })() : [],
    subtasks: row.subtasks ? (() => { try { return JSON.parse(row.subtasks!); } catch { return []; } })() : [],
  };
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM task_templates ORDER BY createdAt DESC').all() as TemplateRow[];
    return NextResponse.json(rows.map(parseTemplate));
  } catch (error) {
    console.error('GET /api/tasks/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { name, title, description, priority, tags, subtasks, taskId } = body;

    // If taskId is provided, create template from existing task
    if (taskId) {
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const templateName = name || (task.title as string);
      if (!templateName || typeof templateName !== 'string') {
        return NextResponse.json({ error: 'name is required' }, { status: 400 });
      }

      const id = randomUUID();
      const subtaskRows = db.prepare('SELECT title, description FROM subtasks WHERE taskId = ?').all(taskId);
      const subtasksJson = JSON.stringify(subtaskRows);

      db.prepare(`
        INSERT INTO task_templates (id, name, title, description, priority, tags, subtasks)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        templateName,
        task.title as string,
        task.description ?? null,
        task.priority ?? 'medium',
        task.tags ?? null,
        subtasksJson,
      );

      const created = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as TemplateRow;
      return NextResponse.json(parseTemplate(created), { status: 201 });
    }

    // Create template from body
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO task_templates (id, name, title, description, priority, tags, subtasks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      title,
      description ?? null,
      priority ?? 'medium',
      tags ? JSON.stringify(tags) : null,
      subtasks ? JSON.stringify(subtasks) : null,
    );

    const created = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(id) as TemplateRow;
    return NextResponse.json(parseTemplate(created), { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/templates error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
