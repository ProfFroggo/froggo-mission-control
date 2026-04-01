// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock, Users, Zap } from 'lucide-react';
import { Badge, Box, Flex } from '@radix-ui/themes';
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
          {
            icon: Users, val: totalAgents, label: 'Total agents',
            color: 'text-mission-control-text',
            subLabel: 'registered',
          },
          {
            icon: Activity, val: online, label: 'Online',
            color: online > 0 ? 'text-success' : 'text-mission-control-text-dim',
            subLabel: 'last hour',
          },
          {
            icon: AlertTriangle, val: circuitOpenCount, label: 'Circuit open',
            color: circuitOpenCount > 0 ? 'text-error' : 'text-success',
            subLabel: circuitOpenCount > 0 ? 'needs attention' : 'all clear',
          },
          {
            icon: Zap, val: unassignedInProgress, label: 'Unassigned',
            color: unassignedInProgress > 0 ? 'text-warning' : 'text-success',
            subLabel: 'in-progress',
          },
        ].map(({ icon: Icon, val, label, color, subLabel }) => (
          <div key={label} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon size={12} className={color} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{label}</span>
            </div>
            <div className="text-xl font-bold tabular-nums font-mono text-mission-control-text">{val}</div>
            <div className="text-[11px] text-mission-control-text-dim/70 mt-0.5">{subLabel}</div>
          </div>
        ))}
      </div>


      {/* Per-agent health table */}
      <div className="rounded-lg border border-mission-control-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-mission-control-border bg-mission-control-surface/50">
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Agent</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider hidden sm:table-cell">Last active</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider hidden md:table-cell">Done today</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Circuit</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">Current task</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mission-control-border/50">
            {healthRows.map(row => (
              <tr
                key={row.agent.id}
                className={`hover:bg-mission-control-surface/40 transition-colors ${onSelectAgent ? 'cursor-pointer' : ''}`}
                onClick={() => onSelectAgent?.(row.agent.id, row.agent.name)}
              >
                {/* Agent name + status badge */}
                <td className="px-4 py-3">
                  <Flex align="center" gap="2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      row.agent.status === 'active' || row.agent.status === 'busy'
                        ? 'bg-success agent-dot-pulse'
                        : 'bg-mission-control-border'
                    }`} />
                    <span className="font-medium text-mission-control-text">{row.agent.name}</span>
                    {(row.agent.status === 'active' || row.agent.status === 'busy') ? (
                      <span className="hidden sm:inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20">
                        online
                      </span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/40 text-mission-control-text-dim">
                        offline
                      </span>
                    )}
                  </Flex>
                </td>

                {/* Last active */}
                <td className="px-4 py-3 text-mission-control-text-dim hidden sm:table-cell">
                  <Flex align="center" gap="1">
                    <Clock size={11} />
                    {formatLastActive(row.agent.lastActivity)}
                  </Flex>
                </td>

                {/* Tasks done today */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <Flex align="center" gap="1" className="text-success">
                    <CheckCircle size={11} />
                    {row.tasksToday}
                  </Flex>
                </td>

                {/* Circuit status */}
                <td className="px-4 py-3">
                  {row.circuitOpen ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/30">
                      <AlertTriangle size={9} /> Open
                    </span>
                  ) : (
                    <span className="text-xs text-success">OK</span>
                  )}
                </td>

                {/* Current task */}
                <td className="px-4 py-3 max-w-xs">
                  {row.currentTask ? (
                    <span className="flex items-center gap-1 text-warning text-xs">
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
          <Flex align="center" justify="center" px="4" py="6" className="text-sm text-mission-control-text-dim">
            No agents to display
          </Flex>
        )}
      </div>
    </div>
  );
}
