import { useState, Suspense, lazy } from 'react';
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

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showAgentComparison, setShowAgentComparison] = useState(false);
  const [dateRange, _setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleExport = async () => {
    try {
      // Export analytics data
      const exportData = {
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        currentTab: activeTab,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      // 'Failed to export analytics:', error;
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

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors"
            >
              <Download size={16} />
              <span className="text-sm">Export</span>
            </button>
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
        <Suspense fallback={<ChartSkeleton />}>
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
        </Suspense>
      </div>

      {/* Agent Comparison Modal */}
      <AdvancedAgentComparison
        isOpen={showAgentComparison}
        onClose={() => setShowAgentComparison(false)}
      />
    </div>
  );
}
