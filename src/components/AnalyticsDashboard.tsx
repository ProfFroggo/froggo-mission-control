// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useRef, useEffect, lazy } from 'react';
import { Button, IconButton } from '@radix-ui/themes';
import { AsyncBoundary } from './AsyncBoundary';
import {
  BarChart2,
  Activity,
  TrendingUp,
  Clock,
  Users,
  Zap,
  Loader2,
  ChevronDown,
  GitCompare,
  Download,
  RefreshCw,
  Copy,
  Check,
  Filter,
  Server,
  type LucideIcon,
} from 'lucide-react';
import TabNav from './TabNav';
import { DateRange } from './DateRangePicker';

// ─── Lazy chart components ─────────────────────────────────────────────────────
const AnalyticsOverview       = lazy(() => import('./AnalyticsOverview'));
const TaskTrendsChart         = lazy(() => import('./TaskTrendsChart'));
const UsageStatsPanel         = lazy(() => import('./UsageStatsPanel'));
const PerformanceBenchmarks   = lazy(() => import('./PerformanceBenchmarks'));
const TokenUsageWidget        = lazy(() => import('./TokenUsageWidget'));
const AdvancedAgentComparison = lazy(() => import('./AdvancedAgentComparison'));
const VelocityChart           = lazy(() => import('./VelocityChart'));
const AgentTrendsChart        = lazy(() => import('./AgentTrendsChart'));
const FunnelChart             = lazy(() => import('./FunnelChart'));

// Regular imports (lighter components)
import TimeTrackingPanel from './TimeTrackingPanel';
import ProductivityHeatmap from './ProductivityHeatmap';
import ReportsPanel from './ReportsPanel';
import PerformanceTable from './PerformanceTable';
import RealTimeAnalytics from './RealTimeAnalytics';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'productivity' | 'team' | 'system';

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon; description: string }> = [
  { id: 'overview',     label: 'Overview',     icon: BarChart2,   description: 'Key metrics and activity summary' },
  { id: 'productivity', label: 'Productivity', icon: TrendingUp,  description: 'Tasks, velocity, funnel, heatmap and time tracking' },
  { id: 'team',         label: 'Team',         icon: Users,       description: 'Agent trends, performance and usage stats' },
  { id: 'system',       label: 'System',       icon: Server,      description: 'Live feed, token usage, benchmarks and exports' },
];

// ─── Date range ────────────────────────────────────────────────────────────────

interface Preset { label: string; range: () => DateRange }

function startOfQuarter(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}
function startOfYear(): Date {
  return new Date(new Date().getFullYear(), 0, 1);
}

const DATE_PRESETS: Preset[] = [
  { label: '7d',  range: () => ({ start: new Date(Date.now() - 7  * 86_400_000), end: new Date() }) },
  { label: '30d', range: () => ({ start: new Date(Date.now() - 30 * 86_400_000), end: new Date() }) },
  { label: '90d', range: () => ({ start: new Date(Date.now() - 90 * 86_400_000), end: new Date() }) },
  { label: 'QTD', range: () => ({ start: startOfQuarter(), end: new Date() }) },
  { label: 'YTD', range: () => ({ start: startOfYear(),    end: new Date() }) },
];

// ─── Export ────────────────────────────────────────────────────────────────────

type ExportReportType = 'tasks' | 'agents' | 'approvals' | 'token-usage';
const CSV_BOM = '\uFEFF';

async function triggerAnalyticsExport(
  type: ExportReportType,
  format: 'csv' | 'json',
  dateRange: DateRange
): Promise<string | null> {
  const params = new URLSearchParams({
    type, format,
    from: dateRange.start.toISOString(),
    to:   dateRange.end.toISOString(),
  });
  const res = await fetch(`/api/reports?${params.toString()}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    const text    = await res.text();
    const content = text.startsWith('\uFEFF') ? text : CSV_BOM + text;
    const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = Object.assign(document.createElement('a'), { href: url, download: `${type}-report-${dateStr}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    return content;
  } else {
    const json    = await res.json();
    const str     = JSON.stringify(json, null, 2);
    const blob    = new Blob([str], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = Object.assign(document.createElement('a'), { href: url, download: `${type}-report-${dateStr}.json` });
    a.click();
    URL.revokeObjectURL(url);
    return str;
  }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-mission-control-accent" />
        <p className="text-xs text-mission-control-text-dim">Loading charts…</p>
      </div>
    </div>
  );
}

/** Section header inside a combined tab */
function SectionHeader({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={15} className="text-mission-control-accent flex-shrink-0" />
      <div>
        <h3 className="text-sm font-semibold text-mission-control-text">{title}</h3>
        {description && <p className="text-xs text-mission-control-text-dim">{description}</p>}
      </div>
    </div>
  );
}

/** Wraps a chart section in a consistent card */
function ChartCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-mission-control-surface border border-mission-control-border rounded-2xl p-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab]               = useState<Tab>('overview');
  const [showAgentComparison, setShowAgentComparison] = useState(false);
  const [dateRange, setDateRange]               = useState<DateRange>({
    start: new Date(Date.now() - 30 * 86_400_000),
    end:   new Date(),
  });
  const [activePreset, setActivePreset]         = useState('30d');
  const [refreshKey, setRefreshKey]             = useState(0);
  const [showExportMenu, setShowExportMenu]     = useState(false);
  const [exportBusy, setExportBusy]             = useState(false);
  const [copiedExport, setCopiedExport]         = useState<string | null>(null);
  const exportMenuRef                           = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!showExportMenu) return;
    function onOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showExportMenu]);

  function applyPreset(preset: Preset) {
    setDateRange(preset.range());
    setActivePreset(preset.label);
  }

  async function handleExport(type: ExportReportType, format: 'csv' | 'json') {
    setExportBusy(true);
    setShowExportMenu(false);
    try { await triggerAnalyticsExport(type, format, dateRange); }
    catch { /* silent */ }
    finally { setExportBusy(false); }
  }

  async function handleExportAndCopy(type: ExportReportType, format: 'csv' | 'json') {
    setExportBusy(true);
    setShowExportMenu(false);
    try {
      const content = await triggerAnalyticsExport(type, format, dateRange);
      if (content) {
        await navigator.clipboard.writeText(content);
        setCopiedExport(`${type}-${format}`);
        setTimeout(() => setCopiedExport(null), 2000);
      }
    } catch { /* silent */ }
    finally { setExportBusy(false); }
  }

  const days  = Math.max(1, Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86_400_000));
  const weeks = Math.max(1, Math.round(days / 7));

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
              <BarChart2 size={22} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
              <p className="text-xs text-mission-control-text-dim">Productivity insights and performance metrics</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Date presets — segment control */}
            <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activePreset === preset.label
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <IconButton
              type="button"
              onClick={() => setShowAgentComparison(true)}
              size="2"
              variant="ghost"
              color="gray"
              title="Compare agents"
            >
              <GitCompare size={15} />
            </IconButton>

            <IconButton
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              size="2"
              variant="ghost"
              color="gray"
              title="Refresh data"
            >
              <RefreshCw size={15} />
            </IconButton>

            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <Button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exportBusy}
                size="2"
                variant="soft"
              >
                <Download size={14} />
                {exportBusy ? 'Exporting…' : 'Export'}
                <ChevronDown size={12} className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </Button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-60 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl overflow-hidden">
                  {(['csv', 'json'] as const).map((fmt) => (
                    <div key={fmt}>
                      <div className="px-3 py-2 text-[10px] font-semibold text-mission-control-text-dim uppercase tracking-wider border-b border-mission-control-border">
                        {fmt === 'csv' ? 'CSV (Excel)' : 'JSON'}
                      </div>
                      {(['tasks', 'agents', 'approvals', 'token-usage'] as ExportReportType[]).map((t) => (
                        <div key={`${fmt}-${t}`} className="flex items-center justify-between hover:bg-mission-control-border/30 transition-colors">
                          <button
                            type="button"
                            onClick={() => handleExport(t, fmt)}
                            className="flex-1 text-left px-3 py-2 text-xs text-mission-control-text capitalize"
                          >
                            {t.replace('-', ' ')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportAndCopy(t, fmt)}
                            className="px-2 py-2 text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                            title="Export and copy"
                          >
                            {copiedExport === `${t}-${fmt}`
                              ? <Check size={12} className="text-success" />
                              : <Copy size={12} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as Tab)}
        />
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden" key={refreshKey}>
        <AsyncBoundary fallback={<ChartSkeleton />} componentName="AnalyticsDashboard">
          {/* OVERVIEW — rich KPI dashboard, no changes needed here */}
          {activeTab === 'overview' && (
            <div className="h-full overflow-y-auto p-0">
              <AnalyticsOverview days={days} />
            </div>
          )}

          {/* PRODUCTIVITY — tasks, velocity, funnel, heatmap, time */}
          {activeTab === 'productivity' && (
            <div className="h-full overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Task trends — primary chart, full width, tallest */}
                <ChartCard>
                  <SectionHeader icon={TrendingUp} title="Task Completion Trends" description="Creation and completion over time" />
                  <div style={{ minHeight: 360 }}>
                    <TaskTrendsChart days={days} />
                  </div>
                </ChartCard>

                {/* Velocity + Funnel side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard>
                    <SectionHeader icon={Zap} title="Velocity" description="Weekly task throughput" />
                    <div style={{ minHeight: 260 }}>
                      <VelocityChart weeks={weeks} />
                    </div>
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader icon={Filter} title="Pipeline Funnel" description="Task status funnel" />
                    <div style={{ minHeight: 260 }}>
                      <FunnelChart />
                    </div>
                  </ChartCard>
                </div>

                {/* Heatmap — full width */}
                <ChartCard>
                  <SectionHeader icon={Activity} title="Productivity Heatmap" description="Activity intensity by day and hour" />
                  <ProductivityHeatmap days={days} />
                </ChartCard>

                {/* Time Tracking — full width */}
                <ChartCard>
                  <SectionHeader icon={Clock} title="Time Tracking" description="Hours logged by agent and project" />
                  <TimeTrackingPanel />
                </ChartCard>
              </div>
            </div>
          )}

          {/* TEAM — agent trends, performance table, usage stats */}
          {activeTab === 'team' && (
            <div className="h-full overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Agent trends — full width, primary chart */}
                <ChartCard>
                  <SectionHeader icon={Users} title="Agent Trends" description="Daily task completions per agent" />
                  <div style={{ minHeight: 320 }}>
                    <AgentTrendsChart days={days} />
                  </div>
                </ChartCard>

                {/* Performance table — full width */}
                <ChartCard>
                  <SectionHeader icon={Users} title="Performance" description="Detailed agent metrics and rankings" />
                  <PerformanceTable />
                </ChartCard>

                {/* Usage stats — full width */}
                <ChartCard>
                  <SectionHeader icon={Activity} title="Usage Stats" description="Messages, sessions, and channel breakdown" />
                  <UsageStatsPanel days={days} />
                </ChartCard>
              </div>
            </div>
          )}

          {/* SYSTEM — live feed, tokens, benchmarks, reports */}
          {activeTab === 'system' && (
            <div className="h-full overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Live feed + Token Usage side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChartCard>
                    <SectionHeader icon={Activity} title="Real-Time" description="Live activity feed" />
                    <RealTimeAnalytics />
                  </ChartCard>
                  <ChartCard>
                    <SectionHeader icon={Zap} title="Token Usage" description="AI token burn rate and budgets" />
                    <div style={{ minHeight: 280 }}>
                      <TokenUsageWidget days={days} />
                    </div>
                  </ChartCard>
                </div>

                {/* Benchmarks — full width */}
                <ChartCard>
                  <SectionHeader icon={TrendingUp} title="Performance Benchmarks" description="Historical performance comparisons" />
                  <PerformanceBenchmarks />
                </ChartCard>

                {/* Reports / Export — full width */}
                <ChartCard>
                  <SectionHeader icon={Download} title="Reports" description="Generate and export detailed reports" />
                  <ReportsPanel />
                </ChartCard>
              </div>
            </div>
          )}
        </AsyncBoundary>
      </div>

      {/* Agent comparison modal */}
      <AdvancedAgentComparison
        isOpen={showAgentComparison}
        onClose={() => setShowAgentComparison(false)}
      />
    </div>
  );
}
