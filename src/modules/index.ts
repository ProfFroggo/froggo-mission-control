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

// Core modules — always active, cannot be uninstalled
import './settings';
import './inbox';
import './chat';
import './kanban';
import './approvals';
import './notifications';
import './agent-mgmt';
import './library';
import './knowledge';
import './projects';
import './campaigns';
import './schedule';
