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
  Code,
  Sparkles,
  Cloud,
  PenLine,
  Boxes,
} from 'lucide-react';

import {
  Dashboard,
  CodeAgentDashboard,
  ContextControlBoard,
  ConnectedAccountsPanel,
  WritingWorkspace,
  ModuleBuilderPage,
} from '../components/ProtectedPanels';

import { ViewRegistry } from './ViewRegistry';

// Register all core views — order here doesn't matter, panelConfig controls display order
// NOTE: finance, analytics, settings, library, inbox, chat, agentdms, kanban, approvals, notifications, meetings, voicechat, schedule are registered by their respective modules (src/modules/*)
[
  { id: 'dashboard',    label: 'Dashboard',        icon: LayoutDashboard,  component: Dashboard },

  { id: 'accounts',    label: 'Accounts',           icon: Cloud,            component: ConnectedAccountsPanel },
  { id: 'context',     label: 'Context',            icon: Sparkles,         component: ContextControlBoard },
  { id: 'codeagent',  label: 'Dev',                 icon: Code,             component: CodeAgentDashboard },
  { id: 'writing',     label: 'Writing',            icon: PenLine,          component: WritingWorkspace },
  { id: 'modulebuilder', label: 'Module Builder',   icon: Boxes,            component: ModuleBuilderPage },
].forEach(view => ViewRegistry.register(view));
