// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// CRUD API for x_posts table — dedicated social post pipeline
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

    const type = searchParams.get('type');
    if (type) { conditions.push('type = ?'); values.push(type); }

    const campaignId = searchParams.get('campaign_id');
    if (campaignId) { conditions.push('campaign_id = ?'); values.push(campaignId); }

    const limit = parseInt(searchParams.get('limit') || '200');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT * FROM x_posts ${where} ORDER BY created_at DESC LIMIT ?`
    ).all(...values, limit);

    // Parse JSON fields
    const posts = (rows as Record<string, unknown>[]).map(row => ({
      ...row,
      thread_tweets: row.thread_tweets ? JSON.parse(row.thread_tweets as string) : null,
      media_ids: row.media_ids ? JSON.parse(row.media_ids as string) : null,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    }));

    return NextResponse.json({ ok: true, posts, total: posts.length });
  } catch (error) {
    console.error('GET /api/x/posts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || `xpost-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = Date.now();

    const content = body.content || '';
    const type = body.type || 'tweet';
    const status = body.status || 'draft';
    const threadTweets = body.thread_tweets ? JSON.stringify(body.thread_tweets) : null;
    const mediaIds = body.media_ids ? JSON.stringify(body.media_ids) : null;
    const scheduledFor = body.scheduled_for || null;
    const publishedAt = body.published_at || null;
    const publishedTweetId = body.published_tweet_id || null;
    const campaignId = body.campaign_id || null;
    const proposedBy = body.proposed_by || 'user';
    const metadata = body.metadata ? JSON.stringify(body.metadata) : '{}';

    db.prepare(`
      INSERT INTO x_posts (id, content, type, status, thread_tweets, media_ids, scheduled_for, published_at, published_tweet_id, campaign_id, proposed_by, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, content, type, status, threadTweets, mediaIds, scheduledFor, publishedAt, publishedTweetId, campaignId, proposedBy, metadata, now, now);

    // Auto-create approval record for tweet-type posts (nothing posts without human approval)
    let approvalId: string | null = null;
    if (type === 'tweet' || type === 'thread' || type === 'post') {
      approvalId = randomUUID();
      db.prepare(`
        INSERT INTO approvals (id, type, title, content, context, metadata, status, requester, tier, category, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `).run(
        approvalId,
        'tweet',
        `Post: ${content.slice(0, 60)}${content.length > 60 ? '...' : ''}`,
        content,
        null,
        JSON.stringify({ postId: id, postType: type, campaignId }),
        proposedBy,
        3,
        'agent_approval',
        now,
      );

      // Link approval to post
      db.prepare('UPDATE x_posts SET approval_id = ? WHERE id = ?').run(approvalId, id);
    }

    const created = db.prepare('SELECT * FROM x_posts WHERE id = ?').get(id) as Record<string, unknown>;
    const post = {
      ...created,
      thread_tweets: created.thread_tweets ? JSON.parse(created.thread_tweets as string) : null,
      media_ids: created.media_ids ? JSON.parse(created.media_ids as string) : null,
      metadata: created.metadata ? JSON.parse(created.metadata as string) : {},
    };

    return NextResponse.json({ ok: true, post, approval_id: approvalId }, { status: 201 });
  } catch (error) {
    console.error('POST /api/x/posts error:', error);
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
      'content', 'type', 'status', 'thread_tweets', 'media_ids',
      'scheduled_for', 'published_at', 'published_tweet_id',
      'like_count', 'retweet_count', 'reply_count', 'impression_count',
      'campaign_id', 'proposed_by', 'approval_id', 'metadata',
    ];

    const setClauses: string[] = ['updated_at = ?'];
    const vals: unknown[] = [Date.now()];

    for (const field of allowed) {
      if (field in updates) {
        setClauses.push(`${field} = ?`);
        const val = updates[field];
        if (field === 'thread_tweets' || field === 'media_ids' || field === 'metadata') {
          vals.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
        } else {
          vals.push(val);
        }
      }
    }

    vals.push(id);
    const result = db.prepare(`UPDATE x_posts SET ${setClauses.join(', ')} WHERE id = ?`).run(...vals);

    if (result.changes === 0) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updated = db.prepare('SELECT * FROM x_posts WHERE id = ?').get(id) as Record<string, unknown>;
    const post = {
      ...updated,
      thread_tweets: updated.thread_tweets ? JSON.parse(updated.thread_tweets as string) : null,
      media_ids: updated.media_ids ? JSON.parse(updated.media_ids as string) : null,
      metadata: updated.metadata ? JSON.parse(updated.metadata as string) : {},
    };

    return NextResponse.json({ ok: true, post });
  } catch (error) {
    console.error('PATCH /api/x/posts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      // Try reading from body
      const body = await req.json().catch(() => ({}));
      const bodyId = (body as Record<string, unknown>).id as string | undefined;
      if (!bodyId) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const result = db.prepare('DELETE FROM x_posts WHERE id = ?').run(bodyId);
      if (result.changes === 0) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      return NextResponse.json({ ok: true, deleted: bodyId });
    }

    const result = db.prepare('DELETE FROM x_posts WHERE id = ?').run(id);
    if (result.changes === 0) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (error) {
    console.error('DELETE /api/x/posts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
