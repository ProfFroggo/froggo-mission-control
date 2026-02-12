import ChapterSidebar from './ChapterSidebar';
import ChapterEditor from './ChapterEditor';
import { useWritingStore } from '../../store/writingStore';

export default function ProjectEditor() {
  const { activeChapterId } = useWritingStore();

  return (
    <div className="flex h-full">
      <ChapterSidebar />
      <div className="flex-1 min-w-0">
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
      </div>
    </div>
  );
}
