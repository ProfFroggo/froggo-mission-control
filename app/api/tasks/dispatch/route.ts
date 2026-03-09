// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';
import { dispatchTask } from '@/lib/taskDispatcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/tasks/dispatch
 * Manually dispatch a task to its assigned agent.
 * Body: { taskId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    const dispatched = dispatchTask(taskId);

    if (!dispatched) {
      return NextResponse.json(
        { error: 'Task not found or has no assignedTo agent' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, taskId });
  } catch (error) {
    console.error('POST /api/tasks/dispatch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
