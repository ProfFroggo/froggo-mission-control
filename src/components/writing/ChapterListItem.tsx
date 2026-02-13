import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { WritingChapter } from '../../store/writingStore';

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
    if (window.confirm(`Delete "${chapter.title}"? This cannot be undone.`)) {
      onDelete();
    }
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(chapter.title);
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameConfirm();
            if (e.key === 'Escape') handleRenameCancel();
          }}
          onBlur={handleRenameConfirm}
          className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-accent text-clawd-text text-xs focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 transition-colors group relative ${
        isActive
          ? 'bg-clawd-border/50 border-l-2 border-l-clawd-accent'
          : 'hover:bg-clawd-border/30 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-clawd-text-dim font-mono">
              {chapter.position + 1}.
            </span>
            <span className="text-xs font-medium text-clawd-text truncate">
              {chapter.title}
            </span>
          </div>
          <span className="text-[10px] text-clawd-text-dim ml-4">
            {chapter.wordCount.toLocaleString()} words
          </span>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={handleStartRename}
            className="p-1 rounded text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border transition-colors"
            title="Rename chapter"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 rounded text-clawd-text-dim hover:text-error hover:bg-error-subtle transition-colors"
            title="Delete chapter"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </button>
  );
}
