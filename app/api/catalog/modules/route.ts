import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';
import { parseCatalogModule, type CatalogModuleRow } from '@/types/catalog';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT * FROM catalog_modules ORDER BY category, name'
    ).all() as CatalogModuleRow[];
    return NextResponse.json(rows.map(parseCatalogModule));
  } catch (error) {
    console.error('GET /api/catalog/modules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
