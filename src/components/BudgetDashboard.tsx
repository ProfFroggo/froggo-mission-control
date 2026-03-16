// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// BudgetDashboard — token cost budgeting UI
// Shows budget cards with circular progress, add/edit form, alert banners,
// historical spend chart, and total monthly spend.

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  BarChart3,
  Bell,
  Trash2,
  Plus,
  X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'daily' | 'weekly' | 'monthly';
type BudgetStatus = 'ok' | 'warning' | 'exceeded';

interface Budget {
  id: string;
  name: string;
  agentId?: string;
  period: Period;
  limitUsd: number;
  alertAt: number;
  currentUsd: number;
  status: BudgetStatus;
  createdAt: number;
}

interface DayUsage {
  date: string;
  cost: number;
}

// ── SVG Circular progress ring ────────────────────────────────────────────────

function CircularProgress({
  pct,
  status,
  size = 72,
}: {
  pct: number;
  status: BudgetStatus;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1) * circumference;
  const cx = size / 2;
  const cy = size / 2;

  const color =
    status === 'exceeded'
      ? 'var(--color-error, #ef4444)'
      : status === 'warning'
      ? 'var(--color-warning, #f59e0b)'
      : 'var(--mission-control-accent, #22c55e)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--mission-control-border, #262626)"
        strokeWidth={6}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${filled} ${circumference - filled}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size < 64 ? 11 : 13}
        fontWeight="600"
        fill="var(--mission-control-text, #fafafa)"
      >
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── 7-bar spend chart (SVG) ───────────────────────────────────────────────────

function SpendBarChart({ budgetId }: { budgetId: string }) {
  const [days, setDays] = useState<DayUsage[]>([]);

  useEffect(() => {
    fetch(`/api/token-usage?days=7${budgetId !== '__all' ? '' : ''}`)
      .then(r => r.json())
      .then((d: { byDay?: DayUsage[] }) => {
        if (d.byDay) setDays(d.byDay);
      })
      .catch(() => {});
  }, [budgetId]);

  if (days.length === 0) {
    return (
      <div className="text-xs text-mission-control-text-dim flex items-center gap-1">
        <BarChart3 size={12} /> No spend data
      </div>
    );
  }

  const W = 200;
  const H = 40;
  const pad = 2;
  const barW = (W - pad * (days.length - 1)) / days.length;
  const maxCost = Math.max(...days.map(d => d.cost), 0.000001);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: H }} aria-label="7-day spend chart" role="img">
      {days.map((day, i) => {
        const h = Math.max(2, (day.cost / maxCost) * (H - 4));
        const x = i * (barW + pad);
        return (
          <rect
            key={day.date}
            x={x}
            y={H - h}
            width={barW}
            height={h}
            rx={2}
            fill="var(--mission-control-accent, #22c55e)"
            opacity={0.75}
          >
            <title>${day.cost.toFixed(4)} on {day.date}</title>
          </rect>
        );
      })}
    </svg>
  );
}

// ── Budget card ───────────────────────────────────────────────────────────────

function BudgetCard({
  budget,
  onDelete,
}: {
  budget: Budget;
  onDelete: (id: string) => void;
}) {
  const pct = budget.limitUsd > 0 ? (budget.currentUsd / budget.limitUsd) * 100 : 0;
  const periodLabel =
    budget.period === 'daily'
      ? 'Today'
      : budget.period === 'weekly'
      ? 'This week'
      : 'This month';

  const statusClasses: Record<BudgetStatus, string> = {
    ok: 'bg-success-subtle border-success-border text-success',
    warning: 'bg-warning-subtle border-warning-border text-warning',
    exceeded: 'bg-error-subtle border-error-border text-error',
  };

  const statusLabel: Record<BudgetStatus, string> = {
    ok: 'On track',
    warning: 'Near limit',
    exceeded: 'Exceeded',
  };

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{budget.name}</div>
          <div className="text-xs text-mission-control-text-dim">
            {budget.agentId ? budget.agentId : 'All agents'} · {budget.period}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusClasses[budget.status]}`}
          >
            {statusLabel[budget.status]}
          </span>
          <button
            type="button"
            onClick={() => onDelete(budget.id)}
            className="text-mission-control-text-dim hover:text-error transition-colors"
            aria-label={`Delete budget ${budget.name}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Ring + spend */}
      <div className="flex items-center gap-4">
        <CircularProgress pct={pct} status={budget.status} />
        <div className="flex flex-col gap-1">
          <div className="text-2xl font-bold tabular-nums">
            ${budget.currentUsd.toFixed(2)}
          </div>
          <div className="text-xs text-mission-control-text-dim">
            of ${budget.limitUsd.toFixed(2)} limit
          </div>
          <div className="text-xs text-mission-control-text-dim">{periodLabel}</div>
        </div>
      </div>

      {/* Alert threshold */}
      <div className="text-xs text-mission-control-text-dim flex items-center gap-1">
        <Bell size={11} />
        Alert at {budget.alertAt}%
      </div>

      {/* 7-day chart */}
      <div>
        <div className="text-[10px] text-mission-control-text-dim uppercase tracking-wider mb-1 flex items-center gap-1">
          <BarChart3 size={10} /> 7-day spend
        </div>
        <SpendBarChart budgetId={budget.id} />
      </div>
    </div>
  );
}

// ── Add budget form ────────────────────────────────────────────────────────────

interface AddFormState {
  name: string;
  agentId: string;
  period: Period;
  limitUsd: string;
  alertAt: string;
}

function AddBudgetForm({
  onCreated,
  onCancel,
}: {
  onCreated: (budget: Budget) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddFormState>({
    name: '',
    agentId: '',
    period: 'monthly',
    limitUsd: '',
    alertAt: '80',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('Name is required'); return; }
    const limitUsd = parseFloat(form.limitUsd);
    if (isNaN(limitUsd) || limitUsd <= 0) { setError('Limit must be a positive number'); return; }
    const alertAt = parseFloat(form.alertAt);
    if (isNaN(alertAt) || alertAt < 0 || alertAt > 100) { setError('Alert threshold must be 0–100'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          agentId: form.agentId.trim() || undefined,
          period: form.period,
          limitUsd,
          alertAt,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to create budget');
      }
      const created = await res.json() as Budget;
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <PiggyBank size={16} className="text-mission-control-accent" />
          New Budget
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-mission-control-text-dim hover:text-mission-control-text"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-error bg-error-subtle border border-error-border rounded-lg px-3 py-2">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-mission-control-text-dim mb-1" htmlFor="budget-name">
            Name
          </label>
          <input
            id="budget-name"
            type="text"
            className="input w-full"
            placeholder="e.g. Monthly ops budget"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1" htmlFor="budget-agent">
            Agent (optional)
          </label>
          <input
            id="budget-agent"
            type="text"
            className="input w-full"
            placeholder="e.g. coder (leave blank for all)"
            value={form.agentId}
            onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1" htmlFor="budget-period">
            Period
          </label>
          <select
            id="budget-period"
            className="input w-full"
            value={form.period}
            onChange={e => setForm(f => ({ ...f, period: e.target.value as Period }))}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1" htmlFor="budget-limit">
            Limit ($)
          </label>
          <input
            id="budget-limit"
            type="number"
            min="0.01"
            step="0.01"
            className="input w-full"
            placeholder="e.g. 50.00"
            value={form.limitUsd}
            onChange={e => setForm(f => ({ ...f, limitUsd: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs text-mission-control-text-dim mb-1" htmlFor="budget-alert">
            Alert at (%)
          </label>
          <input
            id="budget-alert"
            type="number"
            min="1"
            max="100"
            className="input w-full"
            placeholder="80"
            value={form.alertAt}
            onChange={e => setForm(f => ({ ...f, alertAt: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost text-sm px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5"
        >
          {saving ? 'Creating…' : (
            <>
              <Plus size={14} />
              Create Budget
            </>
          )}
        </button>
      </div>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function BudgetDashboard() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [monthlyTotal, setMonthlyTotal] = useState(0);

  const loadBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/budgets');
      if (res.ok) {
        const data = await res.json() as Budget[];
        setBudgets(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMonthlyTotal = useCallback(async () => {
    try {
      const res = await fetch('/api/token-usage?days=30');
      if (res.ok) {
        const d = await res.json() as { totalCost: number };
        setMonthlyTotal(d.totalCost ?? 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadBudgets();
    loadMonthlyTotal();
  }, [loadBudgets, loadMonthlyTotal]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBudgets(b => b.filter(x => x.id !== id));
      }
    } catch {
      // silent
    }
  };

  const handleCreated = (budget: Budget) => {
    setBudgets(b => [...b, budget]);
    setShowForm(false);
  };

  const alerts = budgets.filter(b => b.status !== 'ok');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank size={18} className="text-mission-control-accent" />
          <h2 className="text-base font-semibold">Cost Budgets</h2>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(s => !s)}
          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
        >
          <Plus size={14} />
          Add Budget
        </button>
      </div>

      {/* Total spend this month */}
      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 flex items-center gap-3">
        <div className="p-2 bg-mission-control-bg rounded-lg">
          <DollarSign size={18} className="text-success" />
        </div>
        <div>
          <div className="text-xs text-mission-control-text-dim">Total spend this month</div>
          <div className="text-2xl font-bold text-success tabular-nums">
            ${monthlyTotal.toFixed(4)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-mission-control-text-dim">
          <TrendingUp size={12} />
          All agents · 30 days
        </div>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map(b => (
            <div
              key={b.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                b.status === 'exceeded'
                  ? 'bg-error-subtle border-error-border text-error'
                  : 'bg-warning-subtle border-warning-border text-warning'
              }`}
            >
              <AlertTriangle size={13} className="shrink-0" />
              <span>
                <strong>{b.name}</strong>:{' '}
                {b.status === 'exceeded' ? 'Budget exceeded' : 'Approaching limit'} —
                ${b.currentUsd.toFixed(4)} / ${b.limitUsd.toFixed(2)} (
                {b.limitUsd > 0 ? Math.round((b.currentUsd / b.limitUsd) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <AddBudgetForm
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Budget cards */}
      {loading ? (
        <div className="text-sm text-mission-control-text-dim">Loading budgets…</div>
      ) : budgets.length === 0 ? (
        <div className="text-sm text-mission-control-text-dim bg-mission-control-surface border border-mission-control-border rounded-lg p-6 text-center">
          No budgets configured. Click <strong>Add Budget</strong> to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {budgets.map(b => (
            <BudgetCard key={b.id} budget={b} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
