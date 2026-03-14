'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[App Error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-mission-control-bg text-mission-control-text">
      <AlertTriangle size={48} className="text-warning" />
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-mission-control-text-dim max-w-md text-center">{error.message}</p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-mission-control-accent text-white hover:opacity-90 transition-opacity"
      >
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
