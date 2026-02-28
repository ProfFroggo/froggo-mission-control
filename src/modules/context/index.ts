/**
 * Context Module — optional system module.
 * Registers the 'context' view pointing to ContextControlBoard.
 */

import { lazy } from 'react';
import { Sparkles } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ContextControlBoard = lazy(() => import('../../components/ContextControlBoard'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'context',
      label: 'Context',
      icon: Sparkles,
      component: ContextControlBoard,
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
