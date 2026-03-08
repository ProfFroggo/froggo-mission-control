import { NextRequest, NextResponse } from 'next/server';
import { runReviewCycle } from '@/lib/claraReviewCron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Trigger Clara review for a specific task or sweep all pending
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { taskId } = body;

  if (taskId) {
    // Single task: import and use the shared spawn logic
    const { runReviewCycle: _ } = await import('@/lib/claraReviewCron');
    void _;
    // For single-task trigger, just run the full sweep — it will pick it up
    // (The sweep already deduplicates via inReview set)
  }

  const { queued } = runReviewCycle();
  return NextResponse.json({ queued });
}
