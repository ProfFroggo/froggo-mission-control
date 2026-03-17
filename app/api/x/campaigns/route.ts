// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// CRUD API for x_campaigns table — dedicated social campaign management
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const conditions: string[] = [];
    const values: unknown[] = [];

    const status = searchParams.get('status');
    if (status) { conditions.push('status = ?'); values.push(status); }

    const limit = parseInt(searchParams.get('limit') || '100');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT * FROM x_campaigns ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...values, limit);

    // Parse JSON fields
    const campaigns = (rows as Record<string, unknown>[]).map(row => ({
      ...row,
      stages: row.stages ? JSON.parse(row.stages as string) : [],
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    }));

    return NextResponse.json({ ok: true, campaigns, total: campaigns.length });
  } catch (error) {
    console.error('GET /api/x/campaigns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `xcampaign-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    const title = body.title || '';
    const subject = body.subject || '';
    const status = body.status || 'draft';
    const startDate = body.start_date || null;
    const stages = body.stages ? (typeof body.stages === 'string' ? body.stages : JSON.stringify(body.stages)) : '[]';
    const parsedStages = JSON.parse(stages);
    const totalPosts = parsedStages.length;
    const postsPublished = body.posts_published || 0;
    const proposedBy = body.proposed_by || 'user';
    const metadata = body.metadata ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata)) : '{}';

    db.prepare(`
      INSERT INTO x_campaigns (id, title, subject, status, start_date, stages, total_posts, posts_published, proposed_by, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, subject, status, startDate, stages, totalPosts, postsPublished, proposedBy, metadata, now, now);

    const created = db.prepare('SELECT * FROM x_campaigns WHERE id = ?').get(id) as Record<string, unknown>;
    const campaign = {
      ...created,
      stages: created.stages ? JSON.parse(created.stages as string) : [],
      metadata: created.metadata ? JSON.parse(created.metadata as string) : {},
    };

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (error) {
    console.error('POST /api/x/campaigns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const allowed = [
      'title', 'subject', 'status', 'start_date', 'stages',
      'total_posts', 'posts_published', 'proposed_by', 'metadata',
    ];

    const setClauses: string[] = ['updated_at = ?'];
    const vals: unknown[] = [Date.now()];

    for (const field of allowed) {
      if (field in updates) {
        setClauses.push(`${field} = ?`);
        const val = updates[field];
        if (field === 'stages' || field === 'metadata') {
          vals.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
        } else {
          vals.push(val);
        }
      }
    }

    vals.push(id);
    const result = db.prepare(`UPDATE x_campaigns SET ${setClauses.join(', ')} WHERE id = ?`).run(...vals);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const updated = db.prepare('SELECT * FROM x_campaigns WHERE id = ?').get(id) as Record<string, unknown>;
    const campaign = {
      ...updated,
      stages: updated.stages ? JSON.parse(updated.stages as string) : [],
      metadata: updated.metadata ? JSON.parse(updated.metadata as string) : {},
    };

    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    console.error('PATCH /api/x/campaigns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      const body = await req.json().catch(() => ({}));
      const bodyId = (body as Record<string, unknown>).id as string | undefined;
      if (!bodyId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const result = db.prepare('DELETE FROM x_campaigns WHERE id = ?').run(bodyId);
      if (result.changes === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      return NextResponse.json({ ok: true, deleted: bodyId });
    }

    const result = db.prepare('DELETE FROM x_campaigns WHERE id = ?').run(id);
    if (result.changes === 0) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) {
    console.error('DELETE /api/x/campaigns error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
