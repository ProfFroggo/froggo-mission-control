import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Total chat messages sent in period
    const msgRow = db.prepare(
      `SELECT COUNT(*) as count FROM chat_messages WHERE created_at >= ?`
    ).get(since) as { count: number };

    // Total active sessions
    const sesRow = db.prepare(
      `SELECT COUNT(*) as count FROM agent_sessions WHERE createdAt >= ?`
    ).get(since) as { count: number };

    // Active channels (distinct chat rooms with messages)
    const chanRow = db.prepare(
      `SELECT COUNT(DISTINCT roomId) as count FROM chat_messages WHERE created_at >= ?`
    ).get(since) as { count: number };

    // Messages per day
    const messagesPerDay = db.prepare(`
      SELECT date(created_at / 1000, 'unixepoch') AS date,
             COUNT(*) AS count
      FROM chat_messages
      WHERE created_at >= ?
      GROUP BY date
      ORDER BY date ASC
    `).all(since) as { date: string; count: number }[];

    // Channel breakdown (by agentId as proxy for channel)
    const channelBreakdown = db.prepare(`
      SELECT agentId AS channel, COUNT(*) AS count
      FROM chat_messages
      WHERE created_at >= ?
      GROUP BY agentId
      ORDER BY count DESC
      LIMIT 10
    `).all(since) as { channel: string; count: number }[];

    // Peak hours
    const peakHours = db.prepare(`
      SELECT CAST(strftime('%H', created_at / 1000, 'unixepoch') AS INTEGER) AS hour,
             COUNT(*) AS count
      FROM chat_messages
      WHERE created_at >= ?
      GROUP BY hour
      ORDER BY hour ASC
    `).all(since) as { hour: number; count: number }[];

    return NextResponse.json({
      totalMessages: msgRow?.count ?? 0,
      totalSessions: sesRow?.count ?? 0,
      activeChannels: chanRow?.count ?? 0,
      messagesPerDay,
      channelBreakdown,
      peakHours,
      avgResponseTime: 0,
    });
  } catch (error) {
    console.error('GET /api/analytics/usage-stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
