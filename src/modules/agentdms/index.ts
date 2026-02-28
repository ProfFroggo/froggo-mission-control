/**
 * Agent DMs Module — core agent messaging feed.
 * Re-exports existing DMFeed via lazy loading.
 */

import { lazy } from 'react';
import { MessagesSquare } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const DMFeed = lazy(() => import('../../components/DMFeed'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'agentdms',
      label: 'Agent DMs',
      icon: MessagesSquare,
      component: DMFeed,
      moduleId: manifest.id,
      category: manifest.category,
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule(manifest.id);
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
