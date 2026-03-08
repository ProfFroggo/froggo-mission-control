import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, TrendingUp, Award, Clock } from 'lucide-react';
import {
  generateWeeklyReport,
  generateMonthlyReport,
  WeeklyReport,
  MonthlyReport,
} from '../services/analyticsService';

type ReportType = 'weekly' | 'monthly';

export default function ReportsPanel() {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [weekly, monthly] = await Promise.all([
        generateWeeklyReport(),
        generateMonthlyReport(),
      ]);
      setWeeklyReport(weekly);
      setMonthlyReport(monthly);
    } catch (error) {
      // 'Failed to generate reports:', error;
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (type: ReportType) => {
    const report = type === 'weekly' ? weeklyReport : monthlyReport;
    if (!report) return;

    let content = '';
    if (type === 'weekly') {
      const w = report as WeeklyReport;
      content = `# Weekly Report\n\n`;
      content += `**Week:** ${w.weekStart} to ${w.weekEnd}\n\n`;
      content += `## Summary\n\n`;
      content += `- Tasks Created: ${w.tasksCreated}\n`;
      content += `- Tasks Completed: ${w.tasksCompleted}\n`;
      content += `- Completion Rate: ${w.completionRate}%\n`;
      content += `- Total Hours: ${w.totalHours}h\n\n`;
      content += `## Highlights\n\n`;
      content += `- Top Agent: ${w.topAgent}\n`;
      content += `- Top Project: ${w.topProject}\n\n`;
      content += `## Insights\n\n`;
      w.insights.forEach((insight) => {
        content += `- ${insight}\n`;
      });
    } else {
      const m = report as MonthlyReport;
      content = `# Monthly Report\n\n`;
      content += `**Month:** ${m.month} ${m.year}\n\n`;
      content += `## Summary\n\n`;
      content += `- Tasks Created: ${m.tasksCreated}\n`;
      content += `- Tasks Completed: ${m.tasksCompleted}\n`;
      content += `- Completion Rate: ${m.completionRate}%\n`;
      content += `- Total Hours: ${m.totalHours}h\n\n`;
      content += `## Agent Performance\n\n`;
      m.agentPerformance.forEach((agent) => {
        content += `### ${agent.agentName}\n`;
        content += `- Completed: ${agent.tasksCompleted} tasks\n`;
        content += `- Completion Rate: ${agent.completionRate}%\n`;
        content += `- Total Time: ${agent.totalTimeSpent}h\n\n`;
      });
      content += `## Project Breakdown\n\n`;
      m.projectBreakdown.forEach((project) => {
        content += `### ${project.project}\n`;
        content += `- Total Tasks: ${project.totalTasks}\n`;
        content += `- Completed: ${project.completedTasks}\n`;
        content += `- Time Spent: ${project.totalTimeSpent}h\n\n`;
      });
      content += `## Insights\n\n`;
      m.insights.forEach((insight) => {
        content += `- ${insight}\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-mission-control-text-dim">Generating reports...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="text-mission-control-accent" size={20} />
            Productivity Reports
          </h2>
          <p className="text-sm text-mission-control-text-dim mt-1">
            Weekly and monthly performance summaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Report type selector */}
          <div className="flex bg-mission-control-border rounded-lg p-1">
            {(['weekly', 'monthly'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`px-3 py-2 rounded text-sm font-medium transition-colors capitalize ${
                  reportType === type
                    ? 'bg-mission-control-accent text-white'
                    : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Export button */}
          <button
            onClick={() => exportReport(reportType)}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto">
        {reportType === 'weekly' && weeklyReport && (
          <div className="space-y-6">
            {/* Week Header */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-mission-control-accent mb-2">
                <Calendar size={20} />
                <span className="font-medium">Week of {weeklyReport.weekStart}</span>
              </div>
              <p className="text-sm text-mission-control-text-dim">
                {weeklyReport.weekStart} to {weeklyReport.weekEnd}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Tasks Created</div>
                <div className="text-3xl font-bold text-info">
                  {weeklyReport.tasksCreated}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Tasks Completed</div>
                <div className="text-3xl font-bold text-success">
                  {weeklyReport.tasksCompleted}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Completion Rate</div>
                <div className="text-3xl font-bold text-review">
                  {weeklyReport.completionRate}%
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Total Hours</div>
                <div className="text-3xl font-bold text-warning">
                  {weeklyReport.totalHours.toFixed(1)}h
                </div>
              </div>
            </div>

            {/* Highlights */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Award size={16} className="text-warning" />
                Highlights
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-mission-control-bg rounded-xl">
                  <div className="text-sm text-mission-control-text-dim mb-2">Top Performer</div>
                  <div className="text-xl font-bold text-warning">
                    {weeklyReport.topAgent}
                  </div>
                </div>
                <div className="p-4 bg-mission-control-bg rounded-xl">
                  <div className="text-sm text-mission-control-text-dim mb-2">Most Active Project</div>
                  <div className="text-xl font-bold text-info">
                    {weeklyReport.topProject}
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-mission-control-accent" />
                Insights
              </h3>
              <div className="space-y-3">
                {weeklyReport.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-mission-control-bg rounded-xl text-sm"
                  >
                    {insight}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {reportType === 'monthly' && monthlyReport && (
          <div className="space-y-6">
            {/* Month Header */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <div className="flex items-center gap-2 text-mission-control-accent mb-2">
                <Calendar size={20} />
                <span className="font-medium">
                  {monthlyReport.month} {monthlyReport.year}
                </span>
              </div>
              <p className="text-sm text-mission-control-text-dim">Monthly Performance Report</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Tasks Created</div>
                <div className="text-3xl font-bold text-info">
                  {monthlyReport.tasksCreated}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Tasks Completed</div>
                <div className="text-3xl font-bold text-success">
                  {monthlyReport.tasksCompleted}
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Completion Rate</div>
                <div className="text-3xl font-bold text-review">
                  {monthlyReport.completionRate}%
                </div>
              </div>
              <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
                <div className="text-sm text-mission-control-text-dim mb-2">Total Hours</div>
                <div className="text-3xl font-bold text-warning">
                  {monthlyReport.totalHours.toFixed(1)}h
                </div>
              </div>
            </div>

            {/* Agent Performance */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Award size={16} className="text-warning" />
                Agent Performance
              </h3>
              <div className="space-y-3">
                {monthlyReport.agentPerformance.map((agent) => (
                  <div
                    key={agent.agentId}
                    className="p-4 bg-mission-control-bg rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{agent.agentName}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {agent.tasksCompleted} completed
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-mission-control-text-dim">Completion Rate</div>
                        <div className="font-medium text-success">
                          {agent.completionRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Avg Time</div>
                        <div className="font-medium text-info">
                          {agent.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Total Time</div>
                        <div className="font-medium text-warning">
                          {agent.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Breakdown */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock size={16} className="text-mission-control-accent" />
                Project Breakdown
              </h3>
              <div className="space-y-3">
                {monthlyReport.projectBreakdown.map((project) => (
                  <div
                    key={project.project}
                    className="p-4 bg-mission-control-bg rounded-xl"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium">{project.project}</span>
                      <span className="text-sm text-mission-control-text-dim">
                        {project.totalTasks} tasks
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-mission-control-text-dim">Completed</div>
                        <div className="font-medium text-success">
                          {project.completedTasks}
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Avg Time</div>
                        <div className="font-medium text-info">
                          {project.avgCompletionTime.toFixed(1)}h
                        </div>
                      </div>
                      <div>
                        <div className="text-mission-control-text-dim">Total Time</div>
                        <div className="font-medium text-warning">
                          {project.totalTimeSpent.toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insights */}
            <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-mission-control-accent" />
                Insights
              </h3>
              <div className="space-y-3">
                {monthlyReport.insights.map((insight, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-mission-control-bg rounded-xl text-sm"
                  >
                    {insight}
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
