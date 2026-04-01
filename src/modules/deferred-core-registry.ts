// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Deferred Core Module Registry
 *
 * Core modules that are always enabled but loaded **asynchronously** inside
 * ModuleLoader.initAll() rather than imported synchronously at startup via
 * modules/index.ts. This reduces the initial JS parse overhead while ensuring
 * the modules are available immediately after the first React render (typically
 * < 100ms after mount on localhost, < 300ms on a production 4G connection).
 *
 * ## Why This Helps
 * Every entry in modules/index.ts is a synchronous import — the module's
 * index.ts file, its Lucide icon imports, and its module.json manifest are all
 * parsed and evaluated before App.tsx mounts. While each module stub is small
 * (~500-2,000 bytes), the cumulative synchronous parse for all 13 core modules
 * contributes to TBT (Total Blocking Time) on slower devices.
 *
 * Deferred modules avoid this synchronous parse: their code is only evaluated
 * inside ModuleLoader.initAll(), which runs in a useEffect (after first paint).
 *
 * ## When to Use Deferred vs. Synchronous Registration
 *
 * Keep in modules/index.ts (synchronous — load at startup):
 * - Modules the user commonly lands on first: kanban, chat, inbox
 * - Always-visible nav items: settings, notifications, approvals, agent-mgmt
 * - Modules that other modules depend on at registration time
 *
 * Use DEFERRED_CORE_MODULE_IMPORTS (async — load after first paint):
 * - Modules users rarely click first: schedule, automations, campaigns, budget, knowledge
 * - Modules with no cross-module registration dependencies
 *
 * ## UX Trade-off
 * Deferred modules appear in the sidebar ~50-200ms after mount (after initAll
 * resolves). For low-frequency nav items this is acceptable. If sidebar flash
 * is a concern, consider pre-seeding panelConfig with a static default order.
 */

export const DEFERRED_CORE_MODULE_IMPORTS: Record<string, () => Promise<unknown>> = {
  'workflow-studio': () => import('./workflow-studio'),
  notifications: () => import('./notifications'),
  'agent-mgmt':  () => import('./agent-mgmt'),
  schedule:    () => import('./schedule'),
  automations: () => import('./automations'),
  library:     () => import('./library'),
  knowledge:   () => import('./knowledge'),
  projects:    () => import('./projects'),
  campaigns:   () => import('./campaigns'),
  budget:      () => import('./budget'),
  notes:       () => import('./notes'),
};
