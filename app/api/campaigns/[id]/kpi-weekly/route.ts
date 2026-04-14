// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/campaigns/:id/kpi-weekly
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM campaign_kpi_weekly WHERE campaignId = ? ORDER BY weekStart ASC, metric ASC`
    ).all(id);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// PUT /api/campaigns/:id/kpi-weekly — upsert a cell (metric + weekLabel)
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (!body.metric || !body.weekLabel) return NextResponse.json({ error: 'metric and weekLabel required' }, { status: 400 });
    const db = getDb();
    const now = Date.now();
    const rowId = `kpi-${id}-${body.metric}-${body.weekLabel}`.replace(/\s+/g, '-');

    db.prepare(`
      INSERT INTO campaign_kpi_weekly (id, campaignId, metric, weekLabel, weekStart, target, actual, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(campaignId, metric, weekLabel) DO UPDATE SET
        target = COALESCE(excluded.target, target),
        actual = COALESCE(excluded.actual, actual),
        weekStart = excluded.weekStart,
        updatedAt = excluded.updatedAt
    `).run(
      rowId,
      id,
      body.metric,
      body.weekLabel,
      body.weekStart ?? now,
      body.target ?? null,
      body.actual ?? null,
      now,
      now,
    );

    const row = db.prepare(`SELECT * FROM campaign_kpi_weekly WHERE campaignId = ? AND metric = ? AND weekLabel = ?`).get(id, body.metric, body.weekLabel);
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/campaigns/:id/kpi-weekly/seed — seed all weeks for a campaign
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    // body.metrics: string[], body.weeks: {label: string, weekStart: number}[]
    const metrics: string[] = body.metrics ?? [];
    const weeks: { label: string; weekStart: number }[] = body.weeks ?? [];
    if (!metrics.length || !weeks.length) return NextResponse.json({ error: 'metrics and weeks required' }, { status: 400 });
    const db = getDb();
    const now = Date.now();

    const insert = db.prepare(`
      INSERT OR IGNORE INTO campaign_kpi_weekly (id, campaignId, metric, weekLabel, weekStart, target, actual, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)
    `);

    const insertMany = db.transaction(() => {
      for (const metric of metrics) {
        for (const week of weeks) {
          const rowId = `kpi-${id}-${metric}-${week.label}`.replace(/\s+/g, '-');
          insert.run(rowId, id, metric, week.label, week.weekStart, now, now);
        }
      }
    });
    insertMany();

    const rows = db.prepare(`SELECT * FROM campaign_kpi_weekly WHERE campaignId = ? ORDER BY weekStart ASC, metric ASC`).all(id);
    return NextResponse.json({ rows }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
