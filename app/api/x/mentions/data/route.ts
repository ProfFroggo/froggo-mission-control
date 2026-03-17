// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/x/mentions/data — Read mentions from x_mentions table
// PATCH /api/x/mentions/data — Update a mention (status, notes, etc.)
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);

    const conditions: string[] = [];
    const values: unknown[] = [];

    const status = searchParams.get('status');
    if (status) { conditions.push('reply_status = ?'); values.push(status); }

    const type = searchParams.get('type');
    if (type) { conditions.push('mention_type = ?'); values.push(type); }

    const spam = searchParams.get('spam');
    if (spam === 'true') { conditions.push('is_spam = 1'); }
    else if (spam === 'false') { conditions.push('is_spam = 0'); }

    const processed = searchParams.get('processed');
    if (processed === 'true') { conditions.push('ai_processed_at IS NOT NULL'); }
    else if (processed === 'false') { conditions.push('ai_processed_at IS NULL'); }

    const limit = parseInt(searchParams.get('limit') || '100');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT * FROM x_mentions ${where} ORDER BY tweet_created_at DESC LIMIT ?`
    ).all(...values, limit);

    // Parse JSON fields
    const parsed = (rows as any[]).map(row => ({
      ...row,
      ai_safety_flags: row.ai_safety_flags ? JSON.parse(row.ai_safety_flags) : [],
      ai_replies: row.ai_replies ? JSON.parse(row.ai_replies) : null,
      ai_replies_english: row.ai_replies_english ? JSON.parse(row.ai_replies_english) : null,
      is_reply_to_us: !!row.is_reply_to_us,
      is_spam: !!row.is_spam,
    }));

    return NextResponse.json({ ok: true, mentions: parsed, total: parsed.length });
  } catch (error) {
    console.error('GET /api/x/mentions/data error:', error);
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
      'reply_status', 'notes', 'is_spam', 'replied_at', 'replied_with_id',
      'ai_triage', 'ai_triage_reason', 'ai_confidence', 'ai_safety_flags',
      'ai_replies', 'ai_replies_english', 'ai_recommended', 'ai_reasoning',
      'ai_processed_at', 'detected_language', 'mention_translation',
    ];

    const setClauses: string[] = ['updated_at = ?'];
    const vals: unknown[] = [Date.now()];

    for (const field of allowed) {
      if (field in updates) {
        setClauses.push(`${field} = ?`);
        const val = updates[field];
        vals.push(typeof val === 'object' ? JSON.stringify(val) : val);
      }
    }

    vals.push(id);
    const result = db.prepare(`UPDATE x_mentions SET ${setClauses.join(', ')} WHERE id = ?`).run(...vals);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Mention not found' }, { status: 404 });
    }

    const updated = db.prepare('SELECT * FROM x_mentions WHERE id = ?').get(id);
    return NextResponse.json({ ok: true, mention: updated });
  } catch (error) {
    console.error('PATCH /api/x/mentions/data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
