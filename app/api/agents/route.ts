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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role, emoji, color, capabilities, personality } = body;
    if (!id || !name || !role) {
      return NextResponse.json({ error: 'id, name and role are required' }, { status: 400 });
    }
    const db = getDb();
    db.prepare(`
      INSERT INTO agents (id, name, role, emoji, color, capabilities, personality, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', unixepoch())
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, role=excluded.role,
        emoji=excluded.emoji, color=excluded.color, capabilities=excluded.capabilities,
        personality=excluded.personality
    `).run(id, name, role, emoji || '🤖', color || '#00BCD4',
      JSON.stringify(Array.isArray(capabilities) ? capabilities : []), personality || '');
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>;
    return NextResponse.json(parseAgent(row), { status: 201 });
  } catch (error) {
    console.error('POST /api/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
