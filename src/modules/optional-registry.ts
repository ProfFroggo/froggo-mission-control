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
  finance:        () => import('./finance'),
  analytics:      () => import('./analytics'),
  library:        () => import('./library'),
  twitter:        () => import('./twitter'),
  'agent-mgmt':   () => import('./agent-mgmt'),  // promoted to core — keep for compat
  meetings:       () => import('./meetings'),
  voice:          () => import('./voice'),
  schedule:       () => import('./schedule'),
  writing:        () => import('./writing'),
  dev:            () => import('./dev'),
  'module-builder': () => import('./module-builder'),
  accounts:       () => import('./accounts'),
  projects:       () => import('./projects'),
};
