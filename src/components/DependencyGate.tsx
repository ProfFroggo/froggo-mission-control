import { useState, useEffect, ReactNode } from 'react';
import { Button, Box, Flex, Text, Heading } from '@radix-ui/themes';

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
        <Flex align="center" justify="center" p="6" className="fixed inset-0 z-50 bg-mission-control-bg">
          <Flex direction="column" align="center" gap="4" style={{ maxWidth: '28rem', width: '100%' }}>
            <div className="text-4xl">🐸</div>
            <Heading size="5" as="h1" className="text-mission-control-text">Setup Required</Heading>
            <Text size="2" className="text-mission-control-text-dim" align="center">
              Mission Control cannot start because required files are missing:
            </Text>
            <Box p="4" className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg">
              <Flex direction="column" gap="2">
                {criticalMissing.map(r => (
                  <Flex key={r.path} direction="column" gap="1">
                    <Text size="2" weight="medium" className="text-[var(--color-error)]">{r.label}</Text>
                    <Text size="1" className="text-mission-control-text-dim font-mono break-all">{r.path}</Text>
                  </Flex>
                ))}
              </Flex>
            </Box>
            <Box p="4" className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg">
              <Flex direction="column" gap="1">
                <Text size="1" weight="medium" className="text-mission-control-text" mb="2">To fix this:</Text>
                <Text size="1" className="text-mission-control-text-dim font-mono">1. Ensure ~/mission-control/data/mission-control.db exists</Text>
                <Text size="1" className="text-mission-control-text-dim font-mono">2. Run the Mission Control setup script or restore from backup</Text>
                <Text size="1" className="text-mission-control-text-dim font-mono">3. Restart the app</Text>
              </Flex>
            </Box>
            <Flex gap="2" justify="center">
              <Button
                onClick={() => window.location.reload()}
                size="2"
                variant="solid"
              >
                Retry
              </Button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                Continue anyway
              </button>
            </Flex>
          </Flex>
        </Flex>
      )}
    </>
  );
}
