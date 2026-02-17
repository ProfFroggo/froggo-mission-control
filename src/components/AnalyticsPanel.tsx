/* eslint-disable react-hooks/exhaustive-deps */
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

type TimeRange = '7d' | '30d' | '90d';
type AnalyticsView = 'overview' | 'tasks' | 'agents' | 'time' | 'projects';

export default function AnalyticsPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [view, setView] = useState<AnalyticsView>('overview');
  const [loading, setLoading] = useState(true);
  
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
    try {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      
      const [trends, agents, heatmap, projects, vel, subtasks] = await Promise.all([
        getTaskCompletionTrends(days),
        getAgentUtilization(),
        getProductivityHeatmap(days),
        getProjectStats(),
        getTaskVelocity(days),
        getSubtaskStats(),
      ]);

      setCompletionTrends(trends);
      setAgentUtilization(agents);
      setHeatmapData(heatmap);
      setProjectStats(projects);
      setVelocity(vel);
      setSubtaskStats(subtasks);
    } catch (error) {
      // 'Failed to load analytics:', error;
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="text-clawd-accent" size={20} />
            Analytics & Insights
          </h2>
          <p className="text-sm text-clawd-text-dim mt-1">
            Comprehensive productivity tracking and performance metrics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex bg-clawd-border rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <button
            onClick={loadAnalytics}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>

          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* View selector */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'tasks', label: 'Task Trends', icon: Target },
          { id: 'agents', label: 'Agent Performance', icon: Users },
          { id: 'time', label: 'Time Tracking', icon: Clock },
          { id: 'projects', label: 'Projects', icon: Calendar },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id as AnalyticsView)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              view === id
                ? 'bg-clawd-accent text-white'
                : 'bg-clawd-surface border border-clawd-border text-clawd-text-dim hover:text-clawd-text hover:border-clawd-accent/50'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Target size={20} className="text-info" />
                  <TrendingUp size={16} className="text-success" />
                </div>
                <div className="text-3xl font-bold text-info mb-1">
                  {totalCompleted}
                </div>
                <div className="text-sm text-clawd-text-dim">Tasks Completed</div>
                <div className="mt-2 text-xs text-clawd-text-dim">
                  {totalCreated} created • {avgCompletionRate}% rate
                </div>
              </div>

              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Users size={20} className="text-review" />
                  <Zap size={16} className="text-warning" />
                </div>
                <div className="text-3xl font-bold text-review mb-1">
                  {agentUtilization.length}
                </div>
                <div className="text-sm text-clawd-text-dim">Active Agents</div>
                <div className="mt-2 text-xs text-clawd-text-dim">
                  {agentUtilization.filter(a => a.tasksInProgress > 0).length} working now
                </div>
              </div>

              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock size={20} className="text-warning" />
                  <Activity size={16} className="text-success" />
                </div>
                <div className="text-3xl font-bold text-warning mb-1">
                  {totalHours.toFixed(0)}h
                </div>
                <div className="text-sm text-clawd-text-dim">Total Hours</div>
                <div className="mt-2 text-xs text-clawd-text-dim">
                  Last {timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} days
                </div>
              </div>

              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp size={20} className="text-success" />
                  <Zap size={16} className="text-info" />
                </div>
                <div className="text-3xl font-bold text-success mb-1">
                  {avgVelocity > 0 ? '+' : ''}{avgVelocity}
                </div>
                <div className="text-sm text-clawd-text-dim">Avg Velocity</div>
                <div className="mt-2 text-xs text-clawd-text-dim">
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
              <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Target size={16} className="text-clawd-accent" />
                  Active Tasks - Subtask Progress
                </h3>
                <div className="space-y-3">
                  {subtaskStats.slice(0, 10).map((stat: any) => (
                    <div key={stat.taskId} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1 truncate">
                          {stat.taskTitle}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-clawd-bg rounded-full h-2">
                            <div
                              className="bg-clawd-accent rounded-full h-2 transition-all"
                              style={{ width: `${stat.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-clawd-text-dim w-16 text-right">
                            {stat.completedSubtasks}/{stat.totalSubtasks}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-clawd-accent w-12 text-right">
                        {stat.completionRate}%
                      </div>
                    </div>
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
          <div className="space-y-4">
            <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-clawd-accent" />
                Project Statistics
              </h3>
              <div className="space-y-4">
                {projectStats.map((project) => (
                  <div
                    key={project.project}
                    className="p-4 bg-clawd-bg rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">{project.project}</div>
                        <div className="text-sm text-clawd-text-dim">
                          {project.totalTasks} total • {project.completedTasks} completed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-clawd-accent">
                          {project.completedTasks > 0 
                            ? Math.round((project.completedTasks / project.totalTasks) * 100)
                            : 0}%
                        </div>
                        <div className="text-xs text-clawd-text-dim">completion</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-clawd-text-dim">In Progress</div>
                        <div className="font-medium text-info">
                          {project.inProgressTasks}
                        </div>
                      </div>
                      <div>
                        <div className="text-clawd-text-dim">Avg Time</div>
                        <div className="font-medium text-warning">
                          {project.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-clawd-text-dim">Total Time</div>
                        <div className="font-medium text-review">
                          {project.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 bg-clawd-border rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-clawd-accent to-blue-400 rounded-full h-2 transition-all"
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
