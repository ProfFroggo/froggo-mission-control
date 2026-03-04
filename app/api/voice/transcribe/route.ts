import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Voice transcription uses Web Speech API directly in the browser. No server-side endpoint needed.' },
    { status: 400 }
  );
}
