// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Optional module registry.
 *
 * Maps non-core module IDs to their dynamic import functions.
 * ModuleLoader.initAll() uses this to load only catalog-installed modules.
 *
 * To add a new optional module:
 * 1. Create src/modules/<name>/ with module.json and index.ts
 * 2. Add an entry below
 * 3. Add a catalog/modules/<name>.json manifest
 */

export const OPTIONAL_MODULE_IMPORTS: Record<string, () => Promise<unknown>> = {
  finance:          () => import('./finance'),
  analytics:        () => import('./analytics'),
  twitter:          () => import('./twitter'),
  'agent-mgmt':     () => import('./agent-mgmt'),  // promoted to core — keep for compat
  meetings:         () => import('./meetings'),
  voice:            () => import('./voice'),
  writing:          () => import('./writing'),
  dev:              () => import('./dev'),
  'module-builder': () => import('./module-builder'),
  // library, projects, schedule promoted to core — imported via modules/index.ts
};
