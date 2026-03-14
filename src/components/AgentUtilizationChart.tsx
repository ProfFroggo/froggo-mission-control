import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Users, Award, Clock } from 'lucide-react';
import { getAgentUtilization, AgentUtilization } from '../services/analyticsService';
import { CHART_COLORS, CHART_GRID, CHART_AXIS } from '../lib/chartTheme';

const AGENT_COLORS: { [key: string]: string } = {
  coder: CHART_COLORS.blue,
  researcher: CHART_COLORS.purple,
  writer: CHART_COLORS.green,
  chief: CHART_COLORS.amber,
  unassigned: CHART_COLORS.gray,
};

export default function AgentUtilizationChart() {
  const [data, setData] = useState<AgentUtilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'bar' | 'pie'>('bar');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const utilization = await getAgentUtilization();
      setData(utilization);
    } catch (error) {
      // 'Failed to load agent utilization:', error;
    } finally {
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-2">{data.agentName}</p>
          <p className="text-sm text-info">Assigned: {data.tasksAssigned}</p>
          <p className="text-sm text-success">Completed: {data.tasksCompleted}</p>
          <p className="text-sm text-warning">In Progress: {data.tasksInProgress}</p>
          <p className="text-sm text-review">Completion Rate: {data.completionRate}%</p>
          <p className="text-sm text-warning">Avg Time: {data.avgCompletionTime.toFixed(1)}h</p>
          <p className="text-sm text-pink-400">Total Time: {data.totalTimeSpent.toFixed(1)}h</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim">Loading agent data...</div>
      </div>
    );
  }

  const topAgent = data[0];
  const totalTasks = data.reduce((sum, d) => sum + d.tasksAssigned, 0);
  const totalHours = data.reduce((sum, d) => sum + d.totalTimeSpent, 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="text-mission-control-accent" size={20} />
            Agent Utilization
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Performance metrics for each agent
          </p>
        </div>

        <div className="flex bg-mission-control-border rounded-lg p-1">
          {(['bar', 'pie'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                viewMode === mode
                  ? 'bg-mission-control-accent text-white'
                  : 'text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-sm text-mission-control-text-dim mb-1 flex items-center gap-2">
            <Award size={16} className="text-warning" />
            Top Performer
          </div>
          <div className="text-xl font-bold">
            {topAgent ? topAgent.agentName : 'None'}
          </div>
          {topAgent && (
            <div className="text-sm text-mission-control-text-dim mt-1">
              {topAgent.tasksCompleted} tasks completed
            </div>
          )}
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-sm text-mission-control-text-dim mb-1">Total Tasks</div>
          <div className="text-2xl font-bold text-info">{totalTasks}</div>
        </div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4">
          <div className="text-sm text-mission-control-text-dim mb-1 flex items-center gap-2">
            <Clock size={16} className="text-warning" />
            Total Hours
          </div>
          <div className="text-2xl font-bold text-warning">
            {totalHours.toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
        {viewMode === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray={CHART_GRID.strokeDasharray} stroke={CHART_GRID.stroke} />
              <XAxis dataKey="agentName" stroke={CHART_AXIS.stroke} />
              <YAxis stroke={CHART_AXIS.stroke} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="tasksCompleted" name="Completed" fill={CHART_COLORS.green} />
              <Bar dataKey="tasksInProgress" name="In Progress" fill={CHART_COLORS.amber} />
              <Bar dataKey="tasksAssigned" name="Total Assigned" fill={CHART_COLORS.blue} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="tasksCompleted"
                nameKey="agentName"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }: any) =>
                  `${name || ''}: ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={AGENT_COLORS[entry.agentId] || CHART_COLORS.gray}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Agent Details Table */}
      <div className="mt-6 bg-mission-control-surface border border-mission-control-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-mission-control-bg border-b border-mission-control-border">
            <tr>
              <th className="text-left p-3 text-sm font-medium">Agent</th>
              <th className="text-right p-3 text-sm font-medium">Assigned</th>
              <th className="text-right p-3 text-sm font-medium">Completed</th>
              <th className="text-right p-3 text-sm font-medium">Rate</th>
              <th className="text-right p-3 text-sm font-medium">Avg Time</th>
              <th className="text-right p-3 text-sm font-medium">Total Time</th>
            </tr>
          </thead>
          <tbody>
            {data.map((agent) => (
              <tr key={agent.agentId} className="border-b border-mission-control-border last:border-b-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: AGENT_COLORS[agent.agentId] || CHART_COLORS.gray }}
                    />
                    <span className="font-medium">{agent.agentName}</span>
                  </div>
                </td>
                <td className="p-3 text-right text-info">{agent.tasksAssigned}</td>
                <td className="p-3 text-right text-success">{agent.tasksCompleted}</td>
                <td className="p-3 text-right">
                  <span
                    className={
                      agent.completionRate >= 80
                        ? 'text-success'
                        : agent.completionRate >= 50
                        ? 'text-warning'
                        : 'text-error'
                    }
                  >
                    {agent.completionRate}%
                  </span>
                </td>
                <td className="p-3 text-right text-mission-control-text-dim">
                  {agent.avgCompletionTime.toFixed(1)}h
                </td>
                <td className="p-3 text-right text-warning">
                  {agent.totalTimeSpent.toFixed(1)}h
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
