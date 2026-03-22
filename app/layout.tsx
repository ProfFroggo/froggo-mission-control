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
          - taskApi.getAll({ includeSubtasks: 'true' }) → /api/tasks?includeSubtasks=true
          - agentApi.getAll() → /api/agents
        */}
        <link rel="preload" href="/api/tasks?includeSubtasks=true" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/api/agents" as="fetch" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
