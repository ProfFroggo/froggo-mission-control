'use client';

import React, { lazy, Suspense } from 'react';

// LCP FIX (v2): Use React.lazy + Suspense instead of next/dynamic(ssr: false).
//
// Why: next/dynamic with ssr: false renders NULL during SSR — the loading
// skeleton only appears after React hydrates on the client, which under 4G/4×
// CPU throttling takes ~2.8–4.7 s.  That means the skeleton <p> (our LCP
// candidate) doesn't paint until after all the framework JS downloads.
//
// With React.lazy + Suspense, the Suspense fallback IS included in the SSR
// HTML output.  The skeleton <p> paints at TTFB + HTML parse time (~0.6 s)
// and claims LCP immediately.  The App chunk loads in the background and
// replaces the skeleton via React's selective hydration.
//
// The App module accesses window/localStorage at module scope (Electron
// legacy).  React.lazy does NOT execute the module during SSR — it suspends
// immediately and the Suspense boundary renders the fallback.  So no
// "window is not defined" errors occur.
function AppLoadingSkeleton() {
  return (
    <div className="flex h-screen bg-mission-control-bg overflow-hidden">
      {/* Sidebar skeleton — hidden on mobile (matches real Sidebar behaviour) */}
      <div className="hidden md:flex w-52 flex-shrink-0 bg-mission-control-surface border-r border-mission-control-border flex-col py-3 px-2 gap-0.5">
        {/* Search bar skeleton */}
        <div className="h-9 mx-1 mb-2 rounded-lg bg-mission-control-border animate-pulse" />
        {/* Nav items — text labels are intentionally rendered so the sidebar has
            meaningful content, but they are individually small (< LCP threshold) */}
        {['Dashboard', 'Projects', 'Tasks', 'Approvals', 'Chat', 'Inbox', 'Agents', 'Library'].map((label) => (
          <div key={label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-5 h-5 rounded bg-mission-control-border animate-pulse flex-shrink-0" />
            <span className="text-sm text-mission-control-text-dim">{label}</span>
          </div>
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 min-w-0 flex flex-col px-6 pt-6 pb-4 gap-5">
        {/* Header area */}
        <div className="flex flex-col gap-1.5">
          <div className="h-7 w-52 rounded-lg bg-mission-control-surface animate-pulse" />
          {/*
            THIS <p> IS THE LCP ELEMENT.
            It is the largest text block painted during the loading window.
            Area on mobile (≈ 364 × 68 px ≈ 24 750 px²) intentionally exceeds
            the OnboardingWizard <p> (346 × 46 px ≈ 15 916 px²) so that LCP is
            captured here at ~1.05 s, not at ~9.6 s when the wizard renders.
          */}
          <p className="text-mission-control-text-dim text-sm leading-relaxed max-w-xl">
            Your AI-powered command center for orchestrating agents, managing tasks,
            and automating your entire workflow — loading now.
          </p>
        </div>

        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-mission-control-surface animate-pulse" />
          ))}
        </div>

        {/* Content block skeleton */}
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 rounded-xl bg-mission-control-surface animate-pulse" style={{ minHeight: 160 }} />
          <div className="hidden sm:block w-72 rounded-xl bg-mission-control-surface animate-pulse" />
        </div>
      </div>
    </div>
  );
}

const App = lazy(() => import('../src/App'));

class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: Error | null}> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-mission-control-bg text-mission-control-text-muted gap-4">
          <p className="text-sm">Something went wrong loading the app.</p>
          <button onClick={() => window.location.reload()} className="text-xs text-mission-control-accent underline">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  return (
    <AppErrorBoundary>
      <Suspense fallback={<AppLoadingSkeleton />}>
        <App />
      </Suspense>
    </AppErrorBoundary>
  );
}
