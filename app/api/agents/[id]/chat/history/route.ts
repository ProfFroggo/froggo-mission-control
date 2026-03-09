// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 80: Conversation history endpoint for SDK chat sessions

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;
  const sessionKey = request.nextUrl.searchParams.get('sessionKey') || `sdk-chat:${agentId}`;
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200);

  const db = getDb();
  try {
    const messages = db.prepare(`
      SELECT role, content, timestamp
      FROM messages
      WHERE sessionKey = ? AND (channel = 'sdk-chat' OR channel = 'dashboard')
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(sessionKey, limit) as { role: string; content: string; timestamp: number }[];

    return NextResponse.json({ messages, sessionKey });
  } catch {
    return NextResponse.json({ messages: [], sessionKey });
  }
}
