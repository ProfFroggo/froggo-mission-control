import { useState, useMemo } from 'react';
import { BarChart2, TrendingUp, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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

  // Generate completion trend data for the past 7 days
  const completionTrendData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const completed = myTasks.filter(t => {
        if (t.status !== 'done' || !t.completedAt) return false;
        return new Date(t.completedAt).toISOString().split('T')[0] === dateStr;
      }).length;
      
      data.push({
        day: days[date.getDay()],
        date: dateStr,
        completed,
      });
    }
    
    return data;
  }, [myTasks]);

  const StatCard = ({ icon: Icon, label, value, subtext, color }: {
    icon: any;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
  }) => (
    <div className="p-4 rounded-xl bg-clawd-surface/50 border border-clawd-border">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-sm text-clawd-text-dim">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {subtext && <p className="text-xs text-clawd-text-dim/60 mt-1">{subtext}</p>}
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border">
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
                    : 'bg-clawd-surface text-clawd-text-dim hover:text-white'
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

        {/* Task Completion Trend Chart */}
        <div className="p-6 rounded-xl bg-clawd-surface/50 border border-clawd-border mb-6">
          <h2 className="text-lg font-medium text-white mb-4">Task Completion Trend</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={completionTrendData} margin={{ top: 10, right: 10, left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="day" 
                  stroke="#9CA3AF" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: number) => [value, 'Completed']}
                />
                <Bar 
                  dataKey="completed" 
                  name="Completed" 
                  fill="#22c55e" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-4 rounded-xl bg-clawd-surface/50 border border-clawd-border">
          <h2 className="text-lg font-medium text-white mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {myTasks.slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  task.status === 'done' ? 'bg-green-500' :
                  task.status === 'in-progress' ? 'bg-warning' : 'bg-clawd-text-dim'
                }`} />
                <span className="flex-1 text-clawd-text truncate">{task.title}</span>
                <span className="text-xs text-clawd-text-dim capitalize">{task.status}</span>
              </div>
            ))}
            {myTasks.length === 0 && (
              <p className="text-clawd-text-dim text-center py-4">No tasks yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
