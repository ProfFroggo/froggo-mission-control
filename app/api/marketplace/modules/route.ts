import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM module_state ORDER BY module_id ASC').all();
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/marketplace/modules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
