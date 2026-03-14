// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseCampaign(c: Record<string, unknown>): Record<string, unknown> {
  // Parse types: try the types column first; fallback to wrapping legacy type string
  let types: string[] = [];
  if (c.types) {
    try { types = JSON.parse(c.types as string); } catch { types = [c.types as string]; }
  } else if (c.type) {
    types = [c.type as string];
  }
  return {
    ...c,
    channels: (() => { try { return JSON.parse(c.channels as string); } catch { return []; } })(),
    kpis: (() => { try { return JSON.parse(c.kpis as string); } catch { return {}; } })(),
    types,
  };
}

// GET /api/campaigns — list campaigns with computed stats
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let q = `SELECT c.*,
      (SELECT COUNT(*) FROM campaign_members WHERE campaignId = c.id) as memberCount,
      (SELECT COUNT(*) FROM tasks WHERE project = c.id) as totalTasks,
      (SELECT COUNT(*) FROM tasks WHERE project = c.id AND status = 'done') as doneTasks,
      (SELECT COUNT(*) FROM tasks WHERE project = c.id AND status IN ('in-progress','internal-review','review','human-review')) as inProgressTasks,
      (SELECT MAX(updatedAt) FROM tasks WHERE project = c.id) as lastTaskActivity
      FROM campaigns c WHERE 1=1`;
    const params: unknown[] = [];
    if (status) { q += ' AND c.status = ?'; params.push(status); }
    if (type) { q += ' AND c.type = ?'; params.push(type); }
    q += ' ORDER BY c.updatedAt DESC';

    const campaigns = (db.prepare(q).all(...params) as Record<string, unknown>[]).map(parseCampaign);

    // Enrich with members
    const memberStmt = db.prepare(`
      SELECT cm.*, a.name AS agentName, a.avatar AS agentEmoji
      FROM campaign_members cm
      LEFT JOIN agents a ON a.id = cm.agentId
      WHERE cm.campaignId = ?
      ORDER BY cm.addedAt ASC
    `);
    const enriched = campaigns.map(c => ({
      ...c,
      members: memberStmt.all(c.id as string),
    }));

    return NextResponse.json({ success: true, campaigns: enriched });
  } catch (error) {
    console.error('GET /api/campaigns error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns — create campaign
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json().catch(() => ({}));
    const {
      name, description, goal, channels = [], budget,
      currency = 'USD', targetAudience, startDate, endDate, briefContent,
      color = '#6366f1', memberAgentIds = [],
    } = body;

    // Accept `types` array or legacy `type` string
    let types: string[] = [];
    if (Array.isArray(body.types) && body.types.length > 0) {
      types = body.types;
    } else if (typeof body.type === 'string' && body.type) {
      types = [body.type];
    } else {
      types = ['general'];
    }
    const primaryType = types[0];

    if (!name?.trim()) {
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
    }

    const now = Date.now();
    const id = `cmp-${now}-${Math.random().toString(36).slice(2, 7)}`;

    // Ensure types column exists (migration for existing DBs)
    try {
      db.exec(`ALTER TABLE campaigns ADD COLUMN types TEXT`);
    } catch { /* column already exists */ }

    db.prepare(`
      INSERT INTO campaigns (id, name, description, type, types, goal, status, channels, budget, budgetSpent, currency, targetAudience, kpis, startDate, endDate, briefContent, color, createdBy, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, 0, ?, ?, '{}', ?, ?, ?, ?, 'human', ?, ?)
    `).run(
      id, name.trim(), description || null, primaryType, JSON.stringify(types), goal || null,
      JSON.stringify(channels), budget || null, currency, targetAudience || null,
      startDate || null, endDate || null, briefContent || null, color, now, now
    );

    // Add members
    if (Array.isArray(memberAgentIds) && memberAgentIds.length > 0) {
      const addMember = db.prepare('INSERT OR IGNORE INTO campaign_members (campaignId, agentId, role, addedAt) VALUES (?, ?, ?, ?)');
      const tx = db.transaction(() => {
        for (const agentId of memberAgentIds) {
          addMember.run(id, agentId, 'member', now);
        }
      });
      tx();
    }

    // Create chat room for campaign
    try {
      const roomAgents = Array.isArray(memberAgentIds) ? memberAgentIds : [];
      db.prepare('INSERT OR IGNORE INTO chat_rooms (id, name, agents, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
        .run(`campaign-${id}`, `Campaign: ${name.trim()}`, JSON.stringify(roomAgents), now, now);
    } catch { /* non-critical */ }

    // Create library folder
    try {
      const { mkdirSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const folderPath = join(homedir(), 'mission-control', 'library', 'campaigns', id);
      mkdirSync(folderPath, { recursive: true });
    } catch { /* non-critical */ }

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    return NextResponse.json({ success: true, id, campaign }, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
