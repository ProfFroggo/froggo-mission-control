// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useEffect, useState } from 'react';
import { Inbox, Activity, Bot, CalendarDays, Mail } from 'lucide-react';
import { useStore } from '../../store/store';

interface DashCommandBarProps {
  onShowBrief?: () => void;
  onQuickAction?: (action: 'calendar' | 'email') => void;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function DashCommandBar({ onShowBrief, onQuickAction }: DashCommandBarProps) {
  const { connected, tasks, approvals, agents, gatewaySessions } = useStore();

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const realAgents = agents.filter((a) => !['main', 'chat-agent'].includes(a.id));
  const activeSubagents = gatewaySessions.filter((s) => s.isActive).length;

  return (
    <div className="w-full px-6 py-3 bg-mission-control-surface border-b border-mission-control-border flex items-center justify-between gap-4">

      {/* LEFT — identity + clock */}
      <div className="flex items-center gap-3 shrink-0">
        <span
          className={[
            'w-2 h-2 rounded-full shrink-0',
            connected ? 'bg-success-DEFAULT animate-pulse' : 'bg-error-DEFAULT',
          ].join(' ')}
          aria-label={connected ? 'Connected' : 'Disconnected'}
        />
        <span className="text-sm font-bold text-mission-control-text">Mission Control</span>
        <span className="text-sm text-mission-control-text-dim tabular-nums">
          {now ? formatDate(now) : '\u00A0'}
        </span>
        <span className="text-sm tabular-nums text-mission-control-text-dim">
          {now ? formatTime(now) : '\u00A0'}
        </span>
      </div>

      {/* CENTER — metric chips */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Approvals */}
        <div
          className={[
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
            pendingApprovals > 0
              ? 'text-error-DEFAULT border-error-border bg-error-subtle'
              : 'text-mission-control-text-dim border-mission-control-border',
          ].join(' ')}
        >
          <Inbox className="w-3.5 h-3.5 shrink-0" />
          <span>{pendingApprovals} pending</span>
        </div>

        {/* In Progress */}
        <div
          className={[
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
            inProgressTasks > 0
              ? 'text-info-DEFAULT border-info-border bg-info-subtle'
              : 'text-mission-control-text-dim border-mission-control-border',
          ].join(' ')}
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>{inProgressTasks} active</span>
        </div>

        {/* Agents */}
        <div
          className={[
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border',
            activeSubagents > 0
              ? 'text-success-DEFAULT border-success-border bg-success-subtle'
              : 'text-mission-control-text-dim border-mission-control-border',
          ].join(' ')}
        >
          <Bot className="w-3.5 h-3.5 shrink-0" />
          <span>{realAgents.length} agents</span>
        </div>


      </div>

      {/* RIGHT — actions */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Quick icon: Calendar */}
        <button
          type="button"
          onClick={() => onQuickAction?.('calendar')}
          className="w-8 h-8 rounded-md border border-mission-control-border flex items-center justify-center text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          aria-label="Calendar"
        >
          <CalendarDays className="w-4 h-4" />
        </button>

        {/* Quick icon: Mail */}
        <button
          type="button"
          onClick={() => onQuickAction?.('email')}
          className="w-8 h-8 rounded-md border border-mission-control-border flex items-center justify-center text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          aria-label="Email"
        >
          <Mail className="w-4 h-4" />
        </button>

        {/* Daily Brief CTA */}
        <button
          type="button"
          onClick={() => onShowBrief?.()}
          className="px-4 py-1.5 rounded-lg bg-mission-control-accent text-black text-sm font-semibold hover:bg-mission-control-accent-dim transition-colors"
        >
          Daily Brief
        </button>

      </div>
    </div>
  );
}
