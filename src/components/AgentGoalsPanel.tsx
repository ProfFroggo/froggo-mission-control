// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  Target, Plus, CheckCircle2, Trash2, Clock,
  ChevronRight, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { Button, IconButton, TextField } from '@radix-ui/themes';
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
    ? 'var(--mission-control-success)'
    : days >= 7
    ? 'var(--mission-control-warning)'
    : 'var(--mission-control-error)';

  const label = days < 0
    ? `${Math.abs(days)}d overdue`
    : days === 0
    ? 'Due today'
    : `${days}d left`;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border border-mission-control-border"
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
      ? 'var(--mission-control-success)'
      : pct >= 75
      ? 'var(--mission-control-success)'
      : pct >= 40
      ? 'var(--mission-control-warning)'
      : 'var(--mission-control-error)';

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-mission-control-text-dim">
          <span>{current} / {target}</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--mission-control-border)' }}
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
    ? 'var(--mission-control-success)'
    : status === 'cancelled'
    ? 'var(--mission-control-error)'
    : status === 'paused'
    ? 'var(--mission-control-warning)'
    : 'var(--mission-control-info)';

  return (
    <span
      className="inline-flex text-xs font-medium px-2 py-0.5 rounded-full border border-mission-control-border capitalize"
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
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-mission-control-border text-mission-control-text-dim font-medium tabular-nums">
              {activeGoals.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            type="button"
            size="1"
            variant="ghost"
            radius="medium"
            onClick={fetchGoals}
            disabled={loading}
            title="Refresh goals"
            aria-label="Refresh goals"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </IconButton>
          <IconButton
            type="button"
            size="1"
            variant="ghost"
            radius="medium"
            onClick={() => setShowForm(v => !v)}
            title="Add goal"
            aria-label="Add new goal"
          >
            <Plus size={12} />
          </IconButton>
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
          className="rounded-lg border border-mission-control-border bg-mission-control-bg p-4 space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
              Goal title
            </label>
            <TextField.Root
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              placeholder="e.g. Reach 90% success rate"
              size="2"
              required
              maxLength={200}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
                Target
              </label>
              <TextField.Root
                value={formTarget}
                onChange={e => setFormTarget(e.target.value)}
                placeholder="e.g. 90 or complete"
                size="2"
                maxLength={200}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-1">
                Deadline
              </label>
              <TextField.Root
                type="date"
                value={formDeadline}
                onChange={e => setFormDeadline(e.target.value)}
                size="2"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              size="2"
              variant="solid"
              disabled={formSubmitting || !formTitle.trim()}
              style={{ flex: 1 }}
            >
              {formSubmitting ? 'Adding...' : 'Add goal'}
            </Button>
            <Button
              type="button"
              size="2"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {!loading && goals.length === 0 && (
        <div className="rounded-lg border border-mission-control-border p-6 text-center space-y-2">
          <Target size={24} className="mx-auto text-mission-control-text-dim opacity-40" />
          <p className="text-sm text-mission-control-text-dim">No goals set yet</p>
          <Button
            type="button"
            size="1"
            variant="ghost"
            onClick={() => setShowForm(true)}
          >
            Add the first goal
          </Button>
        </div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-2">
          {activeGoals.map(goal => (
            <div
              key={goal.id}
              className="rounded-lg border border-mission-control-border bg-mission-control-bg p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-mission-control-text leading-snug flex-1">{goal.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {goal.status !== 'completed' && (
                    <IconButton
                      type="button"
                      size="1"
                      variant="ghost"
                      radius="medium"
                      color="green"
                      onClick={() => handleMarkComplete(goal.id, goal.title)}
                      title="Mark complete"
                      aria-label="Mark goal complete"
                    >
                      <CheckCircle2 size={13} />
                    </IconButton>
                  )}
                  <IconButton
                    type="button"
                    size="1"
                    variant="ghost"
                    radius="medium"
                    color="red"
                    onClick={() => handleDeleteGoal(goal.id)}
                    title="Delete goal"
                    aria-label="Delete goal"
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              </div>

              <GoalProgressBar current={goal.current} target={goal.target} status={goal.status} />

              <div className="flex items-center justify-between">
                {goal.deadline && <DeadlineBadge deadline={goal.deadline} />}
                <Button
                  type="button"
                  size="1"
                  variant="ghost"
                  onClick={() => {
                    setEditingGoalId(goal.id === editingGoalId ? null : goal.id);
                    setEditCurrent(goal.current);
                  }}
                  style={{ marginLeft: 'auto' }}
                >
                  Update progress
                  <ChevronRight size={10} />
                </Button>
              </div>

              {editingGoalId === goal.id && (
                <div className="flex items-center gap-2 pt-1">
                  <TextField.Root
                    value={editCurrent}
                    onChange={e => setEditCurrent(e.target.value)}
                    placeholder="Current value"
                    size="1"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleUpdateProgress(goal.id);
                      if (e.key === 'Escape') setEditingGoalId(null);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    size="1"
                    variant="solid"
                    onClick={() => void handleUpdateProgress(goal.id)}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="1"
                    variant="ghost"
                    onClick={() => setEditingGoalId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {completedGoals.length > 0 && (
        <div className="text-xs text-mission-control-text-dim text-center pt-1">
          {completedGoals.length} completed goal{completedGoals.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
