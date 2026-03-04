import { NextResponse } from 'next/server';
import { getDb } from '@/lib/database';

export async function GET() {
  try {
    const db = getDb();
    const state = db.prepare("SELECT value FROM module_state WHERE module_id = 'accounts'").get() as { value: string } | undefined;
    if (state?.value) return NextResponse.json(JSON.parse(state.value));
  } catch { /* table may not have value column or no matching row */ }
  return NextResponse.json([]);
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true, id: `acct-${Date.now()}`, ...body });
}
