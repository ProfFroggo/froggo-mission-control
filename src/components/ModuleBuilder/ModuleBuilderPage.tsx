import { useState, useCallback } from 'react';
import ModuleListView from './ModuleListView';
import ModuleBuilderView from './ModuleBuilderView';

export default function ModuleBuilderPage() {
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const handleCreateNew = useCallback(async () => {
    const id = `mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      await window.clawdbot.moduleBuilder?.save({
        id,
        name: '',
        description: '',
        status: 'in-progress',
        spec: {},
        conversation: [],
        conversation_state: {},
        overall_progress: 0,
      });
    } catch (err) {
      console.error('[ModuleBuilder] Failed to create:', err);
    }
    setActiveModuleId(id);
  }, []);

  if (activeModuleId === null) {
    return (
      <ModuleListView
        onSelectModule={(id) => setActiveModuleId(id)}
        onCreateNew={handleCreateNew}
      />
    );
  }

  return (
    <ModuleBuilderView
      moduleId={activeModuleId}
      onBack={() => setActiveModuleId(null)}
    />
  );
}
