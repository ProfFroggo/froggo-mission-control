/**
 * Twitter Module — entry point
 *
 * Wraps the existing X Publishing feature as a module.
 * Registers with ModuleLoader and ViewRegistry, pointing at the
 * existing XPublishComposer component (no new view needed).
 *
 * IPC handlers (module-twitter:*) are registered server-side in
 * electron/handlers/twitter-module-handlers.ts.
 *
 * All existing x:publish:* and x:* handlers remain untouched —
 * they are registered separately by registerXPublishingHandlers()
 * and registerXTwitterHandlers() during startup.
 */

import { lazy } from 'react';
import { Share2 } from 'lucide-react';
import { ModuleLoader, type ModuleLifecycle, type ModuleManifest } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

// Lazy-load the existing X publish composer (already has default export)
const XPanel = lazy(() => import('../../components/XPublishComposer'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'twitter',
      label: 'Social Media',
      icon: Share2,
      component: XPanel,
      moduleId: manifest.id,
      category: manifest.category,
      description: manifest.description,
    });
  },

  async activate() {
    console.log('[Twitter Module] Activated');
  },

  deactivate() {
    console.log('[Twitter Module] Deactivated');
  },

  dispose() {
    ViewRegistry.unregisterModule(manifest.id);
    console.log('[Twitter Module] Disposed');
  },
};

// Register with ModuleLoader — self-registration on import (side-effect)
ModuleLoader.register(manifest as ModuleManifest, lifecycle);
