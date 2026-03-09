// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const taskId  = searchParams.get('taskId');
    const limit   = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset  = parseInt(searchParams.get('offset') ?? '0', 10);

    const db = getDb();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (agentId) { conditions.push('agentId = ?'); params.push(agentId); }
    if (taskId)  { conditions.push('taskId = ?');  params.push(taskId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db.prepare(
      `SELECT id, agentId, taskId, model, inputTokens, outputTokens, costUsd, createdAt
       FROM token_usage ${where}
       ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as Record<string, unknown>[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/finance/transactions error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
