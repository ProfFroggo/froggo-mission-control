/**
 * Module registration entry point.
 *
 * Import this file in App.tsx (after CoreViews) to register all modules.
 * Each module's index.ts self-registers with the ModuleLoader on import.
 *
 * To add a new module:
 * 1. Create src/modules/<name>/
 * 2. Add module.json and index.ts
 * 3. Add import below
 */

// Extracted modules (proof-of-concept)
import './finance';
import './settings';
import './analytics';
import './library';

import './twitter';
import './agent-mgmt';

// Phase 45: Core view migrations
import './inbox';
import './chat';
import './kanban';
import './approvals';
import './notifications';

// Phase 46: Optional module migrations — wave 1
import './meetings';
import './voice';
import './schedule';
import './writing';

// Phase 47: Optional module migrations — wave 2
import './accounts';
import './context';
import './dev';
import './module-builder';

// Future modules:
// import './comms';
