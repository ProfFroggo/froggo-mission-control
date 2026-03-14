// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// app/api/tasks/from-template/route.ts
// POST: create a task from a template, with optional overrides

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

interface SubtaskTemplate {
  title: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { templateId, overrides = {} } = body as {
      templateId: string;
      overrides?: Record<string, unknown>;
    };

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    // Ensure the templates table exists
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

    const template = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(templateId) as TemplateRow | undefined;
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const taskId = randomUUID();
    const now = Date.now();

    const title = (overrides.title as string | undefined) ?? template.title;
    const description = (overrides.description as string | undefined) ?? template.description ?? undefined;
    const priority = (overrides.priority as string | undefined) ?? template.priority ?? 'p2';
    const status = (overrides.status as string | undefined) ?? 'todo';
    const project = (overrides.project as string | undefined) ?? 'General';
    const projectId = (overrides.project_id as string | undefined) ?? null;
    const tags = (overrides.tags as unknown[] | undefined) ?? (template.tags ? (() => { try { return JSON.parse(template.tags!); } catch { return []; } })() : []);

    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, project, project_id, tags, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      title,
      description ?? null,
      status,
      priority,
      project,
      projectId,
      JSON.stringify(tags),
      now,
      now,
    );

    // Create subtasks from template
    const subtaskTemplates: SubtaskTemplate[] = template.subtasks
      ? (() => { try { return JSON.parse(template.subtasks) as SubtaskTemplate[]; } catch { return []; } })()
      : [];

    if (subtaskTemplates.length > 0) {
      const insertSubtask = db.prepare(`
        INSERT INTO subtasks (id, taskId, title, description, completed, position, createdAt)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `);
      subtaskTemplates.forEach((st, idx) => {
        insertSubtask.run(randomUUID(), taskId, st.title, st.description ?? null, idx, now);
      });
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/from-template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
