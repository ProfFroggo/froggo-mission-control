// LEGACY: TokenUsageWidget uses file-level suppression for intentional patterns.
// Widget for token usage tracking - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Zap, DollarSign, TrendingUp, Shield } from 'lucide-react';
import { getAgentTheme } from '../utils/agentThemes';
import AgentTokenDetailModal from './AgentTokenDetailModal';
import { CHART_COLORS, CHART_GRID, CHART_AXIS } from '../lib/chartTheme';

interface TokenSummaryResponse {
  by_agent: Array<{
    agent: string;
    total_input: number;
    total_output: number;
    total_all: number;
    total_cost: number;
    calls: number;
  }>;
  by_model?: Array<any>;
  period?: string;
  error?: string;
}

interface BudgetResponse {
  agent: string;
  daily_limit: number;
  used_today: number;
  remaining: number;
  percentage_used: number;
  alert_threshold: number;
  over_budget: boolean;
  hard_limit: boolean;
  error?: string;
}

interface ChartData {
  agent: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  calls: number;
  cost: number;
}

export default function TokenUsageWidget() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '30d'>('today');
  const [summaryData, setSummaryData] = useState<TokenSummaryResponse | null>(null);
  const [budgetData, setBudgetData] = useState<Map<string, BudgetResponse>>(new Map());
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const periodMap: Record<string, string> = { 'today': 'day', '7d': 'week', '30d': 'month' };
      const summary = await fetch(`/api/analytics/token-usage?period=${periodMap[period] || period}`).then(r => r.ok ? r.json() : null).catch(() => null);
      if (!summary) {
        setLoading(false);
        return;
      }
      setSummaryData(summary as TokenSummaryResponse);

      if (!summary.error && summary.by_agent) {
        const chartData = summary.by_agent
          .filter((item: any) => item.agent !== 'unknown')
          .map((item: any) => ({
            agent: item.agent,
            inputTokens: item.total_input,
            outputTokens: item.total_output,
            totalTokens: item.total_all,
            calls: item.calls,
            cost: item.total_cost,
          }));
        setChartData(chartData);
      }
    } catch (error) {
      // Failed to load token data
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-clawd-surface border border-clawd-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{data.agent}</p>
          <p className="text-sm text-info">Input: {data.inputTokens.toLocaleString()}</p>
          <p className="text-sm text-review">Output: {data.outputTokens.toLocaleString()}</p>
          <p className="text-sm text-success">Total: {data.totalTokens.toLocaleString()}</p>
          <p className="text-sm text-warning">Calls: {data.calls}</p>
          <p className="text-sm text-warning">Cost: ${data.cost.toFixed(4)}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-clawd-text-dim">Loading token data...</div>
      </div>
    );
  }

  if (summaryData?.error || !summaryData?.by_agent) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-clawd-text-dim">No token data available</div>
      </div>
    );
  }

  // Calculate summary stats
  const totalTokens = summaryData.by_agent.reduce((sum, d) => sum + d.total_all, 0);
  const totalCost = summaryData.by_agent.reduce((sum, d) => sum + d.total_cost, 0);
  const topConsumer = summaryData.by_agent.reduce(
    (max, agent) => (agent.total_all > max.total_all ? agent : max),
    summaryData.by_agent[0]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="text-clawd-accent" size={20} />
            Token Usage
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Token burn rate and budget tracking
          </p>
        </div>

        {/* Period selector */}
        <div className="flex bg-clawd-border rounded-lg p-1">
          {(['today', '7d', '30d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-clawd-accent text-white'
                  : 'text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {p === 'today' ? 'Today' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1 flex items-center gap-2">
            <Zap size={16} className="text-warning" />
            Total Tokens
          </div>
          <div className="text-2xl font-bold text-warning">
            {totalTokens.toLocaleString()}
          </div>
          <div className="text-sm text-clawd-text-dim mt-1">
            {summaryData.by_agent.reduce((sum, d) => sum + d.calls, 0)} calls
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1 flex items-center gap-2">
            <DollarSign size={16} className="text-success" />
            Total Cost
          </div>
          <div className="text-2xl font-bold text-success">
            ${totalCost.toFixed(2)}
          </div>
          <div className="text-sm text-clawd-text-dim mt-1">
            {period === 'today' ? 'Today' : `Last ${period}`}
          </div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="text-sm text-clawd-text-dim mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-info" />
            Top Consumer
          </div>
          <div className="text-xl font-bold">
            {topConsumer?.agent || 'None'}
          </div>
          <div className="text-sm text-clawd-text-dim mt-1">
            {topConsumer?.total_all.toLocaleString() || '0'} tokens
          </div>
        </div>
      </div>

      {/* Burn Rate Bar Chart */}
      <div className="flex-1 bg-clawd-surface border border-clawd-border rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-medium text-clawd-text-dim mb-4">
          Per-Agent Token Consumption
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
            <XAxis dataKey="agent" stroke={CHART_AXIS.stroke} />
            <YAxis stroke={CHART_AXIS.stroke} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              dataKey="inputTokens"
              name="Input Tokens"
              stackId="a"
              onClick={(data: any) => setSelectedAgent(data.agent)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-input-${index}`} fill={getAgentTheme(entry.agent).color} />
              ))}
            </Bar>
            <Bar
              dataKey="outputTokens"
              name="Output Tokens"
              stackId="a"
              onClick={(data: any) => setSelectedAgent(data.agent)}
              cursor="pointer"
            >
              {chartData.map((entry, index) => {
                // Use a slightly darker/lighter variant for output
                const baseColor = getAgentTheme(entry.agent).color;
                return <Cell key={`cell-output-${index}`} fill={baseColor} fillOpacity={0.6} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Budget Status Section */}
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl p-6">
        <h3 className="text-sm font-medium text-clawd-text-dim mb-4 flex items-center gap-2">
          <Shield size={16} className="text-info" />
          Budget Status
        </h3>
        <div className="space-y-4">
          {summaryData.by_agent
            .filter((agent) => agent.agent !== 'unknown')
            .map((agent) => {
              const budget = budgetData.get(agent.agent);
              if (!budget || budget.daily_limit === 0) {
                return (
                  <div key={agent.agent} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-32">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getAgentTheme(agent.agent).color }}
                      />
                      <span
                        className="text-sm font-medium cursor-pointer hover:underline"
                        onClick={() => setSelectedAgent(agent.agent)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent(agent.agent); } }}
                        role="button"
                        tabIndex={0}
                      >
                        {agent.agent}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-clawd-text-dim">No budget set</div>
                    </div>
                  </div>
                );
              }

              const pctRaw = budget.percentage_used ?? budget.percentage_used ?? 0;
              const percentage = pctRaw > 1 ? pctRaw : pctRaw * 100; // normalize to 0-100
              const threshold = (budget.alert_threshold || 0.9) * 100;
              let barColor = getAgentTheme(agent.agent).color; // Green (< 70%)
              if (percentage >= threshold) {
                barColor = CHART_COLORS.red; // Red (>= alert threshold)
              } else if (percentage >= 70) {
                barColor = CHART_COLORS.amber; // Yellow (70-90%)
              }

              return (
                <div key={agent.agent} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getAgentTheme(agent.agent).color }}
                      />
                      <span
                        className="text-sm font-medium cursor-pointer hover:underline"
                        onClick={() => setSelectedAgent(agent.agent)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedAgent(agent.agent); } }}
                        role="button"
                        tabIndex={0}
                      >
                        {agent.agent}
                      </span>
                      {budget.over_budget && (
                        <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded-full font-medium">
                          OVER BUDGET
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-clawd-text-dim">
                      {budget.used_today.toLocaleString()} / {budget.daily_limit.toLocaleString()} tokens
                      <span className="ml-2 text-xs">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="bg-clawd-border rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Agent Token Detail Modal */}
      <AgentTokenDetailModal
        isOpen={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        agent={selectedAgent}
      />
    </div>
  );
}
