// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useRef, useEffect, lazy } from 'react';
import { AsyncBoundary } from './AsyncBoundary';
import {
  BarChart2,
  Activity,
  TrendingUp,
  Clock,
  Users,
  FileText,
  Flame,
  MessageSquare,
  GitCompare,
  Target,
  Download,
  RefreshCw,
  Zap,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { DateRange } from './DateRangePicker';

// Lazy load heavy chart components (code splitting)
const AnalyticsOverview = lazy(() => import('./AnalyticsOverview'));
const TaskTrendsChart = lazy(() => import('./TaskTrendsChart'));
const UsageStatsPanel = lazy(() => import('./UsageStatsPanel'));
const PerformanceBenchmarks = lazy(() => import('./PerformanceBenchmarks'));
const TokenUsageWidget = lazy(() => import('./TokenUsageWidget'));
const AdvancedAgentComparison = lazy(() => import('./AdvancedAgentComparison'));

// Lightweight components - regular imports
import TimeTrackingPanel from './TimeTrackingPanel';
import ProductivityHeatmap from './ProductivityHeatmap';
import ReportsPanel from './ReportsPanel';
import PerformanceTable from './PerformanceTable';
import RealTimeAnalytics from './RealTimeAnalytics';

type Tab =
  | 'overview'
  | 'realtime'
  | 'tokens'
  | 'trends'
  | 'agents'
  | 'usage'
  | 'benchmarks'
  | 'time'
  | 'heatmap'
  | 'reports';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart2,
    description: 'Key metrics and summary',
  },
  {
    id: 'realtime',
    label: 'Real-Time',
    icon: Activity,
    description: 'Live analytics feed',
  },
  {
    id: 'tokens',
    label: 'Token Usage',
    icon: Zap,
    description: 'Token burn rate & budgets',
  },
  {
    id: 'trends',
    label: 'Task Trends',
    icon: TrendingUp,
    description: 'Task completion trends',
  },
  {
    id: 'agents',
    label: 'Agent Performance',
    icon: Users,
    description: 'Agent utilization & stats',
  },
  {
    id: 'usage',
    label: 'Usage Stats',
    icon: MessageSquare,
    description: 'Messages, sessions, channels',
  },
  {
    id: 'benchmarks',
    label: 'Benchmarks',
    icon: Target,
    description: 'Performance over time',
  },
  {
    id: 'time',
    label: 'Time Tracking',
    icon: Clock,
    description: 'Time spent analysis',
  },
  {
    id: 'heatmap',
    label: 'Heatmap',
    icon: Flame,
    description: 'Activity patterns',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    description: 'Generate reports',
  },
];

// Loading fallback component
function ChartSkeleton() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-mission-control-text-dim">
        <Loader2 size={32} className="animate-spin" />
        <p className="text-sm">Loading charts...</p>
      </div>
    </div>
  );
}

type ExportReportType = 'tasks' | 'agents' | 'approvals' | 'token-usage';

async function triggerAnalyticsExport(
  type: ExportReportType,
  format: 'csv' | 'json',
  dateRange: DateRange
): Promise<void> {
  const params = new URLSearchParams({
    type,
    format,
    from: dateRange.start.toISOString(),
    to: dateRange.end.toISOString(),
  });
  const res = await fetch(`/api/reports?${params.toString()}`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'csv') {
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showAgentComparison, setShowAgentComparison] = useState(false);
  const [dateRange, _setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Close export menu on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showExportMenu]);

  const handleExport = async (type: ExportReportType, format: 'csv' | 'json') => {
    setExportBusy(true);
    setShowExportMenu(false);
    try {
      await triggerAnalyticsExport(type, format, dateRange);
    } catch {
      // silent
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <BarChart2 size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
              <p className="text-sm text-mission-control-text-dim">
                Comprehensive productivity insights and performance metrics
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAgentComparison(true)}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
              title="Compare Agents"
            >
              <GitCompare size={16} />
              <span className="text-sm">Compare</span>
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>

            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                disabled={exportBusy}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-60"
              >
                <Download size={16} />
                <span className="text-sm">{exportBusy ? 'Exporting…' : 'Export'}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showExportMenu ? 'rotate-180' : ''}`}
                />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider border-b border-mission-control-border">
                    Export as CSV
                  </div>
                  {(['tasks', 'agents', 'approvals', 'token-usage'] as ExportReportType[]).map(
                    (t) => (
                      <button
                        key={`csv-${t}`}
                        onClick={() => handleExport(t, 'csv')}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-mission-control-border transition-colors capitalize"
                      >
                        {t.replace('-', ' ')} CSV
                      </button>
                    )
                  )}
                  <div className="px-3 py-2 text-xs font-medium text-mission-control-text-dim uppercase tracking-wider border-b border-mission-control-border border-t">
                    Export as JSON
                  </div>
                  {(['tasks', 'agents', 'approvals', 'token-usage'] as ExportReportType[]).map(
                    (t) => (
                      <button
                        key={`json-${t}`}
                        onClick={() => handleExport(t, 'json')}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-mission-control-border transition-colors capitalize"
                      >
                        {t.replace('-', ' ')} JSON
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap group ${
                  activeTab === tab.id
                    ? 'bg-mission-control-accent text-white'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border'
                }`}
                title={tab.description}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden p-6" key={refreshKey}>
        <AsyncBoundary fallback={<ChartSkeleton />} componentName="AnalyticsDashboard">
          {activeTab === 'overview' && <AnalyticsOverview />}
          {activeTab === 'realtime' && <RealTimeAnalytics />}
          {activeTab === 'tokens' && <TokenUsageWidget />}
          {activeTab === 'trends' && <TaskTrendsChart />}
          {activeTab === 'agents' && <PerformanceTable />}
          {activeTab === 'usage' && <UsageStatsPanel />}
          {activeTab === 'benchmarks' && <PerformanceBenchmarks />}
          {activeTab === 'time' && <TimeTrackingPanel />}
          {activeTab === 'heatmap' && <ProductivityHeatmap />}
          {activeTab === 'reports' && <ReportsPanel />}
        </AsyncBoundary>
      </div>

      {/* Agent Comparison Modal */}
      <AdvancedAgentComparison
        isOpen={showAgentComparison}
        onClose={() => setShowAgentComparison(false)}
      />
    </div>
  );
}
