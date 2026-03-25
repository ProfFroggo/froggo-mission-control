import { useState, useEffect, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePanelConfigStore, PanelConfig } from '../store/panelConfig';
import { Toggle } from './Toggle';

function SortableItem({ panel, isLastVisible, onToggle }: {
  panel: PanelConfig;
  isLastVisible: boolean;
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: panel.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 py-2.5 border-b border-mission-control-border/40 last:border-0 transition-shadow ${
        isDragging ? 'shadow-xl scale-[1.02] rounded-lg bg-mission-control-surface px-2' : ''
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${panel.label}`}
        className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
      >
        <GripVertical size={16} />
      </button>
      <div className="w-8 h-8 rounded-lg bg-mission-control-border/30 flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-semibold text-mission-control-text-dim uppercase select-none">
          {panel.label.slice(0, 2)}
        </span>
      </div>
      <span className="flex-1 text-sm font-medium text-mission-control-text">{panel.label}</span>
      <Toggle
        checked={panel.visible}
        onChange={(_checked) => onToggle(panel.id)}
        disabled={panel.visible && isLastVisible}
        size="sm"
      />
    </div>
  );
}

export default function EditPanelsModal() {
  const { panels: savedPanels, editModalOpen, closeEditModal, savePanels, resetPanels } = usePanelConfigStore();
  const [draft, setDraft] = useState<PanelConfig[]>([]);

  useEffect(() => {
    if (editModalOpen) {
      const sorted = [...savedPanels].sort((a, b) => a.order - b.order);
      setDraft(sorted);
    }
  }, [editModalOpen, savedPanels]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleCount = draft.filter(p => p.visible).length;

  const handleToggle = useCallback((id: string) => {
    setDraft(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setDraft(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id);
        const newIndex = prev.findIndex(p => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleSave = () => {
    savePanels(draft.map((p, i) => ({ ...p, order: i })));
  };

  const handleReset = () => {
    resetPanels();
    // Also update local draft from defaults
    const { panels } = usePanelConfigStore.getState();
    setDraft([...panels].sort((a, b) => a.order - b.order));
  };

  // Close on Escape
  useEffect(() => {
    if (!editModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEditModal();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editModalOpen, closeEditModal]);

  if (!editModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') closeEditModal(); }}
      role="button"
      tabIndex={0}
      aria-label="Close edit panels modal"
    >
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <span className="text-base font-semibold text-mission-control-text">Edit Panels</span>
            <p className="text-xs text-mission-control-text-dim mt-0.5">Showing {visibleCount} of {draft.length} panels</p>
          </div>
          <button
            type="button"
            onClick={closeEditModal}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Panel list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={draft.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {draft.map(panel => (
                <SortableItem
                  key={panel.id}
                  panel={panel}
                  isLastVisible={panel.visible && visibleCount <= 1}
                  onToggle={handleToggle}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button
            onClick={handleReset}
            variant="soft"
            color="gray"
            size="2"
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            variant="solid"
            size="2"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
