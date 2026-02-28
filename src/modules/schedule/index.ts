/**
 * Schedule Module — optional productivity module.
 */
import { lazy } from 'react';
import { Calendar } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const SchedulePanel = lazy(() => import('../../components/SchedulePanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'schedule',
      label: 'Schedule',
      icon: Calendar,
      component: SchedulePanel,
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
