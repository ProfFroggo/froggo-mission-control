import { useState, useRef, useEffect } from 'react';
import { useWritingStore } from '../../store/writingStore';
import ChapterListItem from './ChapterListItem';
import { ArrowLeft, Plus, ChevronDown } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

export default function ChapterSidebar() {
  const {
    activeProject,
    activeChapterId,
    closeProject,
    openChapter,
    createChapter,
    renameChapter,
    deleteChapter,
    reorderChapters,
  } = useWritingStore();

  const [showAddInput, setShowAddInput] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [chaptersCollapsed, setChaptersCollapsed] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (showAddInput && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [showAddInput]);

  if (!activeProject) return null;

  const chapters = [...activeProject.chapters].sort((a, b) => a.position - b.position);

  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);

  const handleCreateChapter = async () => {
    const trimmed = newTitle.trim();
    if (!trimmed || creating) return;

    setCreating(true);
    const id = await createChapter(trimmed);
    if (id) {
      setNewTitle('');
      setShowAddInput(false);
      // Auto-open the new chapter
      await openChapter(id);
    }
    setCreating(false);
  };

  const handleCancelAdd = () => {
    setNewTitle('');
    setShowAddInput(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = chapters.findIndex(c => c.id === active.id);
      const newIndex = chapters.findIndex(c => c.id === over.id);
      const newOrder = arrayMove(chapters, oldIndex, newIndex);
      await reorderChapters(newOrder.map(c => c.id));
    }
  };

  return (
    <div className="w-64 h-full flex flex-col bg-clawd-surface border-r border-clawd-border flex-shrink-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-clawd-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={closeProject}
            className="p-1 rounded text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
            title="Back to projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-clawd-text truncate">
              {activeProject.title}
            </h2>
            <p className="text-[10px] text-clawd-text-dim">
              {totalWords.toLocaleString()} words total
            </p>
          </div>
        </div>
      </div>

      {/* Add chapter button */}
      <div className="px-3 py-2 border-b border-clawd-border flex-shrink-0">
        {showAddInput ? (
          <div className="space-y-1.5">
            <input
              ref={addInputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChapter();
                if (e.key === 'Escape') handleCancelAdd();
              }}
              placeholder="Chapter title..."
              className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
              disabled={creating}
            />
            <div className="flex gap-1">
              <button
                onClick={handleCreateChapter}
                disabled={!newTitle.trim() || creating}
                className="px-2 py-0.5 rounded bg-clawd-accent text-white text-[10px] font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40"
              >
                {creating ? '...' : 'Add'}
              </button>
              <button
                onClick={handleCancelAdd}
                className="px-2 py-0.5 rounded text-clawd-text-dim text-[10px] hover:bg-clawd-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddInput(true)}
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
          >
            <Plus size={14} />
            Add Chapter
          </button>
        )}
      </div>

      {/* Chapters section header */}
      <button
        onClick={() => setChaptersCollapsed(!chaptersCollapsed)}
        className="px-3 py-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-clawd-text-dim hover:text-clawd-text transition-colors flex-shrink-0"
      >
        <span>Chapters ({chapters.length})</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${chaptersCollapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto">
        {chaptersCollapsed ? null : chapters.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-clawd-text-dim">
            No chapters yet. Add your first chapter.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={chapters.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {chapters.map((chapter) => (
                <ChapterListItem
                  key={chapter.id}
                  chapter={chapter}
                  isActive={activeChapterId === chapter.id}
                  onSelect={() => openChapter(chapter.id)}
                  onRename={(title) => renameChapter(chapter.id, title)}
                  onDelete={() => deleteChapter(chapter.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
