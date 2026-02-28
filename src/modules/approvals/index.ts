/**
 * Approvals Module — core content approval queue.
 * Re-exports existing InboxPanel via lazy loading.
 */

import { lazy } from 'react';
import { Inbox } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const InboxPanel = lazy(() => import('../../components/InboxPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'approvals',
      label: 'Approvals',
      icon: Inbox,
      component: InboxPanel,
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
