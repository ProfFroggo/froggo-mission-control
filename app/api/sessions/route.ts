import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT s.*, a.name as agentName, a.status as agentStatus
      FROM agent_sessions s
      LEFT JOIN agents a ON s.agentId = a.id
      ORDER BY s.lastActivity DESC
    `).all();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    return NextResponse.json([]);
  }
}
