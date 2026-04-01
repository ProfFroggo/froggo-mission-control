// LEGACY: AnalyticsPanel uses file-level suppression for intentional patterns.
// loadAnalytics and related functions are redefined on each render but capture latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Activity,
  Calendar,
  Users,
  Target,
  Zap,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import TabNav from './TabNav';
import TaskTrendsChart from './TaskTrendsChart';
import AgentUtilizationChart from './AgentUtilizationChart';
import ProductivityHeatmap from './ProductivityHeatmap';
import TimeTrackingPanel from './TimeTrackingPanel';
import {
  getTaskCompletionTrends,
  getAgentUtilization,
  getProductivityHeatmap,
  getProjectStats,
  getTaskVelocity,
  getSubtaskStats,
  type TaskCompletionTrend,
  type AgentUtilization,
  type ProductivityHeatmap as HeatmapData,
  type ProjectStats,
} from '../services/analyticsService';
import { Spinner } from './LoadingStates';
import EmptyState from './EmptyState';
import ErrorDisplay from './ErrorDisplay';

type TimeRange = '7d' | '30d' | '90d';
type AnalyticsView = 'overview' | 'tasks' | 'agents' | 'time' | 'projects';

export default function AnalyticsPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [view, setView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Analytics data
  const [completionTrends, setCompletionTrends] = useState<TaskCompletionTrend[]>([]);
  const [agentUtilization, setAgentUtilization] = useState<AgentUtilization[]>([]);
  const [_heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [subtaskStats, setSubtaskStats] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;

      const [trends, agents, heatmap, projects, vel, subtasks] = await Promise.allSettled([
        getTaskCompletionTrends(days),
        getAgentUtilization(),
        getProductivityHeatmap(days),
        getProjectStats(),
        getTaskVelocity(days),
        getSubtaskStats(),
      ]);

      if (trends.status === 'fulfilled') setCompletionTrends(trends.value);
      if (agents.status === 'fulfilled') setAgentUtilization(agents.value);
      if (heatmap.status === 'fulfilled') setHeatmapData(heatmap.value);
      if (projects.status === 'fulfilled') setProjectStats(projects.value);
      if (vel.status === 'fulfilled') setVelocity(vel.value);
      if (subtasks.status === 'fulfilled') setSubtaskStats(subtasks.value);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const data = {
      timeRange,
      generatedAt: new Date().toISOString(),
      completionTrends,
      agentUtilization,
      projectStats,
      velocity,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Calculate summary stats
  const totalCompleted = completionTrends.reduce((sum, d) => sum + d.completed, 0);
  const totalCreated = completionTrends.reduce((sum, d) => sum + d.created, 0);
  const avgCompletionRate = totalCreated > 0 
    ? Math.round((totalCompleted / totalCreated) * 100) 
    : 0;
  const totalHours = agentUtilization.reduce((sum, a) => sum + a.totalTimeSpent, 0);
  const avgVelocity = velocity.length > 0
    ? Math.round(velocity.reduce((sum, v) => sum + v.velocity, 0) / velocity.length * 10) / 10
    : 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorDisplay
        error={error}
        context={{ action: 'load analytics', resource: 'analytics data' }}
        onRetry={loadAnalytics}
      />
    );
  }

  const hasData = completionTrends.length > 0 || agentUtilization.length > 0 || projectStats.length > 0;
  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState
          icon={BarChart3}
          title="No analytics data yet"
          description="Analytics data appears as agents process tasks. Check back after some activity."
          action={{ label: 'Refresh', onClick: loadAnalytics }}
        />
      </div>
    );
  }

  return (
    <Flex direction="column" height="100%">
      {/* Header + tabs wrapper */}
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" justify="between" className="px-4 py-3">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
              <BarChart3 size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">Analytics & Insights</h1>
              <p className="text-sm text-mission-control-text-dim">Comprehensive productivity tracking and performance metrics</p>
            </div>
          </Flex>

          <Flex align="center" gap="2">
            {/* Time range selector */}
            <div className="flex items-center border border-mission-control-border rounded-lg overflow-hidden">
              {(['7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    timeRange === range
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
            <button type="button" onClick={loadAnalytics} title="Refresh" aria-label="Refresh" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
              <RefreshCw size={16} />
            </button>
            <Button size="2" variant="outline" onClick={exportData}>
              <Download size={16} />
              Export
            </Button>
          </Flex>
        </Flex>

        {/* Tab nav — flush with header border */}
        <TabNav
          tabs={[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'tasks', label: 'Task Trends', icon: Target },
            { id: 'agents', label: 'Agent Performance', icon: Users },
            { id: 'time', label: 'Time Tracking', icon: Clock },
            { id: 'projects', label: 'Projects', icon: Calendar },
          ]}
          activeTab={view}
          onTabChange={(id) => setView(id as AnalyticsView)}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">

      {/* Content */}
      <div>
        {view === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <Flex align="center" justify="between" className="mb-2">
                  <Target size={18} className="text-info" />
                  <TrendingUp size={14} className="text-success" />
                </Flex>
                <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
                  {totalCompleted}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-0.5">Tasks Completed</div>
                <div className="mt-1.5 text-xs text-mission-control-text-dim tabular-nums">
                  {totalCreated} created • <span className="text-success">{avgCompletionRate}%</span> rate
                </div>
              </div>

              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <Flex align="center" justify="between" className="mb-2">
                  <Users size={18} className="text-review" />
                  <Zap size={14} className="text-warning" />
                </Flex>
                <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
                  {agentUtilization.length}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-0.5">Active Agents</div>
                <div className="mt-1.5 text-xs text-mission-control-text-dim tabular-nums">
                  {agentUtilization.filter(a => a.tasksInProgress > 0).length} working now
                </div>
              </div>

              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <Flex align="center" justify="between" className="mb-2">
                  <Clock size={18} className="text-warning" />
                  <Activity size={14} className="text-success" />
                </Flex>
                <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
                  {totalHours.toFixed(0)}h
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-0.5">Total Hours</div>
                <div className="mt-1.5 text-xs text-mission-control-text-dim">
                  Last {timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} days
                </div>
              </div>

              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <Flex align="center" justify="between" className="mb-2">
                  <TrendingUp size={18} className="text-success" />
                  <Zap size={14} className="text-info" />
                </Flex>
                <div className="text-2xl font-bold tabular-nums text-mission-control-text mb-0.5">
                  {avgVelocity > 0 ? '+' : ''}{avgVelocity}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mt-0.5">Avg Velocity</div>
                <div className="mt-1.5 text-xs text-mission-control-text-dim">
                  Tasks/day throughput
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 gap-6">
              <TaskTrendsChart />
              <AgentUtilizationChart />
            </div>

            {/* Heatmap */}
            <ProductivityHeatmap />

            {/* Subtask Progress */}
            {subtaskStats.length > 0 && (
              <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3 flex items-center gap-2">
                  <Target size={12} className="text-mission-control-text-dim" />
                  Active Tasks — Subtask Progress
                </h3>
                <div className="space-y-3">
                  {subtaskStats.slice(0, 10).map((stat: any) => (
                    <Flex key={stat.taskId} align="center" gap="3">
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1 truncate">
                          {stat.taskTitle}
                        </div>
                        <Flex align="center" gap="2">
                          <div className="flex-1 bg-mission-control-bg rounded-full h-2">
                            <div
                              className="bg-mission-control-accent rounded-full h-2 transition-colors"
                              style={{ width: `${stat.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-mission-control-text-dim w-16 text-right">
                            {stat.completedSubtasks}/{stat.totalSubtasks}
                          </span>
                        </Flex>
                      </div>
                      <div className="text-sm font-medium text-mission-control-accent w-12 text-right">
                        {stat.completionRate}%
                      </div>
                    </Flex>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'tasks' && <TaskTrendsChart />}
        {view === 'agents' && <AgentUtilizationChart />}
        {view === 'time' && <TimeTrackingPanel />}
        
        {view === 'projects' && (
          <div className="space-y-6">
            <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-mission-control-text-dim" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Project Statistics</span>
                </div>
              </div>
              <div className="px-4 pt-3 pb-4">
              {projectStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-mission-control-text-dim">
                  <BarChart3 size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No data for this period</p>
                  <p className="text-xs mt-1 opacity-70">Activity will appear here once agents start working</p>
                </div>
              ) : (
              <div className="space-y-4">
                {projectStats.map((project) => (
                  <div
                    key={project.project}
                    className="p-4 bg-mission-control-border/10 rounded-xl"
                  >
                    <Flex align="center" justify="between" className="mb-3">
                      <div>
                        <div className="font-medium text-mission-control-text">{project.project}</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">
                          {project.totalTasks} total • {project.completedTasks} completed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold tabular-nums text-mission-control-text">
                          {project.completedTasks > 0
                            ? Math.round((project.completedTasks / project.totalTasks) * 100)
                            : 0}%
                        </div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">completion</div>
                      </div>
                    </Flex>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-mission-control-text-dim">In Progress</div>
                        <div className="font-medium text-info">
                          {project.inProgressTasks}
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Avg Time</div>
                        <div className="font-medium text-warning">
                          {project.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Total Time</div>
                        <div className="font-medium text-review">
                          {project.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 bg-mission-control-border rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-mission-control-accent to-[var(--color-info)] rounded-full h-2 transition-colors"
                        style={{
                          width: `${project.totalTasks > 0 
                            ? (project.completedTasks / project.totalTasks) * 100 
                            : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>

      </div>
    </Flex>
  );
}
