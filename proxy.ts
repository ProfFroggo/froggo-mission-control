// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// proxy.ts (formerly middleware.ts)
// API authentication proxy — protects all /api/* routes with bearer token.
// Leave INTERNAL_API_TOKEN empty (default) to disable auth in local dev.

import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  // Only protect /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip auth for setup routes (needed during onboarding before token is set)
  const skipAuthRoutes = ['/api/setup/system-check', '/api/health'];
  if (skipAuthRoutes.some(route => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = process.env.INTERNAL_API_TOKEN;

  // If no token configured, allow all (dev mode / first run)
  if (!token) {
    return NextResponse.next();
  }

  // Localhost requests are always allowed — auth is for remote access only
  const host = request.headers.get('host') || '';
  if (host.includes('localhost') || host.startsWith('127.') || host.startsWith('[::1]')) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.replace('Bearer ', '');

  if (bearerToken !== token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
