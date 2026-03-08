import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, error: 'Google import not configured' }, { status: 501 });
}
