/**
 * Analytics Service
 * Provides comprehensive analytics data for tasks, agents, and productivity
 */

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
  avgCompletionTime: number; // in hours
  totalTimeSpent: number; // in hours
}

export interface TimeTrackingData {
  taskId: string;
  taskTitle: string;
  project: string;
  agent: string;
  startTime: number;
  endTime: number | null;
  duration: number | null; // in milliseconds
  status: string;
}

export interface ProductivityHeatmap {
  date: string;
  dayOfWeek: number; // 0 = Sunday
  hour: number;
  activityCount: number;
}

export interface ProjectStats {
  project: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  avgCompletionTime: number; // in hours
  totalTimeSpent: number; // in hours
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

/**
 * Get task completion trends over time
 */
export async function getTaskCompletionTrends(
  days: number = 30
): Promise<TaskCompletionTrend[]> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

  const query = `
    WITH RECURSIVE
      dates(date) AS (
        SELECT date('now', '-${days} days')
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now')
      ),
      daily_stats AS (
        SELECT 
          date(created_at / 1000, 'unixepoch') as date,
          COUNT(*) as created,
          SUM(CASE WHEN status = 'done' AND completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed
        FROM tasks
        WHERE created_at >= ${cutoffDate}
        GROUP BY date
      )
    SELECT 
      dates.date,
      COALESCE(ds.created, 0) as created,
      COALESCE(ds.completed, 0) as completed,
      (SELECT COUNT(*) FROM tasks WHERE created_at <= strftime('%s', dates.date || ' 23:59:59') * 1000) as total,
      CASE 
        WHEN COALESCE(ds.created, 0) > 0 
        THEN ROUND(CAST(COALESCE(ds.completed, 0) AS FLOAT) / ds.created * 100, 2)
        ELSE 0 
      END as completionRate
    FROM dates
    LEFT JOIN daily_stats ds ON dates.date = ds.date
    ORDER BY dates.date;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows.map((row: any) => ({
    date: row.date,
    completed: row.completed,
    created: row.created,
    total: row.total,
    completionRate: row.completionRate,
  }));
}

/**
 * Get agent utilization statistics
 */
export async function getAgentUtilization(): Promise<AgentUtilization[]> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const query = `
    SELECT 
      COALESCE(assigned_to, 'unassigned') as agentId,
      COALESCE(assigned_to, 'unassigned') as agentName,
      COUNT(*) as tasksAssigned,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as tasksCompleted,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as tasksInProgress,
      ROUND(
        CASE 
          WHEN COUNT(*) > 0 
          THEN CAST(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100
          ELSE 0 
        END, 
        2
      ) as completionRate,
      ROUND(
        AVG(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            ELSE NULL 
          END
        ),
        2
      ) as avgCompletionTime,
      ROUND(
        SUM(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            WHEN started_at IS NOT NULL AND status = 'in-progress'
            THEN (strftime('%s', 'now') * 1000 - started_at) / 1000.0 / 3600.0
            ELSE 0 
          END
        ),
        2
      ) as totalTimeSpent
    FROM tasks
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
    ORDER BY tasksCompleted DESC;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows.map((row: any) => ({
    agentId: row.agentId,
    agentName: row.agentName,
    tasksAssigned: row.tasksAssigned,
    tasksCompleted: row.tasksCompleted,
    tasksInProgress: row.tasksInProgress,
    completionRate: row.completionRate,
    avgCompletionTime: row.avgCompletionTime || 0,
    totalTimeSpent: row.totalTimeSpent || 0,
  }));
}

/**
 * Get time tracking data for all tasks
 */
export async function getTimeTrackingData(
  projectFilter?: string
): Promise<TimeTrackingData[]> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const whereClause = projectFilter ? `WHERE project = ?` : '';
  const params = projectFilter ? [projectFilter] : [];

  const query = `
    SELECT 
      id as taskId,
      title as taskTitle,
      COALESCE(project, 'Uncategorized') as project,
      COALESCE(assigned_to, 'unassigned') as agent,
      started_at as startTime,
      completed_at as endTime,
      CASE 
        WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
        THEN completed_at - started_at
        WHEN started_at IS NOT NULL AND status = 'in-progress'
        THEN strftime('%s', 'now') * 1000 - started_at
        ELSE NULL 
      END as duration,
      status
    FROM tasks
    ${whereClause}
    ORDER BY started_at DESC NULLS LAST;
  `;

  const result = await db.query(query, params);
  await db.close();

  return result.rows.map((row: any) => ({
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    project: row.project,
    agent: row.agent,
    startTime: row.startTime,
    endTime: row.endTime,
    duration: row.duration,
    status: row.status,
  }));
}

/**
 * Get productivity heatmap data (activity by day and hour)
 */
export async function getProductivityHeatmap(
  days: number = 30
): Promise<ProductivityHeatmap[]> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

  const query = `
    SELECT 
      date(timestamp / 1000, 'unixepoch') as date,
      CAST(strftime('%w', timestamp / 1000, 'unixepoch') AS INTEGER) as dayOfWeek,
      CAST(strftime('%H', timestamp / 1000, 'unixepoch') AS INTEGER) as hour,
      COUNT(*) as activityCount
    FROM task_activity
    WHERE timestamp >= ${cutoffDate}
    GROUP BY date, dayOfWeek, hour
    ORDER BY date, hour;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows.map((row: any) => ({
    date: row.date,
    dayOfWeek: row.dayOfWeek,
    hour: row.hour,
    activityCount: row.activityCount,
  }));
}

/**
 * Get project statistics
 */
export async function getProjectStats(): Promise<ProjectStats[]> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const query = `
    SELECT 
      COALESCE(project, 'Uncategorized') as project,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as inProgressTasks,
      ROUND(
        AVG(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            ELSE NULL 
          END
        ),
        2
      ) as avgCompletionTime,
      ROUND(
        SUM(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            WHEN started_at IS NOT NULL AND status = 'in-progress'
            THEN (strftime('%s', 'now') * 1000 - started_at) / 1000.0 / 3600.0
            ELSE 0 
          END
        ),
        2
      ) as totalTimeSpent
    FROM tasks
    GROUP BY project
    ORDER BY totalTasks DESC;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows.map((row: any) => ({
    project: row.project,
    totalTasks: row.totalTasks,
    completedTasks: row.completedTasks,
    inProgressTasks: row.inProgressTasks,
    avgCompletionTime: row.avgCompletionTime || 0,
    totalTimeSpent: row.totalTimeSpent || 0,
  }));
}

/**
 * Generate weekly report
 */
export async function generateWeeklyReport(): Promise<WeeklyReport> {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const weekStartTs = weekStart.getTime();
  const weekEndTs = weekEnd.getTime();

  // Get basic stats
  const statsQuery = `
    SELECT 
      COUNT(*) as created,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
      ROUND(
        SUM(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            ELSE 0 
          END
        ),
        2
      ) as totalHours
    FROM tasks
    WHERE created_at BETWEEN ${weekStartTs} AND ${weekEndTs};
  `;

  const statsResult = await db.query(statsQuery);
  const stats = statsResult.rows[0];

  // Get top agent
  const agentQuery = `
    SELECT assigned_to, COUNT(*) as count
    FROM tasks
    WHERE created_at BETWEEN ${weekStartTs} AND ${weekEndTs}
      AND status = 'done'
      AND assigned_to IS NOT NULL
    GROUP BY assigned_to
    ORDER BY count DESC
    LIMIT 1;
  `;

  const agentResult = await db.query(agentQuery);
  const topAgent = agentResult.rows[0]?.assigned_to || 'None';

  // Get top project
  const projectQuery = `
    SELECT project, COUNT(*) as count
    FROM tasks
    WHERE created_at BETWEEN ${weekStartTs} AND ${weekEndTs}
      AND project IS NOT NULL
    GROUP BY project
    ORDER BY count DESC
    LIMIT 1;
  `;

  const projectResult = await db.query(projectQuery);
  const topProject = projectResult.rows[0]?.project || 'None';

  await db.close();

  const completionRate = stats.created > 0 
    ? Math.round((stats.completed / stats.created) * 100) 
    : 0;

  // Generate insights
  const insights: string[] = [];
  if (completionRate >= 80) {
    insights.push('🎉 Excellent completion rate this week!');
  } else if (completionRate < 50) {
    insights.push('⚠️ Completion rate below 50% - consider reviewing task priorities');
  }
  
  if (stats.totalHours > 40) {
    insights.push('💪 High productivity week with ' + stats.totalHours.toFixed(1) + ' hours logged');
  }
  
  if (topAgent !== 'None') {
    insights.push('🌟 Top performer: ' + topAgent);
  }

  return {
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
    tasksCreated: stats.created,
    tasksCompleted: stats.completed,
    completionRate,
    topAgent,
    topProject,
    totalHours: stats.totalHours || 0,
    insights,
  };
}

/**
 * Generate monthly report
 */
export async function generateMonthlyReport(): Promise<MonthlyReport> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthStartTs = monthStart.getTime();
  const monthEndTs = monthEnd.getTime();

  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  // Get basic stats
  const statsQuery = `
    SELECT 
      COUNT(*) as created,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed,
      ROUND(
        SUM(
          CASE 
            WHEN started_at IS NOT NULL AND completed_at IS NOT NULL 
            THEN (completed_at - started_at) / 1000.0 / 3600.0
            ELSE 0 
          END
        ),
        2
      ) as totalHours
    FROM tasks
    WHERE created_at BETWEEN ${monthStartTs} AND ${monthEndTs};
  `;

  const statsResult = await db.query(statsQuery);
  const stats = statsResult.rows[0];

  await db.close();

  // Get agent performance and project breakdown using existing functions
  const agentPerformance = await getAgentUtilization();
  const projectBreakdown = await getProjectStats();

  const completionRate = stats.created > 0 
    ? Math.round((stats.completed / stats.created) * 100) 
    : 0;

  // Generate insights
  const insights: string[] = [];
  if (stats.completed > 50) {
    insights.push('🚀 Highly productive month with ' + stats.completed + ' tasks completed');
  }
  
  if (completionRate >= 75) {
    insights.push('✨ Strong completion rate of ' + completionRate + '%');
  }
  
  const topAgent = agentPerformance[0];
  if (topAgent) {
    insights.push('🏆 ' + topAgent.agentName + ' completed ' + topAgent.tasksCompleted + ' tasks');
  }
  
  const topProject = projectBreakdown[0];
  if (topProject) {
    insights.push('📊 Most active project: ' + topProject.project + ' (' + topProject.totalTasks + ' tasks)');
  }

  return {
    month: monthStart.toLocaleString('default', { month: 'long' }),
    year: monthStart.getFullYear(),
    tasksCreated: stats.created,
    tasksCompleted: stats.completed,
    completionRate,
    agentPerformance: agentPerformance.slice(0, 5), // Top 5 agents
    projectBreakdown: projectBreakdown.slice(0, 5), // Top 5 projects
    totalHours: stats.totalHours || 0,
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
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

  const query = `
    WITH RECURSIVE
      dates(date) AS (
        SELECT date('now', '-${days} days')
        UNION ALL
        SELECT date(date, '+1 day')
        FROM dates
        WHERE date < date('now')
      )
    SELECT 
      dates.date,
      COALESCE((
        SELECT COUNT(*) 
        FROM tasks 
        WHERE date(created_at / 1000, 'unixepoch') = dates.date
      ), 0) as created,
      COALESCE((
        SELECT COUNT(*) 
        FROM tasks 
        WHERE date(completed_at / 1000, 'unixepoch') = dates.date 
          AND status = 'done'
      ), 0) as completed,
      COALESCE((
        SELECT COUNT(*) 
        FROM tasks 
        WHERE date(completed_at / 1000, 'unixepoch') = dates.date 
          AND status = 'done'
      ), 0) - COALESCE((
        SELECT COUNT(*) 
        FROM tasks 
        WHERE date(created_at / 1000, 'unixepoch') = dates.date
      ), 0) as velocity
    FROM dates
    ORDER BY dates.date;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows.map((row: any) => ({
    date: row.date,
    created: row.created,
    completed: row.completed,
    velocity: row.velocity,
  }));
}

/**
 * Get subtask completion statistics
 */
export async function getSubtaskStats() {
  const db = await (window as any).clawdbot?.db?.connect();
  if (!db) throw new Error('Database not available');

  const query = `
    SELECT 
      t.id as taskId,
      t.title as taskTitle,
      COUNT(s.id) as totalSubtasks,
      SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) as completedSubtasks,
      ROUND(
        CASE 
          WHEN COUNT(s.id) > 0 
          THEN CAST(SUM(CASE WHEN s.completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(s.id) * 100
          ELSE 0 
        END,
        2
      ) as completionRate
    FROM tasks t
    LEFT JOIN subtasks s ON t.id = s.task_id
    WHERE t.status != 'done'
    GROUP BY t.id, t.title
    HAVING COUNT(s.id) > 0
    ORDER BY completionRate ASC;
  `;

  const result = await db.query(query);
  await db.close();

  return result.rows;
}
