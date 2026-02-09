import { useState } from 'react';
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
} from 'lucide-react';
import AnalyticsOverview from './AnalyticsOverview';
import SessionsFilter from './SessionsFilter';
import TaskTrendsChart from './TaskTrendsChart';
import AgentUtilizationChart from './AgentUtilizationChart';
import TimeTrackingPanel from './TimeTrackingPanel';
import ProductivityHeatmap from './ProductivityHeatmap';
import ReportsPanel from './ReportsPanel';
import UsageStatsPanel from './UsageStatsPanel';
import AdvancedAgentComparison from './AdvancedAgentComparison';
import PerformanceBenchmarks from './PerformanceBenchmarks';
import RealTimeAnalytics from './RealTimeAnalytics';
import TokenUsageWidget from './TokenUsageWidget';
import PerformanceTable from './PerformanceTable';
import { DateRange } from './DateRangePicker';

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
  | 'reports'
  | 'sessions';

const TABS: { id: Tab; label: string; icon: any; description: string }[] = [
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
  {
    id: 'sessions',
    label: 'Sessions',
    icon: Activity,
    description: 'Active sessions',
  },
];

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
      console.error('Failed to export analytics:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <BarChart2 size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
              <p className="text-sm text-clawd-text-dim">
                Comprehensive productivity insights and performance metrics
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAgentComparison(true)}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
              title="Compare Agents"
            >
              <GitCompare size={16} />
              <span className="text-sm">Compare</span>
            </button>

            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} />
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors"
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
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border'
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
        {activeTab === 'sessions' && <SessionsFilter />}
      </div>

      {/* Agent Comparison Modal */}
      <AdvancedAgentComparison
        isOpen={showAgentComparison}
        onClose={() => setShowAgentComparison(false)}
      />
    </div>
  );
}
