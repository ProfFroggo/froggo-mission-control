'use client';

/**
 * ProjectGanttView — horizontal scrollable task timeline.
 *
 * Zoom levels:
 *   week    → 7 days,  80px/day
 *   month   → 30 days, 32px/day
 *   quarter → 91 days, 12px/day
 *
 * Props:
 *   projectId   — project identifier (passed through to onTaskClick)
 *   tasks       — GanttTask[]
 *   onTaskClick — callback when a task bar is clicked
 */

import { useState, useRef, useMemo } from 'react';
import { Calendar, ZoomIn, ZoomOut, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GanttTask {
  id: string;
  title: string;
  status: string;
  createdAt: number;
  dueDate?: number | null;
  completedAt?: number | null;
  assignedTo?: string | null;
  priority?: string;
}

interface Props {
  projectId: string;
  tasks: GanttTask[];
  onTaskClick?: (taskId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

type ZoomLevel = 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { colPx: number; days: number; label: string }> = {
  week:    { colPx: 80, days: 7,  label: 'Week' },
  month:   { colPx: 32, days: 30, label: 'Month' },
  quarter: { colPx: 12, days: 91, label: 'Quarter' },
};
const ZOOM_ORDER: ZoomLevel[] = ['week', 'month', 'quarter'];

const STATUS_GROUPS = [
  { id: 'in-progress', label: 'In Progress', statuses: ['in-progress', 'internal-review', 'human-review'] },
  { id: 'review',      label: 'Review',      statuses: ['review'] },
  { id: 'done',        label: 'Done',         statuses: ['done', 'completed'] },
  { id: 'todo',        label: 'To Do',        statuses: ['todo', 'blocked'] },
];

const STATUS_COLORS: Record<string, string> = {
  'in-progress':     'var(--color-accent, #6366f1)',
  'internal-review': 'var(--color-accent, #6366f1)',
  'human-review':    'var(--color-warning, #f59e0b)',
  'review':          'var(--color-info, #06b6d4)',
  'done':            'var(--color-success, #22c55e)',
  'completed':       'var(--color-success, #22c55e)',
  'todo':            'var(--color-border, #3f3f5a)',
  'blocked':         'var(--color-error, #ef4444)',
};

const ROW_H      = 32;
const LABEL_W    = 220;
const HEADER_H   = 44;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDays(ts: number, n: number): number {
  return ts + n * 86_400_000;
}

function fmtDay(ts: number, colPx: number): string {
  const d = new Date(ts);
  if (colPx >= 48) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (colPx >= 20) return `${d.getMonth() + 1}/${d.getDate()}`;
  return String(d.getDate());
}

// ─── Task Bar ─────────────────────────────────────────────────────────────────

function TaskBar({
  task, windowStart, colPx, rowTop, onClick,
}: {
  task: GanttTask;
  windowStart: number;
  colPx: number;
  rowTop: number;
  onClick?: () => void;
}) {
  const taskStart = startOfDay(task.createdAt);
  const taskEnd   = task.dueDate ? startOfDay(task.dueDate) : addDays(taskStart, 7);
  const x         = ((taskStart - windowStart) / 86_400_000) * colPx;
  const width     = Math.max(colPx * 0.8, ((taskEnd - taskStart) / 86_400_000) * colPx);
  const color     = STATUS_COLORS[task.status] ?? 'var(--color-accent, #6366f1)';
  const isDone    = task.status === 'done' || task.status === 'completed';
  const isLate    = !isDone && task.dueDate != null && task.dueDate < Date.now();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick?.()}
      title={`${task.title}\n${new Date(task.createdAt).toLocaleDateString()} → ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '+7d'}`}
      style={{
        position: 'absolute',
        left: Math.max(0, x),
        top: rowTop + 4,
        width,
        height: ROW_H - 8,
        backgroundColor: color,
        opacity: isDone ? 0.5 : 1,
        borderRadius: 4,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 6,
        paddingRight: 4,
        overflow: 'hidden',
        boxSizing: 'border-box',
        outline: isLate ? `2px solid var(--color-error, #ef4444)` : 'none',
        outlineOffset: -2,
        zIndex: 2,
      }}
      className="hover:brightness-110 focus:brightness-110 transition-[filter]"
    >
      {colPx >= 32 && (
        <span style={{ fontSize: 11, color: '#fff', fontWeight: 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1 }}>
          {task.title}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectGanttView({ tasks, onTaskClick }: Props) {
  const [zoom, setZoom]           = useState<ZoomLevel>('month');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const scrollRef                 = useRef<HTMLDivElement>(null);

  const { colPx, days } = ZOOM_CONFIG[zoom];
  const today           = useMemo(() => startOfDay(Date.now()), []);
  const windowStart     = useMemo(() => addDays(today, -14), [today]);
  const totalPx         = days * colPx;
  const todayX          = ((today - windowStart) / 86_400_000) * colPx;

  const dayHeaders = useMemo(() => {
    const cols: number[] = [];
    for (let i = 0; i < days; i++) cols.push(addDays(windowStart, i));
    return cols;
  }, [windowStart, days]);

  const groupedTasks = useMemo(
    () => STATUS_GROUPS
      .map(g => ({ ...g, tasks: tasks.filter(t => g.statuses.includes(t.status)) }))
      .filter(g => g.tasks.length > 0),
    [tasks]
  );

  const { rows, totalHeight } = useMemo(() => {
    const rows: Array<{ task: GanttTask; rowTop: number }> = [];
    let y = 0;
    for (const group of groupedTasks) {
      y += ROW_H;
      if (!collapsed[group.id]) {
        for (const task of group.tasks) {
          rows.push({ task, rowTop: y });
          y += ROW_H;
        }
      }
    }
    return { rows, totalHeight: Math.max(y, ROW_H * 2) };
  }, [groupedTasks, collapsed]);

  function toggleGroup(id: string) {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-mission-control-text-dim">
        <Calendar size={28} className="mb-2" />
        <p className="text-sm">No tasks to display on the timeline.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mission-control-border" style={{ flexShrink: 0 }}>
        <Calendar size={14} className="text-mission-control-text-dim" />
        <span className="text-xs font-medium text-mission-control-text-dim">Timeline</span>
        <div className="flex-1" />
        <button onClick={() => { const i = ZOOM_ORDER.indexOf(zoom); if (i > 0) setZoom(ZOOM_ORDER[i - 1]); }}
          disabled={zoom === 'week'}
          className="p-1 rounded text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface disabled:opacity-30 transition-colors"
          title="Zoom in" aria-label="Zoom in">
          <ZoomIn size={13} />
        </button>
        {ZOOM_ORDER.map(z => (
          <button key={z} onClick={() => setZoom(z)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${zoom === z ? 'bg-mission-control-accent text-white' : 'text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface'}`}>
            {ZOOM_CONFIG[z].label}
          </button>
        ))}
        <button onClick={() => { const i = ZOOM_ORDER.indexOf(zoom); if (i < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[i + 1]); }}
          disabled={zoom === 'quarter'}
          className="p-1 rounded text-mission-control-text-dim hover:text-mission-control-text-primary hover:bg-mission-control-surface disabled:opacity-30 transition-colors"
          title="Zoom out" aria-label="Zoom out">
          <ZoomOut size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* Fixed label column */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: HEADER_H, flexShrink: 0, borderBottom: '1px solid var(--color-border)' }} />
          <div style={{ flex: 1, overflowY: 'hidden', position: 'relative', height: totalHeight }}>
            {(() => {
              const items: React.ReactNode[] = [];
              let y = 0;
              for (const group of groupedTasks) {
                const isOpen = !collapsed[group.id];
                items.push(
                  <div key={`g-${group.id}`}
                    role="button" tabIndex={0}
                    onClick={() => toggleGroup(group.id)}
                    onKeyDown={e => e.key === 'Enter' && toggleGroup(group.id)}
                    style={{ height: ROW_H, display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 8,
                      cursor: 'pointer', backgroundColor: 'var(--color-surface)',
                      borderBottom: '1px solid var(--color-border)',
                      position: 'absolute', top: y, left: 0, right: 0 }}>
                    {isOpen
                      ? <ChevronDown size={12} className="text-mission-control-text-dim flex-shrink-0" />
                      : <ChevronRight size={12} className="text-mission-control-text-dim flex-shrink-0" />}
                    <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide truncate">{group.label}</span>
                    <span className="ml-auto text-xs text-mission-control-text-dim">{group.tasks.length}</span>
                  </div>
                );
                y += ROW_H;
                if (isOpen) {
                  for (const task of group.tasks) {
                    items.push(
                      <div key={`t-${task.id}`}
                        style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 20, paddingRight: 8,
                          position: 'absolute', top: y, left: 0, right: 0,
                          borderBottom: '1px solid var(--color-border-subtle, var(--color-border))' }}>
                        <span className="text-xs text-mission-control-text-primary truncate" title={task.title}>{task.title}</span>
                      </div>
                    );
                    y += ROW_H;
                  }
                }
              }
              return items;
            })()}
          </div>
        </div>

        {/* Scrollable grid */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative' }}>
          {/* Day headers */}
          <div style={{ position: 'sticky', top: 0, height: HEADER_H, display: 'flex', width: totalPx,
            backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', zIndex: 5, flexShrink: 0 }}>
            {dayHeaders.map((day, i) => (
              <div key={i} style={{ width: colPx, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: day === today ? 'var(--color-error, #ef4444)' : 'var(--color-text-dim)',
                fontWeight: day === today ? 700 : 400,
                borderRight: '1px solid var(--color-border-subtle, var(--color-border))', userSelect: 'none' }}>
                {fmtDay(day, colPx)}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ position: 'relative', width: totalPx, height: totalHeight }}>
            {/* Today line */}
            <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: 2,
              backgroundColor: 'var(--color-error, #ef4444)', opacity: 0.7, pointerEvents: 'none', zIndex: 10 }} />

            {/* Vertical day lines */}
            {dayHeaders.map((_, i) => (
              <div key={i} style={{ position: 'absolute', left: i * colPx, top: 0, bottom: 0, width: 1,
                backgroundColor: 'var(--color-border)', opacity: 0.3, pointerEvents: 'none' }} />
            ))}

            {/* Group header bands */}
            {(() => {
              const bands: React.ReactNode[] = [];
              let y = 0;
              for (const group of groupedTasks) {
                bands.push(
                  <div key={`band-${group.id}`} style={{ position: 'absolute', left: 0, top: y, width: '100%',
                    height: ROW_H, backgroundColor: 'var(--color-surface)',
                    borderBottom: '1px solid var(--color-border)', pointerEvents: 'none' }} />
                );
                y += ROW_H;
                if (!collapsed[group.id]) y += group.tasks.length * ROW_H;
              }
              return bands;
            })()}

            {/* Task bars */}
            {rows.map(({ task, rowTop }) => (
              <TaskBar key={task.id} task={task} windowStart={windowStart}
                colPx={colPx} rowTop={rowTop} onClick={() => onTaskClick?.(task.id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-mission-control-border" style={{ flexShrink: 0 }}>
        <span className="text-xs text-mission-control-text-dim">Legend:</span>
        {[
          { label: 'In Progress', color: 'var(--color-accent, #6366f1)' },
          { label: 'Review',      color: 'var(--color-info, #06b6d4)' },
          { label: 'Done',        color: 'var(--color-success, #22c55e)' },
          { label: 'To Do',       color: 'var(--color-border, #3f3f5a)' },
          { label: 'Overdue',     color: 'var(--color-error, #ef4444)', outline: true },
          { label: 'Today',       color: 'var(--color-error, #ef4444)', line: true },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            {item.line
              ? <div style={{ width: 2, height: 12, backgroundColor: item.color, borderRadius: 1 }} />
              : <div style={{ width: 10, height: 10, borderRadius: 2,
                  backgroundColor: item.outline ? 'transparent' : item.color,
                  border: item.outline ? `2px solid ${item.color}` : 'none' }} />
            }
            <span className="text-xs text-mission-control-text-dim">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
