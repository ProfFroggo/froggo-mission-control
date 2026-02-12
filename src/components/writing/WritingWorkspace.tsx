import { useEffect } from 'react';
import { useWritingStore } from '../../store/writingStore';
import ProjectSelector from './ProjectSelector';
import { ArrowLeft } from 'lucide-react';

export default function WritingWorkspace() {
  const {
    activeProjectId,
    activeProject,
    loadProjects,
    closeProject,
  } = useWritingStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // No active project — show project list
  if (!activeProjectId || !activeProject) {
    return <ProjectSelector />;
  }

  // Active project — placeholder for Plan 03's ProjectEditor
  return (
    <div className="h-full flex flex-col bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-clawd-border">
        <button
          onClick={closeProject}
          className="p-1.5 rounded-lg text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
          title="Back to projects"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-clawd-text">{activeProject.title}</h1>
          <p className="text-xs text-clawd-text-dim">
            {activeProject.type === 'memoir' ? 'Memoir' : 'Novel'}
            {' \u00B7 '}
            {activeProject.chapterCount} {activeProject.chapterCount === 1 ? 'chapter' : 'chapters'}
            {' \u00B7 '}
            {activeProject.wordCount.toLocaleString()} words
          </p>
        </div>
      </div>

      {/* Placeholder body — Plan 03 replaces this with ProjectEditor */}
      <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
        <div className="text-center space-y-2">
          <p className="text-sm">Editor loading in Plan 03...</p>
          <p className="text-xs">
            {activeProject.chapters.length} chapters ready
          </p>
        </div>
      </div>
    </div>
  );
}
