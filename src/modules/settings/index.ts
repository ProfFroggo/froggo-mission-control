// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Settings Module — extracted from core dashboard.
 * Re-exports existing SettingsPanel and ModulesPage via lazy loading.
 *
 * Views registered:
 *   - 'settings'  → SettingsPanel (dashboard preferences, security, accounts)
 *   - 'modules'   → ModulesPage (module management, credentials, wizard trigger)
 */

import { lazy } from 'react';
import { Settings, Puzzle } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const SettingsPanel = lazy(() => import('../../components/EnhancedSettingsPanel'));
const ModulesPage = lazy(() => import('../../components/ModulesPage'));

ViewRegistry.register({
  id: 'settings',
  label: 'Settings',
  icon: Settings,
  component: SettingsPanel,
  moduleId: 'settings',
  category: 'system',
  description: manifest.description,
});
ViewRegistry.register({
  id: 'modules',
  label: 'Modules',
  icon: Puzzle,
  component: ModulesPage,
  moduleId: 'settings',
  category: 'system',
  description: 'Manage installed modules and integrations',
});

const lifecycle: ModuleLifecycle = {
  async init() {},

  dispose() {
    ViewRegistry.unregisterModule('settings');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
