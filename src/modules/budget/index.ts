// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Budget Module — quarter/category/invoice management with AI finance agent
import { lazy } from 'react';
import { Wallet } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const BudgetPanel = lazy(() => import('../../components/BudgetPanel'));

ViewRegistry.register({
  id: 'budget',
  label: 'Budget',
  icon: Wallet,
  component: BudgetPanel,
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
