import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(_request: NextRequest) {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT assignedTo, COUNT(*) as taskCount
      FROM tasks
      WHERE assignedTo IS NOT NULL
      GROUP BY assignedTo
      ORDER BY taskCount DESC
    `).all() as { assignedTo: string; taskCount: number }[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/analytics/agent-activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
