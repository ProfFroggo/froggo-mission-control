// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { useStore } from '../../store/store';

interface DashAgentPerfProps {
  range: '24h' | '48h';
  onNavigate?: (view: string) => void;
}

interface AgentPerfRow {
  agent_id: string;
  status: string;
  total_tasks: number;
  success_rate: number;
  avg_completion_hours: number;
  clara_approval_rate: number;
}

interface PerfResponse {
  agents: AgentPerfRow[];
}

function SuccessBar({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? 'bg-success-DEFAULT' : rate >= 50 ? 'bg-warning-DEFAULT' : 'bg-error-DEFAULT';
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 h-1 rounded-full bg-mission-control-border overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, rate)}%` }} />
      </div>
      <span className="text-[10px] text-mission-control-text-dim tabular-nums w-7 text-right shrink-0">
        {Math.round(rate)}%
      </span>
    </div>
  );
}

export function DashAgentPerf({ range, onNavigate }: DashAgentPerfProps) {
  const { agents } = useStore();
  const [rows, setRows] = useState<AgentPerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const days = range === '24h' ? 1 : 2;

    fetch(`/api/analytics/performance?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PerfResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const active = (data.agents ?? [])
          .filter((a) => a.total_tasks > 0)
          .sort((a, b) => b.total_tasks - a.total_tasks)
          .slice(0, 6);
        setRows(active);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [range]);

  const agentMap = new Map(agents.map((a) => [a.id, a]));

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <h2
          className="text-sm font-bold text-mission-control-text flex items-center gap-2 cursor-pointer hover:text-mission-control-accent transition-colors"
          onClick={() => onNavigate?.('agents')}
        >
          <Bot size={15} className="text-mission-control-accent" />
          Agents
        </h2>
        <span className="text-[10px] text-mission-control-text-dim">Last {range}</span>
      </div>

      <div className="p-3 space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-mission-control-border shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 rounded bg-mission-control-border w-24" />
                <div className="h-1 rounded bg-mission-control-border w-full" />
              </div>
              <div className="h-2.5 rounded bg-mission-control-border w-5 shrink-0" />
            </div>
          ))
        ) : error ? (
          <p className="text-xs text-error-DEFAULT px-1 py-2">Failed to load</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-mission-control-text-dim px-1 py-2">No activity in this period</p>
        ) : (
          rows.map((row) => {
            const storeAgent = agentMap.get(row.agent_id);
            const displayName = storeAgent?.name ?? row.agent_id;
            const letter = displayName[0]?.toUpperCase() ?? '?';
            const avgHours = row.avg_completion_hours;
            const timeLabel =
              avgHours >= 1
                ? `${avgHours.toFixed(1)}h`
                : avgHours > 0
                ? `${Math.round(avgHours * 60)}m`
                : null;

            return (
              <div key={row.agent_id} className="flex items-center gap-2 group">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-[10px] font-bold shrink-0">
                  {letter}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-mission-control-text truncate">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-mission-control-text-dim tabular-nums ml-2 shrink-0">
                      {row.total_tasks} task{row.total_tasks !== 1 ? 's' : ''}
                      {timeLabel ? ` · ${timeLabel}` : ''}
                    </span>
                  </div>
                  <SuccessBar rate={row.success_rate} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default DashAgentPerf;
