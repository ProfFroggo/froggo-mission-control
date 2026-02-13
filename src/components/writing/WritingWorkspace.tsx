import { useEffect } from 'react';
import { useWritingStore } from '../../store/writingStore';
import { useWizardStore } from '../../store/wizardStore';
import ProjectSelector from './ProjectSelector';
import ProjectEditor from './ProjectEditor';
import SetupWizard from './SetupWizard';

export default function WritingWorkspace() {
  const {
    activeProjectId,
    activeProject,
    loadProjects,
  } = useWritingStore();

  const { step: wizardStep } = useWizardStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Wizard active — show wizard UI
  if (wizardStep !== 'idle') {
    return <SetupWizard />;
  }

  // No active project — show project list
  if (!activeProjectId || !activeProject) {
    return <ProjectSelector />;
  }

  // Active project — full editor with chapter sidebar
  return (
    <div className="h-full bg-clawd-bg">
      <ProjectEditor />
    </div>
  );
}
