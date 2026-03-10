'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamic import with ssr: false to avoid window-is-not-defined errors
// from Electron-ported code that accesses window/localStorage at module level
const App = dynamic(() => import('../src/App'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-mission-control-bg">
      <div className="w-6 h-6 border-2 border-mission-control-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

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
      <App />
    </AppErrorBoundary>
  );
}
