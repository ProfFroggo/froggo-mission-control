/**
 * Approvals Module — core content approval queue.
 * Re-exports existing InboxPanel via lazy loading.
 */

import { lazy } from 'react';
import { ShieldAlert } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ApprovalQueuePanel = lazy(() => import('../../components/ApprovalQueuePanel'));

ViewRegistry.register({
  id: 'approvals',
  label: 'Approvals',
  icon: ShieldAlert,
  component: ApprovalQueuePanel,
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
