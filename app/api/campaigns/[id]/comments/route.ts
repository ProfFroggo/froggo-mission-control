// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

function ensureTable(db: ReturnType<typeof getDb>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_comments (
      id TEXT PRIMARY KEY,
      campaignId TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'user',
      body TEXT NOT NULL,
      parentId TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_comments_campaignId ON campaign_comments(campaignId, createdAt);
  `);
}

// GET /api/campaigns/:id/comments
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTable(db);

    const comments = db.prepare(
      'SELECT * FROM campaign_comments WHERE campaignId = ? ORDER BY createdAt ASC'
    ).all(id);

    return NextResponse.json({ success: true, comments });
  } catch (error) {
    console.error('GET /api/campaigns/:id/comments error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/campaigns/:id/comments
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    ensureTable(db);

    const body = await req.json().catch(() => ({}));
    const { author = 'user', body: commentBody, parentId } = body as {
      author?: string;
      body?: string;
      parentId?: string;
    };

    if (!commentBody || typeof commentBody !== 'string' || !commentBody.trim()) {
      return NextResponse.json({ success: false, error: 'body is required' }, { status: 400 });
    }

    const commentId = randomUUID();
    db.prepare(
      'INSERT INTO campaign_comments (id, campaignId, author, body, parentId) VALUES (?, ?, ?, ?, ?)'
    ).run(commentId, id, author, commentBody.trim(), parentId ?? null);

    const comment = db.prepare('SELECT * FROM campaign_comments WHERE id = ?').get(commentId);
    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    console.error('POST /api/campaigns/:id/comments error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
