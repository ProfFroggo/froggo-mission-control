import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `).all() as { status: string; count: number }[];

    const stats: Record<string, number> = {};
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    const total = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number }).count;

    return NextResponse.json({ byStatus: stats, total });
  } catch (error) {
    console.error('GET /api/analytics/task-stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
