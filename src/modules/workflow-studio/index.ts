// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Workflow Studio Module — embedded workflow builder via iframe.
 * Connects to the Workflow Studio Next.js app running on port 4000.
 */

import { lazy } from 'react';
import { Workflow } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const WorkflowStudioPanel = lazy(() => import('../../components/WorkflowStudioPanel'));

// Register synchronously at import time — sidebar shows immediately
ViewRegistry.register({
  id: 'workflow-studio',
  label: 'Workflow Studio',
  icon: Workflow,
  component: WorkflowStudioPanel,
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
