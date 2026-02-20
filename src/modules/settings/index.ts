/**
 * Settings Module — extracted from core dashboard.
 * Re-exports existing SettingsPanel via lazy loading.
 */

import { lazy } from 'react';
import { Settings } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const SettingsPanel = lazy(() => import('../../components/SettingsPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      component: SettingsPanel,
      moduleId: 'froggo-settings',
      category: 'system',
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule('froggo-settings');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
