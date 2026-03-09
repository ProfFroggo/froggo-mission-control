// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';
import { dispatchTask } from '@/lib/taskDispatcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/:id/dispatch — dispatch a task to an agent in project context
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { agentId, title, description, priority = 'p2' } = await request.json();

    if (!agentId || !title) {
      return NextResponse.json({ error: 'agentId and title are required' }, { status: 400 });
    }

    const taskId = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    // Build project-aware description
    const fullDescription = `**Project:** ${project.emoji ?? '📁'} ${project.name}\n**Goal:** ${project.goal ?? 'See project context'}\n\n${description}`;

    // Insert task
    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignedTo, project, project_id, createdAt, updatedAt)
      VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?)
    `).run(taskId, title, fullDescription, priority, agentId, project.name, id, now, now);

    // Dispatch to agent
    await dispatchTask(taskId);

    db.prepare('UPDATE projects SET updatedAt = ? WHERE id = ?').run(now, id);

    return NextResponse.json({ taskId, status: 'dispatched' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/:id/dispatch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
