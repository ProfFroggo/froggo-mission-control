// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ success: false, error: 'Google import not configured' }, { status: 501 });
}
