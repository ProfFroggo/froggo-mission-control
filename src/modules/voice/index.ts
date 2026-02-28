/**
 * Voice Chat Module — optional communications module.
 */

import { lazy } from 'react';
import { Mic } from 'lucide-react';
import { ModuleLoader, type ModuleManifest, type ModuleLifecycle } from '../../core/ModuleLoader';
import { ViewRegistry } from '../../core/ViewRegistry';
import manifest from './module.json';

const VoiceChatPanel = lazy(() => import('../../components/VoiceChatPanel'));

const lifecycle: ModuleLifecycle = {
  async init() {
    ViewRegistry.register({
      id: 'voicechat',
      label: 'Voice Chat',
      icon: Mic,
      component: VoiceChatPanel,
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
