import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import SpecPreviewPanel from './SpecPreviewPanel';
import { useModuleSpec } from './useModuleSpec';
import { useConversationFlow } from './useConversationFlow';
import { generateTasksForModule, exportSpecAsJson } from './TaskGenerator';
import { showToast } from '../Toast';
import type { ModuleSpec } from './types';

interface ModuleBuilderViewProps {
  moduleId: string;
  onBack: () => void;
}

interface SavedModule {
  id: string;
  name: string;
  description: string;
  status: string;
  spec: any;
  conversation: any[];
  conversation_state: any;
  overall_progress: number;
  created_at: number;
  updated_at: number;
}

function ModuleBuilderInner({ saved, onBack }: { saved: SavedModule; onBack: () => void }) {
  const moduleSpec = useModuleSpec({
    initialSpec: saved.spec,
    initialAnswered: saved.conversation_state?.answeredQuestions || [],
  });
  const { spec, sectionProgress, overallProgress, isComplete } = moduleSpec;

  const flow = useConversationFlow({
    moduleSpec,
    initialState: saved.conversation_state?.flow || undefined,
  });

  // ── Auto-save (2s debounce + flush on unmount) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const doSave = useCallback(() => {
    if (!isMountedRef.current) return;
    const flowState = flow.getState();
    fetch(`/api/modules/${saved.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: saved.id,
        name: (spec.name as string) || '',
        description: (spec.description as string) || '',
        status: isComplete ? 'finished' : 'in-progress',
        spec,
        conversation: flowState.messages,
        conversation_state: {
          answeredQuestions: moduleSpec.answeredQuestionsArray,
          flow: flowState,
        },
        overall_progress: overallProgress,
      }),
    }).catch(err => console.error('[ModuleBuilder] Auto-save failed:', err));
  }, [saved.id, spec, isComplete, overallProgress, flow, moduleSpec.answeredQuestionsArray]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 2000);
  }, [doSave]);

  // Trigger auto-save on spec / conversation changes
  useEffect(() => {
    if (flow.isStarted) scheduleSave();
  }, [spec, flow.messages.length, overallProgress, flow.isStarted, scheduleSave]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      // Synchronous final save
      doSave();
    };
  }, [doSave]);

  const handleGenerateTasks = async () => {
    try {
      const tasks = generateTasksForModule(spec as ModuleSpec, saved.id, flow.wireframe);
      const taskIds: string[] = [];
      for (const task of tasks) {
        const { subtasks, ...taskBody } = task;
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskBody),
        });
        if (!res.ok) throw new Error(`Task creation failed: ${res.status}`);
        const created = await res.json();
        taskIds.push(created.id);
        for (const subtask of subtasks || []) {
          await fetch(`/api/tasks/${created.id}/subtasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subtask),
          });
        }
      }
      await fetch(`/api/modules/${saved.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, status: 'built' }),
      });
      showToast('success', 'Tasks Created', `${taskIds.length} tasks created for ${spec.name}`);
    } catch (err: unknown) {
      showToast('error', 'Task Generation Failed', (err as Error).message);
    }
  };

  const handleExportJson = () => {
    const json = exportSpecAsJson(spec as ModuleSpec);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${spec.id || 'module'}-spec.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { doSave(); onBack(); }}
            className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg rounded-lg transition-colors"
          >
            <ArrowLeft size={14} /> My Modules
          </button>
          <span className="text-mission-control-border">|</span>
          <h1 className="text-lg font-semibold text-mission-control-text truncate">
            {spec.name || 'Untitled Module'}
          </h1>
        </div>
      </div>

      {/* Split layout */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 min-w-0">
          <ConversationPanel
            messages={flow.messages}
            sectionProgress={sectionProgress}
            currentSection={flow.currentSection}
            overallProgress={overallProgress}
            isStarted={flow.isStarted}
            isFinished={flow.isFinished}
            isStreaming={flow.isStreaming}
            onSend={flow.submitAnswer}
            onStart={flow.startInterview}
            onJumpToSection={flow.jumpToSection}
          />
        </div>
        <div className="w-1/2 min-w-0">
          <SpecPreviewPanel
            spec={spec}
            sectionProgress={sectionProgress}
            isComplete={isComplete}
            wireframe={flow.wireframe}
            liveTasks={flow.liveTasks}
            onGenerateTasks={handleGenerateTasks}
            onExportJson={handleExportJson}
          />
        </div>
      </div>
    </div>
  );
}

export default function ModuleBuilderView({ moduleId, onBack }: ModuleBuilderViewProps) {
  const [saved, setSaved] = useState<SavedModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/modules/${moduleId}`);
        if (cancelled) return;
        if (res.ok) {
          const result = await res.json();
          if (result?.module) {
            setSaved(result.module);
          } else {
            setError('Module not found');
          }
        } else {
          setError('Module not found');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [moduleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-mission-control-text-dim">
        Loading module...
      </div>
    );
  }

  if (error || !saved) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim gap-3">
        <p>Failed to load module: {error}</p>
        <button onClick={onBack} className="text-mission-control-accent hover:underline text-sm">
          Back to list
        </button>
      </div>
    );
  }

  return <ModuleBuilderInner key={saved.id} saved={saved} onBack={onBack} />;
}
