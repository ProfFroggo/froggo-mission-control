// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// GET /api/health/history — returns the last 60 health metric snapshots

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  // Access the same global circular buffer populated by /api/health/metrics
  const history: unknown[] = (globalThis as any).__healthMetricsHistory ?? [];
  return NextResponse.json({ snapshots: history, count: history.length }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
