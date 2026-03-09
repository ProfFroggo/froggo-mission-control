// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Library Module — extracted from core dashboard.
 * Re-exports existing LibraryPanel via lazy loading.
 */

import { lazy } from 'react';
import { FolderOpen } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const LibraryPanel = lazy(() => import('../../components/LibraryPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'library',
      label: 'Library',
      icon: FolderOpen,
      component: LibraryPanel,
      moduleId: 'library',
      category: 'productivity',
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule('library');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
