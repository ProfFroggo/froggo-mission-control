/**
 * Kanban Module — core task management board.
 * Re-exports existing Kanban panel via lazy loading.
 */

import { lazy } from 'react';
import { Kanban } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const KanbanPanel = lazy(() => import('../../components/Kanban'));

ViewRegistry.register({
  id: 'kanban',
  label: 'Tasks',
  icon: Kanban,
  component: KanbanPanel,
  moduleId: manifest.id,
  category: manifest.category,
  description: manifest.description,
});

const lifecycle: ModuleLifecycle = {
  async init() {},

  dispose() {
    ViewRegistry.unregisterModule(manifest.id);
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
