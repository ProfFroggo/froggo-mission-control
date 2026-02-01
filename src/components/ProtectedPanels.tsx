/**
 * Protected Panels - All major panels wrapped with error boundaries and lazy loaded
 * 
 * Import these instead of the raw components to get automatic error handling + lazy loading
 */

import { lazy } from 'react';
import { withErrorBoundary } from './ErrorBoundary';

// Lazy load all panels
const DashboardRaw = lazy(() => import('./Dashboard'));
const KanbanRaw = lazy(() => import('./Kanban'));
const AgentPanelRaw = lazy(() => import('./AgentPanel'));
const ChatPanelRaw = lazy(() => import('./ChatPanel'));
const MeetingsPanelRaw = lazy(() => import('./MeetingsPanel'));
const SettingsPanelRaw = lazy(() => import('./EnhancedSettingsPanel'));
const NotificationsPanelRaw = lazy(() => import('./NotificationsPanelV2'));
const XPanelRaw = lazy(() => import('./XPanel'));
const InboxPanelRaw = lazy(() => import('./InboxPanel'));
const ThreePaneInboxRaw = lazy(() => import('./ThreePaneInbox'));
const CommsInboxRaw = lazy(() => import('./CommsInbox'));
const UnifiedCommsInboxRaw = lazy(() => import('./UnifiedCommsInbox'));
const CommsInbox3PaneRaw = lazy(() => import('./CommsInbox3Pane'));
const LibraryPanelRaw = lazy(() => import('./LibraryPanel'));
const CalendarPanelRaw = lazy(() => import('./CalendarPanel'));
const SchedulePanelRaw = lazy(() => import('./SchedulePanel'));
const CodeAgentDashboardRaw = lazy(() => import('./CodeAgentDashboard'));
const ContextControlBoardRaw = lazy(() => import('./ContextControlBoard'));
const ContentCalendarRaw = lazy(() => import('./ContentCalendar'));
const AnalyticsDashboardRaw = lazy(() => import('./AnalyticsDashboard'));
const ConnectedAccountsPanelRaw = lazy(() => import('./ConnectedAccountsPanel'));
const StarredMessagesPanelRaw = lazy(() => import('./StarredMessagesPanel'));
const VoiceChatPanelRaw = lazy(() => import('./VoiceChatPanel'));
const GeminiVoicePanelRaw = lazy(() => import('./GeminiVoicePanel'));
const MultiAgentVoicePanelRaw = lazy(() => import('./MultiAgentVoicePanel'));

// Wrap all panels with error boundaries
export const Dashboard = withErrorBoundary(DashboardRaw, 'Dashboard');
export const Kanban = withErrorBoundary(KanbanRaw, 'Kanban Board');
export const AgentPanel = withErrorBoundary(AgentPanelRaw, 'Agent Panel');
export const ChatPanel = withErrorBoundary(ChatPanelRaw, 'Chat Panel');
export const MeetingsPanel = withErrorBoundary(MeetingsPanelRaw, 'Meetings');
export const SettingsPanel = withErrorBoundary(SettingsPanelRaw, 'Settings');
export const NotificationsPanel = withErrorBoundary(NotificationsPanelRaw, 'Notifications');
export const XPanel = withErrorBoundary(XPanelRaw, 'X/Twitter');
export const InboxPanel = withErrorBoundary(InboxPanelRaw, 'Inbox');
export const ThreePaneInbox = withErrorBoundary(ThreePaneInboxRaw, 'Three Pane Inbox');
export const CommsInbox = withErrorBoundary(CommsInboxRaw, 'Communications Inbox');
export const UnifiedCommsInbox = withErrorBoundary(UnifiedCommsInboxRaw, 'Unified Communications Inbox');
export const CommsInbox3Pane = withErrorBoundary(CommsInbox3PaneRaw, 'Communications Inbox 3-Pane');
export const LibraryPanel = withErrorBoundary(LibraryPanelRaw, 'Library');
export const CalendarPanel = withErrorBoundary(CalendarPanelRaw, 'Calendar');
export const SchedulePanel = withErrorBoundary(SchedulePanelRaw, 'Schedule');
export const CodeAgentDashboard = withErrorBoundary(CodeAgentDashboardRaw, 'Code Agent Dashboard');
export const ContextControlBoard = withErrorBoundary(ContextControlBoardRaw, 'Context Control');
export const ContentCalendar = withErrorBoundary(ContentCalendarRaw, 'Content Calendar');
export const AnalyticsDashboard = withErrorBoundary(AnalyticsDashboardRaw, 'Analytics');
export const ConnectedAccountsPanel = withErrorBoundary(ConnectedAccountsPanelRaw, 'Connected Accounts');
export const StarredMessagesPanel = withErrorBoundary(StarredMessagesPanelRaw, 'Starred Messages');
export const VoiceChatPanel = withErrorBoundary(VoiceChatPanelRaw, 'Voice Chat');
export const GeminiVoicePanel = withErrorBoundary(GeminiVoicePanelRaw, 'Gemini Voice Chat');
export const MultiAgentVoicePanel = withErrorBoundary(MultiAgentVoicePanelRaw, 'Multi-Agent Voice');

// Export the error boundary itself for custom usage
export { default as ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
