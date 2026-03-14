// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Knowledge Module — registers the Knowledge Base view.
 * Provides human-curated workspace knowledge to all agents.
 */

import { lazy } from 'react';
import { BookOpen } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const KnowledgeBase = lazy(() => import('../../components/KnowledgeBase'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'knowledge',
      label: 'Knowledge',
      icon: BookOpen,
      component: KnowledgeBase,
      moduleId: 'knowledge',
      category: 'productivity',
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule('knowledge');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
