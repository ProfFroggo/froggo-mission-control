// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  Target, Plus, CheckCircle2, Trash2, Clock,
  ChevronRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { showToast } from './Toast';

interface Goal {
  id: string;
  title: string;
  target: string;
  current: string;
  deadline: string;
  status: string;
}

interface AgentGoalsPanelProps {
  agentId: string;
}

function parseNumber(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function deadlineDays(deadline: string): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = deadlineDays(deadline);
  if (days === null) return null;

  const color = days > 14
    ? 'var(--color-success)'
    : days >= 7
    ? 'var(--color-warning)'
    : 'var(--color-error)';

  const label = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Due today'
    : `${days}d left`;

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
      style={{ color, borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Clock size={9} />
      {label}
    </span>
  );
}

function GoalProgressBar({ current, target, status }: { current: string; target: string; status: string }) {
  const cur = parseNumber(current);
  const tgt = parseNumber(target);

  if (cur !== null && tgt !== null && tgt > 0) {
    const pct = Math.min(100, Math.round((cur / tgt) * 100));
    const color = status === 'completed'
      ? 'var(--color-success)'
      : pct >= 75
      ? 'var(--color-success)'
      : pct >= 40
      ? 'var(--color-warning)'
      : 'var(--color-error)';

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-mission-control-text-dim">
          <span>{current} / {target}</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--color-mission-control-border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    );
  }

  const statusColor = status === 'completed'
    ? 'var(--color-success)'
    : status === 'cancelled'
    ? 'var(--color-error)'
    : status === 'paused'
    ? 'var(--color-warning)'
    : 'var(--color-info)';

  return (
    <span
      className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize"
      style={{ color: statusColor, borderColor: statusColor, background: `color-mix(in srgb, ${statusColor} 12%, transparent)` }}
    >
      {status}
    </span>
  );
}

export default function AgentGoalsPanel({ agentId }: AgentGoalsPanelProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editCurrent, setEditCurrent] = useState('');

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/goals`);
      if (!res.ok) throw new Error('Failed to load goals');
      const json = await res.json() as { goals: Goal[] };
      setGoals(json.goals);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formTitle, target: formTarget, deadline: formDeadline }),
      });
      if (!res.ok) throw new Error('Failed to create goal');
      setFormTitle('');
      setFormTarget('');
      setFormDeadline('');
      setShowForm(false);
      await fetchGoals();
      showToast('success', 'Goal created', formTitle);
    } catch (err) {
      showToast('error', 'Error', (err as Error).message);
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleUpdateProgress(goalId: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: editCurrent }),
      });
      if (!res.ok) throw new Error('Failed to update progress');
      setEditingGoalId(null);
      await fetchGoals();
    } catch (err) {
      showToast('error', 'Error', (err as Error).message);
    }
  }

  async function handleMarkComplete(goalId: string, title: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/goals/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error('Failed to complete goal');
      await fetchGoals();
      showToast('success', 'Goal completed', title);
    } catch (err) {
      showToast('error', 'Error', (err as Error).message);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    try {
      const res = await fetch(`/api/agents/${agentId}/goals/${goalId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete goal');
      await fetchGoals();
    } catch (err) {
      showToast('error', 'Error', (err as Error).message);
    }
  }

  const activeGoals    = goals.filter(g => g.status === 'active' || g.status === 'paused');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-mission-control-text-dim" />
          <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider">Goals</span>
          {goals.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-mission-control-border text-mission-control-text-dim font-medium">
              {activeGoals.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchGoals}
            disabled={loading}
            className="icon-btn border border-mission-control-border disabled:opacity-50"
            title="Refresh goals"
            aria-label="Refresh goals"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setShowForm(v => !v)}
            className="icon-btn border border-mission-control-border"
            title="Add goal"
            aria-label="Add new goal"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-lg border border-error-border bg-error-subtle p-3 text-xs text-error flex items-center gap-2">
          <AlertTriangle size={12} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleAddGoal}
          className="rounded-xl border border-mission-control-border bg-mission-control-bg p-4 space-y-3"
        >
          <div>
            <label className="block text-[10px] font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
              Goal title
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="e.g. Reach 90% success rate"
              className="w-full"
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
                Target
              </label>
              <input
                type="text"
                value={formTarget}
                onChange={e => setFormTarget(e.target.value)}
                placeholder="e.g. 90 or complete"
                className="w-full"
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
                Deadline
              </label>
              <input
                type="date"
                value={formDeadline}
                onChange={e => setFormDeadline(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={formSubmitting || !formTitle.trim()}
              className="flex-1 py-2 text-xs font-medium rounded-lg bg-mission-control-accent text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {formSubmitting ? 'Adding...' : 'Add goal'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!loading && goals.length === 0 && (
        <div className="rounded-xl border border-mission-control-border p-6 text-center space-y-2">
          <Target size={24} className="mx-auto text-mission-control-text-dim opacity-40" />
          <p className="text-sm text-mission-control-text-dim">No goals set yet</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-mission-control-accent hover:underline"
          >
            Add the first goal
          </button>
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-2">
          {activeGoals.map(goal => (
            <div
              key={goal.id}
              className="rounded-xl border border-mission-control-border bg-mission-control-bg p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-mission-control-text leading-snug flex-1">{goal.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {goal.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleMarkComplete(goal.id, goal.title)}
                      className="icon-btn text-success hover:bg-success-subtle"
                      title="Mark complete"
                      aria-label="Mark goal complete"
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="icon-btn text-error hover:bg-error-subtle"
                    title="Delete goal"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <GoalProgressBar current={goal.current} target={goal.target} status={goal.status} />

              <div className="flex items-center justify-between">
                {goal.deadline && <DeadlineBadge deadline={goal.deadline} />}
                <button
                  type="button"
                  onClick={() => {
                    setEditingGoalId(goal.id === editingGoalId ? null : goal.id);
                    setEditCurrent(goal.current);
                  }}
                  className="ml-auto inline-flex items-center gap-1 text-[10px] text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                >
                  Update progress
                  <ChevronRight size={10} />
                </button>
              </div>

              {editingGoalId === goal.id && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={editCurrent}
                    onChange={e => setEditCurrent(e.target.value)}
                    placeholder="Current value"
                    className="flex-1 text-xs"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleUpdateProgress(goal.id);
                      if (e.key === 'Escape') setEditingGoalId(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleUpdateProgress(goal.id)}
                    className="px-2.5 py-1.5 text-[10px] font-medium rounded-md bg-mission-control-accent text-white hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGoalId(null)}
                    className="px-2.5 py-1.5 text-[10px] font-medium rounded-md border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="text-[11px] text-mission-control-text-dim text-center pt-1">
          {completedGoals.length} completed goal{completedGoals.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
