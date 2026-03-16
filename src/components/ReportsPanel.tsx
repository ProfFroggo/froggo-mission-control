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
    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
      <div className="text-sm text-mission-control-text-dim mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color ?? 'text-mission-control-text'}`}>
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
    } catch {
      // silent — user will see nothing was downloaded
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('csv')}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors disabled:opacity-50"
        title={`Export ${type} as CSV`}
      >
        <Download size={12} />
        {busy === 'csv' ? 'Exporting…' : 'CSV'}
      </button>
      <button
        onClick={() => handleExport('json')}
        disabled={!!busy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors disabled:opacity-50"
        title={`Export ${type} as JSON`}
      >
        <Download size={12} />
        {busy === 'json' ? 'Exporting…' : 'JSON'}
      </button>
    </div>
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
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 animate-pulse">
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
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        <p className="text-sm text-mission-control-text-dim">
          Executive summary unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-mission-control-accent" />
          <h3 className="font-semibold">Executive Summary</h3>
          <span className="text-xs text-mission-control-text-dim">
            ({summary.period.days}d period)
          </span>
        </div>
        <button
          onClick={load}
          className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
          title="Refresh summary"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-mission-control-bg rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-2">
            <CheckSquare size={12} />
            Tasks Completed
          </div>
          <div className="text-2xl font-bold text-success">{summary.tasks.completed}</div>
          <div className="text-xs text-mission-control-text-dim mt-1">
            {summary.tasks.velocity}/day velocity
          </div>
        </div>
        <div className="p-4 bg-mission-control-bg rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-2">
            <Users size={12} />
            Active Agents
          </div>
          <div className="text-2xl font-bold text-info">{summary.agents.active}</div>
          <div className="text-xs text-mission-control-text-dim mt-1">
            {summary.agents.avgSuccessRate}% avg success rate
          </div>
        </div>
        <div className="p-4 bg-mission-control-bg rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-2">
            <Award size={12} />
            Approvals
          </div>
          <div className="text-2xl font-bold text-warning">{summary.approvals.total}</div>
          <div className="text-xs text-mission-control-text-dim mt-1">
            {summary.approvals.approved} approved
          </div>
        </div>
        <div className="p-4 bg-mission-control-bg rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-mission-control-text-dim mb-2">
            <Zap size={12} />
            Token Cost
          </div>
          <div className="text-2xl font-bold text-review">${summary.tokens.cost.toFixed(4)}</div>
          <div className="text-xs text-mission-control-text-dim mt-1">
            {formatNumber(summary.tokens.total)} tokens
          </div>
        </div>
      </div>

      {/* Highlights */}
      {summary.highlights.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider">
            Highlights
          </div>
          <div className="space-y-1.5">
            {summary.highlights.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm p-3 bg-mission-control-bg rounded-lg"
              >
                <TrendingUp size={14} className="text-mission-control-accent mt-0.5 shrink-0" />
                {h}
              </div>
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
    <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Icon size={16} className="text-mission-control-accent" />
            {title}
          </h3>
          <p className="text-xs text-mission-control-text-dim mt-0.5">{subtitle}</p>
        </div>
        <ExportButtons type={exportType} from={from} to={to} />
      </div>
      {children}
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
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim">Generating reports…</div>
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
    <div className="h-full flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="text-mission-control-accent" size={20} />
            Productivity Reports
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Weekly, monthly summaries and data exports
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Date range quick selectors */}
          <div className="flex bg-mission-control-border rounded-lg p-1 gap-0.5">
            {QUICK_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => { setQuickRange(r.value); setCustomFrom(''); setCustomTo(''); }}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  quickRange === r.value && !customFrom
                    ? 'bg-mission-control-accent text-white'
                    : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-mission-control-text-dim" />
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg"
              title="From date"
            />
            <span className="text-mission-control-text-dim text-xs">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs px-2 py-1.5 bg-mission-control-surface border border-mission-control-border rounded-lg"
              title="To date"
            />
          </div>

          {/* Report type selector */}
          <div className="flex bg-mission-control-border rounded-lg p-1">
            {(['weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors capitalize ${
                  reportType === type
                    ? 'bg-mission-control-accent text-white'
                    : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Schedule stub */}
          <button
            onClick={() => setShowScheduleToast(true)}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors text-sm"
          >
            <Bell size={14} />
            Schedule Report
          </button>
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
            subtitle="All tasks in selected period"
            exportType="tasks"
            from={exportFrom}
            to={exportTo}
          >
            <p className="text-sm text-mission-control-text-dim">
              Includes id, title, status, priority, agent, created, completed, and duration.
            </p>
          </ReportSection>

          <ReportSection
            icon={Users}
            title="Agent Performance"
            subtitle="Per-agent metrics"
            exportType="agents"
            from={exportFrom}
            to={exportTo}
          >
            <p className="text-sm text-mission-control-text-dim">
              Includes tasks completed, success rate, avg duration, and token usage.
            </p>
          </ReportSection>

          <ReportSection
            icon={Award}
            title="Approvals Report"
            subtitle="All approval decisions"
            exportType="approvals"
            from={exportFrom}
            to={exportTo}
          >
            <p className="text-sm text-mission-control-text-dim">
              Includes type, status, created, resolved, and response time.
            </p>
          </ReportSection>

          <ReportSection
            icon={Zap}
            title="Token Usage"
            subtitle="Daily token consumption by agent"
            exportType="token-usage"
            from={exportFrom}
            to={exportTo}
          >
            <p className="text-sm text-mission-control-text-dim">
              Includes date, agent, input/output tokens, and cost per day.
            </p>
          </ReportSection>
        </div>

        {/* ── Legacy weekly/monthly report ── */}
        {reportType === 'weekly' && weeklyReport && (
          <div className="space-y-6">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-mission-control-accent mb-2">
                <Calendar size={20} />
                <span className="font-medium">Week of {weeklyReport.weekStart}</span>
              </div>
              <p className="text-sm text-mission-control-text-dim">
                {weeklyReport.weekStart} to {weeklyReport.weekEnd}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Tasks Created" value={weeklyReport.tasksCreated} color="text-info" />
              <StatCard label="Tasks Completed" value={weeklyReport.tasksCompleted} color="text-success" />
              <StatCard label="Completion Rate" value={`${weeklyReport.completionRate}%`} color="text-review" />
              <StatCard label="Total Hours" value={`${weeklyReport.totalHours.toFixed(1)}h`} color="text-warning" />
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Award size={16} className="text-warning" />
                Highlights
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-mission-control-bg rounded-lg">
                  <div className="text-sm text-mission-control-text-dim mb-2">Top Performer</div>
                  <div className="text-xl font-bold text-warning">{weeklyReport.topAgent}</div>
                </div>
                <div className="p-4 bg-mission-control-bg rounded-lg">
                  <div className="text-sm text-mission-control-text-dim mb-2">Most Active Project</div>
                  <div className="text-xl font-bold text-info">{weeklyReport.topProject}</div>
                </div>
              </div>
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-mission-control-accent" />
                Insights
              </h3>
              <div className="space-y-3">
                {weeklyReport.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 bg-mission-control-bg rounded-lg text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reportType === 'monthly' && monthlyReport && (
          <div className="space-y-6">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-mission-control-accent mb-2">
                <Calendar size={20} />
                <span className="font-medium">
                  {monthlyReport.month} {monthlyReport.year}
                </span>
              </div>
              <p className="text-sm text-mission-control-text-dim">Monthly Performance Report</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Tasks Created" value={monthlyReport.tasksCreated} color="text-info" />
              <StatCard label="Tasks Completed" value={monthlyReport.tasksCompleted} color="text-success" />
              <StatCard label="Completion Rate" value={`${monthlyReport.completionRate}%`} color="text-review" />
              <StatCard label="Total Hours" value={`${monthlyReport.totalHours.toFixed(1)}h`} color="text-warning" />
            </div>

            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Award size={16} className="text-warning" />
                Agent Performance
              </h3>
              <div className="space-y-3">
                {monthlyReport.agentPerformance.map((agent) => (
                  <div key={agent.agentId} className="p-4 bg-mission-control-bg rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{agent.agentName}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {agent.tasksCompleted} completed
                      </span>
                    </div>
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

            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-mission-control-accent" />
                Project Breakdown
              </h3>
              <div className="space-y-3">
                {monthlyReport.projectBreakdown.map((project) => (
                  <div key={project.project} className="p-4 bg-mission-control-bg rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{project.project}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {project.totalTasks} tasks
                      </span>
                    </div>
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

            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-mission-control-accent" />
                Insights
              </h3>
              <div className="space-y-3">
                {monthlyReport.insights.map((insight, idx) => (
                  <div key={idx} className="p-4 bg-mission-control-bg rounded-lg text-sm">
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <ScheduleToast visible={showScheduleToast} onHide={() => setShowScheduleToast(false)} />
    </div>
  );
}
