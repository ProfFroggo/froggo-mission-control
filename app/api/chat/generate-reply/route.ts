// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Social media agent chat — DEPRECATED, use /api/sessions/chat instead.
// Remaining callers: CommsInbox3Pane, XEngageView, x/automations/execute.
import { NextRequest, NextResponse } from 'next/server';
import { ENV } from '@/lib/env';
import { spawnSync } from 'child_process';
import { getDb } from '@/lib/database';
import { loadSocialContext } from '@/lib/sessionService';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // ── DEPRECATED ──────────────────────────────────────────────────────────────
  // This endpoint is superseded by POST /api/sessions/chat for agent chat.
  // Remaining callers: CommsInbox3Pane, XEngageView, x/automations/execute.
  // These use a different API shape (threadMessages, platform, tone) and will be
  // migrated in a future phase. Until then, this endpoint remains functional.
  console.warn('[DEPRECATED] /api/chat/generate-reply called — use /api/sessions/chat for agent chat instead');

  try {
    const { message, context, tone = 'professional', tab, agentId, sessionKey } = await request.json();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Pre-fetch real data based on active tab (now via sessionService)
    const liveData = tab ? loadSocialContext(tab) : '';

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
