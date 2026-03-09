// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Analytics Module — extracted from core dashboard.
 * Re-exports existing AnalyticsDashboard via lazy loading.
 */

import { lazy } from 'react';
import { BarChart2 } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const AnalyticsDashboard = lazy(() => import('../../components/AnalyticsDashboard'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart2,
      component: AnalyticsDashboard,
      moduleId: 'analytics',
      category: 'productivity',
      description: manifest.description,
    });
  },

  dispose() {
    ViewRegistry.unregisterModule('analytics');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
