import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Calculator, TrendingUp, TrendingDown, Plus, Trash2, Play, Save, Loader2 } from 'lucide-react';
import { Button, Flex, TextField, Select, TextArea, Box } from '@radix-ui/themes';
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
      <Flex align="center" justify="center" gap="2" className="py-12 text-mission-control-text-dim">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading recurring items...</span>
      </Flex>
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
                  ? 'bg-[var(--color-error)]/5 border-[var(--color-error)]/30 opacity-60'
                  : 'bg-mission-control-border/20 border-mission-control-border'
              }`}
            >
              {/* Toggle */}
              <button
                onClick={() => setCancel(item.id, !isCancelled)}
                aria-label={isCancelled ? 'Restore item' : 'Cancel item'}
                title={isCancelled ? 'Click to restore' : 'Click to cancel'}
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0 transition-colors ${
                  isCancelled
                    ? 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30 text-[var(--color-error)]'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
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
              <TextField.Root
                type="number"
                disabled={isCancelled}
                defaultValue={Math.abs(item.amount).toFixed(2)}
                onChange={(e) => setAdjustAmount(item.id, e.target.value)}
                min="0"
                step="0.01"
                size="2"
                className="w-24"
                aria-label={`Amount for ${item.description}`}
                style={{ textAlign: 'right' }}
              />
              <span className="text-xs text-mission-control-text-dim flex-shrink-0">{item.currency}</span>
            </div>
          );
        })}
      </div>

      {/* Calculate button */}
      <Button
        onClick={calculate}
        disabled={calculating}
        size="2"
        variant="soft"
       
        className="w-full"
        aria-label="Calculate projection"
      >
        {calculating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</>
        ) : (
          <><Calculator className="w-4 h-4" /> Calculate</>
        )}
      </Button>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* Before */}
          <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Before</p>
            <p className="text-xl font-bold tabular-nums text-mission-control-text">
              {formatCurrency(result.before.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
              {formatCurrency(result.before.yearly)}/yr
            </p>
          </div>

          {/* After */}
          <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">After</p>
            <p className="text-xl font-bold tabular-nums text-mission-control-text">
              {formatCurrency(result.after.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
              {formatCurrency(result.after.yearly)}/yr
            </p>
          </div>

          {/* Savings */}
          <div
            className={`rounded-xl p-4 border ${
              result.savings.monthly >= 0
                ? 'bg-[var(--color-success)]/10 border-[var(--color-success)]/30'
                : 'bg-[var(--color-error)]/10 border-[var(--color-error)]/30'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-1">
              {result.savings.monthly >= 0 ? (
                <TrendingDown className="w-3 h-3 text-[var(--color-success)]" />
              ) : (
                <TrendingUp className="w-3 h-3 text-[var(--color-error)]" />
              )}
              Savings
            </p>
            <p
              className={`text-xl font-bold tabular-nums ${
                result.savings.monthly >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
              }`}
            >
              {result.savings.monthly >= 0 ? '+' : ''}
              {formatCurrency(result.savings.monthly)}
              <span className="text-xs font-normal text-mission-control-text-dim">/mo</span>
            </p>
            <p className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
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
      <Flex align="center" justify="between">
        <span className="text-sm text-mission-control-text-dim">
          {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}
        </span>
        <Flex align="center" gap="2">
          {comparedIds.length >= 2 && (
            <button
              onClick={() => setCompareMode((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                compareMode
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
              }`}
            >
              Compare
            </button>
          )}
          <Button
            onClick={() => setShowForm(true)}
            size="2"
            variant="soft"

            aria-label="New scenario"
          >
            <Plus className="w-4 h-4" /> New Scenario
          </Button>
        </Flex>
      </Flex>

      {/* Comparison chart */}
      {compareMode && comparisonChartData.length > 0 && (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Scenario Comparison</h4>
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
        <Flex align="center" justify="center" gap="2" className="py-8 text-mission-control-text-dim">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading scenarios...</span>
        </Flex>
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
              <div key={scenario.id} className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <Flex align="start" justify="between" gap="3" className="mb-3">
                  <div>
                    <h4 className="font-semibold text-mission-control-text">{scenario.name}</h4>
                    {scenario.description && (
                      <p className="text-xs text-mission-control-text-dim mt-0.5">{scenario.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      onClick={() => runProjection(scenario.id)}
                      disabled={projecting}
                      size="1"
                      variant="soft"
                     
                      aria-label="Run projection"
                    >
                      <Play className="w-3 h-3" /> Run
                    </Button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                      onClick={() => deleteScenario(scenario.id, scenario.name)}
                      aria-label={`Delete ${scenario.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Flex>

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
                                  <Flex justify="between" gap="4">
                                    <span>Income</span>
                                    <span className="text-[var(--color-success)]">{formatCurrency(d.income)}</span>
                                  </Flex>
                                  <Flex justify="between" gap="4">
                                    <span>Expenses</span>
                                    <span className="text-[var(--color-error)]">{formatCurrency(d.expenses)}</span>
                                  </Flex>
                                  {d.oneTime !== 0 && (
                                    <Flex justify="between" gap="4">
                                      <span>One-time</span>
                                      <span>{formatCurrency(d.oneTime)}</span>
                                    </Flex>
                                  )}
                                  <Flex justify="between" gap="4" className="border-t border-mission-control-border pt-1 mt-1">
                                    <span className="font-medium text-mission-control-text">Net</span>
                                    <span className={d.net >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
                                      {formatCurrency(d.net)}
                                    </span>
                                  </Flex>
                                  <Flex justify="between" gap="4">
                                    <span className="font-medium text-mission-control-text">Balance</span>
                                    <span className={d.runningBalance >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}>
                                      {formatCurrency(d.runningBalance)}
                                    </span>
                                  </Flex>
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
            <TextField.Root
              id="scenario-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g., Cancel Netflix + Gym"
              size="2"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="scenario-description" className="block text-xs text-mission-control-text-dim mb-1">Description</label>
            <TextArea
              id="scenario-description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional notes..."
              rows={2}
              variant="soft"
              resize="vertical"
            />
          </div>

          {/* Account + Projection months */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="scenario-account" className="block text-xs text-mission-control-text-dim mb-1">Base Account</label>
              <Select.Root
                value={form.baseAccountId || '_none'}
                onValueChange={(val) => setForm((f) => ({ ...f, baseAccountId: val === '_none' ? '' : val }))}
                size="2"
              >
                <Select.Trigger id="scenario-account" className="w-full" />
                <Select.Content>
                  <Select.Item value="_none">None (delta mode)</Select.Item>
                  {accounts.map((a) => (
                    <Select.Item key={a.id} value={a.id}>{a.name}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <label htmlFor="scenario-months" className="block text-xs text-mission-control-text-dim mb-1">Projection months</label>
              <TextField.Root
                id="scenario-months"
                type="number"
                min={1}
                max={60}
                value={form.projectionMonths}
                onChange={(e) => setForm((f) => ({ ...f, projectionMonths: parseInt(e.target.value) || 12 }))}
                size="2"
              />
            </div>
          </div>

          {/* Income adjustments */}
          <div>
            <Flex align="center" justify="between" className="mb-2">
              <span className="text-[10px] text-mission-control-text-dim font-bold uppercase tracking-wide">
                Income adjustments
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    incomeRows: [...f.incomeRows, { label: '', monthly_delta: 0 }],
                  }))
                }
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </Flex>
            {form.incomeRows.map((row, i) => (
              <Flex key={i} align="center" gap="2" className="mb-2">
                <TextField.Root
                  value={row.label}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.incomeRows];
                      next[i] = { ...next[i], label: e.target.value };
                      return { ...f, incomeRows: next };
                    })
                  }
                  placeholder="e.g., Side project"
                  size="2"
                  className="flex-1"
                />
                <TextField.Root
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
                  size="2"
                  className="w-24"
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      incomeRows: f.incomeRows.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="Remove income row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Flex>
            ))}
          </div>

          {/* Expense adjustments */}
          <div>
            <Flex align="center" justify="between" className="mb-2">
              <span className="text-[10px] text-mission-control-text-dim font-bold uppercase tracking-wide">
                Expense adjustments
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    expenseRows: [...f.expenseRows, { category: '', monthly_delta: 0 }],
                  }))
                }
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </Flex>
            {form.expenseRows.map((row, i) => (
              <Flex key={i} align="center" gap="2" className="mb-2">
                <TextField.Root
                  value={row.category}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.expenseRows];
                      next[i] = { ...next[i], category: e.target.value };
                      return { ...f, expenseRows: next };
                    })
                  }
                  placeholder="e.g., subscriptions"
                  size="2"
                  className="flex-1"
                />
                <TextField.Root
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
                  size="2"
                  className="w-24"
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      expenseRows: f.expenseRows.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="Remove expense row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Flex>
            ))}
          </div>

          {/* One-time events */}
          <div>
            <Flex align="center" justify="between" className="mb-2">
              <span className="text-[10px] text-mission-control-text-dim font-bold uppercase tracking-wide">
                One-time events
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    eventRows: [...f.eventRows, { label: '', amount: 0, date: '' }],
                  }))
                }
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </Flex>
            {form.eventRows.map((row, i) => (
              <Flex key={i} align="center" gap="2" className="mb-2">
                <TextField.Root
                  value={row.label}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.eventRows];
                      next[i] = { ...next[i], label: e.target.value };
                      return { ...f, eventRows: next };
                    })
                  }
                  placeholder="e.g., Vacation"
                  size="2"
                  className="flex-1"
                />
                <TextField.Root
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
                  size="2"
                  className="w-24"
                />
                <TextField.Root
                  type="date"
                  value={row.date}
                  onChange={(e) =>
                    setForm((f) => {
                      const next = [...f.eventRows];
                      next[i] = { ...next[i], date: e.target.value };
                      return { ...f, eventRows: next };
                    })
                  }
                  size="2"
                  className="w-32"
                />
                <button
                  type="button"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      eventRows: f.eventRows.filter((_, j) => j !== i),
                    }))
                  }
                  aria-label="Remove event row"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Flex>
            ))}
          </div>

          {/* Actions */}
          <Flex align="center" gap="2" className="pt-2">
            <Button
              onClick={saveAndProject}
              disabled={saving || projecting}
              size="2"
              variant="soft"
             
            >
              {saving || projecting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {saving ? 'Saving...' : 'Projecting...'}</>
              ) : (
                <><Save className="w-4 h-4" /> Save & Project</>
              )}
            </Button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              onClick={resetForm}
            >
              Cancel
            </button>
          </Flex>
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
    <Box p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
      {/* Tab strip */}
      <Flex gap="1" className="border-b border-mission-control-border mb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 border-b-2 -mb-px text-sm font-medium transition-colors ${
              activeTab === id
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </Flex>

      {/* Tab content */}
      {activeTab === 'quick' ? <QuickProjectionTab /> : <ScenarioBuilderTab />}
    </Box>
  );
}
