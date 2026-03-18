// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Global error boundary — catches errors in the root layout itself.
// force-dynamic prevents static prerendering of /_global-error which fails with
// "Cannot read properties of null (reading 'useContext')" in Next.js 16.1.x
// because LayoutRouterContext is unavailable during error-boundary prerendering.
// Build must run with NODE_ENV=production (enforced in package.json build script).
// Running 'next build' with NODE_ENV=development causes React to load development
// internals that produce mismatched webpack module IDs, reproducing this crash.
'use client';

export const dynamic = 'force-dynamic';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-gray-100 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
          <p className="text-gray-400 max-w-md">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-600 font-mono">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-md transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
