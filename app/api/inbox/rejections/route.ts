import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM inbox WHERE status = 'rejected' ORDER BY updatedAt DESC LIMIT ?`
    ).all(limit) as Record<string, unknown>[];

    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/inbox/rejections error:', error);
    return NextResponse.json([]);
  }
}
