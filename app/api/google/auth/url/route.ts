// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/googleAuth';

export async function GET() {
  const url = getAuthUrl();
  if (!url) {
    return NextResponse.json({ error: 'Google credentials not configured' }, { status: 500 });
  }
  return NextResponse.json({ url });
}
