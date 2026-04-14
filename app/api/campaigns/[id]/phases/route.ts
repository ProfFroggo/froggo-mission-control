// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/campaigns/:id/phases
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM campaign_phases WHERE campaignId = ? ORDER BY sortOrder ASC, createdAt ASC`
    ).all(id) as Record<string, unknown>[];
    return NextResponse.json({ phases: rows.map(r => ({ ...r, channels: JSON.parse((r.channels as string) || '[]'), milestones: JSON.parse((r.milestones as string) || '[]') })) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/campaigns/:id/phases
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const now = Date.now();
    const phaseId = `phase-${now}-${Math.random().toString(36).slice(2, 6)}`;

    const maxOrder = (db.prepare(`SELECT MAX(sortOrder) as m FROM campaign_phases WHERE campaignId = ?`).get(id) as { m: number | null })?.m ?? -1;

    db.prepare(`
      INSERT INTO campaign_phases (id, campaignId, name, startDate, endDate, color, channels, owner, milestones, sortOrder, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      phaseId,
      id,
      body.name ?? 'New Phase',
      body.startDate ?? null,
      body.endDate ?? null,
      body.color ?? '#6366f1',
      JSON.stringify(body.channels ?? []),
      body.owner ?? null,
      JSON.stringify(body.milestones ?? []),
      maxOrder + 1,
      now,
      now,
    );

    const phase = db.prepare(`SELECT * FROM campaign_phases WHERE id = ?`).get(phaseId) as Record<string, unknown>;
    return NextResponse.json({ phase: { ...phase, channels: JSON.parse((phase.channels as string) || '[]'), milestones: JSON.parse((phase.milestones as string) || '[]') } }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/campaigns/:id/phases — update or reorder multiple phases
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const now = Date.now();

    // Single phase update
    if (body.phaseId) {
      const fields: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined)       { fields.push('name = ?');       vals.push(body.name); }
      if (body.startDate !== undefined)  { fields.push('startDate = ?');  vals.push(body.startDate); }
      if (body.endDate !== undefined)    { fields.push('endDate = ?');    vals.push(body.endDate); }
      if (body.color !== undefined)      { fields.push('color = ?');      vals.push(body.color); }
      if (body.channels !== undefined)   { fields.push('channels = ?');   vals.push(JSON.stringify(body.channels)); }
      if (body.owner !== undefined)      { fields.push('owner = ?');      vals.push(body.owner); }
      if (body.milestones !== undefined) { fields.push('milestones = ?'); vals.push(JSON.stringify(body.milestones)); }
      if (body.sortOrder !== undefined)  { fields.push('sortOrder = ?');  vals.push(body.sortOrder); }
      fields.push('updatedAt = ?'); vals.push(now);
      vals.push(body.phaseId, id);
      db.prepare(`UPDATE campaign_phases SET ${fields.join(', ')} WHERE id = ? AND campaignId = ?`).run(...vals);
      const phase = db.prepare(`SELECT * FROM campaign_phases WHERE id = ?`).get(body.phaseId) as Record<string, unknown>;
      return NextResponse.json({ phase: { ...phase, channels: JSON.parse((phase.channels as string) || '[]'), milestones: JSON.parse((phase.milestones as string) || '[]') } });
    }

    return NextResponse.json({ error: 'phaseId required' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/campaigns/:id/phases?phaseId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const phaseId = searchParams.get('phaseId');
    if (!phaseId) return NextResponse.json({ error: 'phaseId required' }, { status: 400 });
    const db = getDb();
    db.prepare(`DELETE FROM campaign_phases WHERE id = ? AND campaignId = ?`).run(phaseId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
