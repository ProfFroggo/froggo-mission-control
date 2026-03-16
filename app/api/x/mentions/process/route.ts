// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/x/mentions/process — Background job: fetch mentions, store in inbox, generate AI replies
// Called by cron daemon every 15 minutes or manually via Engage tab
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { getTwitterClient } from '@/lib/twitterClient';
// ENV imported but PORT accessed via process.env directly

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for AI generation

interface ProcessResult {
  fetched: number;
  newMentions: number;
  aiRepliesGenerated: number;
  errors: string[];
}

export async function POST() {
  const result: ProcessResult = { fetched: 0, newMentions: 0, aiRepliesGenerated: 0, errors: [] };

  try {
    const db = getDb();
    const client = await getTwitterClient();
    if (!client) {
      return NextResponse.json({ ...result, error: 'Twitter not configured' }, { status: 200 });
    }

    // 1. Get our user ID
    const me = await client.v2.me();
    if (!me.data?.id) {
      return NextResponse.json({ ...result, error: 'Could not get user profile' }, { status: 200 });
    }
    const myId = me.data.id;

    // 2. Fetch mentions with full context
    const mentions = await client.v2.userMentionTimeline(myId, {
      max_results: 50,
      'tweet.fields': [
        'created_at', 'public_metrics', 'author_id', 'conversation_id',
        'in_reply_to_user_id', 'referenced_tweets', 'reply_settings',
      ],
      expansions: ['author_id', 'referenced_tweets.id', 'referenced_tweets.id.author_id'],
      'user.fields': ['name', 'username', 'profile_image_url', 'public_metrics'],
    });

    const tweets = mentions.data?.data || [];
    const users = mentions.includes?.users || [];
    const referencedTweets = mentions.includes?.tweets || [];
    const userMap = new Map(users.map(u => [u.id, u]));
    const tweetMap = new Map(referencedTweets.map(t => [t.id, t]));
    result.fetched = tweets.length;

    // 3. Store new mentions in inbox
    for (const tweet of tweets) {
      const author = userMap.get(tweet.author_id as string);
      const refTweets = (tweet.referenced_tweets || []).map((ref: any) => {
        const refTweet = tweetMap.get(ref.id);
        const refAuthor = refTweet ? userMap.get(refTweet.author_id as string) : undefined;
        return {
          type: ref.type,
          id: ref.id,
          text: refTweet?.text || null,
          author: refAuthor ? { id: refAuthor.id, username: refAuthor.username, name: refAuthor.name } : null,
        };
      });

      const isReplyToUs = tweet.in_reply_to_user_id === myId;
      const isReplyToOther = !!tweet.in_reply_to_user_id && tweet.in_reply_to_user_id !== myId;
      const hasQuote = refTweets.some((r: any) => r.type === 'quoted');
      const mentionType = (isReplyToUs || isReplyToOther) ? 'reply' : hasQuote ? 'quote' : 'mention';
      const parentRef = refTweets.find((r: any) => r.type === 'replied_to') || null;

      // Check if already exists (by tweet_id in metadata)
      const existing = db.prepare(
        `SELECT id FROM inbox WHERE type = 'x-mention' AND json_extract(metadata, '$.tweet_id') = ?`
      ).get(tweet.id) as { id: number } | undefined;

      if (existing) continue;

      const metadata = {
        tweet_id: tweet.id,
        author_id: author?.id || tweet.author_id,
        author_username: author?.username || 'unknown',
        author_name: author?.name || 'Unknown',
        author_followers: (author as any)?.public_metrics?.followers_count,
        conversation_id: tweet.conversation_id,
        in_reply_to_user_id: tweet.in_reply_to_user_id || '',
        mention_type: mentionType,
        is_reply_to_us: isReplyToUs,
        parent_tweet: parentRef,
        reply_status: 'pending',
        public_metrics: tweet.public_metrics || {},
        created_at: new Date(tweet.created_at as string).getTime(),
      };

      try {
        db.prepare(`
          INSERT INTO inbox (type, title, content, channel, status, createdAt, metadata, starred, isRead, tags, project)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, '[]', NULL)
        `).run(
          'x-mention',
          `@${author?.username || 'unknown'}: ${(tweet.text || '').slice(0, 80)}`,
          tweet.text || '',
          'x-twitter',
          'pending',
          Date.now(),
          JSON.stringify(metadata),
        );
        result.newMentions++;
      } catch {
        // Duplicate or DB error — skip
      }
    }

    // 4. Generate AI replies for pending mentions without suggestions
    const pendingMentions = db.prepare(`
      SELECT id, content, metadata FROM inbox
      WHERE type = 'x-mention'
      AND status = 'pending'
      AND json_extract(metadata, '$.ai_replies') IS NULL
      ORDER BY createdAt DESC
      LIMIT 10
    `).all() as Array<{ id: number; content: string; metadata: string }>;

    // Load knowledge base for brand context — get comprehensive brand knowledge
    let brandContext = '';
    let brandGuidelines = '';
    try {
      // Get brand/strategy articles
      const kbRows = db.prepare(
        `SELECT title, summary, content FROM knowledge_base
         WHERE scope IN ('agents', 'all')
         ORDER BY
           CASE WHEN tags LIKE '%brand%' OR tags LIKE '%voice%' OR tags LIKE '%strategy%' THEN 0 ELSE 1 END,
           updated_at DESC
         LIMIT 5`
      ).all() as Array<{ title: string; summary: string; content: string }>;

      if (kbRows.length > 0) {
        brandContext = `\n\nBrand knowledge base (use this to inform tone, facts, and positioning):\n${kbRows.map(a =>
          `- ${a.title}: ${(a.summary || a.content || '').slice(0, 300)}`
        ).join('\n')}`;

        // Extract any explicit guidelines
        const guidelineArticles = kbRows.filter(a =>
          a.title.toLowerCase().includes('guide') ||
          a.title.toLowerCase().includes('voice') ||
          a.title.toLowerCase().includes('brand')
        );
        if (guidelineArticles.length > 0) {
          brandGuidelines = `\n\nBrand guidelines to follow:\n${guidelineArticles.map(a =>
            (a.content || '').slice(0, 500)
          ).join('\n')}`;
        }
      }
    } catch { /* KB might not exist */ }

    // Get recent approved replies to learn from past decisions
    let replyHistory = '';
    try {
      const recentApproved = db.prepare(
        `SELECT content, metadata FROM approvals
         WHERE type = 'x-reply' AND status = 'approved'
         ORDER BY created_at DESC LIMIT 5`
      ).all() as Array<{ content: string; metadata: string }>;

      if (recentApproved.length > 0) {
        replyHistory = `\n\nRecently approved replies (match this tone and style):\n${recentApproved.map(a => {
          try {
            const m = JSON.parse(a.metadata || '{}');
            return `- To @${m.payload?.mentionId || 'user'}: "${m.payload?.replyText || a.content}"`;
          } catch { return ''; }
        }).filter(Boolean).join('\n')}`;
      }
    } catch { /* approvals table might not have these */ }

    for (const row of pendingMentions) {
      let meta: any = {};
      try { meta = JSON.parse(row.metadata); } catch { continue; }

      const parentContext = meta.parent_tweet?.text
        ? `\nThis is a reply to: "${meta.parent_tweet.text}" by @${meta.parent_tweet.author?.username || 'unknown'}`
        : '';
      const typeContext = meta.mention_type === 'reply'
        ? (meta.is_reply_to_us ? 'This is a reply to YOUR tweet.' : 'This is a reply mentioning you.')
        : meta.mention_type === 'quote' ? 'This is a quote tweet.' : 'This is a direct mention.';

      const followerContext = meta.author_followers != null
        ? `\nAuthor has ${meta.author_followers} followers (${meta.author_followers > 10000 ? 'HIGH PROFILE — take extra care' : meta.author_followers > 1000 ? 'medium following' : 'smaller account'}).`
        : '';

      const prompt = `You are a social media manager crafting reply options for an X/Twitter mention. Generate exactly 3 reply options.

MENTION:
@${meta.author_username}: "${row.content}"${parentContext}
${typeContext}${followerContext}
${brandContext}${brandGuidelines}${replyHistory}

RULES:
- Each reply MUST be under 200 characters
- Reference specific details from their tweet (never generic)
- If they asked a question, answer it with real information from the knowledge base
- If they gave feedback, acknowledge the specific point
- Match the brand voice from the knowledge base
- Learn from recently approved replies for tone consistency
- Option 1: Professional/informative — lead with value
- Option 2: Casual/engaging — conversational and warm
- Option 3: Bold/witty — memorable and shareable

Pick the best option based on: mention type, author profile size, sentiment, and brand fit.

Return ONLY JSON: {"replies": ["reply1", "reply2", "reply3"], "recommended": 0, "reasoning": "brief reason for recommendation"}`;

      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/chat/generate-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: prompt, context: 'Social media reply generator. Return ONLY JSON.', tone: 'professional' }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || '';
          const objMatch = reply.match(/\{[\s\S]*"replies"[\s\S]*\}/);
          const arrMatch = reply.match(/\[[\s\S]*?\]/);

          let aiReplies: any = null;
          if (objMatch) {
            try { aiReplies = JSON.parse(objMatch[0]); } catch { /* skip */ }
          } else if (arrMatch) {
            try {
              const arr = JSON.parse(arrMatch[0]);
              if (Array.isArray(arr)) aiReplies = { replies: arr.slice(0, 3), recommended: 0, reasoning: '' };
            } catch { /* skip */ }
          }

          if (aiReplies?.replies?.length) {
            const recIdx = typeof aiReplies.recommended === 'number' ? aiReplies.recommended : 0;
            meta.ai_replies = {
              replies: aiReplies.replies.slice(0, 3),
              recommended: recIdx,
              reasoning: aiReplies.reasoning || '',
              generated_at: Date.now(),
            };
            db.prepare('UPDATE inbox SET metadata = ? WHERE id = ?').run(JSON.stringify(meta), row.id);
            result.aiRepliesGenerated++;

            // Auto-queue the recommended reply into the approval pipeline
            const bestReply = aiReplies.replies[recIdx] || aiReplies.replies[0];
            if (bestReply) {
              try {
                // Check if an approval already exists for this mention
                const existingApproval = db.prepare(
                  `SELECT id FROM approvals WHERE type = 'x-reply' AND json_extract(payload, '$.mentionId') = ? AND status = 'pending'`
                ).get(String(row.id));

                if (!existingApproval) {
                  db.prepare(`
                    INSERT INTO approvals (type, tier, status, payload, metadata, requestedBy, created_at)
                    VALUES (?, ?, 'pending', ?, ?, ?, ?)
                  `).run(
                    'x-reply',
                    3, // standard tier — human reviews
                    JSON.stringify({
                      mentionId: String(row.id),
                      tweetId: meta.tweet_id,
                      replyText: bestReply,
                    }),
                    JSON.stringify({
                      auto_generated: true,
                      mention_author: meta.author_username,
                      mention_text: (row.content || '').slice(0, 100),
                      reasoning: aiReplies.reasoning || '',
                      all_options: aiReplies.replies.slice(0, 3),
                      recommended_index: recIdx,
                    }),
                    'ai-social-manager',
                    Date.now(),
                  );
                }
              } catch { /* approval table might have different schema — non-fatal */ }
            }
          }
        }
      } catch (err) {
        result.errors.push(`AI reply for ${row.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[x/mentions/process]', err);
    return NextResponse.json({ ok: false, ...result, error: String(err) }, { status: 500 });
  }
}
