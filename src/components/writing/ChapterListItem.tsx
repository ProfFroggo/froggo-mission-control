import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, GripVertical } from 'lucide-react';
import { Button, IconButton, TextField } from '@radix-ui/themes';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WritingChapter } from '../../store/writingStore';
import ConfirmDialog, { useConfirmDialog } from '../ConfirmDialog';

interface ChapterListItemProps {
  chapter: WritingChapter;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function ChapterListItem({
  chapter,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: ChapterListItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chapter.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const deleteDialog = useConfirmDialog();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleRenameConfirm = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== chapter.title) {
      onRename(trimmed);
    }
    setEditing(false);
  };

  const handleRenameCancel = () => {
    setEditTitle(chapter.title);
    setEditing(false);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteDialog.showConfirm({
      title: 'Delete Chapter',
      message: `Delete "${chapter.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, onDelete);
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(chapter.title);
    setEditing(true);
  };

  if (editing) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center group">
        <div className="px-3 py-2 flex-1">
          <TextField.Root
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameConfirm();
              if (e.key === 'Escape') handleRenameCancel();
            }}
            onBlur={handleRenameConfirm}
            size="1"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={setNodeRef} style={style} className="flex items-center group">
        <IconButton
          {...attributes}
          {...listeners}
          size="1"
          variant="ghost"
         
          className="ml-1 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Drag to reorder ${chapter.title}`}
        >
          <GripVertical size={14} />
        </IconButton>
        <Button
          variant={isActive ? 'soft' : 'ghost'}
          size="1"
          onClick={onSelect}
          className={`flex-1 text-left px-2 py-2 relative ${
            isActive ? 'border-l-2 border-l-mission-control-accent' : 'border-l-2 border-l-transparent'
          }`}
        >
          <div className="flex items-start justify-between min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-mission-control-text-dim font-mono">
                  {chapter.position + 1}.
                </span>
                <span className="text-xs font-medium text-mission-control-text truncate">
                  {chapter.title}
                </span>
              </div>
              <span className="text-[10px] text-mission-control-text-dim ml-4">
                {chapter.wordCount.toLocaleString()} words
              </span>
            </div>

            {/* Action buttons — visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <IconButton
                size="1"
                variant="ghost"
               
                onClick={handleStartRename}
                title="Rename chapter"
              >
                <Pencil size={12} />
              </IconButton>
              <IconButton
                size="1"
                variant="ghost"
               
                onClick={handleDelete}
                title="Delete chapter"
              >
                <Trash2 size={12} />
              </IconButton>
            </div>
          </div>
        </Button>
      </div>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={deleteDialog.closeConfirm}
        onConfirm={deleteDialog.onConfirm || (() => {})}
        {...deleteDialog.config}
      />
    </>
  );
}
