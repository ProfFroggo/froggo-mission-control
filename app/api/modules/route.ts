import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ModuleRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  spec: string;
  conversationState: string;
  overallProgress: number;
  createdAt: number;
  updatedAt: number;
};

function parseRow(row: ModuleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    status: row.status,
    spec: (() => { try { return JSON.parse(row.spec || '{}'); } catch { return {}; } })(),
    conversationState: (() => { try { return JSON.parse(row.conversationState || '{}'); } catch { return {}; } })(),
    overallProgress: row.overallProgress,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// GET /api/modules — list all module builder drafts + installed module states
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // Return module_state toggle data when requested
    if (type === 'state') {
      const rows = db.prepare('SELECT module_id, enabled, last_toggled FROM module_state').all() as {
        module_id: string; enabled: number; last_toggled: number | null;
      }[];
      return NextResponse.json(rows.map(r => ({ id: r.module_id, enabled: r.enabled === 1, lastToggled: r.last_toggled })));
    }

    // Default: return module builder drafts
    const rows = db.prepare(
      'SELECT * FROM modules_builder ORDER BY updatedAt DESC'
    ).all() as ModuleRow[];
    return NextResponse.json(rows.map(parseRow));
  } catch (error) {
    console.error('GET /api/modules error:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/modules — create a new module builder draft
export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const id = body.id || randomUUID();
    const now = Date.now();
    const name = body.name || 'Untitled Module';
    const description = body.description ?? null;
    const category = body.category || 'general';
    const status = body.status || 'in-progress';
    const spec = JSON.stringify(body.spec ?? {});
    const conversationState = JSON.stringify(body.conversationState ?? {});
    const overallProgress = body.overallProgress ?? 0;

    db.prepare(`
      INSERT INTO modules_builder (id, name, description, category, status, spec, conversationState, overallProgress, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, category, status, spec, conversationState, overallProgress, now, now);

    const row = db.prepare('SELECT * FROM modules_builder WHERE id = ?').get(id) as ModuleRow;
    return NextResponse.json(parseRow(row), { status: 201 });
  } catch (error) {
    console.error('POST /api/modules error:', error);
    return NextResponse.json({ error: 'Failed to create module draft' }, { status: 500 });
  }
}
