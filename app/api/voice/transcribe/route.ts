// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Voice transcription uses Web Speech API directly in the browser. No server-side endpoint needed.' },
    { status: 400 }
  );
}
