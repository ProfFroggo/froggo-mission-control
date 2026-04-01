// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { lazy } from 'react';
import { StickyNote } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const NotesPanel = lazy(() => import('../../components/NotesPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'notes',
      label: 'Notes',
      icon: StickyNote,
      component: NotesPanel,
      moduleId: 'notes',
      category: 'productivity',
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule('notes');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
