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
  Boxes,
} from 'lucide-react';

import {
  Dashboard,
  CodeAgentDashboard,
  ModuleBuilderPage,
} from '../components/ProtectedPanels';

import { ViewRegistry } from './ViewRegistry';

// Register all core views — order here doesn't matter, panelConfig controls display order
// NOTE: finance, analytics, settings, library, inbox, chat, agentdms, kanban, approvals, notifications, meetings, voicechat, schedule, writing, accounts, context are registered by their respective modules (src/modules/*)
[
  { id: 'dashboard',    label: 'Dashboard',        icon: LayoutDashboard,  component: Dashboard },

  { id: 'codeagent',  label: 'Dev',                 icon: Code,             component: CodeAgentDashboard },
  { id: 'modulebuilder', label: 'Module Builder',   icon: Boxes,            component: ModuleBuilderPage },
].forEach(view => ViewRegistry.register(view));
