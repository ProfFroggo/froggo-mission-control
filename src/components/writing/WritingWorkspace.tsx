import { useEffect, useState } from 'react';
import { useWritingStore } from '../../store/writingStore';
import { useWizardStore } from '../../store/wizardStore';
import { AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import ProjectSelector from './ProjectSelector';
import ProjectEditor from './ProjectEditor';
import SetupWizard from './SetupWizard';

// Wizard bridge removed — state is managed in the Zustand store

interface PendingWizard {
  sessionId: string;
  step: string;
  brainDump?: string;
  messages?: any[];
  selectedAgent?: string;
  plan?: any;
}

export default function WritingWorkspace() {
  const {
    activeProjectId,
    activeProject,
    loadProjects,
  } = useWritingStore();

  const { step: wizardStep, loadState } = useWizardStore();

  const [pendingWizard, setPendingWizard] = useState<PendingWizard | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Detect pending wizard sessions on mount
  useEffect(() => {
    if (wizardStep !== 'idle' || activeProjectId) return;

    // Wizard list not available via web — no pending wizards to detect
    return () => {};
  }, [wizardStep, activeProjectId]);

  const handleResume = () => {
    if (!pendingWizard) return;
    loadState({
      step: pendingWizard.step as any,
      sessionId: pendingWizard.sessionId,
      messages: pendingWizard.messages || [],
      selectedAgent: pendingWizard.selectedAgent || 'writer',
      brainDump: pendingWizard.brainDump || '',
      plan: pendingWizard.plan || null,
    });
    setShowResumePrompt(false);
    setPendingWizard(null);
  };

  const handleDiscard = async () => {
    // Wizard state cleanup — no IPC needed
    setShowResumePrompt(false);
    setPendingWizard(null);
  };

  // Wizard active — show wizard UI
  if (wizardStep !== 'idle') {
    return <SetupWizard />;
  }

  // No active project — show project list (with optional resume banner)
  if (!activeProjectId || !activeProject) {
    return (
      <div className="h-full flex flex-col">
        {showResumePrompt && pendingWizard && (
          <div className="mx-4 mt-4 p-3 rounded-lg border border-mission-control-accent/30 bg-mission-control-accent/5 flex items-center gap-3">
            <AlertCircle size={18} className="text-mission-control-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-mission-control-text font-medium">Unfinished book plan</p>
              <p className="text-xs text-mission-control-text-dim truncate">
                {pendingWizard.brainDump
                  ? `"${pendingWizard.brainDump.slice(0, 80)}${pendingWizard.brainDump.length > 80 ? '...' : ''}"`
                  : 'In progress'}
              </p>
            </div>
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mission-control-accent text-white text-xs font-medium hover:bg-mission-control-accent-dim transition-colors flex-shrink-0"
            >
              <RotateCcw size={12} />
              Resume
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-mission-control-border text-xs text-mission-control-text-dim hover:text-error hover:border-error-border transition-colors flex-shrink-0"
            >
              <Trash2 size={12} />
              Discard
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ProjectSelector />
        </div>
      </div>
    );
  }

  // Active project — full editor with chapter sidebar
  return (
    <div className="h-full bg-mission-control-bg">
      <ProjectEditor />
    </div>
  );
}
