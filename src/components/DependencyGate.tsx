import { useState, useEffect, ReactNode } from 'react';

interface PathCheckResult {
  path: string;
  label: string;
  exists: boolean;
  critical: boolean;
}

interface StartupState {
  pathResults: PathCheckResult[];
  gatewayRunning: boolean;
}

interface Props {
  children: ReactNode;
}

/**
 * DependencyGate — validates critical dependencies on every launch (not just first-run).
 *
 * Non-blocking: children render immediately. The health check runs in the background
 * and only shows a dismissible error banner if critical deps are missing.
 * This eliminates the "Starting up..." blocking screen that was gating LCP by 8+ seconds.
 *
 * Fails open: if the health check fails for any reason, renders children normally
 * to avoid creating new failure modes.
 */
export function DependencyGate({ children }: Props) {
  const [criticalMissing, setCriticalMissing] = useState<PathCheckResult[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Fire health check in the background — do NOT block rendering on this.
    // The /api/health endpoint initialises background crons and checks paths.
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const state: StartupState | null = data?.startup ?? null;
        if (state) {
          const missing = state.pathResults.filter(r => r.critical && !r.exists);
          if (missing.length > 0) setCriticalMissing(missing);
        }
      })
      .catch(() => {
        // fail-open: health check failed, proceed normally
      });
  }, []);

  // Always render children immediately — health check is non-blocking.
  // Show critical setup error as a dismissible full-screen overlay only when needed.
  return (
    <>
      {children}
      {criticalMissing.length > 0 && !dismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-mission-control-bg p-8">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">🐸</div>
            <h1 className="text-xl font-bold text-mission-control-text">Setup Required</h1>
            <p className="text-mission-control-text-dim text-sm">
              Mission Control cannot start because required files are missing:
            </p>
            <div className="text-left space-y-2 bg-mission-control-surface border border-mission-control-border p-4 rounded-lg">
              {criticalMissing.map(r => (
                <div key={r.path} className="space-y-1">
                  <p className="text-sm text-error font-medium">{r.label}</p>
                  <p className="text-xs text-mission-control-text-dim font-mono break-all">{r.path}</p>
                </div>
              ))}
            </div>
            <div className="text-left text-xs text-mission-control-text-dim space-y-1 bg-mission-control-bg border border-mission-control-border p-4 rounded-lg">
              <p className="font-medium text-mission-control-text mb-2">To fix this:</p>
              <p className="font-mono">1. Ensure ~/mission-control/data/mission-control.db exists</p>
              <p className="font-mono">2. Run the Mission Control setup script or restore from backup</p>
              <p className="font-mono">3. Restart the app</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors text-sm"
              >
                Retry
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-4 py-2 bg-mission-control-surface text-mission-control-text-dim border border-mission-control-border rounded-lg hover:bg-mission-control-border/20 transition-colors text-sm"
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
