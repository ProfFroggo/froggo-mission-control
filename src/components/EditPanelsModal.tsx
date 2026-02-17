import { useState, useEffect, useCallback } from 'react';
import { X, GripVertical } from 'lucide-react';
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
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-clawd-surface border border-clawd-border transition-shadow ${
        isDragging ? 'shadow-xl scale-[1.02]' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-clawd-text-dim hover:text-clawd-text cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        aria-label={`Drag to reorder ${panel.label}`}
      >
        <GripVertical size={20} />
      </button>
      <span className="flex-1 text-clawd-text text-sm font-medium">{panel.label}</span>
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
      setDraft([...savedPanels].sort((a, b) => a.order - b.order));
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
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') closeEditModal(); }}
      role="button"
      tabIndex={0}
      aria-label="Close edit panels modal"
    >
      <div className="glass-modal rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-clawd-text">Edit Panels</h2>
            <p className="text-sm text-clawd-text-dim mt-1">Showing {visibleCount} of {draft.length} Panels</p>
          </div>
          <button
            onClick={closeEditModal}
            className="text-clawd-text-dim hover:text-clawd-text transition-colors p-1"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        {/* Panel list */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-2">
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
        <div className="flex gap-3 p-6 pt-4 border-t border-clawd-border">
          <button
            onClick={handleReset}
            className="flex-1 py-3 rounded-xl border border-clawd-border text-clawd-text font-semibold text-sm hover:bg-clawd-surface transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-clawd-accent text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
