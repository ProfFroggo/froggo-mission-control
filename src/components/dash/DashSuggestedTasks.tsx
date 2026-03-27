// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * DashSuggestedTasks — Rule-based "things you should work on today" panel.
 * Derives suggestions deterministically from store data + optional calendar events.
 * No AI, no API calls — pure computation from existing state.
 *
 * Rules (priority order):
 *   5 — Pending approvals
 *   1 — Tasks in review
 *   2 — Stalled in-progress tasks (>24h since update)
 *   3 — Upcoming calendar meeting prep (<4h away)
 *   4 — Unassigned todo tasks
 *
 * Max 5 suggestions total. Session-dismissible (resets on reload).
 */

import { useMemo, useState } from 'react';
import {
  Lightbulb,
  Eye,
  AlertTriangle,
  CalendarDays,
  CircleDashed,
  CheckSquare,
  X,
} from 'lucide-react';
import { useStore } from '../../store/store';
import { formatTimeAgo } from '../../utils/formatting';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
}

export interface DashSuggestedTasksProps {
  onNavigate?: (view: string) => void;
  onCreateTask?: (partial: { title: string; priority: string }) => void;
  calendarEvents?: CalendarEvent[];
}

interface Suggestion {
  id: string;
  icon: React.ElementType;
  label: string;
  title: string;
  sourceLabel: string;
  urgency: 'high' | 'normal';
  action: 'navigate' | 'create';
  target?: string;
  taskTitle?: string;
  taskPriority?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMeetingTime(dateTime: string): string {
  const d = new Date(dateTime);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashSuggestedTasks({
  onNavigate,
  onCreateTask,
  calendarEvents,
}: DashSuggestedTasksProps) {
  const { tasks, approvals } = useStore();

  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const allSuggestions = useMemo<Suggestion[]>(() => {
    const results: Suggestion[] = [];

    // RULE 5 — Pending approvals (highest priority)
    const pendingApprovals = approvals.filter((a) => a.status === 'pending').slice(0, 2);
    for (const a of pendingApprovals) {
      results.push({
        id: `rule5-${a.id}`,
        icon: CheckSquare,
        label: 'Approve',
        title: a.title,
        sourceLabel: `${a.type} · ${formatTimeAgo(a.createdAt)}`,
        urgency: 'high',
        action: 'navigate',
        target: 'approvals',
      });
    }

    // RULE 1 — Tasks waiting in review
    const reviewTasks = tasks.filter((t) => t.status === 'review').slice(0, 2);
    for (const t of reviewTasks) {
      results.push({
        id: `rule1-${t.id}`,
        icon: Eye,
        label: 'Review',
        title: t.title,
        sourceLabel: `Waiting review · ${formatTimeAgo(t.updatedAt)}`,
        urgency: 'high',
        action: 'navigate',
        target: 'kanban',
      });
    }

    // RULE 2 — Stalled in-progress tasks (>24h since last update)
    const stalledTasks = tasks
      .filter(
        (t) =>
          t.status === 'in-progress' &&
          Date.now() - t.updatedAt > 24 * 60 * 60 * 1000
      )
      .slice(0, 2);
    for (const t of stalledTasks) {
      results.push({
        id: `rule2-${t.id}`,
        icon: AlertTriangle,
        label: 'Unblock',
        title: t.title,
        sourceLabel: `Stalled · ${formatTimeAgo(t.updatedAt)}`,
        urgency: 'high',
        action: 'navigate',
        target: 'kanban',
      });
    }

    // RULE 3 — Upcoming calendar meeting prep (events within the next 4 hours)
    const upcomingEvents = (calendarEvents ?? [])
      .filter((ev) => {
        if (!ev.start.dateTime) return false;
        const start = new Date(ev.start.dateTime).getTime();
        const diff = start - Date.now();
        return diff > 0 && diff < 4 * 60 * 60 * 1000;
      })
      .slice(0, 2);
    for (const ev of upcomingEvents) {
      const start = new Date(ev.start.dateTime!).getTime();
      const diff = start - Date.now();
      results.push({
        id: `rule3-${ev.id}`,
        icon: CalendarDays,
        label: 'Prep',
        title: ev.summary,
        sourceLabel: `Meeting · ${formatMeetingTime(ev.start.dateTime!)}`,
        urgency: diff < 90 * 60 * 1000 ? 'high' : 'normal',
        action: 'create',
        taskTitle: `Prep: ${ev.summary}`,
        taskPriority: 'p1',
      });
    }

    // RULE 4 — Unassigned todo tasks (lowest priority)
    const unassignedTodos = tasks
      .filter((t) => t.status === 'todo' && !t.assignedTo)
      .slice(0, 2);
    for (const t of unassignedTodos) {
      results.push({
        id: `rule4-${t.id}`,
        icon: CircleDashed,
        label: 'Assign',
        title: t.title,
        sourceLabel: `Unassigned · ${formatTimeAgo(t.createdAt)}`,
        urgency: 'normal',
        action: 'navigate',
        target: 'kanban',
      });
    }

    // Cap at 5 total
    return results.slice(0, 5);
  }, [tasks, approvals, calendarEvents]);

  const suggestions = allSuggestions.filter((s) => !dismissed.has(s.id));

  // Return nothing if no suggestions remain
  if (suggestions.length === 0) return null;

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
  }

  function handleAction(s: Suggestion) {
    if (s.action === 'navigate') {
      onNavigate?.(s.target ?? '');
    } else if (s.action === 'create') {
      onCreateTask?.({ title: s.taskTitle ?? s.title, priority: s.taskPriority ?? 'p2' });
    }
  }

  return (
    <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-mission-control-text flex items-center gap-2">
          <Lightbulb size={16} className="text-warning-DEFAULT" />
          Suggested
          {suggestions.length > 0 && (
            <span className="ml-auto text-xs font-normal text-mission-control-text-dim">
              {suggestions.length}
            </span>
          )}
        </h2>
      </div>

      {/* Suggestion rows */}
      <div className="space-y-1">
        {suggestions.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.id}
              className="flex items-center gap-2 h-9 px-1 rounded-lg hover:bg-mission-control-bg transition-colors group"
            >
              {/* Icon colored by urgency */}
              <Icon
                size={14}
                className={
                  s.urgency === 'high'
                    ? 'text-warning-DEFAULT flex-shrink-0'
                    : 'text-info-DEFAULT flex-shrink-0'
                }
              />

              {/* Label */}
              <span className="text-xs text-mission-control-text-dim whitespace-nowrap">
                {s.label}
              </span>

              {/* Title (truncated) */}
              <span className="text-xs text-mission-control-text truncate flex-1 min-w-0">
                {s.title}
              </span>

              {/* Source label */}
              <span className="text-xs text-mission-control-text-dim whitespace-nowrap hidden sm:block">
                {s.sourceLabel}
              </span>

              {/* Action button */}
              <button
                onClick={() => handleAction(s)}
                className="text-xs text-mission-control-accent hover:underline whitespace-nowrap flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {s.action === 'navigate' ? 'Open →' : 'Create'}
              </button>

              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(s.id)}
                className="flex-shrink-0 text-mission-control-text-dim hover:text-mission-control-text transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Dismiss suggestion"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
