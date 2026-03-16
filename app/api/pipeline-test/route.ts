// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/pipeline-test — Create a test task that exercises the full pipeline
// GET /api/pipeline-test?id=xxx — Monitor test task progress
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export async function POST() {
  try {
    const db = getDb();
    const now = Date.now();
    const id = `test-${randomUUID().slice(0, 8)}`;
    const dateStr = new Date().toISOString().slice(0, 19);

    // Create test task
    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignedTo, planningNotes, createdAt, updatedAt)
      VALUES (?, ?, ?, 'todo', 'p3', 'mission-control', ?, ?, ?)
    `).run(
      id,
      `Pipeline Test: ${dateStr}`,
      'Automated pipeline validation test. This task should flow through the full pipeline autonomously.',
      'This is a pipeline test task. Complete the following subtasks:\n1. Write a one-line haiku about automation\n2. Report the haiku as the task output\n\nExpected output: A haiku saved to ~/mission-control/library/docs/tests/',
      now, now
    );

    // Create subtasks
    const sub1 = `sub-${randomUUID().slice(0, 8)}`;
    const sub2 = `sub-${randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO subtasks (id, taskId, title, position, completed, createdAt) VALUES (?, ?, ?, ?, 0, ?)`
    ).run(sub1, id, 'Write a one-line haiku about automation', 0, now);
    db.prepare(
      `INSERT INTO subtasks (id, taskId, title, position, completed, createdAt) VALUES (?, ?, ?, ?, 0, ?)`
    ).run(sub2, id, 'Save haiku to library and attach to task', 1, now);

    // Log creation
    db.prepare(
      `INSERT INTO task_activity (taskId, agentId, action, message, timestamp) VALUES (?, ?, ?, ?, ?)`
    ).run(id, 'system', 'pipeline_test', 'Pipeline test task created — monitoring full pipeline flow', now);

    return NextResponse.json({
      success: true,
      taskId: id,
      expectedFlow: 'todo → internal-review → in-progress → review → done',
      monitor: `/api/pipeline-test?id=${id}`,
    }, { status: 201 });
  } catch (err) {
    console.error('[pipeline-test POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  try {
    const db = getDb();

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const subtasks = db.prepare(
      'SELECT id, title, completed FROM subtasks WHERE taskId = ? ORDER BY position'
    ).all(id) as Array<{ id: string; title: string; completed: number }>;

    const activities = db.prepare(
      'SELECT action, message, agentId, timestamp FROM task_activity WHERE taskId = ? ORDER BY timestamp ASC'
    ).all(id) as Array<{ action: string; message: string; agentId: string; timestamp: number }>;

    const attachments = db.prepare(
      'SELECT fileName, category FROM task_attachments WHERE taskId = ?'
    ).all(id) as Array<{ fileName: string; category: string }>;

    // Determine pipeline stage
    const status = task.status as string;
    const stages = ['todo', 'internal-review', 'in-progress', 'review', 'done'];
    const currentStage = stages.indexOf(status);
    const progress = currentStage >= 0 ? Math.round(((currentStage + 1) / stages.length) * 100) : 0;

    return NextResponse.json({
      success: true,
      taskId: id,
      status,
      pipelineProgress: progress,
      pipelineStage: `${currentStage + 1}/${stages.length}`,
      complete: status === 'done',
      reviewStatus: task.reviewStatus,
      assignedTo: task.assignedTo,
      subtasks: subtasks.map(s => ({ ...s, completed: Boolean(s.completed) })),
      activityLog: activities.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp).toISOString(),
      })),
      attachments,
      createdAt: new Date(task.createdAt as number).toISOString(),
      elapsed: `${Math.round((Date.now() - (task.createdAt as number)) / 60000)} minutes`,
    });
  } catch (err) {
    console.error('[pipeline-test GET]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
