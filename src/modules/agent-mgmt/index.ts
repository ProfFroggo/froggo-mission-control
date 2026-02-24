/**
 * Agent Management Module — wraps existing AgentPanel + AgentManagementModal.
 *
 * Views registered:
 *   - 'agents' → AgentPanel (agent grid, management modal, start/stop)
 */

import { lazy } from 'react';
import { Bot } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const AgentPanel = lazy(() => import('../../components/AgentPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'agents',
      label: 'Agents',
      icon: Bot,
      component: AgentPanel,
      moduleId: 'froggo-agent-mgmt',
      category: 'agent',
      description: manifest.description,
    });
  },
  dispose() {
    ViewRegistry.unregisterModule('froggo-agent-mgmt');
  },
};

ModuleLoader.register(manifest as ModuleManifest, lifecycle);
export default lifecycle;
