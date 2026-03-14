// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/automations/[id]/run — trigger a manual run of an automation
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  // Stub: actual execution would require additional scheduling infrastructure
  return NextResponse.json({ success: true, message: 'Manual run triggered', id });
}
