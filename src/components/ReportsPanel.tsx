// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Award,
  Clock,
  BarChart3,
  Users,
  CheckSquare,
  Zap,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import {
  generateWeeklyReport,
  generateMonthlyReport,
  WeeklyReport,
  MonthlyReport,
} from '../services/analyticsService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'weekly' | 'monthly';

type ExportType = 'tasks' | 'agents' | 'approvals' | 'token-usage';

type QuickRange = '1d' | '7d' | '30d' | '90d';

interface ExecutiveSummary {
  period: { from: string; to: string; days: number };
  tasks: { created: number; completed: number; failed: number; velocity: number };
  agents: {
    active: number;
    total: number;
    mostProductive: { name: string; completed: number } | null;
    avgSuccessRate: number;
  };
  approvals: { total: number; approved: number; rejected: number; avgResponseHours: number | null };
  tokens: { total: number; cost: number; topConsumer: { name: string; tokens: number } | null };
  highlights: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateToIso(d: Date): string {
  return d.toISOString().split('T')[0];
}

function quickRangeDates(range: QuickRange): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  from.setDate(from.getDate() - days);
  return { from, to };
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function triggerExport(
  type: ExportType,
  format: 'csv' | 'json',
  from: Date,
  to: Date
): Promise<void> {
  const params = new URLSearchParams({
    type,
    format,
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`/api/reports?${params.toString()}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const dateStr = dateToIso(new Date());

  if (format === 'csv') {
    const text = await res.text();
    downloadFile(text, `${type}-report-${dateStr}.csv`, 'text/csv');
  } else {
    const json = await res.json();
    downloadFile(JSON.stringify(json, null, 2), `${type}-report-${dateStr}.json`, 'application/json');
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">{label}</div>
      <div className={`text-2xl font-bold tabular-nums text-mission-control-text ${color ?? ''}`}>
        {value}
      </div>
    </div>
  );
}

function ExportButtons({
  type,
  from,
  to,
}: {
  type: ExportType;
  from: Date;
  to: Date;
}) {
  const [busy, setBusy] = useState<'csv' | 'json' | null>(null);

  async function handleExport(format: 'csv' | 'json') {
    setBusy(format);
    try {
      await triggerExport(type, format, from, to);
    } catch (err) {
      console.warn('[ReportsPanel] Non-critical:', err);
      // silent — user will see nothing was downloaded
    } finally {
      setBusy(null);
    }
  }

  return (
    <Flex align="center" gap="2">
      <button
        type="button"
        onClick={() => handleExport('csv')}
        disabled={!!busy}
        title={`Export ${type} as CSV`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
      >
        <Download size={12} />
        {busy === 'csv' ? 'Exporting…' : 'CSV'}
      </button>
      <button
        type="button"
        onClick={() => handleExport('json')}
        disabled={!!busy}
        title={`Export ${type} as JSON`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
      >
        <Download size={12} />
        {busy === 'json' ? 'Exporting…' : 'JSON'}
      </button>
    </Flex>
  );
}

function ExecutiveSummaryCard({
  from,
  to,
}: {
  from: Date;
  to: Date;
}) {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/reports/summary?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSummary(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [from.getTime(), to.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5 animate-pulse">
        <div className="h-5 bg-mission-control-border rounded w-48 mb-4" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-mission-control-border rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
        <p className="text-sm text-mission-control-text-dim">
          Executive summary unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5 space-y-5">
      {/* Header */}
      <Flex align="center" justify="between">
        <Flex align="center" gap="2">
          <BarChart3 size={14} className="text-mission-control-text-dim" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Executive Summary</span>
          <span className="text-xs text-mission-control-text-dim">
            ({summary.period.days}d)
          </span>
        </Flex>
        <button
          type="button"
          onClick={load}
          title="Refresh summary"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </Flex>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-mission-control-border/10 rounded-lg">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim mb-2">
            <CheckSquare size={12} />
            Tasks Completed
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">{summary.tasks.completed}</div>
          <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
            <span className="text-success">{summary.tasks.velocity}</span>/day velocity
          </div>
        </div>
        <div className="p-4 bg-mission-control-border/10 rounded-lg">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim mb-2">
            <Users size={12} />
            Active Agents
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">{summary.agents.active}</div>
          <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
            <span className="text-info">{summary.agents.avgSuccessRate}%</span> avg success
          </div>
        </div>
        <div className="p-4 bg-mission-control-border/10 rounded-lg">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim mb-2">
            <Award size={12} />
            Approvals
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">{summary.approvals.total}</div>
          <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
            <span className="text-success">{summary.approvals.approved}</span> approved
          </div>
        </div>
        <div className="p-4 bg-mission-control-border/10 rounded-lg">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim mb-2">
            <Zap size={12} />
            Token Cost
          </Flex>
          <div className="text-2xl font-bold tabular-nums text-mission-control-text">${summary.tokens.cost.toFixed(4)}</div>
          <div className="text-xs text-mission-control-text-dim mt-1 tabular-nums">
            {formatNumber(summary.tokens.total)} tokens
          </div>
        </div>
      </div>

      {/* Highlights */}
      {summary.highlights.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider">
            Highlights
          </div>
          <div className="space-y-1.5">
            {summary.highlights.map((h, i) => (
              <Flex
                key={i}
                align="start"
                gap="2"
                className="text-sm p-3 bg-mission-control-border/10 rounded-lg"
              >
                <TrendingUp size={14} className="text-mission-control-accent mt-0.5 shrink-0" />
                {h}
              </Flex>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Report sections ──────────────────────────────────────────────────────────

interface ReportSectionProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  exportType: ExportType;
  from: Date;
  to: Date;
  children: React.ReactNode;
}

function ReportSection({
  icon: Icon,
  title,
  subtitle,
  exportType,
  from,
  to,
  children,
}: ReportSectionProps) {
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-mission-control-text-dim" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">{title}</span>
        </div>
        <ExportButtons type={exportType} from={from} to={to} />
      </div>
      <div className="px-4 pt-3 pb-4">
        <p className="text-xs text-mission-control-text-dim mb-1">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Toast (minimal inline) ───────────────────────────────────────────────────

function ScheduleToast({ visible, onHide }: { visible: boolean; onHide: () => void }) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onHide, 3000);
      return () => clearTimeout(t);
    }
  }, [visible, onHide]);

  if (!visible) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-lg text-sm">
      <Bell size={14} className="text-mission-control-accent" />
      Scheduled reports — coming soon
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsPanel() {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickRange, setQuickRange] = useState<QuickRange>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showScheduleToast, setShowScheduleToast] = useState(false);

  // Derived date range for exports
  const exportRange = useCallback((): { from: Date; to: Date } => {
    if (customFrom && customTo) {
      return { from: new Date(customFrom), to: new Date(customTo) };
    }
    return quickRangeDates(quickRange);
  }, [quickRange, customFrom, customTo]);

  const { from: exportFrom, to: exportTo } = exportRange();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [weekly, monthly] = await Promise.all([
        generateWeeklyReport(),
        generateMonthlyReport(),
      ]);
      setWeeklyReport(weekly);
      setMonthlyReport(monthly);
    } catch (err) {
      console.warn('[ReportsPanel] Non-critical:', err);
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        <div className="h-32 bg-mission-control-border/20 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-mission-control-border/20 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const QUICK_RANGES: { label: string; value: QuickRange }[] = [
    { label: 'Today', value: '1d' },
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: '90 days', value: '90d' },
  ];

  return (
    <Flex direction="column" height="100%">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <Flex align="center" gap="3">
          <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
            <FileText size={24} className="text-mission-control-accent" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-mission-control-text">Productivity Reports</h2>
            <p className="text-sm text-mission-control-text-dim mt-0.5">Weekly, monthly summaries and data exports</p>
          </div>
        </Flex>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Date range quick selectors */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => { setQuickRange(r.value); setCustomFrom(''); setCustomTo(''); }}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  quickRange === r.value && !customFrom ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs — native date pickers kept as-is for functionality */}
          <Flex align="center" gap="2">
            <Calendar size={14} className="text-mission-control-text-dim" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.5rem', background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)', borderRadius: '0.5rem', color: 'inherit' }}
              title="From date"
            />
            <span className="text-mission-control-text-dim text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.375rem 0.5rem', background: 'var(--mission-control-surface)', border: '1px solid var(--mission-control-border)', borderRadius: '0.5rem', color: 'inherit' }}
              title="To date"
            />
          </Flex>

          {/* Report type selector */}
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
            {(['weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReportType(type)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  reportType === type ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Schedule stub */}
          <Button
            onClick={() => setShowScheduleToast(true)}
            variant="outline"
            size="2"
          >
            <Bell size={14} />
            Schedule Report
          </Button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Executive Summary */}
        <ExecutiveSummaryCard from={exportFrom} to={exportTo} />

        {/* Export sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ReportSection
            icon={CheckSquare}
            title="Tasks Report"
            subtitle="id, title, status, priority, agent, created, completed, duration"
            exportType="tasks"
            from={exportFrom}
            to={exportTo}
          >
            <span />
          </ReportSection>

          <ReportSection
            icon={Users}
            title="Agent Performance"
            subtitle="tasks completed, success rate, avg duration, token usage"
            exportType="agents"
            from={exportFrom}
            to={exportTo}
          >
            <span />
          </ReportSection>

          <ReportSection
            icon={Award}
            title="Approvals Report"
            subtitle="type, status, created, resolved, response time"
            exportType="approvals"
            from={exportFrom}
            to={exportTo}
          >
            <span />
          </ReportSection>

          <ReportSection
            icon={Zap}
            title="Token Usage"
            subtitle="date, agent, input/output tokens, cost per day"
            exportType="token-usage"
            from={exportFrom}
            to={exportTo}
          >
            <span />
          </ReportSection>
        </div>

        {/* ── Legacy weekly/monthly report ── */}
        {reportType === 'weekly' && weeklyReport && (
          <div className="space-y-6">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <Flex align="center" gap="2" className="mb-2">
                <Calendar size={16} className="text-mission-control-accent" />
                <span className="text-sm font-semibold text-mission-control-text">Week of {weeklyReport.weekStart}</span>
              </Flex>
              <p className="text-xs text-mission-control-text-dim">
                {weeklyReport.weekStart} — {weeklyReport.weekEnd}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Tasks Created" value={weeklyReport.tasksCreated} color="text-info" />
              <StatCard label="Tasks Completed" value={weeklyReport.tasksCompleted} color="text-success" />
              <StatCard label="Completion Rate" value={`${weeklyReport.completionRate}%`} color="text-review" />
              <StatCard label="Total Hours" value={`${weeklyReport.totalHours.toFixed(1)}h`} color="text-warning" />
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <Award size={12} className="text-mission-control-text-dim" />
                Highlights
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-mission-control-border/10 rounded-lg">
                  <div className="text-sm text-mission-control-text-dim mb-2">Top Performer</div>
                  <div className="text-xl font-bold text-warning">{weeklyReport.topAgent}</div>
                </div>
                <div className="p-4 bg-mission-control-border/10 rounded-lg">
                  <div className="text-sm text-mission-control-text-dim mb-2">Most Active Project</div>
                  <div className="text-xl font-bold text-info">{weeklyReport.topProject}</div>
                </div>
              </div>
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <TrendingUp size={12} className="text-mission-control-text-dim" />
                Insights
              </div>
              <div className="space-y-3">
                {weeklyReport.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 bg-mission-control-border/10 rounded-lg text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reportType === 'monthly' && monthlyReport && (
          <div className="space-y-6">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <Flex align="center" gap="2" className="mb-2">
                <Calendar size={16} className="text-mission-control-accent" />
                <span className="text-sm font-semibold text-mission-control-text">
                  {monthlyReport.month} {monthlyReport.year}
                </span>
              </Flex>
              <p className="text-xs text-mission-control-text-dim">Monthly Performance Report</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Tasks Created" value={monthlyReport.tasksCreated} color="text-info" />
              <StatCard label="Tasks Completed" value={monthlyReport.tasksCompleted} color="text-success" />
              <StatCard label="Completion Rate" value={`${monthlyReport.completionRate}%`} color="text-review" />
              <StatCard label="Total Hours" value={`${monthlyReport.totalHours.toFixed(1)}h`} color="text-warning" />
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <Award size={12} className="text-mission-control-text-dim" />
                Agent Performance
              </div>
              <div className="space-y-3">
                {monthlyReport.agentPerformance.map((agent) => (
                  <div key={agent.agentId} className="p-4 bg-mission-control-border/10 rounded-lg">
                    <Flex align="center" justify="between" className="mb-3">
                      <span className="font-medium">{agent.agentName}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {agent.tasksCompleted} completed
                      </span>
                    </Flex>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-mission-control-text-dim">Completion Rate</div>
                        <div className="font-medium text-success">{agent.completionRate}%</div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Avg Time</div>
                        <div className="font-medium text-info">
                          {agent.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Total Time</div>
                        <div className="font-medium text-warning">
                          {agent.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <Clock size={12} className="text-mission-control-text-dim" />
                Project Breakdown
              </div>
              <div className="space-y-3">
                {monthlyReport.projectBreakdown.map((project) => (
                  <div key={project.project} className="p-4 bg-mission-control-border/10 rounded-lg">
                    <Flex align="center" justify="between" className="mb-3">
                      <span className="font-medium">{project.project}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {project.totalTasks} tasks
                      </span>
                    </Flex>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-mission-control-text-dim">Completed</div>
                        <div className="font-medium text-success">{project.completedTasks}</div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Avg Time</div>
                        <div className="font-medium text-info">
                          {project.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Total Time</div>
                        <div className="font-medium text-warning">
                          {project.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                <TrendingUp size={12} className="text-mission-control-text-dim" />
                Insights
              </div>
              <div className="space-y-3">
                {monthlyReport.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 bg-mission-control-border/10 rounded-lg text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ScheduleToast visible={showScheduleToast} onHide={() => setShowScheduleToast(false)} />
    </Flex>
  );
}
