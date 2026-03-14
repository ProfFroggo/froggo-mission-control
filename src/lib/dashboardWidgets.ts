// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Dashboard Widget Definitions
 *
 * Defines all available dashboard widgets, their metadata, and default sizes.
 * Components are referenced by ID and rendered by the Dashboard.
 */

import type { WidgetSize } from '../store/dashboardStore';

export type WidgetCategory = 'tasks' | 'agents' | 'metrics' | 'social' | 'system';

export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  defaultSize: WidgetSize;
  category: WidgetCategory;
}

export const DASHBOARD_WIDGETS: DashboardWidgetDefinition[] = [
  {
    id: 'task-stats',
    title: 'Task Stats',
    description: 'Active, review, pre-review, and human-attention task counts at a glance.',
    defaultSize: 'xl',
    category: 'tasks',
  },
  {
    id: 'agent-activity',
    title: 'Agent Activity',
    description: 'Real-time feed of what agents are working on right now.',
    defaultSize: 'lg',
    category: 'agents',
  },
  {
    id: 'approval-queue',
    title: 'Approval Queue',
    description: 'Pending approvals that require your decision.',
    defaultSize: 'lg',
    category: 'tasks',
  },
  {
    id: 'token-usage',
    title: 'Token Usage',
    description: 'Daily token consumption and cost across all agents.',
    defaultSize: 'md',
    category: 'metrics',
  },
  {
    id: 'kanban-mini',
    title: 'Kanban Mini',
    description: 'Compact kanban board showing tasks across all stages.',
    defaultSize: 'lg',
    category: 'tasks',
  },
  {
    id: 'schedule-upcoming',
    title: 'Upcoming Schedule',
    description: "Today's calendar events with meeting links.",
    defaultSize: 'md',
    category: 'system',
  },
  {
    id: 'inbox-count',
    title: 'Inbox',
    description: 'Unread message and notification count with quick access.',
    defaultSize: 'sm',
    category: 'social',
  },
  {
    id: 'recent-activity',
    title: 'Recent Activity',
    description: 'Combined feed of agent activities and task updates.',
    defaultSize: 'lg',
    category: 'agents',
  },
  {
    id: 'campaign-status',
    title: 'Campaign Status',
    description: 'Active campaign progress and performance metrics.',
    defaultSize: 'md',
    category: 'social',
  },
  {
    id: 'system-health',
    title: 'System Health',
    description: 'Gateway connection, watcher status, and token spend summary.',
    defaultSize: 'md',
    category: 'system',
  },
  {
    id: 'velocity',
    title: 'Velocity',
    description: 'Task completion velocity compared to the previous 7 days.',
    defaultSize: 'md',
    category: 'metrics',
  },
  {
    id: 'agent-productivity',
    title: 'Agent Productivity',
    description: 'Top agents ranked by tasks completed.',
    defaultSize: 'md',
    category: 'agents',
  },
];

export function getWidgetDefinition(id: string): DashboardWidgetDefinition | undefined {
  return DASHBOARD_WIDGETS.find(w => w.id === id);
}
