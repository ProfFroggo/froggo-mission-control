import { useState, useEffect } from 'react';
import { Plus, Settings, Inbox } from 'lucide-react';
import { Box, Flex } from '@radix-ui/themes';
import FolderManager from './FolderManager';
import ErrorDisplay from './ErrorDisplay';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FolderTabsProps {
  selectedFolder: number | null;
  onSelectFolder: (folderId: number | null) => void;
  onRefresh?: () => void;
  onConversationDrop?: (sessionKey: string, folderId: number) => void;
}

interface SortableFolderTabProps {
  folder: MessageFolder;
  isActive: boolean;
  onClick: () => void;
  isOver?: boolean;
}

function SortableFolderTab({ folder, isActive, onClick, isOver }: SortableFolderTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id });

  const { setNodeRef: setDroppableRef, isOver: isDropOver } = useDroppable({
    id: folder.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Combine refs
  const setRefs = (node: HTMLButtonElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  return (
    <button
      type="button"
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-3 min-w-[140px] transition-colors
        border-b-2 -mb-px whitespace-nowrap cursor-move
        ${isActive 
          ? 'border-mission-control-accent text-mission-control-accent bg-mission-control-accent/5'
          : isDropOver || isOver
          ? 'border-success text-mission-control-text bg-success/10'
          : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
        }
      `}
    >
      <span className="text-lg">{folder.icon}</span>
      <span className="font-medium text-sm">{folder.name}</span>
      {(folder.conversation_count ?? 0) > 0 && (
        <span className={`
          text-xs px-2 py-0.5 rounded-full
          ${isActive 
            ? 'bg-mission-control-accent text-white' 
            : 'bg-mission-control-border text-mission-control-text-dim'
          }
        `}>
          {folder.conversation_count}
        </span>
      )}
    </button>
  );
}

export default function FolderTabs({ selectedFolder, onSelectFolder, onRefresh, onConversationDrop }: FolderTabsProps) {
  const [folders, setFolders] = useState<MessageFolder[]>([]);
  const [folderLoadError, setFolderLoadError] = useState<Error | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [allSessionsCount, setAllSessionsCount] = useState(0);
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    })
  );

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    setFolderLoadError(null);
    try {
      const result = await fetch('/api/library?action=folders').then(r => r.ok ? r.json() : { success: false });
      if (result?.success) {
        const sortedFolders = (result?.folders || []).sort((a: MessageFolder, b: MessageFolder) =>
          (a as any).sort_order - (b as any).sort_order
        );
        setFolders(sortedFolders);

        // Calculate total sessions count
        const total = sortedFolders.reduce((sum: number, f: MessageFolder) => sum + (f.conversation_count ?? 0), 0);
        setAllSessionsCount(total);
      }
    } catch (err) {
      setFolderLoadError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDragOverFolder(null);

    if (!over) return;

    // Check if we're dragging a conversation (session key) onto a folder
    if (typeof active.id === 'string' && active.id.includes('agent:') && typeof over.id === 'number') {
      // This is a conversation being dropped on a folder
      const sessionKey = active.id as string;
      const folderId = over.id as number;
      
      if (onConversationDrop) {
        onConversationDrop(sessionKey, folderId);
        loadFolders();
      }
      return;
    }

    // Otherwise, handle folder reordering
    if (over && active.id !== over.id && typeof active.id === 'number' && typeof over.id === 'number') {
      const oldIndex = folders.findIndex(f => f.id === active.id);
      const newIndex = folders.findIndex(f => f.id === over.id);

      const reorderedFolders = arrayMove(folders, oldIndex, newIndex);
      setFolders(reorderedFolders);

      // Update sort order in database
      try {
        for (let i = 0; i < reorderedFolders.length; i++) {
          await fetch('/api/library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'folder-update', id: reorderedFolders[i].id, sort_order: i }),
          });
        }
      } catch {
        // Reload on error to restore previous order
        loadFolders();
      }
    }
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over && typeof over.id === 'number') {
      setDragOverFolder(over.id);
    } else {
      setDragOverFolder(null);
    }
  };

  const handleCreateFolder = () => {
    setShowManager(true);
  };

  const handleManagerClose = () => {
    setShowManager(false);
    loadFolders();
    if (onRefresh) onRefresh();
  };

  return (
    <>
      <Box className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" className="overflow-x-auto scrollbar-thin scrollbar-thumb-mission-control-border scrollbar-track-transparent">
          {/* All Sessions Tab */}
          <button
            type="button"
            onClick={() => onSelectFolder(null)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 -mb-px min-w-[140px] whitespace-nowrap text-sm font-medium transition-colors ${
              selectedFolder === null
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Inbox size={16} />
            All Messages
            {allSessionsCount > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                selectedFolder === null
                  ? 'bg-mission-control-accent/20 text-mission-control-accent'
                  : 'bg-mission-control-border text-mission-control-text-dim'
              }`}>
                {allSessionsCount}
              </span>
            )}
          </button>

          {/* Folder load error */}
          {folderLoadError && (
            <Box px="2" py="1" flexGrow="1" minWidth="0">
              <ErrorDisplay
                error={folderLoadError}
                onRetry={loadFolders}
                inline
                context={{ action: 'load folders' }}
              />
            </Box>
          )}

          {/* Folder Tabs (Draggable & Droppable) */}
          {!folderLoadError && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
            >
              <SortableContext
                items={folders.map(f => f.id)}
                strategy={horizontalListSortingStrategy}
              >
                {folders.map((folder) => (
                  <SortableFolderTab
                    key={folder.id}
                    folder={folder}
                    isActive={selectedFolder === folder.id}
                    onClick={() => onSelectFolder(folder.id)}
                    isOver={dragOverFolder === folder.id}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {/* Action Buttons */}
          <Flex align="center" gap="1" px="2" className="ml-auto border-l border-mission-control-border">
            <button
              type="button"
              onClick={handleCreateFolder}
              title="Create new folder"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowManager(true)}
              title="Manage folders"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Settings size={16} />
            </button>
          </Flex>
        </Flex>
      </Box>

      {/* Folder Manager Modal */}
      {showManager && (
        <FolderManager
          onClose={handleManagerClose}
          onSelect={(folderId) => {
            onSelectFolder(folderId);
            setShowManager(false);
          }}
        />
      )}
    </>
  );
}
