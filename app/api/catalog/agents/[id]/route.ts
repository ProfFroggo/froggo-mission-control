import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { parseCatalogAgent, type CatalogAgentRow } from '@/types/catalog';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const db = getDb();
    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(parseCatalogAgent(row));
  } catch (error) {
    console.error('GET /api/catalog/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const row = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow | undefined;
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fields: string[] = [];
    const values: unknown[] = [];

    if (typeof body.installed === 'boolean') {
      fields.push('installed = ?');
      values.push(body.installed ? 1 : 0);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    db.prepare(`UPDATE catalog_agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM catalog_agents WHERE id = ?').get(id) as CatalogAgentRow;
    return NextResponse.json(parseCatalogAgent(updated));
  } catch (error) {
    console.error('PATCH /api/catalog/agents/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
