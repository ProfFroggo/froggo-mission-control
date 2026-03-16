// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// POST /api/x/mentions/process — Background job: fetch mentions, store in inbox, generate AI replies
// Called by cron daemon every 15 minutes or manually via Engage tab
// Uses Gemini Flash Lite for AI reply generation (fast, cheap, no CLI spawn overhead)
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { getTwitterClient } from '@/lib/twitterClient';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 120s for full batch

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_FALLBACK = 'gemini-2.5-flash-preview-05-20';

async function getGeminiKey(): Promise<string | null> {
  try {
    const { keychainGet } = await import('@/lib/keychain');
    const val = await keychainGet('gemini_api_key');
    if (val) return val;
  } catch { /* ignore */ }
  return process.env.GEMINI_API_KEY ?? null;
}

async function geminiGenerate(prompt: string, apiKey: string): Promise<string | null> {
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) {
        if (model === GEMINI_MODEL) continue; // try fallback
        return null;
      }
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      if (model === GEMINI_MODEL) continue;
      return null;
    }
  }
  return null;
}

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

      // Check if already exists in x_mentions
      const existing = db.prepare(
        `SELECT id FROM x_mentions WHERE tweet_id = ?`
      ).get(tweet.id) as { id: string } | undefined;

      if (existing) continue;

      const metrics = (tweet.public_metrics || {}) as Record<string, number>;
      const mentionId = `xm-${tweet.id}`;
      const tweetCreatedAt = new Date(tweet.created_at as string).getTime();

      try {
        db.prepare(`
          INSERT INTO x_mentions (
            id, tweet_id, author_id, author_username, author_name, author_followers,
            text, mention_type, is_reply_to_us, parent_tweet_id, parent_tweet_text, parent_tweet_author,
            conversation_id, in_reply_to_user_id,
            like_count, retweet_count, reply_count,
            reply_status, tweet_created_at, fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
        `).run(
          mentionId,
          tweet.id,
          author?.id || tweet.author_id || '',
          author?.username || 'unknown',
          author?.name || 'Unknown',
          (author as any)?.public_metrics?.followers_count ?? null,
          tweet.text || '',
          mentionType,
          isReplyToUs ? 1 : 0,
          parentRef?.id || null,
          parentRef?.text || null,
          parentRef?.author?.username || null,
          tweet.conversation_id || null,
          tweet.in_reply_to_user_id || null,
          metrics.like_count ?? 0,
          metrics.retweet_count ?? 0,
          metrics.reply_count ?? 0,
          tweetCreatedAt,
          Date.now(),
        );
        result.newMentions++;
      } catch {
        // Duplicate or DB error — skip
      }
    }

    // 4. Generate AI replies for pending mentions without AI processing
    const pendingMentions = db.prepare(`
      SELECT * FROM x_mentions
      WHERE reply_status = 'pending'
      AND ai_processed_at IS NULL
      ORDER BY tweet_created_at DESC
    `).all() as Array<any>;

    // Load knowledge base — MANDATORY: Voice & Style Guide is the primary reference
    let voiceGuide = '';
    let brandContext = '';
    let brandGuidelines = '';
    try {
      // 1. Load the Voice & Style Guide specifically — this is the #1 reference for all replies
      const voiceRow = db.prepare(
        `SELECT title, content FROM knowledge_base
         WHERE title LIKE '%Voice and Style Guide%' OR title LIKE '%Voice & Style%'
         LIMIT 1`
      ).get() as { title: string; content: string } | undefined;

      if (voiceRow) {
        // Give the AI the FULL guide (up to 3000 chars) — this is the most important context
        voiceGuide = `\n\n=== MANDATORY: ${voiceRow.title} ===\nYou MUST follow this guide for every reply. Read it carefully before writing anything.\n\n${(voiceRow.content || '').slice(0, 3000)}`;
      }

      // 2. Load Brand Voice & Tone (general)
      const brandVoiceRow = db.prepare(
        `SELECT title, content FROM knowledge_base
         WHERE title LIKE '%Brand Voice%' AND title NOT LIKE '%Style Guide%'
         LIMIT 1`
      ).get() as { title: string; content: string } | undefined;

      if (brandVoiceRow) {
        brandGuidelines = `\n\n=== ${brandVoiceRow.title} ===\n${(brandVoiceRow.content || '').slice(0, 1500)}`;
      }

      // 3. Load additional brand/strategy articles for factual context
      const kbRows = db.prepare(
        `SELECT title, summary, content FROM knowledge_base
         WHERE scope IN ('agents', 'all')
         AND title NOT LIKE '%Voice and Style Guide%'
         AND title NOT LIKE '%Brand Voice%'
         ORDER BY
           CASE WHEN tags LIKE '%brand%' OR tags LIKE '%strategy%' OR tags LIKE '%product%' THEN 0 ELSE 1 END,
           updated_at DESC
         LIMIT 5`
      ).all() as Array<{ title: string; summary: string; content: string }>;

      if (kbRows.length > 0) {
        brandContext = `\n\nAdditional brand knowledge (use for facts and positioning):\n${kbRows.map(a =>
          `- ${a.title}: ${(a.summary || a.content || '').slice(0, 300)}`
        ).join('\n')}`;
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
      const parentContext = row.parent_tweet_text
        ? `\nThis is a reply to: "${row.parent_tweet_text}" by @${row.parent_tweet_author || 'unknown'}`
        : '';
      const typeContext = row.mention_type === 'reply'
        ? (row.is_reply_to_us ? 'This is a reply to YOUR tweet.' : 'This is a reply mentioning you.')
        : row.mention_type === 'quote' ? 'This is a quote tweet.' : 'This is a direct mention.';

      const followerContext = row.author_followers != null
        ? `\nAuthor has ${row.author_followers} followers (${row.author_followers > 10000 ? 'HIGH PROFILE — take extra care' : row.author_followers > 1000 ? 'medium following' : 'smaller account'}).`
        : '';

      const prompt = `You are the social media manager for Bitso Onchain (@BitsoOnchain). Before writing ANY reply, you MUST review the Voice and Style Guide below and match its tone, vocabulary, and style exactly.
${voiceGuide}
${brandGuidelines}

STEP 1 — TRIAGE THIS MENTION. Decide:
- "reply" — worth replying to (genuine question, feedback, engagement opportunity)
- "ignore" — not worth replying (spam, trolling, irrelevant, bot-like)
- "escalate" — needs human review (complaint, legal mention, competitor attack, sensitive topic, angry customer)

STEP 2 — If "reply", generate exactly 3 reply options that MATCH THE VOICE AND STYLE GUIDE. If "ignore" or "escalate", skip replies.

STEP 3 — VALIDATE each reply:
- Does it match the voice guide's tone, vocabulary, and style?
- Does it contain accurate information from the knowledge base?
- Does it accidentally reveal internal information? (roadmaps, pricing changes, unreleased features)
- Could it be misinterpreted as a commitment, guarantee, or legal statement?
- Would you be comfortable if this was screenshotted and went viral?

Flag any reply that fails validation as "unsafe" with a reason.

MENTION:
@${row.author_username}: "${row.text}"${parentContext}
${typeContext}${followerContext}
${brandContext}${replyHistory}

REPLY RULES:
- KEEP IT SHORT. 50-120 characters ideal. Under 150 max. Sound human, not like a brand bot.
- REPLY IN THE SAME LANGUAGE AS THE MENTION. Spanish mention = Spanish reply. Always match.
- Sound like a real person tweeting, not a corporate account. No "We appreciate your feedback" energy.
- Match the voice guide tone but keep it natural — like a crypto-native friend, not a marketing team.
- Reference something specific from THEIR tweet (never generic "thanks for the support" replies)
- If they asked a question, answer directly from knowledge base — if you don't know, say "DM us"
- Never mention competitors. Never promise timelines/features/pricing.
- Trolls/hostile = "ignore". Complaints = empathy + DM offer, never defensive.
- Option 1: Direct/helpful — answer or acknowledge their specific point
- Option 2: Casual/fun — how you'd reply to a friend
- Option 3: Punchy/bold — one-liner energy, quotable

Also detect the language of the mention and provide English translations of each reply if they are NOT in English.

Return ONLY JSON:
{
  "triage": "reply" | "ignore" | "escalate",
  "triage_reason": "brief explanation",
  "detected_language": "en" | "es" | "pt" | "ja" | etc,
  "mention_translation": "English translation of the mention (only if not English, otherwise null)",
  "replies": ["reply1", "reply2", "reply3"],
  "replies_english": ["English translation of reply1 (null if already English)", ...],
  "recommended": 0,
  "reasoning": "why this option is best and how it matches the voice guide",
  "safety_flags": ["any concerns about specific replies"],
  "confidence": 0.0-1.0
}`;

      try {
        // Use Gemini Flash Lite directly — faster and cheaper than Claude CLI spawn
        const geminiKey = await getGeminiKey();
        if (!geminiKey) {
          result.errors.push('No Gemini API key configured');
          break; // Can't generate without a key
        }
        const reply = await geminiGenerate(prompt, geminiKey);

        if (reply) {
          const objMatch = reply.match(/\{[\s\S]*"replies"[\s\S]*\}/);
          const arrMatch = reply.match(/\[[\s\S]*?\]/);

          let aiResult: any = null;
          if (objMatch) {
            try { aiResult = JSON.parse(objMatch[0]); } catch { /* skip */ }
          } else if (arrMatch) {
            try {
              const arr = JSON.parse(arrMatch[0]);
              if (Array.isArray(arr)) aiResult = { triage: 'reply', replies: arr.slice(0, 3), recommended: 0 };
            } catch { /* skip */ }
          }

          if (!aiResult) continue;

          const triage = aiResult.triage || 'reply';
          const confidence = typeof aiResult.confidence === 'number' ? aiResult.confidence : 0.5;

          if (triage === 'ignore') {
            db.prepare(`
              UPDATE x_mentions SET reply_status = 'ignored', ai_triage = 'ignore',
              ai_triage_reason = ?, ai_confidence = ?, ai_processed_at = ?, updated_at = ?
              WHERE id = ?
            `).run(aiResult.triage_reason || '', confidence, Date.now(), Date.now(), row.id);
            continue;
          }

          if (triage === 'escalate') {
            db.prepare(`
              UPDATE x_mentions SET reply_status = 'considering', ai_triage = 'escalate',
              ai_triage_reason = ?, ai_confidence = ?, ai_processed_at = ?, updated_at = ?
              WHERE id = ?
            `).run(aiResult.triage_reason || '', confidence, Date.now(), Date.now(), row.id);
            continue;
          }

          // triage === 'reply' — store AI replies and queue
          if (aiResult.replies?.length) {
            const recIdx = typeof aiResult.recommended === 'number' ? aiResult.recommended : 0;
            const safetyFlags = aiResult.safety_flags || [];
            const hasSafetyIssues = safetyFlags.length > 0;

            db.prepare(`
              UPDATE x_mentions SET
                ai_triage = 'reply', ai_triage_reason = ?, ai_confidence = ?,
                ai_safety_flags = ?, ai_replies = ?, ai_replies_english = ?,
                ai_recommended = ?, ai_reasoning = ?, ai_processed_at = ?,
                detected_language = ?, mention_translation = ?, updated_at = ?
              WHERE id = ?
            `).run(
              aiResult.triage_reason || '',
              confidence,
              JSON.stringify(safetyFlags),
              JSON.stringify(aiResult.replies.slice(0, 3)),
              JSON.stringify(aiResult.replies_english?.slice(0, 3) || []),
              recIdx,
              aiResult.reasoning || '',
              Date.now(),
              aiResult.detected_language || 'en',
              aiResult.mention_translation || null,
              Date.now(),
              row.id,
            );
            result.aiRepliesGenerated++;

            // Only auto-queue to approval pipeline if:
            // 1. Confidence >= 0.7
            // 2. No safety flags
            // 3. Triage is definitively "reply"
            if (confidence >= 0.7 && !hasSafetyIssues) {
              const bestReply = aiResult.replies[recIdx] || aiResult.replies[0];
              if (bestReply) {
                try {
                  const existingApproval = db.prepare(
                    `SELECT id FROM approvals WHERE type = 'x-reply' AND json_extract(metadata, '$.mentionId') = ? AND status = 'pending'`
                  ).get(String(row.id));

                  if (!existingApproval) {
                    const approvalId = `xr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    db.prepare(`
                      INSERT INTO approvals (id, type, title, content, tier, status, metadata, requester, createdAt)
                      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                    `).run(
                      approvalId,
                      'x-reply',
                      `Reply to @${row.author_username}`,
                      bestReply,
                      confidence >= 0.9 ? 1 : 3,
                      JSON.stringify({
                        auto_generated: true,
                        mentionId: String(row.id),
                        tweetId: row.tweet_id,
                        replyText: bestReply,
                        mention_author: row.author_username,
                        mention_text: (row.text || '').slice(0, 100),
                        reasoning: aiResult.reasoning || '',
                        all_options: aiResult.replies.slice(0, 3),
                        recommended_index: recIdx,
                        confidence,
                        safety_flags: safetyFlags,
                        triage_reason: aiResult.triage_reason || '',
                      }),
                      'ai-social-manager',
                      Date.now(),
                    );

                    // Also create a schedule item so it shows in Pipeline view
                    try {
                      const schedId = `si-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                      db.prepare(`
                        INSERT INTO scheduled_items (id, type, content, status, platform, scheduledFor, metadata, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      `).run(
                        schedId,
                        'draft',
                        bestReply,
                        'pending',
                        'twitter',
                        String(Date.now()),
                        JSON.stringify({
                          proposed_by: 'ai-social-manager',
                          mention_reply: true,
                          mention_id: String(row.id),
                          mention_author: row.author_username,
                          tweet_id: row.tweet_id,
                          approval_id: approvalId,
                          confidence,
                        }),
                        Date.now(),
                        Date.now(),
                      );
                    } catch { /* schedule table might differ — non-fatal */ }
                  }
                } catch (e) {
                  result.errors.push(`Approval for mention ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
                }
              }
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
