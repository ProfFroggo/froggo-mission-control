/**
 * Twitter Module — entry point
 *
 * Owns the full Social Media view (XTwitterPage with all 8 tabs).
 * Registers the view with ViewRegistry on init.
 *
 * IPC handlers (module-twitter:*) are registered server-side in
 * electron/handlers/twitter-module-handlers.ts.
 *
 * All existing x:publish:* and x:* handlers remain untouched —
 * they are registered separately by registerXPublishingHandlers()
 * and registerXTwitterHandlers() during startup.
 */

import { lazy } from 'react';
import { ModuleLoader, type ModuleLifecycle, type ModuleManifest } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

// X logo SVG component
const XIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Lazy-load the full XTwitterPage (all 8 tabs)
const XTwitterPage = lazy(() => import('../../components/XTwitterPage'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'twitter',
      label: 'Social Media',
      icon: XIcon,
      component: XTwitterPage,
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
