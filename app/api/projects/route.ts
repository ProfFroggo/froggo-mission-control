// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseProject(row: Record<string, unknown>) {
  return row;
}

// GET /api/projects — list all projects with member counts and task counts
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where = status ? `WHERE p.status = ?` : '';
    const values = status ? [status] : [];

    const projects = db.prepare(`
      SELECT
        p.*,
        COUNT(DISTINCT pm.agentId) AS memberCount,
        COUNT(DISTINCT t.id) AS totalTasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS doneTasks,
        SUM(CASE WHEN t.status IN ('in-progress','internal-review','review','human-review') THEN 1 ELSE 0 END) AS inProgressTasks,
        SUM(CASE WHEN t.status IN ('todo','blocked') THEN 1 ELSE 0 END) AS todoTasks,
        MAX(t.updatedAt) AS lastTaskActivity
      FROM projects p
      LEFT JOIN project_members pm ON pm.projectId = p.id
      LEFT JOIN tasks t ON t.project_id = p.id
      ${where}
      GROUP BY p.id
      ORDER BY p.updatedAt DESC
    `).all(...values) as Record<string, unknown>[];

    // Enrich with members
    const memberStmt = db.prepare(`
      SELECT pm.*, a.name AS agentName, a.avatar AS agentEmoji
      FROM project_members pm
      LEFT JOIN agents a ON a.id = pm.agentId
      WHERE pm.projectId = ?
      ORDER BY pm.addedAt ASC
    `);

    const enriched = projects.map(p => ({
      ...parseProject(p),
      members: memberStmt.all(p.id as string),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { name, description, emoji, color, goal, memberAgentIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const id = `proj-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    db.prepare(`
      INSERT INTO projects (id, name, description, emoji, color, goal, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      name.trim(),
      description || null,
      emoji || '📁',
      color || '#6366f1',
      goal || null,
      now,
      now
    );

    // Add members
    if (Array.isArray(memberAgentIds) && memberAgentIds.length > 0) {
      const addMember = db.prepare(`
        INSERT OR IGNORE INTO project_members (projectId, agentId, role, addedAt)
        VALUES (?, ?, 'member', ?)
      `);
      const tx = db.transaction(() => {
        for (const agentId of memberAgentIds) {
          addMember.run(id, agentId, now);
        }
      });
      tx();
    }

    // Auto-create a chat room for the project, seeded with the project members
    try {
      const roomId = `project-${id}`;
      const roomAgents = Array.isArray(memberAgentIds) ? memberAgentIds : [];
      db.prepare(`
        INSERT OR IGNORE INTO chat_rooms (id, name, topic, agents, project_id, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(roomId, `${emoji || '📁'} ${name.trim()}`, `Project chat for ${name.trim()}`, JSON.stringify(roomAgents), id, now, now);
    } catch { /* project_id column might not exist on old DBs */ }

    // Auto-create library folder
    const { mkdirSync } = await import('fs');
    const { join } = await import('path');
    const { homedir } = await import('os');
    const projectLibDir = join(homedir(), 'mission-control', 'library', 'projects', id);
    mkdirSync(projectLibDir, { recursive: true });

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
