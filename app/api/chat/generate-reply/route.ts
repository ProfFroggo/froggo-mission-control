import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, error: 'Generate reply not configured' }, { status: 501 });
}
