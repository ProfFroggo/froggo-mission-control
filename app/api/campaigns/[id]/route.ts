// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function parseCampaign(c: Record<string, unknown>) {
  return {
    ...c,
    channels: (() => { try { return JSON.parse(c.channels as string); } catch { return []; } })(),
    kpis: (() => { try { return JSON.parse(c.kpis as string); } catch { return {}; } })(),
  };
}

// GET /api/campaigns/:id
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const members = db.prepare(`
      SELECT cm.*, a.name as agentName, a.status as agentStatus, a.avatar as agentEmoji
      FROM campaign_members cm
      LEFT JOIN agents a ON a.id = cm.agentId
      WHERE cm.campaignId = ?
      ORDER BY cm.addedAt ASC
    `).all(id);

    const assets = db.prepare('SELECT * FROM campaign_assets WHERE campaignId = ? ORDER BY createdAt DESC').all(id);

    return NextResponse.json({
      success: true,
      campaign: { ...parseCampaign(campaign), members, assets },
    });
  } catch (error) {
    console.error('GET /api/campaigns/:id error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/campaigns/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const sets: string[] = ['updatedAt = ?'];
    const vals: unknown[] = [Date.now()];

    const fields = ['name', 'description', 'type', 'goal', 'status', 'budget', 'budgetSpent', 'currency', 'targetAudience', 'briefContent', 'color', 'startDate', 'endDate'];
    for (const f of fields) {
      if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(body[f]); }
    }
    if (body.channels !== undefined) { sets.push('channels = ?'); vals.push(JSON.stringify(body.channels)); }
    if (body.kpis !== undefined) { sets.push('kpis = ?'); vals.push(JSON.stringify(body.kpis)); }

    vals.push(id);
    db.prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json({ success: true, campaign: parseCampaign(updated) });
  } catch (error) {
    console.error('PATCH /api/campaigns/:id error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/campaigns/:id — archives the campaign
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    db.prepare("UPDATE campaigns SET status = 'archived', updatedAt = ? WHERE id = ?").run(Date.now(), id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/campaigns/:id error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
