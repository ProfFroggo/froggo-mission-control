// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';
import { isAuthenticated, loadTokens } from '@/lib/googleAuth';

export async function GET() {
  if (!isAuthenticated()) {
    return NextResponse.json({ authenticated: false, hasCredentials: true });
  }

  const tokens = loadTokens();
  return NextResponse.json({
    authenticated: true,
    hasCredentials: true,
    email: tokens?.email ?? null,
  });
}
