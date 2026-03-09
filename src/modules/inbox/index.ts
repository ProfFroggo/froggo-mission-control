// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Inbox Module — core communications hub.
 * Registers both 'inbox' and 'comms' (alias) view IDs pointing to CommsInbox3Pane.
 */

import { lazy } from 'react';
import { Mail } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const CommsInbox3Pane = lazy(() => import('../../components/CommsInbox3Pane'));

// Register synchronously at import time — sidebar shows immediately
ViewRegistry.register({
  id: 'inbox',
  label: 'Inbox',
  icon: Mail,
  component: CommsInbox3Pane,
  moduleId: manifest.id,
  category: manifest.category,
  description: manifest.description,
});
ViewRegistry.register({
  id: 'comms',
  label: 'Communications',
  icon: Mail,
  component: CommsInbox3Pane,
  moduleId: manifest.id,
  category: manifest.category,
  description: manifest.description,
});

const lifecycle: ModuleLifecycle = {
  async init() {},

  dispose() {
    // Removes both 'inbox' and 'comms' views (both share moduleId: manifest.id)
    ViewRegistry.unregisterModule(manifest.id);
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
