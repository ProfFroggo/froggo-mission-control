// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Projects Module — unified project workspaces.
 * Registers the Projects panel in the ViewRegistry.
 */

import { lazy } from 'react';
import { FolderKanban } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ProjectsPanel = lazy(() => import('../../components/projects/ProjectsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      component: ProjectsPanel,
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
