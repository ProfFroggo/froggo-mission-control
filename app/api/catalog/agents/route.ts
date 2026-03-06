import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { parseCatalogAgent, type CatalogAgentRow } from '@/types/catalog';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM catalog_agents ORDER BY category, name'
    ).all() as CatalogAgentRow[];
    return NextResponse.json(rows.map(parseCatalogAgent));
  } catch (error) {
    console.error('GET /api/catalog/agents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
