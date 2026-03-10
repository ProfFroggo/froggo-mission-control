import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus } from 'lucide-react';
import ConversationPanel from './ConversationPanel';
import SpecPreviewPanel from './SpecPreviewPanel';
import ModuleBuildProgress from './ModuleBuildProgress';
import BuildReviewModal from './BuildReviewModal';
import { useModuleSpec } from './useModuleSpec';
import { useConversationFlow } from './useConversationFlow';
import { generateTasksForModule, exportSpecAsJson } from './TaskGenerator';
import { showToast } from '../Toast';
import type { ModuleSpec } from './types';

const LS_KEY = 'module-builder-active-id';

export default function ModuleBuilderPage() {
  const moduleSpec = useModuleSpec();
  const { spec, resetSpec, sectionProgress, overallProgress, isComplete } = moduleSpec;
  const flow = useConversationFlow({ moduleSpec });

  const [moduleId, setModuleId] = useState<string | null>(null);
  const [tasksCreated, setTasksCreated] = useState(false);
  const [createdTaskIds, setCreatedTaskIds] = useState<string[]>([]);
  const [showBuildReview, setShowBuildReview] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<{ id: string; name: string } | null>(null);
  const wireframeSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check for saved draft
  useEffect(() => {
    const savedId = localStorage.getItem(LS_KEY);
    if (!savedId) return;
    fetch(`/api/modules/${savedId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.status !== 'built') {
          setResumeDraft({ id: savedId, name: data.name || 'Untitled' });
        } else {
          localStorage.removeItem(LS_KEY);
        }
      })
      .catch(() => localStorage.removeItem(LS_KEY));
  }, []);

  // Ensure module record exists in DB whenever spec gains a name
  const ensureModuleId = useCallback(async (): Promise<string> => {
    if (moduleId) return moduleId;
    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: spec.name || 'Untitled Module',
        description: spec.description ?? null,
        category: spec.category ?? 'general',
        status: 'in-progress',
        spec,
      }),
    });
    const data = await res.json();
    const id = data.id as string;
    setModuleId(id);
    localStorage.setItem(LS_KEY, id);
    return id;
  }, [moduleId, spec]);

  // Save wireframeHtml to DB whenever it changes (debounced)
  useEffect(() => {
    if (!flow.wireframe) return;
    if (wireframeSaveRef.current) clearTimeout(wireframeSaveRef.current);
    wireframeSaveRef.current = setTimeout(async () => {
      try {
        const id = await ensureModuleId();
        await fetch(`/api/modules/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wireframeHtml: flow.wireframe }),
        });
      } catch { /* non-critical */ }
    }, 1000);
  }, [flow.wireframe, ensureModuleId]);

  const handleBuildClick = () => {
    setShowBuildReview(true);
  };

  const handleConfirmBuild = async () => {
    setShowBuildReview(false);
    try {
      const id = await ensureModuleId();
      const tasks = generateTasksForModule(spec as ModuleSpec, id, flow.wireframe);
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

      // Save taskIds to module
      await fetch(`/api/modules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds, status: 'built' }),
      });

      setCreatedTaskIds(taskIds);
      setTasksCreated(true);
      localStorage.removeItem(LS_KEY);
      showToast('success', 'Build Queued', `${taskIds.length} tasks created for ${spec.name}`);
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

  const handleReset = () => {
    if (confirm('Start a new module? All unsaved progress will be lost.')) {
      localStorage.removeItem(LS_KEY);
      resetSpec();
      setModuleId(null);
      setTasksCreated(false);
      setCreatedTaskIds([]);
      setResumeDraft(null);
    }
  };

  const handleResumeDraft = async () => {
    if (!resumeDraft) return;
    try {
      const res = await fetch(`/api/modules/${resumeDraft.id}`);
      const data = await res.json();
      setModuleId(resumeDraft.id);
      setResumeDraft(null);
      if (data.wireframeHtml) flow.setWireframe(data.wireframeHtml);
    } catch {
      setResumeDraft(null);
    }
  };

  const handleDismissResume = () => {
    localStorage.removeItem(LS_KEY);
    setResumeDraft(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Resume draft banner */}
      {resumeDraft && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-mission-control-surface border-b border-mission-control-accent/40 text-sm">
          <span className="text-mission-control-text-dim">Unfinished module: <strong className="text-mission-control-text">{resumeDraft.name}</strong></span>
          <button onClick={handleResumeDraft} className="px-2.5 py-1 rounded bg-mission-control-accent text-white text-xs font-medium">Resume</button>
          <button onClick={handleDismissResume} className="px-2.5 py-1 rounded border border-mission-control-border text-mission-control-text-dim text-xs">Start New</button>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <h1 className="text-lg font-semibold text-mission-control-text">Module Builder</h1>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-mission-control-border hover:bg-mission-control-bg text-mission-control-text rounded-lg transition-colors"
          >
            <Plus size={14} /> New Module
          </button>
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
        <div className="w-1/2 min-w-0 flex flex-col overflow-hidden">
          {tasksCreated && moduleId ? (
            <div className="flex flex-col h-full overflow-y-auto p-5 gap-4">
              {/* Post-build success state */}
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
                <p className="text-sm font-medium text-green-400">Build queued — {createdTaskIds.length} tasks created</p>
                <p className="text-xs text-mission-control-text-dim mt-0.5">{spec.name}</p>
              </div>
              <ModuleBuildProgress moduleId={moduleId} />
            </div>
          ) : (
            <SpecPreviewPanel
              spec={spec}
              sectionProgress={sectionProgress}
              isComplete={isComplete}
              wireframe={flow.wireframe}
              liveTasks={flow.liveTasks}
              onGenerateTasks={handleBuildClick}
              onExportJson={handleExportJson}
              onRegenerateWireframe={() => flow.generateWireframe(spec)}
            />
          )}
        </div>
      </div>

      {/* Build review modal */}
      {showBuildReview && (
        <BuildReviewModal
          spec={spec as ModuleSpec}
          moduleId={moduleId || ''}
          wireframe={flow.wireframe}
          onConfirm={handleConfirmBuild}
          onCancel={() => setShowBuildReview(false)}
        />
      )}
    </div>
  );
}
