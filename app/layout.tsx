// Force dynamic rendering — internal tool, not a public site.
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import '../src/index.css';
import '../src/accessibility.css';

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'Multi-agent orchestration platform',
  icons: {
    icon: '/agent-profiles/froggo.webp',
    apple: '/agent-profiles/froggo.webp',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/*
          Preload the two most critical API endpoints so the browser starts
          fetching them as soon as HTML is parsed — before JavaScript even runs.
          When the Zustand store's useEffect fires and calls these URLs, the
          browser finds the responses already in the preload cache, eliminating
          one full RTT from the data-fetch waterfall.

          Must match the exact URLs constructed by apiCall() in src/lib/api.ts:
          - taskApi.getAll({ include: 'subtasks', summary: '1', limit: '100' }) → /api/tasks?include=subtasks&summary=1&limit=100
          - agentApi.getAll() → /api/agents
        */}
        <link rel="preload" href="/api/tasks?include=subtasks&summary=1&limit=100" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/api/agents" as="fetch" crossOrigin="anonymous" />
        {/*
          Critical inline CSS for the loading skeleton (LCP fix).

          The full Tailwind + Radix CSS files are ~114 KB compressed. Under 4G
          throttling, they take ~1.2 s to download. Without this inline block,
          the skeleton <p> (our LCP candidate) can't paint until those files
          arrive, pushing LCP from ~0.6 s to ~2.8 s.

          This block defines the minimum CSS custom properties the skeleton
          needs to paint. The browser resolves these immediately from the
          inline <style> in the HTML <head>, so the skeleton paints at
          TTFB + HTML-parse time (~0.6 s) without waiting for external CSS.
        */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root, .dark {
            --gray-5: #3b3b3b;
            --gray-9: #8d8d8d;
            --color-background: #111113;
            --color-panel: #19191b;
            --mission-control-bg: var(--color-background);
            --mission-control-surface: var(--color-panel);
            --mission-control-border: var(--gray-5);
            --mission-control-text-dim: var(--gray-9);
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
