import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import ContextPanel from './ContextPanel';
import { useWritingStore } from '../../store/writingStore';

export default function ProjectEditor() {
  const { activeChapterId } = useWritingStore();
  const [contextOpen, setContextOpen] = useState(false);

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
        {/* Context panel toggle */}
        <button
          onClick={() => setContextOpen((v) => !v)}
          className={`absolute top-2 right-2 z-10 p-1.5 rounded transition-colors ${
            contextOpen
              ? 'bg-clawd-accent/20 text-clawd-accent'
              : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text'
          }`}
          title={contextOpen ? 'Hide context panel' : 'Show context panel'}
        >
          <BookOpen size={16} />
        </button>
      </div>
      {contextOpen && <ContextPanel />}
    </div>
  );
}
