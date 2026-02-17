import React, { useState, useEffect } from 'react';

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half_open';
  consecutive_failures: number;
  last_failure_time: number | null;
  suspended_until: number | null;
  last_state_change: number;
}

export const CircuitBreakerStatus: React.FC = () => {
  const [breakers, setBreakers] = useState<Record<string, CircuitBreakerState>>({});

  useEffect(() => {
    const fetch = async () => {
      try {
        const status = await (window as any).clawdbot?.getCircuitStatus();
        setBreakers(status || {});
      } catch (err) {
        // 'Failed to fetch circuit status:', err;
      }
    };

    fetch();
    const interval = setInterval(fetch, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const tripped = Object.entries(breakers).filter(([_, b]) => b.state !== 'closed');

  if (tripped.length === 0) return null; // Hide when nothing is tripped

  return (
    <div className="p-3 rounded-lg bg-error-subtle border border-error-border">
      <div className="text-xs font-medium text-error mb-2">Circuit Breakers Tripped</div>
      {tripped.map(([agent, state]) => {
        const timeLeft = state.suspended_until ? Math.ceil((state.suspended_until - Date.now()) / 60000) : 0;
        return (
          <div key={agent} className="flex items-center justify-between text-xs py-1">
            <span className="text-clawd-text-dim">{agent}</span>
            <span className={state.state === 'open' ? 'text-error' : 'text-warning'}>
              {state.state === 'open' ? 'SUSPENDED' : 'TRIAL'}
              {state.suspended_until && timeLeft > 0 && ` (${timeLeft}m left)`}
            </span>
          </div>
        );
      })}
    </div>
  );
};
