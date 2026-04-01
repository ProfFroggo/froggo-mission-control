/**
 * Protected Panels - All major panels wrapped with error boundaries and lazy loaded
 * 
 * Import these instead of the raw components to get automatic error handling + lazy loading
 */

import { lazy } from 'react';
import { withErrorBoundary } from './ErrorBoundary';

// Conditionally preload the chunk for the view the user is actually landing on.
// On a bandwidth-constrained 4G connection (~1.6 Mbps), unconditionally preloading
// Dashboard (~50 KB gz) wastes bandwidth when the user is navigating to Tasks or
// another view — delaying the chunk they actually need.
const _initialHash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
const _dashboardChunkPreload = (!_initialHash || _initialHash === 'dashboard')
  ? import('./DashboardRedesigned')
  : null;

// Lazy load all panels (Dashboard reuses the pre-started download if available)
const DashboardRaw = lazy(() => _dashboardChunkPreload || import('./DashboardRedesigned'));
const KanbanRaw = lazy(() => import('./Kanban'));
const AgentPanelRaw = lazy(() => import('./AgentPanel'));
const ChatPanelRaw = lazy(() => import('./ChatPanel'));
const MeetingsPanelRaw = lazy(() => import('./MeetingsPanel'));
const VoiceChatPanelRaw = lazy(() => import('./VoiceChatPanel'));
const SettingsPanelRaw = lazy(() => import('./EnhancedSettingsPanel'));
const NotificationsPanelRaw = lazy(() => import('./NotificationsPanelV2'));
const XPanelRaw = lazy(() => import('./XTwitterPage'));
const InboxPanelRaw = lazy(() => import('./InboxPanel'));
const CommsInbox3PaneRaw = lazy(() => import('./CommsInbox3Pane'));
const LibraryPanelRaw = lazy(() => import('./LibraryPanel'));
const SchedulePanelRaw = lazy(() => import('./SchedulePanel'));
const CodeAgentDashboardRaw = lazy(() => import('./CodeAgentDashboard'));
const AnalyticsDashboardRaw = lazy(() => import('./AnalyticsDashboard'));
const ConnectedAccountsPanelRaw = lazy(() => import('./ConnectedAccountsPanel'));
const FinancePanelRaw = lazy(() => import('./FinancePanel'));
const WritingWorkspaceRaw = lazy(() => import('./writing/WritingWorkspace'));
const ModuleBuilderPageRaw = lazy(() => import('./ModuleBuilder/ModuleBuilderPage'));
const WorkflowStudioPanelRaw = lazy(() => import('./WorkflowStudioPanel'));
// Wrap all panels with error boundaries
export const Dashboard = withErrorBoundary(DashboardRaw, 'Dashboard');
export const Kanban = withErrorBoundary(KanbanRaw, 'Kanban Board');
export const AgentPanel = withErrorBoundary(AgentPanelRaw, 'Agent Panel');
export const ChatPanel = withErrorBoundary(ChatPanelRaw, 'Chat Panel');
export const MeetingsPanel = withErrorBoundary(MeetingsPanelRaw, 'Meetings');
export const VoiceChatPanel = withErrorBoundary(VoiceChatPanelRaw, 'Voice Chat');
export const SettingsPanel = withErrorBoundary(SettingsPanelRaw, 'Settings');
export const NotificationsPanel = withErrorBoundary(NotificationsPanelRaw, 'Notifications');
export const XPanel = withErrorBoundary(XPanelRaw, 'Social Media');
export const InboxPanel = withErrorBoundary(InboxPanelRaw, 'Inbox');
export const CommsInbox3Pane = withErrorBoundary(CommsInbox3PaneRaw, 'Communications Inbox 3-Pane');
export const LibraryPanel = withErrorBoundary(LibraryPanelRaw, 'Library');
export const SchedulePanel = withErrorBoundary(SchedulePanelRaw, 'Schedule');
export const CodeAgentDashboard = withErrorBoundary(CodeAgentDashboardRaw, 'Code Agent Dashboard');
export const AnalyticsDashboard = withErrorBoundary(AnalyticsDashboardRaw, 'Analytics');
export const ConnectedAccountsPanel = withErrorBoundary(ConnectedAccountsPanelRaw, 'Connected Accounts');
export const FinancePanel = withErrorBoundary(FinancePanelRaw, 'Finance Manager');
export const WritingWorkspace = withErrorBoundary(WritingWorkspaceRaw, 'Writing Workspace');
export const ModuleBuilderPage = withErrorBoundary(ModuleBuilderPageRaw, 'Module Builder');
export const WorkflowStudio = withErrorBoundary(WorkflowStudioPanelRaw, 'Workflow Studio');
// Export the error boundary itself for custom usage
export { default as ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
