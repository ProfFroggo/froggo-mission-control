/**
 * Analytics Service
 * Provides comprehensive analytics data for tasks, agents, and productivity
 *
 * Uses REST API endpoints via analyticsApi.
 */

import { analyticsApi } from '../lib/api';

export interface TaskCompletionTrend {
  date: string;
  completed: number;
  created: number;
  total: number;
  completionRate: number;
}

export interface AgentUtilization {
  agentId: string;
  agentName: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksInProgress: number;
  completionRate: number;
  avgCompletionTime: number;
  totalTimeSpent: number;
}

export interface TimeTrackingData {
  taskId: string;
  taskTitle: string;
  project: string;
  agent: string;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  status: string;
}

export interface ProductivityHeatmap {
  date: string;
  dayOfWeek: number;
  hour: number;
  activityCount: number;
}

export interface ProjectStats {
  project: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  avgCompletionTime: number;
  totalTimeSpent: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
  topAgent: string;
  topProject: string;
  totalHours: number;
  insights: string[];
}

export interface MonthlyReport {
  month: string;
  year: number;
  tasksCreated: number;
  tasksCompleted: number;
  completionRate: number;
  agentPerformance: AgentUtilization[];
  projectBreakdown: ProjectStats[];
  totalHours: number;
  insights: string[];
}

// ─── Cached IPC data ──────────────────────────────────────────────────────────

interface IPCAnalyticsData {
  success: boolean;
  days: number;
  completions: Array<{ date: string; tasks_completed: number }>;
  created: Array<{ date: string; tasks_created: number }>;
  agents: Array<{ agent: string; total: number; completed: number }>;
  projects: Array<{ project: string; total: number; completed: number; completion_rate: number }>;
}

let cachedData: IPCAnalyticsData | null = null;
let cachedDays: number = 0;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds

async function fetchAnalyticsData(days: number): Promise<IPCAnalyticsData> {
  const now = Date.now();
  if (cachedData && cachedDays === days && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedData;
  }

  try {
    const [taskStats, agentActivity] = await Promise.all([
      analyticsApi.getTaskStats(days).catch(() => null),
      analyticsApi.getAgentActivity().catch(() => null),
    ]);

    // agentActivity is now a Record<agentId, metrics> — convert to legacy array shape
    const agentsArray = agentActivity && typeof agentActivity === 'object' && !Array.isArray(agentActivity)
      ? Object.entries(agentActivity as Record<string, { totalTasks: number; completedTasks: number }>).map(([id, m]) => ({
          agent: id,
          total: m.totalTasks,
          completed: m.completedTasks,
        }))
      : (Array.isArray(agentActivity)
          ? agentActivity.map((a: { assignedTo: string; taskCount: number }) => ({ agent: a.assignedTo, total: a.taskCount, completed: 0 }))
          : []);

    const result: IPCAnalyticsData = {
      success: true,
      days,
      completions: taskStats?.completions || [],
      created: taskStats?.created || [],
      agents: agentsArray,
      projects: taskStats?.projects || [],
    };

    cachedData = result;
    cachedDays = days;
    cacheTimestamp = now;
    return result;
  } catch (_err) {
    // Analytics API fetch failed
  }

  // Return empty data on failure
  return {
    success: false,
    days,
    completions: [],
    created: [],
    agents: [],
    projects: [],
  };
}

// ─── Public API (matches original interface signatures) ───────────────────────

/**
 * Get task completion trends over time
 */
export async function getTaskCompletionTrends(
  days: number = 30
): Promise<TaskCompletionTrend[]> {
  const data = await fetchAnalyticsData(days);

  // Build a map of completions and creations by date
  const completionMap = new Map<string, number>();
  const createdMap = new Map<string, number>();

  for (const row of data.completions) {
    completionMap.set(row.date, row.tasks_completed);
  }
  for (const row of data.created) {
    createdMap.set(row.date, row.tasks_created);
  }

  // Generate all dates in range
  const trends: TaskCompletionTrend[] = [];
  let runningTotal = 0;

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const completed = completionMap.get(dateStr) || 0;
    const created = createdMap.get(dateStr) || 0;
    runningTotal += created;

    trends.push({
      date: dateStr,
      completed,
      created,
      total: runningTotal,
      completionRate: created > 0 ? Math.round((completed / created) * 100 * 100) / 100 : 0,
    });
  }

  return trends;
}

/**
 * Get agent utilization statistics
 */
export async function getAgentUtilization(): Promise<AgentUtilization[]> {
  const data = await fetchAnalyticsData(30);

  return data.agents.map((agent) => {
    const inProgress = Math.max(0, agent.total - agent.completed);
    const completionRate = agent.total > 0
      ? Math.round((agent.completed / agent.total) * 100 * 100) / 100
      : 0;

    return {
      agentId: agent.agent,
      agentName: agent.agent,
      tasksAssigned: agent.total,
      tasksCompleted: agent.completed,
      tasksInProgress: inProgress,
      completionRate,
      avgCompletionTime: 0, // Not available from IPC data
      totalTimeSpent: 0, // Not available from IPC data
    };
  });
}

/**
 * Get time tracking data for all tasks
 */
export async function getTimeTrackingData(
  _projectFilter?: string
): Promise<TimeTrackingData[]> {
  // Time tracking data is derived from task durations — return empty until REST route exists
  return [];
}

/**
 * Get productivity heatmap data
 */
export async function getProductivityHeatmap(
  days: number = 30
): Promise<ProductivityHeatmap[]> {
  try {
    const result = await analyticsApi.getHeatmap(days).catch(() => null);
    if (!result?.heatmap) return [];
    return (result.heatmap as { dayOfWeek: number; hour: number; activityCount: number; date: string }[])
      .map(r => ({
        date: r.date,
        dayOfWeek: r.dayOfWeek,
        hour: r.hour,
        activityCount: r.activityCount,
      }));
  } catch {
    return [];
  }
}

/**
 * Get project statistics
 */
export async function getProjectStats(): Promise<ProjectStats[]> {
  const data = await fetchAnalyticsData(30);

  return data.projects.map((proj) => ({
    project: proj.project,
    totalTasks: proj.total,
    completedTasks: proj.completed,
    inProgressTasks: Math.max(0, proj.total - proj.completed),
    avgCompletionTime: 0,
    totalTimeSpent: 0,
  }));
}

/**
 * Generate weekly report
 */
export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const data = await fetchAnalyticsData(7);

  const totalCreated = data.created.reduce((sum, r) => sum + r.tasks_created, 0);
  const totalCompleted = data.completions.reduce((sum, r) => sum + r.tasks_completed, 0);
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

  const topAgent = data.agents.length > 0 ? data.agents[0].agent : 'None';
  const topProject = data.projects.length > 0 ? data.projects[0].project : 'None';

  const insights: string[] = [];
  if (completionRate >= 80) insights.push('🎉 Excellent completion rate this week!');
  else if (completionRate < 50) insights.push('⚠️ Completion rate below 50% - consider reviewing task priorities');
  if (topAgent !== 'None') insights.push('🌟 Top performer: ' + topAgent);

  return {
    weekStart: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
    weekEnd: new Date().toISOString().split('T')[0],
    tasksCreated: totalCreated,
    tasksCompleted: totalCompleted,
    completionRate,
    topAgent,
    topProject,
    totalHours: 0,
    insights,
  };
}

/**
 * Generate monthly report
 */
export async function generateMonthlyReport(): Promise<MonthlyReport> {
  const data = await fetchAnalyticsData(30);

  const totalCreated = data.created.reduce((sum, r) => sum + r.tasks_created, 0);
  const totalCompleted = data.completions.reduce((sum, r) => sum + r.tasks_completed, 0);
  const completionRate = totalCreated > 0 ? Math.round((totalCompleted / totalCreated) * 100) : 0;

  const agentPerformance = await getAgentUtilization();
  const projectBreakdown = await getProjectStats();

  const insights: string[] = [];
  if (totalCompleted > 50) insights.push('🚀 Highly productive month with ' + totalCompleted + ' tasks completed');
  if (completionRate >= 75) insights.push('✨ Strong completion rate of ' + completionRate + '%');
  if (agentPerformance.length > 0) insights.push('🏆 ' + agentPerformance[0].agentName + ' completed ' + agentPerformance[0].tasksCompleted + ' tasks');
  if (projectBreakdown.length > 0) insights.push('📊 Most active project: ' + projectBreakdown[0].project + ' (' + projectBreakdown[0].totalTasks + ' tasks)');

  const now = new Date();
  return {
    month: now.toLocaleString('default', { month: 'long' }),
    year: now.getFullYear(),
    tasksCreated: totalCreated,
    tasksCompleted: totalCompleted,
    completionRate,
    agentPerformance: agentPerformance.slice(0, 5),
    projectBreakdown: projectBreakdown.slice(0, 5),
    totalHours: 0,
    insights,
  };
}

/**
 * Get task velocity (tasks created vs completed over time)
 */
export async function getTaskVelocity(days: number = 30): Promise<{
  date: string;
  created: number;
  completed: number;
  velocity: number;
}[]> {
  const data = await fetchAnalyticsData(days);

  const completionMap = new Map<string, number>();
  const createdMap = new Map<string, number>();

  for (const row of data.completions) {
    completionMap.set(row.date, row.tasks_completed);
  }
  for (const row of data.created) {
    createdMap.set(row.date, row.tasks_created);
  }

  const results: { date: string; created: number; completed: number; velocity: number }[] = [];

  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const created = createdMap.get(dateStr) || 0;
    const completed = completionMap.get(dateStr) || 0;

    results.push({
      date: dateStr,
      created,
      completed,
      velocity: completed - created,
    });
  }

  return results;
}

/**
 * Get subtask completion statistics
 */
export async function getSubtaskStats(): Promise<{
  agent: string; total: number; completed: number; completionRate: number;
}[]> {
  try {
    const result = await analyticsApi.getSubtaskStats().catch(() => null);
    return result?.byAgent ?? [];
  } catch {
    return [];
  }
}
