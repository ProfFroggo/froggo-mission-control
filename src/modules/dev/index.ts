// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
/**
 * Dev Module — optional agent module (disabled by default).
 * Registers the 'codeagent' view pointing to CodeAgentDashboard.
 */

import { lazy } from 'react';
import { Code } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const CodeAgentDashboard = lazy(() => import('../../components/CodeAgentDashboard'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'codeagent',
      label: 'Dev',
      icon: Code,
      component: CodeAgentDashboard,
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
