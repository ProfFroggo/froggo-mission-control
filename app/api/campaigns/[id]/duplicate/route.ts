// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// POST /api/campaigns/:id/duplicate — copy campaign + tasks (reset status), clear dates
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const source = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!source) return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });

    const now = Date.now();
    const newId = `cmp-${now}-${Math.random().toString(36).slice(2, 7)}`;
    const newName = `Copy of ${source.name as string}`;

    // Insert the new campaign — clear dates, reset status to draft, reset budgetSpent
    db.prepare(`
      INSERT INTO campaigns (
        id, name, description, type, goal, status, channels, budget, budgetSpent,
        currency, targetAudience, kpis, startDate, endDate, briefContent, color,
        createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, 0, ?, ?, ?, NULL, NULL, ?, ?, 'human', ?, ?)
    `).run(
      newId,
      newName,
      source.description ?? null,
      source.type,
      source.goal ?? null,
      source.channels,   // already JSON string
      source.budget ?? null,
      source.currency ?? 'USD',
      source.targetAudience ?? null,
      source.kpis ?? '{}',
      source.briefContent ?? null,
      source.color ?? '#6366f1',
      now,
      now
    );

    // Copy campaign members
    const members = db.prepare('SELECT agentId, role FROM campaign_members WHERE campaignId = ?').all(id) as { agentId: string; role: string }[];
    if (members.length > 0) {
      const addMember = db.prepare('INSERT OR IGNORE INTO campaign_members (campaignId, agentId, role, addedAt) VALUES (?, ?, ?, ?)');
      const tx = db.transaction(() => {
        for (const m of members) {
          addMember.run(newId, m.agentId, m.role, now);
        }
      });
      tx();
    }

    // Copy tasks linked to the source campaign — reset status to 'todo', clear assignee, clear dueDate
    const sourceTasks = db.prepare('SELECT * FROM tasks WHERE project = ?').all(id) as Record<string, unknown>[];
    if (sourceTasks.length > 0) {
      const insertTask = db.prepare(`
        INSERT INTO tasks (
          id, title, description, status, priority, project, assignedTo,
          dueDate, estimatedHours, labels, planningNotes, createdAt, updatedAt
        ) VALUES (?, ?, ?, 'todo', ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
      `);
      const tx = db.transaction(() => {
        for (const t of sourceTasks) {
          const taskId = `task-${now}-${Math.random().toString(36).slice(2, 9)}`;
          insertTask.run(
            taskId,
            t.title,
            t.description ?? null,
            t.priority ?? 'medium',
            newId,
            t.estimatedHours ?? null,
            t.labels ?? '[]',
            t.planningNotes ?? null,
            now,
            now
          );
        }
      });
      tx();
    }

    // Create chat room for the duplicated campaign
    try {
      const roomAgents = members.map(m => m.agentId);
      db.prepare('INSERT OR IGNORE INTO chat_rooms (id, name, agents, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
        .run(`campaign-${newId}`, `Campaign: ${newName}`, JSON.stringify(roomAgents), now, now);
    } catch { /* non-critical */ }

    const newCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(newId);
    return NextResponse.json({ success: true, id: newId, campaign: newCampaign }, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns/:id/duplicate error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
