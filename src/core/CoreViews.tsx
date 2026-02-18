/**
 * CoreViews — registers all built-in dashboard views with the ViewRegistry.
 *
 * Import this file once (in App.tsx) as a side-effect:
 *   import './core/CoreViews';
 *
 * All existing panels are registered here. To add a new view, add one
 * `ViewRegistry.register(...)` call — no other files need to change.
 */

import {
  LayoutDashboard,
  Kanban,
  Bot,
  MessageSquare,
  Users,
  Mic,
  Bell,
  Inbox,
  FolderOpen,
  Calendar,
  Code,
  Sparkles,
  BarChart2,
  Mail,
  Cloud,
  MessagesSquare,
  DollarSign,
  PenLine,
  Settings,
} from 'lucide-react';

import {
  Dashboard,
  Kanban as KanbanPanel,
  AgentPanel,
  ChatPanel,
  MeetingsPanel,
  VoiceChatPanel,
  SettingsPanel,
  NotificationsPanel,
  XPanel,
  InboxPanel,
  CommsInbox3Pane,
  LibraryPanel,
  SchedulePanel,
  CodeAgentDashboard,
  ContextControlBoard,
  AnalyticsDashboard,
  ConnectedAccountsPanel,
  DMFeed,
  FinancePanel,
  WritingWorkspace,
} from '../components/ProtectedPanels';

import { ViewRegistry } from './ViewRegistry';

// X logo as SVG — kept here so Sidebar.tsx no longer needs it
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Register all core views — order here doesn't matter, panelConfig controls display order
[
  { id: 'dashboard',    label: 'Dashboard',        icon: LayoutDashboard,  component: Dashboard },
  { id: 'inbox',        label: 'Inbox',             icon: Mail,             component: CommsInbox3Pane },
  { id: 'analytics',   label: 'Analytics',          icon: BarChart2,        component: AnalyticsDashboard },
  { id: 'kanban',      label: 'Tasks',              icon: Kanban,           component: KanbanPanel },
  { id: 'agents',      label: 'Agents',             icon: Bot,              component: AgentPanel },
  { id: 'agentdms',   label: 'Agent DMs',           icon: MessagesSquare,   component: DMFeed },
  { id: 'twitter',     label: 'X / Twitter',         icon: XIcon,            component: XPanel },
  { id: 'meetings',    label: 'Meetings',           icon: Users,            component: MeetingsPanel },
  { id: 'voicechat',  label: 'Voice Chat',          icon: Mic,              component: VoiceChatPanel },
  { id: 'chat',        label: 'Chat',               icon: MessageSquare,    component: ChatPanel },
  { id: 'accounts',    label: 'Accounts',           icon: Cloud,            component: ConnectedAccountsPanel },
  { id: 'approvals',   label: 'Approvals',          icon: Inbox,            component: InboxPanel },
  { id: 'context',     label: 'Context',            icon: Sparkles,         component: ContextControlBoard },
  { id: 'codeagent',  label: 'Dev',                 icon: Code,             component: CodeAgentDashboard },
  { id: 'library',     label: 'Library',            icon: FolderOpen,       component: LibraryPanel },
  { id: 'schedule',    label: 'Schedule',           icon: Calendar,         component: SchedulePanel },
  { id: 'notifications', label: 'Notifications',   icon: Bell,             component: NotificationsPanel },
  { id: 'writing',     label: 'Writing',            icon: PenLine,          component: WritingWorkspace },
  { id: 'finance',     label: 'Finance',            icon: DollarSign,       component: FinancePanel },
  { id: 'settings',    label: 'Settings',           icon: Settings,         component: SettingsPanel },
  // Aliases (same component, different route IDs)
  { id: 'comms',       label: 'Communications',     icon: Mail,             component: CommsInbox3Pane },
].forEach(view => ViewRegistry.register(view));
