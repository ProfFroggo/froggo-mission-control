import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

function parseAgent(row: Record<string, unknown>) {
  if (!row) return row;
  const parsed = { ...row };
  if (typeof parsed.capabilities === 'string') {
    try {
      parsed.capabilities = JSON.parse(parsed.capabilities as string);
    } catch {
      parsed.capabilities = [];
    }
  }
  return parsed;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(parseAgent(agent));
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
