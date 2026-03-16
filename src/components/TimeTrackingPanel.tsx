// LEGACY: TimeTrackingPanel uses file-level suppression for intentional patterns.
// Panel for time tracking - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect } from 'react';
import { Clock, Filter } from 'lucide-react';
import { getTimeTrackingData, getProjectStats, TimeTrackingData, ProjectStats } from '../services/analyticsService';

export default function TimeTrackingPanel() {
  const [tasks, setTasks] = useState<TimeTrackingData[]>([]);
  const [projects, setProjects] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'duration' | 'recent'>('recent');

  useEffect(() => {
    loadData();
  }, [selectedProject]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [timeData, projectData] = await Promise.all([
        getTimeTrackingData(selectedProject === 'all' ? undefined : selectedProject),
        getProjectStats(),
      ]);
      setTasks(timeData);
      setProjects(projectData);
    } catch (error) {
      // 'Failed to load time tracking data:', error;
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Not started';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (sortBy === 'duration') {
      return (b.duration || 0) - (a.duration || 0);
    }
    return (b.startTime || 0) - (a.startTime || 0);
  });

  const totalTime = tasks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const avgTime = tasks.filter(t => t.duration).length > 0
    ? totalTime / tasks.filter(t => t.duration).length
    : 0;
  const activeTasksCount = tasks.filter(t => t.status === 'in-progress').length;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim">Loading time tracking data...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="text-mission-control-accent" size={20} />
            Time Tracking
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Detailed time spent per task and project
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-mission-control-text-dim" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.project} value={p.project}>
                  {p.project}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-mission-control-accent"
          >
            <option value="recent">Most Recent</option>
            <option value="duration">Longest Duration</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="text-sm text-mission-control-text-dim mb-1">Total Time</div>
          <div className="text-2xl font-bold text-info tabular-nums">
            {formatDuration(totalTime)}
          </div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="text-sm text-mission-control-text-dim mb-1">Avg Time/Task</div>
          <div className="text-2xl font-bold text-success tabular-nums">
            {formatDuration(avgTime)}
          </div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="text-sm text-mission-control-text-dim mb-1">Active Tasks</div>
          <div className="text-2xl font-bold text-warning tabular-nums">{activeTasksCount}</div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4">
          <div className="text-sm text-mission-control-text-dim mb-1">Tracked Tasks</div>
          <div className="text-2xl font-bold text-review tabular-nums">{tasks.length}</div>
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="mb-6 bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        <h3 className="font-medium mb-4">Project Time Breakdown</h3>
        <div className="space-y-3">
          {projects.slice(0, 5).map((project) => {
            const percentage = totalTime > 0 
              ? (project.totalTimeSpent / (totalTime / (1000 * 60 * 60))) * 100 
              : 0;
            return (
              <div key={project.project}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{project.project}</span>
                  <span className="text-sm text-mission-control-text-dim tabular-nums">
                    {project.totalTimeSpent.toFixed(1)}h
                  </span>
                </div>
                <div className="h-2 bg-mission-control-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mission-control-accent transition-all"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="sticky top-0 bg-mission-control-bg border-b border-mission-control-border">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Task</th>
                <th className="text-left p-3 text-sm font-medium">Project</th>
                <th className="text-left p-3 text-sm font-medium">Agent</th>
                <th className="text-left p-3 text-sm font-medium">Started</th>
                <th className="text-left p-3 text-sm font-medium">Duration</th>
                <th className="text-left p-3 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedTasks.map((task) => (
                <tr
                  key={task.taskId}
                  className="border-b border-mission-control-border last:border-b-0 hover:bg-mission-control-bg transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium text-sm max-w-xs truncate" title={task.taskTitle}>
                      {task.taskTitle}
                    </div>
                    <div className="text-xs text-mission-control-text-dim">{task.taskId}</div>
                  </td>
                  <td className="p-3 text-sm">{task.project}</td>
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-mission-control-border rounded text-xs">
                      {task.agent}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-mission-control-text-dim">
                    {formatDate(task.startTime)}
                  </td>
                  <td className="p-3 text-sm font-medium tabular-nums">
                    {formatDuration(task.duration)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        task.status === 'done'
                          ? 'bg-success-subtle text-success'
                          : task.status === 'in-progress'
                          ? 'bg-warning-subtle text-warning'
                          : 'bg-info-subtle text-info'
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
