// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Module registration entry point — CORE MODULES ONLY.
 *
 * Core modules are always loaded regardless of catalog state.
 * Optional modules are loaded dynamically by ModuleLoader.initAll()
 * based on their installed/enabled state in the catalog DB.
 *
 * To add a new optional module:
 * 1. Create src/modules/<name>/ with module.json and index.ts
 * 2. Add it to src/modules/optional-registry.ts
 * 3. Add a catalog/modules/<name>.json manifest
 */

// Core modules — always active, cannot be uninstalled.
// These are imported synchronously so their nav items appear immediately.
// Only modules users commonly land on first are synchronous; the rest are deferred
// to reduce initial JS parse cost under 4× CPU throttling (Lighthouse mobile sim).
import './settings';
import './inbox';
import './chat';
import './kanban';
import './approvals';
// notifications, agent-mgmt moved to deferred-core-registry.ts — they're always
// enabled but rarely the first view. Loading them async after first paint saves
// ~4KB synchronous parse and 2 fewer icon resolutions in the critical path.
// workflow-studio, library, knowledge, projects, campaigns, automations, schedule,
// budget are also deferred: loaded in ModuleLoader.initAll() via deferred-core-registry.ts
