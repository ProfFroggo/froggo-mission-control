'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface WorkspaceLoaderProps {
  workspaceSlug: string;
  onReady: (url: string) => void;
  onError: (message: string) => void;
}

/**
 * Cold start loading screen — shown while a Fly Machine is starting up.
 * Polls /api/workspaces?slug=X until status is 'running', then redirects.
 */
export default function WorkspaceLoader({ workspaceSlug, onReady, onError }: WorkspaceLoaderProps) {
  const [status, setStatus] = useState<'starting' | 'healthy' | 'error'>('starting');
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const maxWait = 30_000;
    const pollInterval = 2_000;
    const start = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/workspaces?slug=${encodeURIComponent(workspaceSlug)}`);
        if (!res.ok) throw new Error('Failed to check workspace');
        const data = await res.json();
        const ws = data.workspaces?.[0];

        if (ws?.status === 'running') {
          setStatus('healthy');
          onReady(`https://${workspaceSlug}.froggo.pro`);
          return;
        }

        if (Date.now() - start > maxWait) {
          setStatus('error');
          onError('Workspace took too long to start. Please try again.');
          return;
        }

        setTimeout(poll, pollInterval);
      } catch {
        if (Date.now() - start > maxWait) {
          setStatus('error');
          onError('Could not reach workspace. Please try again.');
          return;
        }
        setTimeout(poll, pollInterval);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [workspaceSlug, onReady, onError]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-12">
        {status === 'starting' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
            <h2 className="text-xl font-semibold text-white">Starting your workspace...</h2>
            <p className="text-sm text-gray-400">
              {elapsed < 3
                ? 'Waking up your Mission Control instance'
                : elapsed < 10
                  ? 'Initializing services...'
                  : 'Almost there...'}
            </p>
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-1000"
                style={{ width: `${Math.min((elapsed / 15) * 100, 95)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 tabular-nums">{elapsed}s</p>
          </>
        )}
        {status === 'healthy' && (
          <>
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Workspace ready</h2>
            <p className="text-sm text-gray-400">Redirecting...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <div className="h-4 w-4 rounded-full bg-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Startup failed</h2>
            <p className="text-sm text-gray-400">Please try again or contact support.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  );
}
