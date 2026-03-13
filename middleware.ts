// middleware.ts — enforces INTERNAL_API_TOKEN on all /api/* routes when configured.
// If the token is empty (local dev), all requests pass through.
import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) return NextResponse.next(); // auth disabled (local dev)

  // Public routes — always allow
  const path = req.nextUrl.pathname;
  if (path === '/api/health') return NextResponse.next();

  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
