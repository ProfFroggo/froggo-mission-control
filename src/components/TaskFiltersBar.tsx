// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/components/TaskFiltersBar.tsx
// Sticky filter bar with status multi-select, priority, assignee, date range, clear all

'use client';

import { useRef, useState, useEffect } from 'react';
import { X, Filter, ChevronDown, Calendar, User, Flag, CheckSquare } from 'lucide-react';
import type { TaskStatus, TaskPriority } from '../store/store';

export interface TaskFilters {
  statuses: TaskStatus[];
  priority: TaskPriority | 'all';
  assignee: string; // 'all' | agentId
  dueDateFrom: string; // ISO date string or ''
  dueDateTo: string;   // ISO date string or ''
}

export interface TaskFiltersBarAgent {
  id: string;
  name: string;
  avatar?: string;
}

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  agents: TaskFiltersBarAgent[];
}

const ALL_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'internal-review', label: 'Pre-review' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Agent Review' },
  { id: 'human-review', label: 'Human Review' },
  { id: 'done', label: 'Done' },
];

const PRIORITIES: { id: TaskPriority | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'p0', label: 'Urgent' },
  { id: 'p1', label: 'High' },
  { id: 'p2', label: 'Medium' },
  { id: 'p3', label: 'Low' },
];

const PRIORITY_COLORS: Record<string, string> = {
  p0: 'text-error',
  p1: 'text-warning',
  p2: 'text-info',
  p3: 'text-mission-control-text-dim',
  all: 'text-mission-control-text-dim',
};

function countActiveFilters(filters: TaskFilters): number {
  let count = 0;
  if (filters.statuses.length > 0) count++;
  if (filters.priority !== 'all') count++;
  if (filters.assignee !== 'all') count++;
  if (filters.dueDateFrom || filters.dueDateTo) count++;
  return count;
}

const DEFAULT_FILTERS: TaskFilters = {
  statuses: [],
  priority: 'all',
  assignee: 'all',
  dueDateFrom: '',
  dueDateTo: '',
};

export default function TaskFiltersBar({ filters, onChange, agents }: TaskFiltersBarProps) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const activeCount = countActiveFilters(filters);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!showStatusDropdown) return;
    function handler(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showStatusDropdown]);

  function toggleStatus(status: TaskStatus) {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  }

  function clearAll() {
    onChange({ ...DEFAULT_FILTERS });
  }

  return (
    <div
      className="sticky top-0 z-20 flex items-center gap-3 flex-wrap px-4 py-2.5 bg-mission-control-surface border-b border-mission-control-border"
      role="toolbar"
      aria-label="Task filters"
    >
      {/* Filter icon + count badge */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Filter size={15} className="text-mission-control-text-dim" />
        <span className="text-sm font-medium text-mission-control-text-dim">Filters</span>
        {activeCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-mission-control-accent text-white text-[11px] font-bold leading-none">
            {activeCount}
          </span>
        )}
      </div>

      {/* Status multi-select */}
      <div ref={statusRef} className="relative flex-shrink-0">
        <button
          onClick={() => setShowStatusDropdown(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
            filters.statuses.length > 0
              ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
              : 'border-mission-control-border hover:border-mission-control-accent/50'
          }`}
        >
          <CheckSquare size={13} className="flex-shrink-0" />
          Status
          {filters.statuses.length > 0 && (
            <span className="text-[11px] font-bold bg-mission-control-accent text-white rounded-full px-1.5 leading-tight">
              {filters.statuses.length}
            </span>
          )}
          <ChevronDown size={12} className="flex-shrink-0 opacity-60" />
        </button>

        {showStatusDropdown && (
          <div className="absolute left-0 top-full mt-1 z-30 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl py-1.5 w-44">
            {ALL_STATUSES.map(s => (
              <label
                key={s.id}
                className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-mission-control-border/40 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.statuses.includes(s.id)}
                  onChange={() => toggleStatus(s.id)}
                  className="rounded accent-current w-3.5 h-3.5 flex-shrink-0"
                />
                {s.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Priority filter */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Flag size={13} className="text-mission-control-text-dim flex-shrink-0" />
        <select
          value={filters.priority}
          onChange={e => onChange({ ...filters, priority: e.target.value as TaskPriority | 'all' })}
          className={`px-2.5 py-1.5 rounded-lg border text-sm bg-mission-control-surface transition-all ${
            filters.priority !== 'all'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-mission-control-border hover:border-mission-control-accent/50'
          } ${PRIORITY_COLORS[filters.priority] ?? ''}`}
        >
          {PRIORITIES.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Assignee filter */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <User size={13} className="text-mission-control-text-dim flex-shrink-0" />
        <select
          value={filters.assignee}
          onChange={e => onChange({ ...filters, assignee: e.target.value })}
          className={`px-2.5 py-1.5 rounded-lg border text-sm bg-mission-control-surface transition-all ${
            filters.assignee !== 'all'
              ? 'border-mission-control-accent text-mission-control-accent'
              : 'border-mission-control-border hover:border-mission-control-accent/50'
          }`}
        >
          <option value="all">All Assignees</option>
          <option value="unassigned">Unassigned</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Calendar size={13} className="text-mission-control-text-dim flex-shrink-0" />
        <input
          type="date"
          value={filters.dueDateFrom}
          onChange={e => onChange({ ...filters, dueDateFrom: e.target.value })}
          className={`px-2.5 py-1.5 rounded-lg border text-sm bg-mission-control-surface transition-all ${
            filters.dueDateFrom
              ? 'border-mission-control-accent'
              : 'border-mission-control-border hover:border-mission-control-accent/50'
          }`}
          aria-label="Due date from"
          title="Due date from"
        />
        <span className="text-mission-control-text-dim text-xs">to</span>
        <input
          type="date"
          value={filters.dueDateTo}
          onChange={e => onChange({ ...filters, dueDateTo: e.target.value })}
          className={`px-2.5 py-1.5 rounded-lg border text-sm bg-mission-control-surface transition-all ${
            filters.dueDateTo
              ? 'border-mission-control-accent'
              : 'border-mission-control-border hover:border-mission-control-accent/50'
          }`}
          aria-label="Due date to"
          title="Due date to"
        />
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-mission-control-border text-sm text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/50 transition-all ml-auto flex-shrink-0"
        >
          <X size={13} className="flex-shrink-0" />
          Clear all
        </button>
      )}
    </div>
  );
}
