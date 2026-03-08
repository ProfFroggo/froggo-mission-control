import { NextRequest, NextResponse } from 'next/server';
import { runReviewCycle, spawnClaraReview } from '@/lib/claraReviewCron';
import { getDb } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { taskId } = body as { taskId?: string };

    if (taskId) {
      const task = getDb()
        .prepare(`SELECT id, title, description, assignedTo, progress, lastAgentUpdate FROM tasks WHERE id = ? AND status = 'review'`)
        .get(taskId) as Record<string, unknown> | undefined;
      if (!task) return NextResponse.json({ error: 'Task not found or not in review status' }, { status: 404 });
      spawnClaraReview(task);
      return NextResponse.json({ queued: 1, taskId });
    }

    const { queued } = runReviewCycle();
    return NextResponse.json({ queued });
  } catch (err) {
    console.error('[clara-review] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
