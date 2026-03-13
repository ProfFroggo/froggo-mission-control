// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/campaigns/:id/members
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const members = db.prepare(`
      SELECT cm.*, a.name AS agentName, a.avatar AS agentEmoji, a.status AS agentStatus
      FROM campaign_members cm
      LEFT JOIN agents a ON a.id = cm.agentId
      WHERE cm.campaignId = ?
      ORDER BY cm.role DESC, cm.addedAt ASC
    `).all(id);
    return NextResponse.json(members);
  } catch (error) {
    console.error('GET /api/campaigns/:id/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns/:id/members — add or remove agents
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const { agentId, role = 'member', action = 'add' } = await request.json();

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

    if (action === 'remove') {
      db.prepare('DELETE FROM campaign_members WHERE campaignId = ? AND agentId = ?').run(id, agentId);
    } else {
      db.prepare('INSERT OR REPLACE INTO campaign_members (campaignId, agentId, role, addedAt) VALUES (?, ?, ?, ?)').run(id, agentId, role, Date.now());
    }

    // Sync agents list to the campaign chat room
    try {
      const roomId = `campaign-${id}`;
      const roomRow = db.prepare('SELECT agents FROM chat_rooms WHERE id = ?').get(roomId) as { agents: string } | undefined;
      if (roomRow !== undefined) {
        let agents: string[] = [];
        try { agents = JSON.parse(roomRow?.agents || '[]'); } catch { agents = []; }
        if (!Array.isArray(agents)) agents = [];
        if (action === 'remove') {
          agents = agents.filter((a: string) => a !== agentId);
        } else if (!agents.includes(agentId)) {
          agents.push(agentId);
        }
        db.prepare('UPDATE chat_rooms SET agents = ?, updatedAt = ? WHERE id = ?').run(JSON.stringify(agents), Date.now(), roomId);
      }
    } catch { /* non-critical */ }

    db.prepare('UPDATE campaigns SET updatedAt = ? WHERE id = ?').run(Date.now(), id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/campaigns/:id/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
