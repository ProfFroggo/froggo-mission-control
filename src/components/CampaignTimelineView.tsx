'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useMemo } from 'react';
import { Calendar, CheckCircle2, Circle, Flag, Play } from 'lucide-react';
import type { Campaign } from '../types/campaigns';

interface TaskItem {
  id: string;
  title: string;
  dueDate?: number | null;
  status: string;
}

interface CampaignTimelineViewProps {
  campaign: Campaign;
  tasks: TaskItem[];
  onMilestoneClick?: (taskId: string) => void;
}

type MilestoneType = 'start' | 'task' | 'end';

interface Milestone {
  id: string;
  label: string;
  date: number;
  type: MilestoneType;
  taskStatus?: string;
}

// Map campaign progress to named phases
function getPhaseLabel(pct: number): string {
  if (pct < 20) return 'Planning';
  if (pct < 60) return 'Execution';
  if (pct < 90) return 'Review';
  return 'Complete';
}

function MilestoneDot({ type, taskStatus, isPast }: { type: MilestoneType; taskStatus?: string; isPast: boolean }) {
  const size = type === 'start' || type === 'end' ? 18 : 14;

  if (type === 'start') {
    return (
      <div
        className="rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{
          width: size, height: size,
          borderColor: 'var(--color-success, #22c55e)',
          backgroundColor: isPast ? 'var(--color-success, #22c55e)' : 'var(--mission-control-bg0, #111)',
        }}
      >
        <Play size={7} style={{ color: isPast ? '#fff' : 'var(--color-success, #22c55e)' }} />
      </div>
    );
  }

  if (type === 'end') {
    const color = isPast ? 'var(--color-error, #ef4444)' : 'var(--color-info, #6366f1)';
    return (
      <div
        className="rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{
          width: size, height: size,
          borderColor: color,
          backgroundColor: isPast ? color : 'var(--mission-control-bg0, #111)',
        }}
      >
        <Flag size={7} style={{ color: isPast ? '#fff' : color }} />
      </div>
    );
  }

  // task dot
  const isDone = taskStatus === 'done';
  const color = isDone || isPast
    ? 'var(--mission-control-text-dim, #888)'
    : 'var(--color-info, #6366f1)';

  return isDone ? (
    <CheckCircle2 size={size} style={{ color: 'var(--color-success, #22c55e)', flexShrink: 0 }} />
  ) : (
    <Circle size={size} style={{ color, flexShrink: 0 }} />
  );
}

export default function CampaignTimelineView({ campaign, tasks, onMilestoneClick }: CampaignTimelineViewProps) {
  const now = Date.now();
  const start = campaign.startDate ?? null;
  const end = campaign.endDate ?? null;

  const milestones: Milestone[] = useMemo(() => {
    const items: Milestone[] = [];
    if (start) items.push({ id: '__start', label: 'Campaign start', date: start, type: 'start' });
    for (const t of tasks) {
      if (t.dueDate) {
        items.push({ id: t.id, label: t.title, date: t.dueDate, type: 'task', taskStatus: t.status });
      }
    }
    if (end) items.push({ id: '__end', label: 'Campaign end', date: end, type: 'end' });
    return items.sort((a, b) => a.date - b.date);
  }, [start, end, tasks]);

  // Timeline range
  const rangeStart = milestones.length > 0 ? milestones[0].date : now;
  const rangeEnd = milestones.length > 0 ? milestones[milestones.length - 1].date : now + 1;
  const span = Math.max(rangeEnd - rangeStart, 1);
  const pct = (date: number) => Math.min(100, Math.max(0, ((date - rangeStart) / span) * 100));
  const nowPct = pct(now);

  // Campaign-level timeline progress (start → end)
  const campaignProgress = start && end && end > start
    ? Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)))
    : null;

  const phaseLabel = campaignProgress !== null ? getPhaseLabel(campaignProgress) : null;

  // Phase bands for the track
  const PHASES = [
    { label: 'Planning', from: 0, to: 20, color: 'rgba(99,102,241,0.15)' },
    { label: 'Execution', from: 20, to: 60, color: 'rgba(34,197,94,0.10)' },
    { label: 'Review', from: 60, to: 90, color: 'rgba(234,179,8,0.12)' },
    { label: 'Complete', from: 90, to: 100, color: 'rgba(34,197,94,0.18)' },
  ];

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Calendar size={28} className="text-mission-control-text-dim" />
        <p className="text-sm text-mission-control-text-dim">No timeline data.</p>
        <p className="text-xs text-mission-control-text-dim">Set start/end dates and add due dates to tasks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Phase label + progress */}
      {campaignProgress !== null && phaseLabel && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">Phase</span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-mission-control-accent/40 text-mission-control-accent bg-mission-control-accent/10 font-medium">
              {phaseLabel}
            </span>
          </div>
          <span className="text-xs text-mission-control-text-dim">{campaignProgress}% elapsed</span>
        </div>
      )}

      {/* Horizontal timeline track */}
      <div className="relative select-none" style={{ minHeight: 100 }}>
        {/* Phase bands */}
        <div className="absolute left-0 right-0 rounded-full overflow-hidden" style={{ top: 19, height: 6 }}>
          {PHASES.map(p => (
            <div
              key={p.label}
              className="absolute h-full"
              style={{
                left: `${p.from}%`,
                width: `${p.to - p.from}%`,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>

        {/* Base track */}
        <div
          className="absolute left-0 right-0 rounded-full"
          style={{ top: 19, height: 6, backgroundColor: 'var(--mission-control-border, #2a2a2a)' }}
        />

        {/* Phase labels below track */}
        <div className="absolute left-0 right-0 flex" style={{ top: 30 }}>
          {PHASES.map(p => (
            <div
              key={p.label}
              className="absolute text-[9px] text-mission-control-text-dim"
              style={{ left: `${p.from}%`, transform: 'none', paddingTop: 6 }}
            >
              {p.label}
            </div>
          ))}
        </div>

        {/* "Today" indicator */}
        {nowPct >= 0 && nowPct <= 100 && (
          <div
            className="absolute flex flex-col items-center pointer-events-none"
            style={{ left: `${nowPct}%`, top: 0, transform: 'translateX(-50%)', zIndex: 3 }}
          >
            <div className="w-0.5 rounded-full" style={{ height: 22, backgroundColor: 'var(--mission-control-accent, #6366f1)' }} />
            <span className="text-[10px] font-semibold whitespace-nowrap mt-0.5" style={{ color: 'var(--mission-control-accent, #6366f1)' }}>
              Today
            </span>
          </div>
        )}

        {/* Milestone dots */}
        {milestones.map(m => {
          const p = pct(m.date);
          const isPast = m.date < now;
          const isTask = m.type === 'task';
          return (
            <div
              key={m.id}
              className={`absolute flex flex-col items-center ${isTask && onMilestoneClick ? 'cursor-pointer' : ''}`}
              style={{ left: `${p}%`, top: 12, transform: 'translateX(-50%)', zIndex: 2 }}
              onClick={() => isTask && onMilestoneClick && onMilestoneClick(m.id)}
              title={m.label}
            >
              <MilestoneDot type={m.type} taskStatus={m.taskStatus} isPast={isPast} />
              <span
                className="text-[10px] mt-3 text-center leading-tight"
                style={{
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isPast ? 'var(--mission-control-text-dim)' : 'var(--mission-control-text-primary)',
                }}
              >
                {m.label}
              </span>
              <span className="text-[9px] mt-0.5" style={{ color: 'var(--mission-control-text-dim)' }}>
                {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Milestone list */}
      <div className="space-y-2 mt-8">
        <h3 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-3">Milestones</h3>
        {milestones.map(m => {
          const isPast = m.date < now;
          const isSoon = !isPast && m.date <= now + 7 * 24 * 60 * 60 * 1000;
          const isTask = m.type === 'task';
          return (
            <div
              key={m.id}
              onClick={() => isTask && onMilestoneClick && onMilestoneClick(m.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                isTask && onMilestoneClick ? 'cursor-pointer hover:border-mission-control-accent/40' : ''
              } ${
                isPast
                  ? 'bg-mission-control-surface border-mission-control-border opacity-60'
                  : isSoon
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/40'
                    : 'bg-mission-control-surface border-mission-control-border'
              }`}
            >
              <MilestoneDot type={m.type} taskStatus={m.taskStatus} isPast={isPast} />
              <span className={`text-sm flex-1 truncate ${isPast && m.taskStatus !== 'done' ? 'text-mission-control-text-dim' : 'text-mission-control-text-primary'}`}>
                {m.label}
              </span>
              <span className="text-xs text-mission-control-text-dim flex-shrink-0">
                {new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {m.type === 'task' && m.taskStatus === 'done' && (
                <CheckCircle2 size={13} className="text-mission-control-text-dim flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
