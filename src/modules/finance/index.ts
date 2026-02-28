/**
 * Finance Module — entry point
 *
 * Registers the Finance module with the ModuleLoader.
 * This file is imported as a side-effect (like CoreViews.tsx).
 */

import { lazy } from 'react';
import { DollarSign } from 'lucide-react';
import { ModuleLoader, type ModuleLifecycle, type ModuleManifest } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import { ServiceRegistry } from '../../core/ServiceRegistry';
import { createFinanceService } from './services/finance-ipc';
import manifest from './module.json';

const FinancePanel = lazy(() => import('./views/FinancePanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    // Register views
    ViewRegistry.register({
      id: 'finance',
      label: 'Finance',
      icon: DollarSign,
      component: FinancePanel,
      moduleId: manifest.id,
      category: manifest.category,
      description: manifest.description,
    });

    // Register services
    ServiceRegistry.register({
      id: 'finance-service',
      moduleId: manifest.id,
      factory: () => createFinanceService(),
      singleton: true,
    });
  },

  async activate() {
    // Called when user navigates to finance view
    console.debug('[Finance Module] Activated');
  },

  deactivate() {
    console.debug('[Finance Module] Deactivated');
  },

  dispose() {
    ViewRegistry.unregisterModule(manifest.id);
    ServiceRegistry.disposeModule(manifest.id);
    console.debug('[Finance Module] Disposed');
  },
};

// Register with ModuleLoader
ModuleLoader.register(manifest as ModuleManifest, lifecycle);
