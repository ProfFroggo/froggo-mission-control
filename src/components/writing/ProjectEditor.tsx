import { useState } from 'react';
import { BookOpen, History } from 'lucide-react';
import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import ContextPanel from './ContextPanel';
import VersionPanel from './VersionPanel';
import { useWritingStore } from '../../store/writingStore';

export default function ProjectEditor() {
  const { activeChapterId } = useWritingStore();
  const [contextOpen, setContextOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  const toggleContext = () => {
    setContextOpen((v) => !v);
    if (!contextOpen) setVersionOpen(false); // mutually exclusive
  };

  const toggleVersion = () => {
    setVersionOpen((v) => !v);
    if (!versionOpen) setContextOpen(false); // mutually exclusive
  };

  return (
    <div className="flex h-full">
      <ChapterSidebar />
      <div className="flex-1 min-w-0 relative">
        {activeChapterId ? (
          <ChapterEditor />
        ) : (
          <div className="flex items-center justify-center h-full text-clawd-text-dim">
            <div className="text-center space-y-1">
              <p className="text-sm">Select a chapter to start writing</p>
              <p className="text-xs">or create a new chapter from the sidebar</p>
            </div>
          </div>
        )}
        {/* Panel toggle buttons */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {activeChapterId && (
            <button
              onClick={toggleVersion}
              className={`p-1.5 rounded transition-colors ${
                versionOpen
                  ? 'bg-clawd-accent/20 text-clawd-accent'
                  : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
              }`}
              title={versionOpen ? 'Hide version history' : 'Show version history'}
            >
              <History size={16} />
            </button>
          )}
          <button
            onClick={toggleContext}
            className={`p-1.5 rounded transition-colors ${
              contextOpen
                ? 'bg-clawd-accent/20 text-clawd-accent'
                : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
            }`}
            title={contextOpen ? 'Hide context panel' : 'Show context panel'}
          >
            <BookOpen size={16} />
          </button>
        </div>
      </div>
      {contextOpen && <ContextPanel />}
      {versionOpen && <VersionPanel onClose={() => setVersionOpen(false)} />}
    </div>
  );
}
