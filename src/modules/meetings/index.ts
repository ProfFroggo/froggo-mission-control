/**
 * Meetings Module — optional productivity module.
 */

import { lazy } from 'react';
import { Users } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const MeetingsPanel = lazy(() => import('../../components/MeetingsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'meetings',
      label: 'Meetings',
      icon: Users,
      component: MeetingsPanel,
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
