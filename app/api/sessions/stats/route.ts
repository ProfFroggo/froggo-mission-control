// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/sessions/stats?key={sessionKey} — session statistics
// POST /api/sessions/stats/reset — reset a session
// DELETE /api/sessions/stats?key={sessionKey} — delete a session

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionStats,
  resetSession,
  deleteSession,
  exportSessionAsMarkdown,
  listAllSessions,
} from '@/lib/sessionService';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');

  // If no key, return all sessions list
  if (!key) {
    const sessions = listAllSessions();
    // Compute summary stats
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const oldest = sessions.length > 0
      ? sessions.reduce((min, s) => s.createdAt < min ? s.createdAt : min, sessions[0].createdAt)
      : null;

    // Find most active agent
    const agentCounts: Record<string, number> = {};
    for (const s of sessions) {
      agentCounts[s.agentName] = (agentCounts[s.agentName] || 0) + s.messageCount;
    }
    const mostActiveAgent = Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return NextResponse.json({
      sessions,
      summary: {
        totalSessions: sessions.length,
        totalMessages,
        oldestSession: oldest,
        mostActiveAgent,
      },
    });
  }

  const stats = getSessionStats(key);
  if (!stats) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(stats);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, key } = body;

    if (!key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    if (action === 'reset') {
      const ok = resetSession(key);
      return NextResponse.json({ ok });
    }

    if (action === 'export') {
      const markdown = exportSessionAsMarkdown(key);
      if (!markdown) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      return NextResponse.json({ markdown });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/sessions/stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }

  const ok = deleteSession(key);
  return NextResponse.json({ ok });
}
