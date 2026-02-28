/**
 * Chat Module — core real-time chat.
 * Re-exports existing ChatPanel via lazy loading.
 */

import { lazy } from 'react';
import { MessageSquare } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const ChatPanel = lazy(() => import('../../components/ChatPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      component: ChatPanel,
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
