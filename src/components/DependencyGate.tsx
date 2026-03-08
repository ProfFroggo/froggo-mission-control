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
 * DependencyGate — wraps the entire app and validates critical dependencies
 * on every launch (not just first-run).
 *
 * Queries startup:getState from the main process (populated during boot-time
 * verifyPaths() run). If any critical path is missing, shows a setup-required
 * screen instead of the main app.
 *
 * Fails open: if the IPC call fails for any reason, renders children normally
 * to avoid creating new failure modes.
 */
export function DependencyGate({ children }: Props) {
  const [state, setState] = useState<StartupState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setState(data?.startup ?? null);
        }
        setLoading(false);
      })
      .catch(() => {
        // If health check fails, proceed anyway (fail-open)
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mission-control-bg">
        <div className="text-mission-control-text-dim text-sm">Starting up...</div>
      </div>
    );
  }

  // If we couldn't get state, proceed (fail-open)
  if (!state) return <>{children}</>;

  // Check for critical path failures
  const criticalMissing = state.pathResults.filter(r => r.critical && !r.exists);

  if (criticalMissing.length > 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-mission-control-bg p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">🐸</div>
          <h1 className="text-xl font-bold text-mission-control-text">Setup Required</h1>
          <p className="text-mission-control-text-dim text-sm">
            Mission Control cannot start because required files are missing:
          </p>
          <div className="text-left space-y-2 bg-mission-control-surface border border-mission-control-border p-4 rounded-lg">
            {criticalMissing.map(r => (
              <div key={r.path} className="space-y-1">
                <p className="text-sm text-red-400 font-medium">{r.label}</p>
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
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/80 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // All critical deps OK — render app
  return <>{children}</>;
}
