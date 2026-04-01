import { useState, useRef, useEffect } from 'react';
import { useWritingStore } from '../../store/writingStore';
import ChapterListItem from './ChapterListItem';
import { ArrowLeft, Plus, ChevronDown } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';
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
    <Flex direction="column" width="100%" height="100%" className="bg-mission-control-surface border-r border-mission-control-border flex-shrink-0 min-w-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-mission-control-border flex-shrink-0">
        <Flex align="center" gap="2">
          <button
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            onClick={closeProject}
            title="Back to projects"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-mission-control-text truncate">
              {activeProject.title}
            </h2>
            <p className="text-[10px] text-mission-control-text-dim">
              {totalWords.toLocaleString()} words total
            </p>
          </div>
        </Flex>
      </div>

      {/* Add chapter button */}
      <div className="px-3 py-2 border-b border-mission-control-border flex-shrink-0">
        {showAddInput ? (
          <div className="space-y-1.5">
            <TextField.Root
              ref={addInputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChapter();
                if (e.key === 'Escape') handleCancelAdd();
              }}
              placeholder="Chapter title..."
              size="1"
              disabled={creating}
            />
            <Flex gap="1">
              <Button
                size="1"
                variant="solid"
                onClick={handleCreateChapter}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? '...' : 'Add'}
              </Button>
              <button
                type="button"
                onClick={handleCancelAdd}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              >
                Cancel
              </button>
            </Flex>
          </div>
        ) : (
          <button
            className="inline-flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            onClick={() => setShowAddInput(true)}
          >
            <Plus size={14} />
            Add Chapter
          </button>
        )}
      </div>

      {/* Chapters section header */}
      <button
        type="button"
        onClick={() => setChaptersCollapsed(!chaptersCollapsed)}
        className="inline-flex items-center justify-between w-full px-3 py-1.5 flex-shrink-0 text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors uppercase tracking-wider"
        style={{ fontSize: '10px' }}
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
          <div className="px-3 py-6 text-center text-[11px] text-mission-control-text-dim">
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
    </Flex>
  );
}
