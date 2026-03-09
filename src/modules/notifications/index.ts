// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Notifications Module — core notification center.
 * Re-exports existing NotificationsPanel via lazy loading.
 */

import { lazy } from 'react';
import { Bell } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const NotificationsPanel = lazy(() => import('../../components/NotificationsPanelV2'));

ViewRegistry.register({
  id: 'notifications',
  label: 'Notifications',
  icon: Bell,
  component: NotificationsPanel,
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
