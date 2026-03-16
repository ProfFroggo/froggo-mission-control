import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Calculator, TrendingUp, TrendingDown, Plus, Trash2, Play, Save, Loader2 } from 'lucide-react';
import { showToast } from './Toast';
import { financeApi } from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecurringItem {
  id: string;
  description: string;
  amount: number;
  frequency: string;
  currency: string;
  status: string;
}

interface Adjustment {
  recurringId: string;
  action: 'cancel' | 'adjust';
  newAmount?: number;
}

interface SimpleResult {
  before: { monthly: number; yearly: number };
  after:  { monthly: number; yearly: number };
  savings: { monthly: number; yearly: number };
}

interface IncomeRow  { label: string; monthly_delta: number }
interface ExpenseRow { category: string; monthly_delta: number }
interface EventRow   { label: string; amount: number; date: string }

interface ScenarioForm {
  name: string;
  description: string;
  baseAccountId: string;
  projectionMonths: number;
  incomeRows: IncomeRow[];
  expenseRows: ExpenseRow[];
  eventRows: EventRow[];
}

interface ProjectionMonth {
  month: number;
  income: number;
  expenses: number;
  oneTime: number;
  net: number;
  runningBalance: number;
}

const SCENARIO_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(v);

// ─── Quick Projection Tab ────────────────────────────────────────────────────

function QuickProjectionTab() {
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<SimpleResult | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Recurring items not available via REST yet - use empty
        setRecurring([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setCancel = (id: string, cancelled: boolean) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      if (cancelled) {
        next[id] = { recurringId: id, action: 'cancel' };
      } else {
        delete next[id];
      }
      return next;
    });
    setResult(null);
  };

  const setAdjustAmount = (id: string, newAmount: string) => {
    const num = parseFloat(newAmount);
    setAdjustments((prev) => ({
      ...prev,
      [id]: { recurringId: id, action: 'adjust', newAmount: isNaN(num) ? undefined : Math.abs(num) },
    }));
    setResult(null);
  };

  const calculate = async () => {
    const adjs = Object.values(adjustments);
    if (adjs.length === 0) {
      showToast('info', 'No adjustments made', 'Toggle or adjust at least one item');
      return;
    }
    setCalculating(true);
    try {
      // Scenario projections not yet available via REST - show placeholder
      showToast('info', 'Projections not available in web mode');
    } catch (err: unknown) {
      showToast('error', 'Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-mission-control-text-dim">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading recurring items...</span>
      </div>
    );
  }

  if (recurring.length === 0) {
    return (
      <div className="text-center py-12 text-mission-control-text-dim">
        <Calculator className="w-10 h-10 mx-auto mb-2" />
        <p className="text-sm">No confirmed recurring items yet</p>
        <p className="text-xs mt-1">Confirm recurring transactions to run projections</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Recurring items list */}
      <div className="space-y-2">
        {recurring.map((item) => {
          const adj = adjustments[item.id];
          const isCancelled = adj?.action === 'cancel';
          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isCancelled
                  ? 'bg-error/5 border-error/30 opacity-60'
                  : 'bg-mission-control-bg-alt border-mission-control-border'
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => setCancel(item.id, !isCancelled)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  isCancelled ? 'bg-error/60' : 'bg-mission-control-accent'
                }`}
                aria-label={isCancelled ? 'Restore item' : 'Cancel item'}
                title={isCancelled ? 'Click to restore' : 'Click to cancel'}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isCancelled ? 'translate-x-0.5' : 'translate-x-5'
                  }`}
                />
              </button>

              {/* Name */}
              <span
                className={`flex-1 text-sm font-medium truncate ${
                  isCancelled ? 'line-through text-mission-control-text-dim' : 'text-mission-control-text'
                }`}
              >
                {item.description}
              </span>

              {/* Frequency badge */}
              <span className="text-xs px-2 py-0.5 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim rounded-full flex-shrink-0 capitalize">
                {item.frequency}
              </span>

              {/* Amount input (disabled when cancelled) */}
              <input
                type="number"
                disabled={isCancelled}
                defaultValue={Math.abs(item.amount).toFixed(2)}
                onChange={(e) => setAdjustAmount(item.id, e.target.value)}
                min="0"
                step="0.01"
                className="w-24 text-right text-sm bg-mission-control-surface border border-mission-control-border rounded px-2 py-1 text-mission-control-text focus:outline-none focus:border-mission-control-accent disabled:opacity-40"
                aria-label={`Amount for ${item.description}`}
              />
              <span className="text-xs text-mission-control-text-dim flex-shrink-0">{item.currency}</span>
            </div>
          );
        })}
      </div>

      {/* Calculate button */}
      <button
        onClick={calculate}
        disabled={calculating}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent hover:bg-mission-control-accent/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        aria-label="Calculate projection"
      >
        {calculating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</>
        ) : (
          <><Calculator className="w-4 h-4" /> Calculate</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* Before */}
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
            <p className="text-xs text-mission-control-text-dim uppercase tracking-wide mb-2">Before</p>
            <p className="text-lg font-bold text-mission-control-text">
              {formatCurrency(result.before.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1">
              {formatCurrency(result.before.yearly)}/yr
            </p>
          </div>

          {/* After */}
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
            <p className="text-xs text-mission-control-text-dim uppercase tracking-wide mb-2">After</p>
            <p className="text-lg font-bold text-mission-control-text">
              {formatCurrency(result.after.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1">
              {formatCurrency(result.after.yearly)}/yr
            </p>
          </div>

          {/* Savings */}
          <div
            className={`rounded-lg p-4 border ${
              result.savings.monthly >= 0
                ? 'bg-success/10 border-success/30'
                : 'bg-error/10 border-error/30'
            }`}
          >
            <p className="text-xs text-mission-control-text-dim uppercase tracking-wide mb-2 flex items-center gap-1">
              {result.savings.monthly >= 0 ? (
                <TrendingDown className="w-3 h-3 text-success" />
              ) : (
                <TrendingUp className="w-3 h-3 text-error" />
              )}
              Savings
            </p>
            <p
              className={`text-lg font-bold ${
                result.savings.monthly >= 0 ? 'text-success' : 'text-error'
              }`}
            >
              {result.savings.monthly >= 0 ? '+' : ''}
              {formatCurrency(result.savings.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1">
              {result.savings.yearly >= 0 ? '+' : ''}
              {formatCurrency(result.savings.yearly)}/yr
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scenario Builder Tab ────────────────────────────────────────────────────

function ScenarioBuilderTab() {
  const [scenarios, setScenarios] = useState<FinanceScenario[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [projectionData, setProjectionData] = useState<
    Record<string, ProjectionMonth[]>
  >({});
  const [compareMode, setCompareMode] = useState(false);

  const [form, setForm] = useState<ScenarioForm>({
    name: '',
    description: '',
    baseAccountId: '',
    projectionMonths: 12,
    incomeRows: [],
    expenseRows: [],
    eventRows: [],
  });

  const loadScenarios = useCallback(async () => {
    setLoadingScenarios(true);
    try {
      const stored = localStorage.getItem('finance-scenarios');
      if (stored) setScenarios(JSON.parse(stored));
    } finally {
      setLoadingScenarios(false);
    }
  }, []);

  useEffect(() => {
    loadScenarios();
    (async () => {
      try {
        const balances: any[] = await financeApi.getAccounts();
        if (Array.isArray(balances)) {
          setAccounts(balances.map((a: any) => ({ id: a.id, name: a.name })));
        }
      } catch { /* accounts not available */ }
    })();
  }, [loadScenarios]);

  const resetForm = () => {
    setForm({
      name: '', description: '', baseAccountId: '',
      projectionMonths: 12,
      incomeRows: [], expenseRows: [], eventRows: [],
    });
    setShowForm(false);
  };

  const saveAndProject = async () => {
    if (!form.name.trim()) {
      showToast('error', 'Name required', 'Enter a scenario name');
      return;
    }
    setSaving(true);
    try {
      // Build adjustments from form rows
      const adjustments = {
        income:  form.incomeRows.filter((r) => r.label && r.monthly_delta !== 0),
        expense: form.expenseRows.filter((r) => r.category && r.monthly_delta !== 0),
        events:  form.eventRows.filter((r) => r.label && r.amount !== 0 && r.date),
      };

      const id = `scenario-${Date.now()}`;
      const newScenario: FinanceScenario = {
        id,
        name: form.name.trim(),
        description: form.description || '',
        baseAccountId: form.baseAccountId || undefined,
        projectionMonths: form.projectionMonths,
        adjustments,
      } as any;

      const updatedScenarios = [...scenarios, newScenario];
      setScenarios(updatedScenarios);
      localStorage.setItem('finance-scenarios', JSON.stringify(updatedScenarios));

      showToast('success', 'Scenario saved', form.name);
      resetForm();
    } catch (err: unknown) {
      showToast('error', 'Error', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
      setProjecting(false);
    }
  };

  const runProjection = async (id: string) => {
    setProjecting(true);
    try {
      // Projections not available via REST — show info
      showToast('info', 'Projections not available in web mode');
    } finally {
      setProjecting(false);
    }
  };

  const deleteScenario = async (id: string, name: string) => {
    if (!window.confirm(`Delete scenario "${name}"?`)) return;
    const updated = scenarios.filter((s) => s.id !== id);
    setScenarios(updated);
    localStorage.setItem('finance-scenarios', JSON.stringify(updated));
    setProjectionData((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Build comparison chart data
  const comparedIds = scenarios.filter((s) => projectionData[s.id]).map((s) => s.id);
  const comparisonChartData: Array<Record<string, unknown>> = [];
  if (comparedIds.length > 0) {
    const maxMonths = Math.max(...comparedIds.map((id) => projectionData[id].length));
    for (let i = 0; i < maxMonths; i++) {
      const row: Record<string, unknown> = { month: `M${i + 1}` };
      comparedIds.forEach((id) => {
        const s = scenarios.find((sc) => sc.id === id);
        const m = projectionData[id][i];
        if (s && m) row[s.name] = m.runningBalance;
      });
      comparisonChartData.push(row);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-mission-control-text-dim">
          {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-2">
          {comparedIds.length >= 2 && (
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                compareMode
                  ? 'bg-mission-control-accent text-white'
                  : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              Compare
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-mission-control-accent hover:bg-mission-control-accent/90 text-white rounded-lg text-sm font-medium transition-colors"
            aria-label="New scenario"
          >
            <Plus className="w-4 h-4" /> New Scenario
          </button>
        </div>
      </div>

      {/* Comparison chart */}
      {compareMode && comparisonChartData.length > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <h4 className="text-sm font-semibold text-mission-control-text mb-3">Scenario Comparison</h4>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparisonChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--mission-control-text-dim)' }} />
                <YAxis
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: 'var(--mission-control-text-dim)' }}
                />
                <Tooltip
                  formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                  contentStyle={{
                    background: 'var(--mission-control-surface)',
                    border: '1px solid var(--mission-control-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend />
                {comparedIds.map((id, idx) => {
                  const s = scenarios.find((sc) => sc.id === id);
                  if (!s) return null;
                  return (
                    <Area
                      key={id}
                      type="monotone"
                      dataKey={s.name}
                      stroke={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
                      fill={SCENARIO_COLORS[idx % SCENARIO_COLORS.length]}
                      fillOpacity={0.15}
                    />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Scenario list */}
      {loadingScenarios ? (
        <div className="flex items-center justify-center py-8 gap-2 text-mission-control-text-dim">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading scenarios...</span>
        </div>
      ) : scenarios.length === 0 && !showForm ? (
        <div className="text-center py-10 text-mission-control-text-dim">
          <TrendingUp className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No scenarios yet</p>
          <p className="text-xs mt-1">Create one to project your financial future</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((scenario, idx) => {
            const months = projectionData[scenario.id];
            const color = SCENARIO_COLORS[idx % SCENARIO_COLORS.length];
            return (
              <div key={scenario.id} className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-semibold text-mission-control-text">{scenario.name}</h4>
                    {scenario.description && (
                      <p className="text-xs text-mission-control-text-dim mt-0.5">{scenario.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => runProjection(scenario.id)}
                      disabled={projecting}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-mission-control-accent/20 hover:bg-mission-control-accent/30 text-mission-control-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      aria-label="Run projection"
                    >
                      <Play className="w-3 h-3" /> Run
                    </button>
                    <button
                      onClick={() => deleteScenario(scenario.id, scenario.name)}
                      className="p-1 text-mission-control-text-dim hover:text-error rounded transition-colors"
                      aria-label={`Delete ${scenario.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Projection chart */}
                {months && months.length > 0 && (
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={months}>
                        <defs>
                          <linearGradient id={`grad-${scenario.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={color}
                              stopOpacity={months[months.length - 1]?.runningBalance >= 0 ? 0.3 : 0.1}
                            />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--mission-control-border)" />
                        <XAxis
                          dataKey="month"
                          tickFormatter={(v) => `M${v}`}
                          tick={{ fontSize: 10, fill: 'var(--mission-control-text-dim)' }}
                        />
                        <YAxis
                          tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                          tick={{ fontSize: 10, fill: 'var(--mission-control-text-dim)' }}
                        />
                        <Tooltip
                          formatter={(v, name) => [formatCurrency(Number(v)), String(name)]}
                          labelFormatter={(label) => `Month ${label}`}
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0]?.payload as ProjectionMonth | undefined;
                            if (!d) return null;
                            return (
                              <div
                                className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 text-xs shadow-lg"
                                style={{ minWidth: 160 }}
                              >
                                <p className="font-semibold text-mission-control-text mb-2">Month {label}</p>
                                <div className="space-y-1 text-mission-control-text-dim">
                                  <div className="flex justify-between gap-4">
                                    <span>Income</span>
                                    <span className="text-success">{formatCurrency(d.income)}</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span>Expenses</span>
                                    <span className="text-error">{formatCurrency(d.expenses)}</span>
                                  </div>
                                  {d.oneTime !== 0 && (
                                    <div className="flex justify-between gap-4">
                                      <span>One-time</span>
                                      <span>{formatCurrency(d.oneTime)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between gap-4 border-t border-mission-control-border pt-1 mt-1">
                                    <span className="font-medium text-mission-control-text">Net</span>
                                    <span className={d.net >= 0 ? 'text-success' : 'text-error'}>
                                      {formatCurrency(d.net)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="font-medium text-mission-control-text">Balance</span>
                                    <span className={d.runningBalance >= 0 ? 'text-success' : 'text-error'}>
                                      {formatCurrency(d.runningBalance)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="runningBalance"
                          stroke={color}
                          strokeWidth={2}
                          fill={`url(#grad-${scenario.id})`}
                          name="Balance"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New scenario form */}
      {showForm && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 space-y-4">
          <h4 className="font-semibold text-mission-control-text">New Scenario</h4>

          {/* Name */}
          <div>
            <label htmlFor="scenario-name" className="block text-xs text-mission-control-text-dim mb-1">Name *</label>
            <input
              id="scenario-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Cancel Netflix + Gym"
              className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="scenario-description" className="block text-xs text-mission-control-text-dim mb-1">Description</label>
            <textarea
              id="scenario-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent resize-none"
            />
          </div>

          {/* Account + Projection months */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="scenario-account" className="block text-xs text-mission-control-text-dim mb-1">Base Account</label>
              <select
                id="scenario-account"
                value={form.baseAccountId}
                onChange={(e) => setForm((f) => ({ ...f, baseAccountId: e.target.value }))}
                className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
              >
                <option value="">None (delta mode)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scenario-months" className="block text-xs text-mission-control-text-dim mb-1">Projection months</label>
              <input
                id="scenario-months"
                type="number"
                min={1}
                max={60}
                value={form.projectionMonths}
                onChange={(e) => setForm((f) => ({ ...f, projectionMonths: parseInt(e.target.value) || 12 }))}
                className="w-full px-3 py-2 bg-mission-control-bg-alt border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
              />
            </div>
          </div>

          {/* Income adjustments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">
                Income adjustments
              </span>
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    incomeRows: [...f.incomeRows, { label: '', monthly_delta: 0 }],
                  }))
                }
                className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent/80"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {form.incomeRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.incomeRows];
                      next[i] = { ...next[i], label: e.target.value };
                      return { ...f, incomeRows: next };
                    })
                  }
                  placeholder="e.g., Side project"
                  className="flex-1 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <input
                  type="number"
                  value={row.monthly_delta}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.incomeRows];
                      next[i] = { ...next[i], monthly_delta: parseFloat(e.target.value) || 0 };
                      return { ...f, incomeRows: next };
                    })
                  }
                  placeholder="+500"
                  className="w-24 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      incomeRows: f.incomeRows.filter((_, j) => j !== i),
                    }))
                  }
                  className="p-1 text-mission-control-text-dim hover:text-error rounded transition-colors"
                  aria-label="Remove income row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Expense adjustments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">
                Expense adjustments
              </span>
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    expenseRows: [...f.expenseRows, { category: '', monthly_delta: 0 }],
                  }))
                }
                className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent/80"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {form.expenseRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={row.category}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.expenseRows];
                      next[i] = { ...next[i], category: e.target.value };
                      return { ...f, expenseRows: next };
                    })
                  }
                  placeholder="e.g., subscriptions"
                  className="flex-1 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <input
                  type="number"
                  value={row.monthly_delta}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.expenseRows];
                      next[i] = { ...next[i], monthly_delta: parseFloat(e.target.value) || 0 };
                      return { ...f, expenseRows: next };
                    })
                  }
                  placeholder="-50"
                  className="w-24 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      expenseRows: f.expenseRows.filter((_, j) => j !== i),
                    }))
                  }
                  className="p-1 text-mission-control-text-dim hover:text-error rounded transition-colors"
                  aria-label="Remove expense row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* One-time events */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">
                One-time events
              </span>
              <button
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    eventRows: [...f.eventRows, { label: '', amount: 0, date: '' }],
                  }))
                }
                className="flex items-center gap-1 text-xs text-mission-control-accent hover:text-mission-control-accent/80"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {form.eventRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={row.label}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.eventRows];
                      next[i] = { ...next[i], label: e.target.value };
                      return { ...f, eventRows: next };
                    })
                  }
                  placeholder="e.g., Vacation"
                  className="flex-1 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <input
                  type="number"
                  value={row.amount}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.eventRows];
                      next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 };
                      return { ...f, eventRows: next };
                    })
                  }
                  placeholder="-3000"
                  className="w-24 px-2 py-1.5 bg-mission-control-bg-alt border border-mission-control-border rounded text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.eventRows];
                      next[i] = { ...next[i], date: e.target.value };
                      return { ...f, eventRows: next };
                    })
                  }
                  className="w-32 px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
                />
                <button
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      eventRows: f.eventRows.filter((_, j) => j !== i),
                    }))
                  }
                  className="p-1 text-mission-control-text-dim hover:text-error rounded transition-colors"
                  aria-label="Remove event row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={saveAndProject}
              disabled={saving || projecting}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent hover:bg-mission-control-accent/90 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving || projecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {saving ? 'Saving...' : 'Projecting...'}</>
              ) : (
                <><Save className="w-4 h-4" /> Save & Project</>
              )}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

type TabId = 'quick' | 'builder';

export default function FinanceScenarioPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('quick');

  const tabs: Array<{ id: TabId; label: string; icon: typeof Calculator }> = [
    { id: 'quick',   label: 'Quick Projection', icon: Calculator },
    { id: 'builder', label: 'Scenario Builder', icon: TrendingUp },
  ];

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
      {/* Tab strip */}
      <div className="flex items-center gap-1 mb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === id
                ? 'bg-mission-control-accent text-white'
                : 'bg-mission-control-bg-alt text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'quick' ? <QuickProjectionTab /> : <ScenarioBuilderTab />}
    </div>
  );
}
