// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Users, Zap } from 'lucide-react';
import { useStore, Agent } from '../store/store';
import { useShallow } from 'zustand/react/shallow';
import { useEventBus } from '../lib/useEventBus';

interface AgentHealthRow {
  agent: Agent;
  tasksToday: number;
  circuitOpen: boolean;
  currentTask: string | null;
  isStale: boolean; // no activity in 24h
  failuresToday: number;
}

interface AgentHealthDashboardProps {
  onSelectAgent?: (agentId: string, agentName: string) => void;
}

const PHANTOM_AGENTS = ['main', 'chat-agent'];

export default function AgentHealthDashboard({ onSelectAgent }: AgentHealthDashboardProps) {
  const { agents, tasks } = useStore(
    useShallow(s => ({ agents: s.agents, tasks: s.tasks }))
  );
  const [circuitOpenAgents, setCircuitOpenAgents] = useState<Set<string>>(new Set());
  const [healthData, setHealthData] = useState<Record<string, { tasksToday: number; failuresToday: number }>>({});

  useEventBus('circuit.open', (data) => {
    const d = data as { agentId: string };
    if (d?.agentId) setCircuitOpenAgents(prev => new Set(prev).add(d.agentId));
  });

  useEffect(() => {
    // Build per-agent health stats from tasks
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const stats: Record<string, { tasksToday: number; failuresToday: number }> = {};

    for (const task of tasks) {
      const agentId = task.assignedTo;
      if (!agentId) continue;
      const updatedAt = (task as any).updatedAt ?? 0;
      if (updatedAt < dayAgo) continue;

      if (!stats[agentId]) stats[agentId] = { tasksToday: 0, failuresToday: 0 };
      if (task.status === 'done') stats[agentId].tasksToday++;
      if ((task.status as string) === 'failed') stats[agentId].failuresToday++;
    }

    setHealthData(stats);
  }, [tasks]);

  const realAgents = agents.filter(a => !PHANTOM_AGENTS.includes(a.id) && !a.id.startsWith('worker-'));

  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const healthRows: AgentHealthRow[] = realAgents.map(agent => {
    const currentTask = tasks.find(t => t.id === agent.currentTaskId && t.status === 'in-progress') ?? null;
    const stats = healthData[agent.id] ?? { tasksToday: 0, failuresToday: 0 };
    return {
      agent,
      tasksToday: stats.tasksToday,
      failuresToday: stats.failuresToday,
      circuitOpen: circuitOpenAgents.has(agent.id),
      currentTask: currentTask?.title ?? null,
      isStale: !agent.lastActivity || agent.lastActivity < dayAgo,
    };
  });

  // Fleet-level stats
  const online = agents.filter(a => !PHANTOM_AGENTS.includes(a.id) && (a.lastActivity ?? 0) > hourAgo).length;
  const circuitOpenCount = circuitOpenAgents.size;
  const unassignedInProgress = tasks.filter(t => t.status === 'in-progress' && !t.assignedTo).length;
  const totalAgents = realAgents.length;

  // Alerts: circuit open, stale, or >3 failures today
  const alertRows = healthRows.filter(r => r.circuitOpen || r.isStale || r.failuresToday > 3);

  const formatLastActive = (ts?: number) => {
    if (!ts) return 'Never';
    const diffMs = now - ts;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMs / 3_600_000);
    if (diffMs < 60_000) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  return (
    <div className="space-y-4">
      {/* Fleet overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users,         val: totalAgents,        label: 'Total agents',          color: 'text-mission-control-text' },
          { icon: Activity,      val: online,             label: 'Online (last hour)',     color: 'text-success' },
          { icon: AlertTriangle, val: circuitOpenCount,   label: 'Circuit breakers open',  color: circuitOpenCount > 0 ? 'text-error' : 'text-success' },
          { icon: Zap,           val: unassignedInProgress, label: 'Unassigned in-progress', color: unassignedInProgress > 0 ? 'text-warning' : 'text-success' },
        ].map(({ icon: Icon, val, label, color }) => (
          <div key={label} className="rounded-lg border border-mission-control-border bg-mission-control-surface p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={14} className={color} />
              <span className="text-xs text-mission-control-text-dim">{label}</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${color}`}>{val}</div>
          </div>
        ))}
      </div>

      {/* Alert section */}
      {alertRows.length > 0 && (
        <div className="rounded-lg border border-warning-border bg-warning-subtle p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-warning uppercase tracking-wider mb-1">
            <AlertTriangle size={13} />
            Attention required
          </div>
          {alertRows.map(r => (
            <div key={r.agent.id} className="flex items-center gap-3 text-sm">
              <span className="font-medium text-mission-control-text w-28 truncate">{r.agent.name}</span>
              <div className="flex items-center gap-2 flex-wrap">
                {r.circuitOpen && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-error-subtle text-error border border-error-border">
                    Circuit open
                  </span>
                )}
                {r.isStale && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-warning-subtle text-warning border border-warning-border">
                    No activity 24h
                  </span>
                )}
                {r.failuresToday > 3 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-error-subtle text-error border border-error-border">
                    {r.failuresToday} failures today
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-agent health table */}
      <div className="rounded-lg border border-mission-control-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mission-control-border bg-mission-control-surface/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider hidden sm:table-cell">Last active</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider hidden md:table-cell">Done today</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Circuit</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Current task</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mission-control-border/50">
            {healthRows.map(row => (
              <tr
                key={row.agent.id}
                className={`hover:bg-mission-control-surface/40 transition-colors ${onSelectAgent ? 'cursor-pointer' : ''}`}
                onClick={() => onSelectAgent?.(row.agent.id, row.agent.name)}
              >
                {/* Agent name + status dot */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      row.agent.status === 'busy' ? 'bg-mission-control-accent animate-pulse' :
                      row.agent.status === 'active' || row.agent.status === 'idle' ? 'bg-success' :
                      'bg-mission-control-text-dim/40'
                    }`} />
                    <span className="font-medium text-mission-control-text">{row.agent.name}</span>
                  </div>
                </td>

                {/* Last active */}
                <td className="px-4 py-3 text-mission-control-text-dim hidden sm:table-cell">
                  <div className="flex items-center gap-1">
                    <Clock size={11} />
                    {formatLastActive(row.agent.lastActivity)}
                  </div>
                </td>

                {/* Tasks done today */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-1 text-success">
                    <CheckCircle size={11} />
                    {row.tasksToday}
                  </div>
                </td>

                {/* Circuit status */}
                <td className="px-4 py-3">
                  {row.circuitOpen ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-error-subtle text-error border border-error-border">
                      <AlertTriangle size={9} /> Open
                    </span>
                  ) : (
                    <span className="text-xs text-success">OK</span>
                  )}
                </td>

                {/* Current task */}
                <td className="px-4 py-3 max-w-xs">
                  {row.currentTask ? (
                    <span className="flex items-center gap-1 text-amber-400 text-xs">
                      <Zap size={11} className="flex-shrink-0" />
                      <span className="truncate">{row.currentTask}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-mission-control-text-dim/60">Idle</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {healthRows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-mission-control-text-dim">
            No agents to display
          </div>
        )}
      </div>
    </div>
  );
}
