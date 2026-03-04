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

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM agents ORDER BY name ASC').all() as Record<string, unknown>[];
    return NextResponse.json(rows.map(parseAgent));
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
