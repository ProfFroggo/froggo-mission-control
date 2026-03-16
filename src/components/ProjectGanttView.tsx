// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDown, ChevronRight, ZoomIn, ZoomOut, Calendar,
  AlertCircle,
} from 'lucide-react';
import { taskApi } from '../lib/api';
import { Spinner } from './LoadingStates';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  createdAt: number;
  dueDate?: number;
}

type ZoomLevel = 'week' | 'month' | 'quarter';

const ZOOM_CONFIG: Record<ZoomLevel, { label: string; pxPerDay: number; days: number }> = {
  week:    { label: 'Week',    pxPerDay: 80, days: 14  },
  month:   { label: 'Month',   pxPerDay: 32, days: 42  },
  quarter: { label: 'Quarter', pxPerDay: 12, days: 90  },
};

// ─── Status grouping ────────────────────────────────────────────────────────────

const STATUS_GROUPS: Record<string, string[]> = {
  'To Do':       ['todo', 'blocked'],
  'In Progress': ['in-progress', 'internal-review'],
  'Review':      ['review', 'human-review'],
  'Done':        ['done'],
};

const STATUS_COLORS: Record<string, string> = {
  'To Do':       'var(--color-warning, #f59e0b)',
  'In Progress': 'var(--color-info, #3b82f6)',
  'Review':      'var(--color-accent, #6366f1)',
  'Done':        'var(--color-success, #22c55e)',
};

function groupLabel(status: string): string {
  for (const [label, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.includes(status)) return label;
  }
  return 'Other';
}

// ─── Task bar ───────────────────────────────────────────────────────────────────

interface TaskBarProps {
  task: GanttTask;
  startMs: number;
  pxPerDay: number;
  totalWidthPx: number;
  rowHeight: number;
  color: string;
  onClick: () => void;
}

function TaskBar({ task, startMs, pxPerDay, rowHeight, color, onClick }: TaskBarProps) {
  const DAY_MS = 86_400_000;
  const taskStart = task.createdAt;
  const taskEnd = task.dueDate ?? (task.createdAt + 7 * DAY_MS);

  const left = Math.max(0, ((taskStart - startMs) / DAY_MS) * pxPerDay);
  const width = Math.max(pxPerDay, ((taskEnd - taskStart) / DAY_MS) * pxPerDay);

  const isDone = task.status === 'done';

  return (
    <button
      onClick={onClick}
      title={task.title}
      style={{
        position: 'absolute',
        left: left,
        top: (rowHeight - 20) / 2,
        width: width,
        height: 20,
        backgroundColor: color,
        opacity: isDone ? 0.5 : 0.85,
        borderRadius: 4,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 6,
        paddingRight: 6,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: '#fff',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title}
      </span>
    </button>
  );
}

// ─── Day header ─────────────────────────────────────────────────────────────────

function DayHeader({ startMs, days, pxPerDay }: { startMs: number; days: number; pxPerDay: number }) {
  const DAY_MS = 86_400_000;
  const cells: React.ReactElement[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i++) {
    const d = new Date(startMs + i * DAY_MS);
    const isToday = d.getTime() === today.getTime();
    const isMonday = d.getDay() === 1;
    const showLabel = pxPerDay >= 32 ? true : isMonday;

    cells.push(
      <div
        key={i}
        style={{
          width: pxPerDay,
          flexShrink: 0,
          borderRight: '1px solid var(--color-mission-control-border, #2d2d3a)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isToday ? 'var(--color-accent, #6366f1)' + '22' : undefined,
          fontSize: 10,
          color: isToday ? 'var(--color-accent, #6366f1)' : 'var(--color-text-dim, #6b7280)',
          fontWeight: isToday ? 700 : 400,
          userSelect: 'none',
        }}
      >
        {showLabel && (pxPerDay >= 60
          ? `${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`
          : `${d.getDate()}`
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 32, borderBottom: '1px solid var(--color-mission-control-border, #2d2d3a)' }}>
      {cells}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

interface ProjectGanttViewProps {
  projectId: string;
  projectName: string;
  onTaskClick?: (task: GanttTask) => void;
}

export default function ProjectGanttView({ projectId, projectName, onTaskClick }: ProjectGanttViewProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('month');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const LABEL_W = 220;
  const ROW_H = 36;
  const DAY_MS = 86_400_000;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch tasks by project_id; if none, try by project name
      let result = await taskApi.getAll({ project_id: projectId });
      let raw: GanttTask[] = Array.isArray(result) ? result : (result as any).tasks ?? [];
      if (raw.length === 0 && projectName) {
        result = await taskApi.getAll({ project: projectName });
        raw = Array.isArray(result) ? result : (result as any).tasks ?? [];
      }
      setTasks(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId, projectName]);

  useEffect(() => { load(); }, [load]);

  // Determine start of grid: beginning of week containing earliest task
  const earliest = tasks.length > 0 ? Math.min(...tasks.map(t => t.createdAt)) : Date.now();
  const startDay = new Date(earliest);
  startDay.setHours(0, 0, 0, 0);
  startDay.setDate(startDay.getDate() - startDay.getDay()); // snap to Sunday
  const startMs = startDay.getTime();

  const { pxPerDay, days } = ZOOM_CONFIG[zoom];
  const gridWidth = pxPerDay * days;

  // Today marker offset
  const todayOffset = ((Date.now() - startMs) / DAY_MS) * pxPerDay;

  // Group tasks
  const groups: Record<string, GanttTask[]> = {};
  for (const task of tasks) {
    const g = groupLabel(task.status);
    if (!groups[g]) groups[g] = [];
    groups[g].push(task);
  }
  const orderedGroups = ['To Do', 'In Progress', 'Review', 'Done'].filter(g => groups[g]?.length > 0);

  const toggleGroup = (g: string) => setCollapsed(c => ({ ...c, [g]: !c[g] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 min-h-[300px]">
        <Spinner size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 m-4 px-4 py-3 bg-error-subtle border border-error/30 rounded-lg text-error text-sm">
        <AlertCircle size={15} />
        {error}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-[300px] text-mission-control-text-dim">
        <Calendar size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No tasks to display on the timeline</p>
        <p className="text-xs mt-1 opacity-60">Create tasks with due dates to see them here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
        <span className="text-xs text-mission-control-text-dim mr-2">Zoom:</span>
        {(['week', 'month', 'quarter'] as ZoomLevel[]).map(z => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              zoom === z
                ? 'bg-mission-control-accent text-white'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface border border-mission-control-border'
            }`}
          >
            {ZOOM_CONFIG[z].label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              const levels: ZoomLevel[] = ['week', 'month', 'quarter'];
              const idx = levels.indexOf(zoom);
              if (idx > 0) setZoom(levels[idx - 1]);
            }}
            className="p-1 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => {
              const levels: ZoomLevel[] = ['week', 'month', 'quarter'];
              const idx = levels.indexOf(zoom);
              if (idx < levels.length - 1) setZoom(levels[idx + 1]);
            }}
            className="p-1 rounded text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Label column (fixed) */}
        <div
          style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--color-mission-control-border, #2d2d3a)' }}
          className="overflow-hidden bg-mission-control-surface"
        >
          {/* header spacer */}
          <div style={{ height: 32, borderBottom: '1px solid var(--color-mission-control-border, #2d2d3a)' }} />
          {orderedGroups.map(g => {
            const isCollapsed = collapsed[g];
            const groupTasks = groups[g];
            return (
              <div key={g}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(g)}
                  style={{ height: ROW_H, width: '100%' }}
                  className="flex items-center gap-2 px-3 text-xs font-semibold text-mission-control-text bg-mission-control-bg0 hover:bg-mission-control-surface/60 transition-colors border-b border-mission-control-border"
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: STATUS_COLORS[g],
                      flexShrink: 0,
                    }}
                  />
                  {g} ({groupTasks.length})
                </button>
                {/* Task rows */}
                {!isCollapsed && groupTasks.map(task => (
                  <div
                    key={task.id}
                    style={{ height: ROW_H }}
                    className="flex items-center px-3 pl-7 border-b border-mission-control-border text-xs text-mission-control-text-dim truncate hover:bg-mission-control-surface/60 transition-colors"
                  >
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Scrollable grid */}
        <div
          ref={scrollRef}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}
        >
          <div style={{ width: gridWidth, minHeight: '100%', position: 'relative' }}>
            {/* Day header */}
            <DayHeader startMs={startMs} days={days} pxPerDay={pxPerDay} />

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= gridWidth && (
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  left: todayOffset,
                  bottom: 0,
                  width: 2,
                  backgroundColor: 'var(--color-error, #ef4444)',
                  opacity: 0.6,
                  zIndex: 5,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Rows */}
            {orderedGroups.map(g => {
              const isCollapsed = collapsed[g];
              const groupTasks = groups[g];
              const color = STATUS_COLORS[g];
              return (
                <div key={g}>
                  {/* Group header row (blank) */}
                  <div
                    style={{ height: ROW_H, borderBottom: '1px solid var(--color-mission-control-border, #2d2d3a)' }}
                    className="bg-mission-control-bg0"
                  />
                  {/* Task rows */}
                  {!isCollapsed && groupTasks.map(task => (
                    <div
                      key={task.id}
                      style={{ height: ROW_H, position: 'relative', borderBottom: '1px solid var(--color-mission-control-border, #2d2d3a)' }}
                    >
                      <TaskBar
                        task={task}
                        startMs={startMs}
                        pxPerDay={pxPerDay}
                        totalWidthPx={gridWidth}
                        rowHeight={ROW_H}
                        color={color}
                        onClick={() => onTaskClick?.(task)}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-mission-control-border bg-mission-control-surface flex-shrink-0">
        {orderedGroups.map(g => (
          <div key={g} className="flex items-center gap-1.5 text-xs text-mission-control-text-dim">
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: STATUS_COLORS[g],
                opacity: 0.85,
              }}
            />
            {g}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim ml-auto">
          <div style={{ width: 2, height: 14, backgroundColor: 'var(--color-error, #ef4444)', opacity: 0.6, borderRadius: 1 }} />
          Today
        </div>
      </div>
    </div>
  );
}
