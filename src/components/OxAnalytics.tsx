import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useStore } from '../store/store';

interface PerformanceStats {
  tasksCompleted: number;
  tasksInProgress: number;
  avgCompletionTime: number; // minutes
  successRate: number; // percentage
  subtasksCompleted: number;
  totalHoursWorked: number;
}

export default function OxAnalytics() {
  const { tasks } = useStore();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  
  // Calculate stats from tasks assigned to ox/worker
  const myTasks = tasks.filter(t => 
    t.assignedTo === 'ox' || 
    t.assignedTo === 'worker' || 
    t.assignedTo === 'onchain_worker'
  );
  
  const stats: PerformanceStats = {
    tasksCompleted: myTasks.filter(t => t.status === 'done').length,
    tasksInProgress: myTasks.filter(t => t.status === 'in-progress').length,
    avgCompletionTime: 45, // Would calculate from actual data
    successRate: myTasks.length > 0 
      ? Math.round((myTasks.filter(t => t.status === 'done').length / myTasks.length) * 100)
      : 0,
    subtasksCompleted: myTasks.reduce((acc, t) => 
      acc + (t.subtasks?.filter((s: any) => s.done).length || 0), 0
    ),
    totalHoursWorked: 12.5, // Would calculate from activity logs
  };

  const StatCard = ({ icon: Icon, label, value, subtext, color }: {
    icon: any;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
  }) => (
    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 className="text-amber-500" size={24} />
            <h1 className="text-xl font-semibold text-white">Analytics</h1>
          </div>
          
          {/* Time Range Filter */}
          <div className="flex gap-2">
            {['today', 'week', 'month'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range as any)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  timeRange === range 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={CheckCircle}
            label="Tasks Completed"
            value={stats.tasksCompleted}
            subtext="All time"
            color="bg-green-600"
          />
          <StatCard
            icon={TrendingUp}
            label="Success Rate"
            value={`${stats.successRate}%`}
            subtext="Completion rate"
            color="bg-amber-600"
          />
          <StatCard
            icon={Clock}
            label="Avg Completion"
            value={`${stats.avgCompletionTime}m`}
            subtext="Per task"
            color="bg-blue-600"
          />
          <StatCard
            icon={AlertCircle}
            label="In Progress"
            value={stats.tasksInProgress}
            subtext="Active now"
            color="bg-purple-600"
          />
          <StatCard
            icon={Calendar}
            label="Hours Worked"
            value={stats.totalHoursWorked}
            subtext="This period"
            color="bg-indigo-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Subtasks Done"
            value={stats.subtasksCompleted}
            subtext="Total completed"
            color="bg-teal-600"
          />
        </div>

        {/* Performance Chart Placeholder */}
        <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 mb-6">
          <h2 className="text-lg font-medium text-white mb-4">Task Completion Trend</h2>
          <div className="h-48 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <BarChart2 size={48} className="mx-auto mb-2 opacity-50" />
              <p>Chart visualization coming soon</p>
              <p className="text-xs">Will show completion trends over time</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
          <h2 className="text-lg font-medium text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {myTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  task.status === 'done' ? 'bg-green-500' :
                  task.status === 'in-progress' ? 'bg-amber-500' : 'bg-slate-500'
                }`} />
                <span className="flex-1 text-slate-300 truncate">{task.title}</span>
                <span className="text-xs text-slate-500 capitalize">{task.status}</span>
              </div>
            ))}
            {myTasks.length === 0 && (
              <p className="text-slate-500 text-center py-4">No tasks yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
