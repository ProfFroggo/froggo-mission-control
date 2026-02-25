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
  MessageSquare,
  Users,
  Mic,
  Bell,
  Inbox,
  Calendar,
  Code,
  Sparkles,
  Mail,
  Cloud,
  MessagesSquare,
  PenLine,
  Boxes,
} from 'lucide-react';

import {
  Dashboard,
  Kanban as KanbanPanel,
  ChatPanel,
  MeetingsPanel,
  VoiceChatPanel,
  NotificationsPanel,
  InboxPanel,
  CommsInbox3Pane,
  SchedulePanel,
  CodeAgentDashboard,
  ContextControlBoard,
  ConnectedAccountsPanel,
  DMFeed,
  WritingWorkspace,
  ModuleBuilderPage,
} from '../components/ProtectedPanels';

import { ViewRegistry } from './ViewRegistry';

// Register all core views — order here doesn't matter, panelConfig controls display order
// NOTE: finance, analytics, settings, library are registered by their respective modules (src/modules/*)
[
  { id: 'dashboard',    label: 'Dashboard',        icon: LayoutDashboard,  component: Dashboard },
  { id: 'inbox',        label: 'Inbox',             icon: Mail,             component: CommsInbox3Pane },
  { id: 'kanban',      label: 'Tasks',              icon: Kanban,           component: KanbanPanel },
  { id: 'agentdms',   label: 'Agent DMs',           icon: MessagesSquare,   component: DMFeed },
  // NOTE: twitter/Social Media view is registered by the twitter module (src/modules/twitter/index.ts)
  { id: 'meetings',    label: 'Meetings',           icon: Users,            component: MeetingsPanel },
  { id: 'voicechat',  label: 'Voice Chat',          icon: Mic,              component: VoiceChatPanel },
  { id: 'chat',        label: 'Chat',               icon: MessageSquare,    component: ChatPanel },
  { id: 'accounts',    label: 'Accounts',           icon: Cloud,            component: ConnectedAccountsPanel },
  { id: 'approvals',   label: 'Approvals',          icon: Inbox,            component: InboxPanel },
  { id: 'context',     label: 'Context',            icon: Sparkles,         component: ContextControlBoard },
  { id: 'codeagent',  label: 'Dev',                 icon: Code,             component: CodeAgentDashboard },
  { id: 'schedule',    label: 'Schedule',           icon: Calendar,         component: SchedulePanel },
  { id: 'notifications', label: 'Notifications',   icon: Bell,             component: NotificationsPanel },
  { id: 'writing',     label: 'Writing',            icon: PenLine,          component: WritingWorkspace },
  { id: 'modulebuilder', label: 'Module Builder',   icon: Boxes,            component: ModuleBuilderPage },
  // Aliases (same component, different route IDs)
  { id: 'comms',       label: 'Communications',     icon: Mail,             component: CommsInbox3Pane },
].forEach(view => ViewRegistry.register(view));
