// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function parseItem(r: Record<string, unknown>) {
  return { ...r, channels: JSON.parse((r.channels as string) || '[]') };
}

// GET /api/campaigns/:id/content-items
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const phaseId = searchParams.get('phaseId');
    const db = getDb();
    const rows = phaseId
      ? db.prepare(`SELECT * FROM campaign_content_items WHERE campaignId = ? AND phaseId = ? ORDER BY scheduledDate ASC, sortOrder ASC, createdAt ASC`).all(id, phaseId) as Record<string, unknown>[]
      : db.prepare(`SELECT * FROM campaign_content_items WHERE campaignId = ? ORDER BY scheduledDate ASC, sortOrder ASC, createdAt ASC`).all(id) as Record<string, unknown>[];
    return NextResponse.json({ items: rows.map(parseItem) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/campaigns/:id/content-items
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();
    const now = Date.now();
    const itemId = `ci-${now}-${Math.random().toString(36).slice(2, 6)}`;

    db.prepare(`
      INSERT INTO campaign_content_items
        (id, campaignId, phaseId, scheduledDate, channels, description, angle, ownerType, ownerId, approverId, status, sortOrder, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      id,
      body.phaseId ?? null,
      body.scheduledDate ?? null,
      JSON.stringify(body.channels ?? []),
      body.description ?? '',
      body.angle ?? '',
      body.ownerType ?? 'human',
      body.ownerId ?? '',
      body.approverId ?? '',
      body.status ?? 'draft',
      body.sortOrder ?? 0,
      now,
      now,
    );

    const item = db.prepare(`SELECT * FROM campaign_content_items WHERE id = ?`).get(itemId) as Record<string, unknown>;
    return NextResponse.json({ item: parseItem(item) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/campaigns/:id/content-items — update a single item
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    const db = getDb();
    const now = Date.now();

    const fields: string[] = [];
    const vals: unknown[] = [];
    const updatable = ['phaseId', 'scheduledDate', 'description', 'angle', 'ownerType', 'ownerId', 'approverId', 'status', 'sortOrder'] as const;
    for (const f of updatable) {
      if (body[f] !== undefined) { fields.push(`${f} = ?`); vals.push(body[f]); }
    }
    if (body.channels !== undefined) { fields.push('channels = ?'); vals.push(JSON.stringify(body.channels)); }
    fields.push('updatedAt = ?'); vals.push(now);
    vals.push(body.itemId, id);

    db.prepare(`UPDATE campaign_content_items SET ${fields.join(', ')} WHERE id = ? AND campaignId = ?`).run(...vals);
    const item = db.prepare(`SELECT * FROM campaign_content_items WHERE id = ?`).get(body.itemId) as Record<string, unknown>;
    return NextResponse.json({ item: parseItem(item) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/campaigns/:id/content-items?itemId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    const db = getDb();
    db.prepare(`DELETE FROM campaign_content_items WHERE id = ? AND campaignId = ?`).run(itemId, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
