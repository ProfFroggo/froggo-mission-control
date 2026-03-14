// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; commentId: string }> };

// DELETE /api/campaigns/:id/comments/:commentId
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id, commentId } = await params;
    const db = getDb();

    const comment = db.prepare(
      'SELECT * FROM campaign_comments WHERE id = ? AND campaignId = ?'
    ).get(commentId, id);

    if (!comment) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM campaign_comments WHERE id = ?').run(commentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/campaigns/:id/comments/:commentId error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
