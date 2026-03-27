// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashKPITiles — 4 big action-oriented tiles at the top of the dashboard.
 * Designed for the start-of-day view: what needs your attention right now.
 */
import { AlertTriangle, Activity, CheckCircle, Bot } from 'lucide-react';
import { useStore } from '../../store/store';

interface DashKPITilesProps {
  onNavigate?: (view: string) => void;
}

interface TileProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  subLabel?: string;
  urgency: 'urgent' | 'active' | 'success' | 'neutral';
  onClick?: () => void;
}

const URGENCY_STYLES: Record<TileProps['urgency'], string> = {
  urgent:  'border-error-border hover:border-error-DEFAULT/70 bg-error-subtle/30',
  active:  'border-info-border hover:border-info-DEFAULT/70 bg-info-subtle/30',
  success: 'border-success-border hover:border-success-DEFAULT/70 bg-success-subtle/30',
  neutral: 'border-mission-control-border hover:border-mission-control-accent/40',
};

const VALUE_STYLES: Record<TileProps['urgency'], string> = {
  urgent:  'text-error-DEFAULT',
  active:  'text-info-DEFAULT',
  success: 'text-success-DEFAULT',
  neutral: 'text-mission-control-text',
};

const ICON_STYLES: Record<TileProps['urgency'], string> = {
  urgent:  'text-error-DEFAULT',
  active:  'text-info-DEFAULT',
  success: 'text-success-DEFAULT',
  neutral: 'text-mission-control-text-dim',
};

function KPITile({ icon, value, label, subLabel, urgency, onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex-1 min-w-0 rounded-xl border p-4 text-left transition-colors',
        onClick ? 'cursor-pointer' : 'cursor-default',
        URGENCY_STYLES[urgency],
      ].join(' ')}
    >
      <div className={['mb-3', ICON_STYLES[urgency]].join(' ')}>{icon}</div>
      <div className={['text-3xl font-bold tabular-nums leading-none mb-1', VALUE_STYLES[urgency]].join(' ')}>
        {value}
      </div>
      <div className="text-xs font-semibold text-mission-control-text">{label}</div>
      {subLabel && (
        <div className="text-[10px] text-mission-control-text-dim mt-0.5">{subLabel}</div>
      )}
    </button>
  );
}

export default function DashKPITiles({ onNavigate }: DashKPITilesProps) {
  const { tasks, approvals, agents, gatewaySessions } = useStore();

  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length;
  const humanReviewTasks = tasks.filter((t) => t.status === 'human-review').length;
  const needsInput = pendingApprovals + humanReviewTasks;

  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const activeAgents = agents.filter((a) =>
    !['main', 'chat-agent'].includes(a.id) &&
    (a.status === 'active' || a.status === 'busy')
  ).length;

  const today = new Date().toDateString();
  const doneToday = tasks.filter(
    (t) => t.status === 'done' && new Date(t.updatedAt).toDateString() === today,
  ).length;

  const totalAgents = agents.filter((a) => !['main', 'chat-agent'].includes(a.id)).length;

  return (
    <div className="flex gap-4">
      <KPITile
        icon={<AlertTriangle size={20} />}
        value={needsInput}
        label="Needs your input"
        subLabel={needsInput === 0 ? 'All clear' : `${pendingApprovals} approvals · ${humanReviewTasks} review`}
        urgency={needsInput > 0 ? 'urgent' : 'neutral'}
        onClick={needsInput > 0 ? () => onNavigate?.('approvals') : undefined}
      />
      <KPITile
        icon={<Activity size={20} />}
        value={inProgressTasks}
        label="Tasks in progress"
        subLabel={activeAgents > 0 ? `${activeAgents} agent${activeAgents !== 1 ? 's' : ''} active` : 'No active agents'}
        urgency={inProgressTasks > 0 ? 'active' : 'neutral'}
        onClick={() => onNavigate?.('kanban')}
      />
      <KPITile
        icon={<CheckCircle size={20} />}
        value={doneToday}
        label="Completed today"
        subLabel={doneToday === 0 ? 'Nothing done yet' : `Tasks closed since midnight`}
        urgency={doneToday > 0 ? 'success' : 'neutral'}
        onClick={() => onNavigate?.('kanban')}
      />
      <KPITile
        icon={<Bot size={20} />}
        value={`${activeAgents}/${totalAgents}`}
        label="Agents active"
        subLabel={activeAgents === 0 ? 'All agents standing by' : `${activeAgents} running`}
        urgency={activeAgents > 0 ? 'active' : 'neutral'}
        onClick={() => onNavigate?.('agents')}
      />
      {/* Sessions from gateway */}
      {gatewaySessions.length > 0 && (
        <KPITile
          icon={<Activity size={20} />}
          value={gatewaySessions.filter((s) => s.isActive).length}
          label="Live sessions"
          subLabel={`${gatewaySessions.length} total`}
          urgency="active"
        />
      )}
    </div>
  );
}
