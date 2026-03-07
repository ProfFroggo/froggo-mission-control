import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { dispatchTask } from '@/lib/taskDispatcher';

const JSON_FIELDS = ['tags', 'labels', 'blockedBy', 'blocks', 'recurrence'];

function parseTask(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = field === 'recurrence' ? null : [];
      }
    }
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const conditions: string[] = [];
    const values: unknown[] = [];

    const status = searchParams.get('status');
    if (status) {
      conditions.push('status = ?');
      values.push(status);
    }

    const assignedTo = searchParams.get('assignedTo');
    if (assignedTo) {
      conditions.push('assignedTo = ?');
      values.push(assignedTo);
    }

    const project = searchParams.get('project');
    if (project) {
      conditions.push('project = ?');
      values.push(project);
    }

    const project_id = searchParams.get('project_id');
    if (project_id) {
      conditions.push('project_id = ?');
      values.push(project_id);
    }

    const priority = searchParams.get('priority');
    if (priority) {
      conditions.push('priority = ?');
      values.push(priority);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM tasks ${where} ORDER BY priority ASC, createdAt DESC`;

    const rows = db.prepare(sql).all(...values) as Record<string, unknown>[];
    const tasks = rows.map(parseTask);

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    if (body.title.length > 500) {
      return NextResponse.json({ error: 'title must be 500 characters or fewer' }, { status: 400 });
    }
    if (body.description && typeof body.description === 'string' && body.description.length > 5000) {
      return NextResponse.json({ error: 'description must be 5000 characters or fewer' }, { status: 400 });
    }

    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    const {
      title,
      description,
      status = 'todo',
      priority = 'p2',
      project,
      project_id,
      assignedTo,
      reviewerId,
      reviewStatus,
      reviewNotes,
      tags = [],
      labels = [],
      planningNotes,
      dueDate,
      estimatedHours,
      blockedBy = [],
      blocks = [],
      progress = 0,
      lastAgentUpdate,
      projectName,
      stageNumber,
      stageName,
      nextStage,
      parentTaskId,
      recurrence,
      recurrenceParentId,
    } = body;

    db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, project, project_id, assignedTo,
        reviewerId, reviewStatus, reviewNotes, tags, labels, planningNotes,
        dueDate, estimatedHours, blockedBy, blocks, progress, lastAgentUpdate,
        createdAt, updatedAt, projectName, stageNumber, stageName, nextStage, parentTaskId,
        recurrence, recurrenceParentId
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `).run(
      id, title, description ?? null, status, priority, project ?? null, project_id ?? null, assignedTo ?? null,
      reviewerId ?? null, reviewStatus ?? null, reviewNotes ?? null,
      JSON.stringify(tags), JSON.stringify(labels), planningNotes ?? null,
      dueDate ?? null, estimatedHours ?? null,
      JSON.stringify(blockedBy), JSON.stringify(blocks), progress, lastAgentUpdate ?? null,
      now, now, projectName ?? null, stageNumber ?? null, stageName ?? null, nextStage ?? null, parentTaskId ?? null,
      recurrence ? JSON.stringify(recurrence) : null, recurrenceParentId ?? null
    );

    // Auto-assign Clara as reviewer if none set
    if (!reviewerId) {
      db.prepare('UPDATE tasks SET reviewerId = ? WHERE id = ?').run('clara', id);
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown>;

    // Auto-dispatch to agent if assigned and status is todo
    if (assignedTo && (status === 'todo' || status === 'in-progress')) {
      dispatchTask(id);
    }

    return NextResponse.json(parseTask(task), { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
