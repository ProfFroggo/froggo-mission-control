// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Writing Module — optional productivity module.
 * Registers the 'writing' view pointing to WritingWorkspace.
 */

import { lazy } from 'react';
import { PenLine } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const WritingWorkspace = lazy(() => import('../../components/writing/WritingWorkspace'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'writing',
      label: 'Writing',
      icon: PenLine,
      component: WritingWorkspace,
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
