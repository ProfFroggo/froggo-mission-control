import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingDown, Loader2 } from 'lucide-react';

interface Props {
  selectedAccountId: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  groceries:     '#4CAF50',
  food:          '#4CAF50',
  dining:        '#FF9800',
  transport:     '#2196F3',
  utilities:     '#9C27B0',
  entertainment: '#E91E63',
  health:        '#F44336',
  shopping:      '#00BCD4',
  subscriptions: '#607D8B',
  income:        '#8BC34A',
  other:         '#9E9E9E',
  housing:       '#795548',
  transfer:      '#BDBDBD',
  crypto:        '#FFC107',
};

const FALLBACK_COLORS = [
  '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63',
  '#00BCD4', '#F44336', '#607D8B', '#8BC34A', '#FFC107',
];

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const PERIOD_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(value);

interface BreakdownRow {
  category: string;
  total: number;
  count: number;
  color: string;
}

export default function FinanceCategoryBreakdown({ selectedAccountId }: Props) {
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(30);

  const loadBreakdown = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.clawdbot?.finance?.category?.getBreakdown({
        accountId: selectedAccountId || undefined,
        days: selectedDays,
      });
      if (result?.success && result.breakdown) {
        const rows: BreakdownRow[] = (result.breakdown as FinanceCategoryBreakdownRow[]).map(
          (row, idx) => ({
            ...row,
            total: Math.abs(row.total),
            color: getCategoryColor(row.category, idx),
          })
        );
        setBreakdown(rows);
      } else {
        setBreakdown([]);
      }
    } catch {
      setBreakdown([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId, selectedDays]);

  useEffect(() => {
    loadBreakdown();
  }, [loadBreakdown]);

  const total = breakdown.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-clawd-text-dim uppercase tracking-wide">
          Spend by Category
        </h3>
        {/* Period selector */}
        <div className="flex items-center gap-1">
          {PERIOD_OPTIONS.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setSelectedDays(days)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedDays === days
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-bg-alt text-clawd-text-dim hover:text-clawd-text'
              }`}
              aria-label={`Show ${label} breakdown`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-clawd-text-dim">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading breakdown...</span>
        </div>
      ) : breakdown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-clawd-text-dim">
          <TrendingDown className="w-10 h-10 mb-2" />
          <p className="text-sm">No spending data for this period</p>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          {/* PieChart ~45% */}
          <div className="w-[45%] flex-shrink-0" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {breakdown.map((row) => (
                    <Cell key={row.category} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Spent']}
                  labelFormatter={(label) =>
                    String(label).charAt(0).toUpperCase() + String(label).slice(1)
                  }
                  contentStyle={{
                    background: 'var(--clawd-surface)',
                    border: '1px solid var(--clawd-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category list ~55% */}
          <div className="flex-1 min-w-0 space-y-2 max-h-44 overflow-auto pr-1">
            {breakdown.map((row) => {
              const pct = total > 0 ? (row.total / total) * 100 : 0;
              return (
                <div key={row.category} className="flex items-center gap-2 text-sm">
                  {/* Color dot */}
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: row.color }}
                  />
                  {/* Name */}
                  <span className="flex-1 text-clawd-text capitalize truncate">
                    {row.category}
                  </span>
                  {/* Pct */}
                  <span className="text-clawd-text-dim text-xs w-8 text-right flex-shrink-0">
                    {pct.toFixed(0)}%
                  </span>
                  {/* Amount */}
                  <span className="text-clawd-text font-medium text-right flex-shrink-0 w-20">
                    {formatCurrency(row.total)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
