// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Module Builder Module — optional system module.
 * Registers the 'modulebuilder' view pointing to ModuleBuilderPage.
 * The module creation tool is itself a module.
 */

import { lazy } from 'react';
import { Boxes } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ModuleBuilderPage = lazy(() => import('../../components/ModuleBuilder/ModuleBuilderPage'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'modulebuilder',
      label: 'Module Builder',
      icon: Boxes,
      component: ModuleBuilderPage,
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
