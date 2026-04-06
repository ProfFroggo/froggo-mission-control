import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health',
  '/api/billing/webhook',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const hostname = req.headers.get('host') ?? '';

  // --- Subdomain routing: *.froggo.pro → proxy to user's Fly Machine ---
  // Strip port for local dev (e.g. "kevin.localhost:3001" → "kevin")
  const hostWithoutPort = hostname.split(':')[0];
  const baseDomains = ['froggo.pro', 'localhost'];
  let subdomain: string | null = null;

  for (const base of baseDomains) {
    if (
      hostWithoutPort.endsWith(`.${base}`) &&
      hostWithoutPort !== base &&
      hostWithoutPort !== `www.${base}`
    ) {
      subdomain = hostWithoutPort.replace(`.${base}`, '');
      break;
    }
  }

  if (subdomain) {
    // In production this would look up the workspace and proxy via fetch
    // to the internal Fly Machine URL. For now, return a placeholder.
    return new NextResponse(
      JSON.stringify({
        message: `Proxying to workspace: ${subdomain}`,
        host: hostname,
        path: req.nextUrl.pathname,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  // --- Standard auth: protect non-public routes ---
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    /*
     * Match all request paths except Next.js internals and static files.
     * Always run for API routes.
     */
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
