import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleAuth';

export async function GET() {
  const url = getAuthUrl();
  if (!url) {
    return NextResponse.json({ error: 'Google credentials not configured' }, { status: 500 });
  }
  return NextResponse.json({ url });
}
