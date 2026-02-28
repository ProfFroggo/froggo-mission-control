/**
 * Accounts Module — optional system module.
 * Registers the 'accounts' view pointing to ConnectedAccountsPanel.
 */

import { lazy } from 'react';
import { Cloud } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ConnectedAccountsPanel = lazy(() => import('../../components/ConnectedAccountsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'accounts',
      label: 'Accounts',
      icon: Cloud,
      component: ConnectedAccountsPanel,
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
