import { useState, useEffect } from 'react';
import { Clock, Play, TrendingUp } from 'lucide-react';
import { getTimeTrackingData, type TimeTrackingData } from '../../services/analyticsService';
import { Spinner } from '../LoadingStates';

interface TimeTrackingPanelProps {
  timeRange: string;
}

export default function TimeTrackingPanel({ timeRange }: TimeTrackingPanelProps) {
  const [data, setData] = useState<TimeTrackingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const timeData = await getTimeTrackingData();
      setData(timeData);
    } catch (error) {
      console.error('Failed to load time tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data
  const filteredData = data.filter((item) => {
    if (projectFilter && item.project !== projectFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  // Get unique projects
  const projects = Array.from(new Set(data.map((d) => d.project))).sort();

  // Calculate stats
  const totalTime = filteredData.reduce((sum, d) => sum + (d.duration || 0), 0) / (1000 * 60 * 60); // Convert to hours
  const avgTime = filteredData.length > 0 ? totalTime / filteredData.length : 0;
  const inProgressCount = filteredData.filter((d) => d.status === 'in-progress').length;

  const formatDuration = (ms: number | null): string => {
    if (!ms) return '-';
    const hours = ms / (1000 * 60 * 60);
    if (hours < 1) {
      const minutes = ms / (1000 * 60);
      return `${Math.round(minutes)}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'done':
        return 'text-green-400 bg-green-500/20';
      case 'in-progress':
        return 'text-blue-400 bg-blue-500/20';
      case 'review':
        return 'text-purple-400 bg-purple-500/20';
      case 'blocked':
        return 'text-red-400 bg-red-500/20';
      default:
        return 'text-clawd-text-dim bg-clawd-border';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Clock size={16} className="text-clawd-accent" />
            Time Tracking
          </h3>
          <p className="text-sm text-clawd-text-dim mt-1">
            Detailed time tracking for all tasks
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawd-accent"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-clawd-surface border border-clawd-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-clawd-accent"
          >
            <option value="all">All Status</option>
            <option value="in-progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock size={16} className="text-orange-400" />
            <TrendingUp size={14} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400">{totalTime.toFixed(1)}h</div>
          <div className="text-sm text-clawd-text-dim">Total Time</div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock size={16} className="text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400">{avgTime.toFixed(1)}h</div>
          <div className="text-sm text-clawd-text-dim">Avg Per Task</div>
        </div>

        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Play size={16} className="text-green-400" />
          </div>
          <div className="text-2xl font-bold text-green-400">{inProgressCount}</div>
          <div className="text-sm text-clawd-text-dim">In Progress</div>
        </div>
      </div>

      {/* Time entries table */}
      <div className="bg-clawd-surface border border-clawd-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-clawd-bg border-b border-clawd-border">
              <tr className="text-left text-xs text-clawd-text-dim">
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clawd-border">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-clawd-text-dim">
                    No time tracking data available
                  </td>
                </tr>
              ) : (
                filteredData.slice(0, 50).map((item) => (
                  <tr
                    key={item.taskId}
                    className="hover:bg-clawd-bg/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium truncate max-w-xs" title={item.taskTitle}>
                        {item.taskTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-clawd-text-dim">{item.project}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-clawd-text-dim">{item.agent}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-clawd-text-dim">
                      {item.startTime
                        ? new Date(item.startTime).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-clawd-accent">
                        {formatDuration(item.duration)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'in-progress' && (
                        <div className="flex items-center gap-1 text-xs text-blue-400">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          Active
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredData.length > 50 && (
          <div className="px-4 py-3 bg-clawd-bg border-t border-clawd-border text-center text-sm text-clawd-text-dim">
            Showing 50 of {filteredData.length} entries
          </div>
        )}
      </div>

      {/* Time distribution by project */}
      {projects.length > 0 && (
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6">
          <h4 className="font-semibold mb-4">Time Distribution by Project</h4>
          <div className="space-y-3">
            {projects.map((project) => {
              const projectData = data.filter((d) => d.project === project);
              const projectTime =
                projectData.reduce((sum, d) => sum + (d.duration || 0), 0) /
                (1000 * 60 * 60);
              const percentage = totalTime > 0 ? (projectTime / totalTime) * 100 : 0;

              return (
                <div key={project}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{project}</span>
                    <span className="text-clawd-text-dim">
                      {projectTime.toFixed(1)}h ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="bg-clawd-bg rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-clawd-accent to-purple-400 rounded-full h-2 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
