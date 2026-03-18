// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { startDispatcherCron, runDispatchCycle } from '@/lib/taskDispatcherCron';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Start the background cron on first module load (skip during next build)
const _isBuild =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_BUILD === '1' ||
  process.argv.some((a) => a === 'build') ||
  !!(globalThis as any).__NEXT_DATA__;
if (!_isBuild) {
  startDispatcherCron();
}

/**
 * GET /api/tasks/dispatcher
 * Manually trigger a dispatch cycle and return the result.
 * Also starts the background 30s cron if not already running.
 */
export async function GET() {
  const result = runDispatchCycle();
  return NextResponse.json({ success: true, ...result });
}
