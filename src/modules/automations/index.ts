// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Automations Module — smart workflow automations.
 * Registers the Automations panel in the ViewRegistry.
 */

import { lazy } from 'react';
import { Zap } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const AutomationsPanel = lazy(() => import('../../components/AutomationsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'automations',
      label: 'Automations',
      icon: Zap,
      component: AutomationsPanel,
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
