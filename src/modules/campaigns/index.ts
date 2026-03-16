// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Campaigns Module — full-scale marketing campaign management.
 * Registers the Campaigns panel in the ViewRegistry.
 */

import { lazy } from 'react';
import { Megaphone } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const CampaignsPanel = lazy(() => import('../../components/campaigns/CampaignsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'campaigns',
      label: 'Campaigns',
      icon: Megaphone,
      component: CampaignsPanel,
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
