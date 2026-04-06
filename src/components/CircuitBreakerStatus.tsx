import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { useEventBus } from '../lib/useEventBus';

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  consecutive_failures: number;
  last_failure_time: number | null;
  suspended_until: number | null;
  last_state_change: number;
}

const STATE_LABEL: Record<CircuitBreakerState['state'], string> = {
  open:      'SUSPENDED',
  half_open: 'TRIAL',
  closed:    'CLOSED',
};

const STATE_COLOR: Record<CircuitBreakerState['state'], string> = {
  open:      'text-error',
  half_open: 'text-warning',
  closed:    'text-success',
};

const STATE_DOT: Record<CircuitBreakerState['state'], string> = {
  open:      'bg-error',
  half_open: 'bg-warning',
  closed:    'bg-success',
};

export const CircuitBreakerStatus: React.FC = () => {
  const [breakers, setBreakers] = useState<Record<string, CircuitBreakerState>>({});

  useEffect(() => {
    const controller = new AbortController();

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          setBreakers(data?.circuitBreakers || {});
        }
      } catch (err) {
        console.warn('[CircuitBreakerStatus] Non-critical:', err);
        // Health check failed or aborted — leave breakers as-is
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 120000);
    return () => { controller.abort(); clearInterval(interval); };
  }, []);

  // Subscribe to circuit.open SSE events for immediate updates
  useEventBus('circuit.open', (data) => {
    const d = data as { agentId: string; failures: number; lockedUntil: number | null };
    if (d?.agentId) {
      setBreakers(prev => ({
        ...prev,
        [d.agentId]: {
          state: 'open',
          consecutive_failures: d.failures,
          last_failure_time: Date.now(),
          suspended_until: d.lockedUntil,
          last_state_change: Date.now(),
        },
      }));
    }
  });

  const tripped = Object.entries(breakers).filter(([, b]) => b.state !== 'closed');

  if (tripped.length === 0) return null; // Hide when nothing is tripped

  const TRIP_THRESHOLD = 5; // failures before open

  return (
    <div className="rounded-xl border border-error/30 bg-mission-control-surface overflow-hidden">
      {/* Header */}
      <Flex align="center" gap="2" className="px-4 py-2.5 border-b border-error/20">
        <ShieldAlert size={14} className="text-error flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-error">Circuit Breakers Tripped</span>
        <span className="ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-error/10 text-error">
          {tripped.length}
        </span>
      </Flex>

      {/* Breaker rows */}
      <div>
        {tripped.map(([agent, state]) => {
          const timeLeft = state.suspended_until
            ? Math.ceil((state.suspended_until - Date.now()) / 60000)
            : 0;
          const labelStyle = STATE_COLOR[state.state];
          const dotStyle   = STATE_DOT[state.state];
          const failurePct = Math.min((state.consecutive_failures / TRIP_THRESHOLD) * 100, 100);
          const barColor = state.state === 'open' ? 'bg-error' : 'bg-warning';

          return (
            <div
              key={agent}
              className="px-4 py-2.5 border-b border-mission-control-border/40 last:border-0"
            >
              <Flex align="center" justify="between" gap="3" className="mb-1.5">
                {/* Status dot + agent name */}
                <Flex align="center" gap="2" className="min-w-0">
                  <span className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${dotStyle}`} />
                  <span className="text-xs text-mission-control-text truncate">{agent}</span>
                </Flex>

                {/* Failure count badge + state label */}
                <Flex align="center" gap="2" className="flex-shrink-0">
                  {state.consecutive_failures > 0 && (
                    <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-error/10 text-error">
                      {state.consecutive_failures} fail{state.consecutive_failures !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold tracking-wide ${labelStyle}`}>
                    {STATE_LABEL[state.state]}
                    {state.suspended_until && timeLeft > 0 && (
                      <span className="ml-1 font-normal text-mission-control-text-dim">
                        ({timeLeft}m)
                      </span>
                    )}
                  </span>
                </Flex>
              </Flex>

              {/* Trip threshold progress bar */}
              <div className="h-1 bg-mission-control-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
                  style={{ width: `${failurePct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
