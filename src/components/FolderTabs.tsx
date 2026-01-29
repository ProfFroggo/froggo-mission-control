import { useState, useEffect } from 'react';
import { Folder, Plus, Settings, X, Inbox } from 'lucide-react';
import FolderManager from './FolderManager';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

interface MessageFolder {
  id: number;
  name: string;
  icon: string;
  color: string;
  conversation_count: number;
}

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
      ref={setRefs}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-4 py-3 min-w-[140px] transition-all
        border-b-2 whitespace-nowrap cursor-move
        ${isActive 
          ? 'border-clawd-accent text-clawd-accent bg-clawd-accent/5' 
          : isDropOver || isOver
          ? 'border-green-500 text-clawd-text bg-green-500/10'
          : 'border-transparent text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border/30'
        }
      `}
    >
      <span className="text-lg">{folder.icon}</span>
      <span className="font-medium text-sm">{folder.name}</span>
      {folder.conversation_count > 0 && (
        <span className={`
          text-xs px-2 py-0.5 rounded-full
          ${isActive 
            ? 'bg-clawd-accent text-white' 
            : 'bg-clawd-border text-clawd-text-dim'
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
    try {
      const result = await window.clawdbot.folders.list();
      if (result.success) {
        const sortedFolders = (result.folders || []).sort((a: MessageFolder, b: MessageFolder) => 
          (a as any).sort_order - (b as any).sort_order
        );
        setFolders(sortedFolders);
        
        // Calculate total sessions count
        const total = sortedFolders.reduce((sum: number, f: MessageFolder) => sum + f.conversation_count, 0);
        setAllSessionsCount(total);
      }
    } catch (error) {
      console.error('[FolderTabs] Failed to load folders:', error);
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
          await window.clawdbot.folders.update(reorderedFolders[i].id, {
            sort_order: i
          });
        }
      } catch (error) {
        console.error('[FolderTabs] Failed to update folder order:', error);
        // Reload on error
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
      <div className="border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-clawd-border scrollbar-track-transparent">
          {/* All Sessions Tab */}
          <button
            onClick={() => onSelectFolder(null)}
            className={`
              relative flex items-center gap-2 px-4 py-3 min-w-[140px] transition-all
              border-b-2 whitespace-nowrap
              ${selectedFolder === null 
                ? 'border-clawd-accent text-clawd-accent bg-clawd-accent/5' 
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border/30'
              }
            `}
          >
            <Inbox size={16} />
            <span className="font-medium text-sm">All Messages</span>
            {allSessionsCount > 0 && (
              <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${selectedFolder === null 
                  ? 'bg-clawd-accent text-white' 
                  : 'bg-clawd-border text-clawd-text-dim'
                }
              `}>
                {allSessionsCount}
              </span>
            )}
          </button>

          {/* Folder Tabs (Draggable & Droppable) */}
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

          {/* Action Buttons */}
          <div className="flex items-center gap-1 px-2 ml-auto border-l border-clawd-border">
            <button
              onClick={handleCreateFolder}
              className="p-2 rounded-lg text-clawd-text-dim hover:text-clawd-accent hover:bg-clawd-border/50 transition-colors"
              title="Create new folder"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setShowManager(true)}
              className="p-2 rounded-lg text-clawd-text-dim hover:text-clawd-accent hover:bg-clawd-border/50 transition-colors"
              title="Manage folders"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </div>

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
