// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { ApiError, handleApiError } from '@/lib/apiErrors';

// GET /api/messages?limit=N&sessionKey=...
// Returns recent chat messages from the messages table.
// Used by the gateway chat history fallback.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
    if (isNaN(rawLimit) || rawLimit < 1) {
      throw new ApiError(400, 'limit must be a positive integer', 'INVALID_LIMIT');
    }
    const limit = Math.min(rawLimit, 200);
    const sessionKey = searchParams.get('sessionKey') ?? null;

    const db = getDb();
    const rows = sessionKey
      ? db.prepare('SELECT * FROM messages WHERE sessionKey = ? ORDER BY timestamp DESC LIMIT ?')
          .all(sessionKey, limit)
      : db.prepare('SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?')
          .all(limit);

    return NextResponse.json({ messages: rows });
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return handleApiError(error);
  }
}
