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
    window.clawdbot?.startup?.getState()
      .then((result: StartupState) => {
        setState(result);
        setLoading(false);
      })
      .catch(() => {
        // If IPC fails, proceed anyway (fail-open — don't block on IPC error)
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-clawd-bg">
        <div className="text-clawd-text-dim text-sm">Starting up...</div>
      </div>
    );
  }

  // If we couldn't get state, proceed (fail-open)
  if (!state) return <>{children}</>;

  // Check for critical path failures
  const criticalMissing = state.pathResults.filter(r => r.critical && !r.exists);

  if (criticalMissing.length > 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-clawd-bg p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">🐸</div>
          <h1 className="text-xl font-bold text-clawd-text">Setup Required</h1>
          <p className="text-clawd-text-dim text-sm">
            Froggo cannot start because required files are missing:
          </p>
          <div className="text-left space-y-2 bg-clawd-surface border border-clawd-border p-4 rounded-lg">
            {criticalMissing.map(r => (
              <div key={r.path} className="space-y-1">
                <p className="text-sm text-red-400 font-medium">{r.label}</p>
                <p className="text-xs text-clawd-text-dim font-mono break-all">{r.path}</p>
              </div>
            ))}
          </div>
          <div className="text-left text-xs text-clawd-text-dim space-y-1 bg-clawd-bg border border-clawd-border p-4 rounded-lg">
            <p className="font-medium text-clawd-text mb-2">To fix this:</p>
            <p className="font-mono">1. Ensure ~/froggo/data/froggo.db exists</p>
            <p className="font-mono">2. Run the Froggo setup script or restore from backup</p>
            <p className="font-mono">3. Restart the app</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 transition-colors text-sm"
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
