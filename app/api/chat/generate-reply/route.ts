// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Social media agent chat — pre-fetches real data based on active tab before sending to Claude
import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { spawnSync } from 'child_process';
import { getDb } from '@/lib/database';

export const runtime = 'nodejs';

// Pre-fetch live data based on which tab the user is chatting from
async function fetchTabData(tab: string): Promise<string> {
  const db = getDb();
  const sections: string[] = [];

  try {
    if (tab === 'pipeline' || tab === 'configure') {
      // Pipeline stats
      const posts = db.prepare(`SELECT status, COUNT(*) as c FROM x_posts GROUP BY status`).all() as any[];
      if (posts.length > 0) {
        sections.push(`PIPELINE STATUS:\n${posts.map((p: any) => `- ${p.status}: ${p.c} posts`).join('\n')}`);
      }

      // Recent posts
      const recent = db.prepare(`SELECT content, status, type FROM x_posts ORDER BY created_at DESC LIMIT 5`).all() as any[];
      if (recent.length > 0) {
        sections.push(`RECENT POSTS:\n${recent.map((p: any) => `- [${p.status}] ${(p.content || '').slice(0, 80)}`).join('\n')}`);
      }
    }

    if (tab === 'engage') {
      // Mention stats
      const stats = db.prepare(`SELECT reply_status, COUNT(*) as c FROM x_mentions GROUP BY reply_status`).all() as any[];
      if (stats.length > 0) {
        sections.push(`MENTION STATUS:\n${stats.map((s: any) => `- ${s.reply_status}: ${s.c}`).join('\n')}`);
      }

      // Recent unhandled mentions
      const pending = db.prepare(`SELECT author_username, text, mention_type, like_count FROM x_mentions WHERE reply_status = 'pending' ORDER BY tweet_created_at DESC LIMIT 5`).all() as any[];
      if (pending.length > 0) {
        sections.push(`PENDING MENTIONS:\n${pending.map((m: any) => `- @${m.author_username} (${m.mention_type}, ${m.like_count} likes): "${(m.text || '').slice(0, 80)}"`).join('\n')}`);
      }
    }

    if (tab === 'intelligence') {
      // Competitor handles
      const handleRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('x-competitor-handles') as any;
      const handles = handleRow?.value ? JSON.parse(handleRow.value) : [];
      if (handles.length > 0) {
        sections.push(`TRACKED COMPETITORS: ${handles.map((h: string) => `@${h}`).join(', ')}`);
      }

      // Latest competitor report summary
      const report = db.prepare(`SELECT title, summary FROM x_reports WHERE type = 'competitor-analysis' ORDER BY created_at DESC LIMIT 1`).get() as any;
      if (report) {
        sections.push(`LATEST COMPETITOR REPORT: ${report.title}\n${report.summary}`);
      }
    }

    if (tab === 'measure') {
      // Get live analytics
      try {
        const res = await fetch(`http://localhost:${process.env.PORT || 3000}/api/x/analytics`);
        if (res.ok) {
          const data = await res.json();
          const profile = data.profile?.public_metrics || {};
          const tweets = data.tweets || [];
          const totalLikes = tweets.reduce((s: number, t: any) => s + (t.public_metrics?.like_count || 0), 0);
          const totalRTs = tweets.reduce((s: number, t: any) => s + (t.public_metrics?.retweet_count || 0), 0);

          sections.push(`ACCOUNT METRICS:
- Followers: ${profile.followers_count || 0}
- Following: ${profile.following_count || 0}
- Total tweets: ${profile.tweet_count || 0}
- Recent tweets analyzed: ${tweets.length}
- Total recent likes: ${totalLikes}
- Total recent RTs: ${totalRTs}
- Avg engagement/tweet: ${tweets.length > 0 ? ((totalLikes + totalRTs) / tweets.length).toFixed(1) : 0}`);

          // Top 3 posts
          const sorted = [...tweets].sort((a: any, b: any) => (b.public_metrics?.like_count || 0) - (a.public_metrics?.like_count || 0));
          if (sorted.length > 0) {
            sections.push(`TOP PERFORMING POSTS:\n${sorted.slice(0, 3).map((t: any, i: number) =>
              `${i + 1}. "${(t.text || '').slice(0, 80)}" — ${t.public_metrics?.like_count || 0} likes, ${t.public_metrics?.retweet_count || 0} RTs`
            ).join('\n')}`);
          }
        }
      } catch {}

      // Mention engagement
      const mentionStats = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied FROM x_mentions`).get() as any;
      if (mentionStats) {
        sections.push(`ENGAGEMENT: ${mentionStats.total} total mentions, ${mentionStats.replied} replied`);
      }
    }

    if (tab === 'configure') {
      // Automations
      const autos = db.prepare(`SELECT name, enabled, trigger_type, total_executions FROM x_automations ORDER BY created_at DESC LIMIT 5`).all() as any[];
      if (autos.length > 0) {
        sections.push(`ACTIVE AUTOMATIONS:\n${autos.map((a: any) => `- ${a.name} [${a.enabled ? 'ON' : 'OFF'}] trigger:${a.trigger_type} runs:${a.total_executions}`).join('\n')}`);
      }
    }

    // Always include knowledge base context
    const kb = db.prepare(`SELECT title, substr(summary, 1, 100) as s FROM knowledge_base WHERE scope IN ('agents','all') ORDER BY updated_at DESC LIMIT 3`).all() as any[];
    if (kb.length > 0) {
      sections.push(`BRAND KNOWLEDGE:\n${kb.map((a: any) => `- ${a.title}: ${a.s}`).join('\n')}`);
    }
  } catch (err) {
    console.error('[generate-reply] Data fetch error:', err);
  }

  return sections.length > 0 ? `\n\n--- LIVE DATA (from Mission Control) ---\n${sections.join('\n\n')}` : '';
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, tone = 'professional', tab, agentId, sessionKey } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Pre-fetch real data based on active tab
    const liveData = tab ? await fetchTabData(tab) : '';

    // Load agent SOUL.md for identity (if agentId provided)
    let agentIdentity = '';
    if (agentId) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const soulPaths = [
          path.join(process.cwd(), 'catalog', 'agents', agentId, 'soul.md'),
          path.join(process.cwd(), '.claude', 'agents', `${agentId}.md`),
        ];
        for (const p of soulPaths) {
          if (fs.existsSync(p)) {
            const soul = fs.readFileSync(p, 'utf-8');
            // Take first 2000 chars of SOUL.md for identity
            agentIdentity = `\n\n--- AGENT IDENTITY (from SOUL.md) ---\n${soul.slice(0, 2000)}`;
            break;
          }
        }
      } catch { /* non-critical */ }
    }

    const agentName = agentId === 'social-manager' ? 'Social Manager for Bitso Onchain (@BitsoOnchain)' :
      agentId ? agentId : 'Mission Control assistant';

    const systemPrompt = `You are the ${agentName}. You have access to live data from Mission Control. Be concise, data-driven, and actionable. Use markdown for formatting.${agentIdentity}${tone !== 'professional' ? ` Tone: ${tone}.` : ''}

IMPORTANT: You are ${agentName}, NOT mission-control. Stay in character. Never say you are a different agent.`;

    // Load recent conversation history for session continuity
    let conversationHistory = '';
    if (sessionKey) {
      try {
        const db = getDb();
        const recentMsgs = db.prepare(
          `SELECT role, content FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT 6`
        ).all(sessionKey) as Array<{ role: string; content: string }>;
        if (recentMsgs.length > 0) {
          conversationHistory = '\n\n--- RECENT CONVERSATION (for continuity) ---\n' +
            recentMsgs.reverse().map(m => `${m.role === 'user' ? 'User' : 'You'}: ${(m.content || '').slice(0, 300)}`).join('\n');
        }
      } catch { /* non-critical */ }
    }

    const userPrompt = `${context || ''}${liveData}${conversationHistory}\n\nUser message: ${message}`;

    const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, CLAUDE_CODE_SESSION_ID, ...cleanEnv } = process.env;
    void CLAUDECODE; void CLAUDE_CODE_ENTRYPOINT; void CLAUDE_CODE_SESSION_ID;

    const result = spawnSync(
      process.execPath,
      [
        ENV.CLAUDE_SCRIPT,
        '--print',
        '--output-format', 'text',
        '--model', ENV.MODEL_TRIVIAL,
        '--system-prompt', systemPrompt,
      ],
      {
        input: userPrompt,
        encoding: 'utf-8',
        env: cleanEnv as NodeJS.ProcessEnv,
        timeout: 30_000,
      }
    );

    if (result.error || result.status !== 0) {
      console.error('generate-reply claude error:', result.stderr);
      return NextResponse.json({ success: false, error: 'Claude CLI failed' }, { status: 500 });
    }

    const reply = (result.stdout || '').trim();
    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error('POST /api/chat/generate-reply error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate reply' }, { status: 500 });
  }
}
