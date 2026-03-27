// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useMemo } from 'react';
import { Bot, Zap, Clock, Activity } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../../store/store';
import AgentAvatar from '../AgentAvatar';
import { formatTimeAgo } from '../../utils/formatting';
import type { Agent, Task, GatewaySession } from '../../store/store';

// ── Constants ────────────────────────────────────────────────────────────────

const PHANTOM_AGENTS = ['main', 'chat-agent'];

// Statuses that should render the card at reduced opacity
const OFFLINE_STATUSES: Agent['status'][] = ['offline', 'archived', 'disabled'];

// Statuses that indicate the agent is doing work
const ACTIVE_STATUSES: Agent['status'][] = ['active', 'busy'];

// ── Token helpers ─────────────────────────────────────────────────────────────

function getAgentTokens(agentId: string, sessions: GatewaySession[]): number {
  return sessions.reduce((sum, session) => {
    const keyMatch = session.key.toLowerCase().includes(agentId.toLowerCase());
    const labelMatch = session.label
      ? session.label.toLowerCase().includes(agentId.toLowerCase())
      : false;
    if (keyMatch || labelMatch) {
      return sum + (session.totalTokens ?? 0);
    }
    return sum;
  }, 0);
}

function formatTokens(count: number): string {
  if (count === 0) return '0';
  if (count < 1000) return `${count}`;
  return `${(count / 1000).toFixed(1)}k`;
}

// ── Subagent helpers ──────────────────────────────────────────────────────────

function getActiveSubagentCount(agentId: string, sessions: GatewaySession[]): number {
  return sessions.filter(
    s =>
      s.type === 'subagent' &&
      s.isActive === true &&
      s.key.toLowerCase().includes(agentId.toLowerCase()),
  ).length;
}

// ── Status helpers ────────────────────────────────────────────────────────────

function isAgentBusy(agent: Agent): boolean {
  return ACTIVE_STATUSES.includes(agent.status);
}

function isAgentOffline(agent: Agent): boolean {
  return OFFLINE_STATUSES.includes(agent.status);
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface StatusDotProps {
  busy: boolean;
}

function StatusDot({ busy }: StatusDotProps) {
  if (busy) {
    return (
      <span className="w-2 h-2 rounded-full bg-success-DEFAULT animate-pulse flex-shrink-0" />
    );
  }
  return (
    <span className="w-2 h-2 rounded-full bg-mission-control-text-dim flex-shrink-0 opacity-40" />
  );
}

interface StatusLabelProps {
  status: Agent['status'];
}

function StatusLabel({ status }: StatusLabelProps) {
  const busy = ACTIVE_STATUSES.includes(status);
  const labelCls = busy
    ? 'text-xs text-success-DEFAULT tabular-nums'
    : 'text-xs text-mission-control-text-dim tabular-nums';

  const label =
    status === 'active' ? 'active' :
    status === 'busy'   ? 'busy' :
    status === 'idle'   ? 'idle' :
    status;

  return <span className={labelCls}>{label}</span>;
}

interface SubagentChipProps {
  count: number;
}

function SubagentChip({ count }: SubagentChipProps) {
  if (count === 0) return null;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-success-subtle text-success-DEFAULT border border-success-border tabular-nums">
      {count} sub-agent{count !== 1 ? 's' : ''} running
    </span>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: Agent;
  currentTask: Task | undefined;
  tokens: number;
  subagentCount: number;
}

function AgentCard({ agent, currentTask, tokens, subagentCount }: AgentCardProps) {
  const busy = isAgentBusy(agent);
  const offline = isAgentOffline(agent);

  const cardBase =
    'rounded-xl p-4 bg-mission-control-surface border transition-colors';
  const cardBorder = busy
    ? 'border-success-border hover:border-success-DEFAULT/50'
    : 'border-mission-control-border hover:border-mission-control-accent/30';
  const cardOpacity = offline ? 'opacity-50' : '';

  const taskTitle = currentTask?.title ?? null;
  const lastActiveText = agent.lastActivity
    ? formatTimeAgo(agent.lastActivity)
    : 'Never';

  return (
    <div className={`${cardBase} ${cardBorder} ${cardOpacity}`}>
      {/* Header row: avatar + name + status */}
      <div className="flex items-center gap-2 min-w-0">
        <AgentAvatar
          agentId={agent.id}
          agentName={agent.name}
          size="sm"
          status={busy ? 'active' : 'idle'}
        />
        <span className="text-sm font-semibold text-mission-control-text truncate flex-1 min-w-0">
          {agent.name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusLabel status={agent.status} />
          <StatusDot busy={busy} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-mission-control-border my-2.5" />

      {/* Current task */}
      <div className="flex items-center gap-1.5 min-w-0">
        <Activity
          size={12}
          className={
            busy
              ? 'text-success-DEFAULT flex-shrink-0'
              : 'text-mission-control-text-dim flex-shrink-0 opacity-50'
          }
        />
        {taskTitle ? (
          <span className="text-xs text-mission-control-text-dim truncate">
            {taskTitle}
          </span>
        ) : (
          <span className="text-xs text-mission-control-text-dim opacity-50">Idle</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-mission-control-border my-2.5" />

      {/* Footer: tokens + last active */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-xs text-mission-control-text-dim tabular-nums">
            <Zap size={11} className="flex-shrink-0" />
            {formatTokens(tokens)} tokens
          </span>
          <span className="flex items-center gap-1 text-xs text-mission-control-text-dim tabular-nums">
            <Clock size={11} className="flex-shrink-0" />
            {lastActiveText}
          </span>
        </div>
      </div>

      {/* Subagent chip (if any active) */}
      {subagentCount > 0 && (
        <div className="mt-2">
          <SubagentChip count={subagentCount} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashAgentGrid() {
  const { agents, tasks, gatewaySessions } = useStore(
    useShallow(s => ({
      agents: s.agents,
      tasks: s.tasks,
      gatewaySessions: s.gatewaySessions,
    })),
  );

  const realAgents = useMemo(
    () => agents.filter(a => !PHANTOM_AGENTS.includes(a.id)),
    [agents],
  );

  const activeCount = useMemo(
    () => realAgents.filter(a => isAgentBusy(a)).length,
    [realAgents],
  );

  // Build a taskId → Task lookup for O(1) per-card lookup
  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of tasks) map.set(t.id, t);
    return map;
  }, [tasks]);

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Bot size={16} className="text-mission-control-accent" />
          Agent Status
          <span className="text-xs font-normal text-mission-control-text-dim">
            ({realAgents.length} agents)
          </span>
        </h2>
        <span className="text-xs text-mission-control-text-dim tabular-nums">
          {activeCount} active
        </span>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {realAgents.map(agent => {
          const currentTask = agent.currentTaskId
            ? taskById.get(agent.currentTaskId)
            : undefined;
          const tokens = getAgentTokens(agent.id, gatewaySessions);
          const subagentCount = getActiveSubagentCount(agent.id, gatewaySessions);

          return (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentTask={currentTask}
              tokens={tokens}
              subagentCount={subagentCount}
            />
          );
        })}
      </div>

      {/* Empty state */}
      {realAgents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-mission-control-text-dim">
          <Bot size={32} className="mb-3 opacity-30" />
          <span className="text-sm">No agents configured</span>
        </div>
      )}
    </section>
  );
}
