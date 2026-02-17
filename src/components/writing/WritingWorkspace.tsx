import { useEffect, useState } from 'react';
import { useWritingStore } from '../../store/writingStore';
import { useWizardStore } from '../../store/wizardStore';
import { AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import ProjectSelector from './ProjectSelector';
import ProjectEditor from './ProjectEditor';
import SetupWizard from './SetupWizard';

const bridge = () => window.clawdbot?.writing?.wizard;

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

    let cancelled = false;
    (async () => {
      try {
        const result = await bridge()?.list();
        if (cancelled) return;
        if (result?.success && result.wizards?.length > 0) {
          setPendingWizard(result.wizards[0]);
          setShowResumePrompt(true);
        }
      } catch {
        // Silent — no pending wizards
      }
    })();
    return () => { cancelled = true; };
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
    if (pendingWizard?.sessionId) {
      try {
        await bridge()?.delete(pendingWizard.sessionId);
      } catch {
        // best-effort
      }
    }
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
          <div className="mx-4 mt-4 p-3 rounded-lg border border-clawd-accent/30 bg-clawd-accent/5 flex items-center gap-3">
            <AlertCircle size={18} className="text-clawd-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-clawd-text font-medium">Unfinished book plan</p>
              <p className="text-xs text-clawd-text-dim truncate">
                {pendingWizard.brainDump
                  ? `"${pendingWizard.brainDump.slice(0, 80)}${pendingWizard.brainDump.length > 80 ? '...' : ''}"`
                  : 'In progress'}
              </p>
            </div>
            <button
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clawd-accent text-white text-xs font-medium hover:bg-clawd-accent-dim transition-colors flex-shrink-0"
            >
              <RotateCcw size={12} />
              Resume
            </button>
            <button
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-clawd-border text-xs text-clawd-text-dim hover:text-error hover:border-error-border transition-colors flex-shrink-0"
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
    <div className="h-full bg-clawd-bg">
      <ProjectEditor />
    </div>
  );
}
