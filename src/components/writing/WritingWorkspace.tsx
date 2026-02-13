import { useEffect } from 'react';
import { useWritingStore } from '../../store/writingStore';
import ProjectSelector from './ProjectSelector';
import ProjectEditor from './ProjectEditor';

export default function WritingWorkspace() {
  const {
    activeProjectId,
    activeProject,
    loadProjects,
  } = useWritingStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

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
