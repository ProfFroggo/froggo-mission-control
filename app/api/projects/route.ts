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

    // Batch-fetch all members for returned projects (avoids N+1)
    const projectIds = projects.map(p => p.id as string);
    let allMembers: Record<string, unknown>[] = [];
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      allMembers = db.prepare(`
        SELECT pm.*, a.name AS agentName, a.avatar AS agentEmoji
        FROM project_members pm
        LEFT JOIN agents a ON a.id = pm.agentId
        WHERE pm.projectId IN (${placeholders})
        ORDER BY pm.addedAt ASC
      `).all(...projectIds) as Record<string, unknown>[];
    }
    const membersByProject = new Map<string, Record<string, unknown>[]>();
    for (const m of allMembers) {
      const pid = m.projectId as string;
      if (!membersByProject.has(pid)) membersByProject.set(pid, []);
      membersByProject.get(pid)!.push(m);
    }

    const enriched = projects.map(p => ({
      ...parseProject(p),
      members: membersByProject.get(p.id as string) || [],
    }));

    return NextResponse.json(enriched, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
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

    // Atomic: create project + members + chat room
    db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, description, emoji, color, goal, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `).run(
        id,
        name.trim(),
        description || null,
        emoji || 'folder',
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
        for (const agentId of memberAgentIds) {
          addMember.run(id, agentId, now);
        }
      }

      // Auto-create a chat room for the project, seeded with the project members
      try {
        const roomId = `project-${id}`;
        const roomAgents = Array.isArray(memberAgentIds) ? memberAgentIds : [];
        db.prepare(`
          INSERT OR IGNORE INTO chat_rooms (id, name, topic, agents, project_id, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(roomId, `${emoji || '📁'} ${name.trim()}`, `Project chat for ${name.trim()}`, JSON.stringify(roomAgents), id, now, now);
      } catch (err) { console.warn('[projects] Non-critical: project_id column might not exist on old DBs:', err); }
    })();

    // Auto-create project directory structure (non-transactional — filesystem, not DB)
    try {
      const { mkdirSync, writeFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const projDir = join(homedir(), 'mission-control', 'library', 'projects', id);
      for (const sub of ['images', 'docs', 'code', 'design']) {
        mkdirSync(join(projDir, sub), { recursive: true });
      }
      if (!existsSync(join(projDir, 'GOAL.md'))) {
        writeFileSync(join(projDir, 'GOAL.md'), `# ${name.trim()}\n\n${goal || description || 'Project goal TBD.'}\n`, 'utf-8');
      }
      if (!existsSync(join(projDir, 'STATUS.md'))) {
        writeFileSync(join(projDir, 'STATUS.md'), `# Status\n\nProject created ${new Date().toISOString().slice(0, 10)}.\n`, 'utf-8');
      }
      if (!existsSync(join(projDir, 'CONTEXT.md'))) {
        writeFileSync(join(projDir, 'CONTEXT.md'), `# Context\n\n${description || 'No additional context yet.'}\n`, 'utf-8');
      }
    } catch (err) { console.warn('[projects] Non-critical: directory creation failure:', err); }

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
