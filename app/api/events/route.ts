import { NextRequest } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const since = parseInt(request.nextUrl.searchParams.get('since') || '0');
    const db = getDb();

    const events = {
      tasks: db.prepare(
        'SELECT id, status, assignedTo, updatedAt FROM tasks WHERE updatedAt > ? ORDER BY updatedAt DESC LIMIT 20'
      ).all(since),
      approvals: db.prepare(
        'SELECT id, status, type, createdAt FROM approvals WHERE createdAt > ? ORDER BY createdAt DESC LIMIT 10'
      ).all(since),
      chatMessages: db.prepare(
        'SELECT id, roomId, agentId, timestamp FROM chat_room_messages WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 20'
      ).all(since),
      agentStatus: db.prepare(
        'SELECT id, status, lastActivity FROM agents WHERE lastActivity > ? ORDER BY lastActivity DESC'
      ).all(since),
    };

    return Response.json(events);
  } catch (error) {
    console.error('GET /api/events error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
