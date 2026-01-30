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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={`unstyled relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 border-0 p-0 ${
        checked ? 'bg-[#8b5cf6]' : 'bg-[#3a3a3a]'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

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
      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[#2a2a2a] transition-shadow ${
        isDragging ? 'shadow-xl shadow-black/40 scale-[1.02]' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-[#666] hover:text-[#999] cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
        aria-label={`Drag to reorder ${panel.label}`}
      >
        <GripVertical size={20} />
      </button>
      <span className="flex-1 text-white text-sm font-medium">{panel.label}</span>
      <Toggle
        checked={panel.visible}
        onChange={() => onToggle(panel.id)}
        disabled={panel.visible && isLastVisible}
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeEditModal(); }}
    >
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-[#2a2a2a]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Panels</h2>
            <p className="text-sm text-[#888] mt-1">Showing {visibleCount} of {draft.length} Panels</p>
          </div>
          <button
            onClick={closeEditModal}
            className="text-[#888] hover:text-white transition-colors p-1"
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
        <div className="flex gap-3 p-6 pt-4 border-t border-[#2a2a2a]">
          <button
            onClick={handleReset}
            className="flex-1 py-3 rounded-xl border border-[#444] text-white font-semibold text-sm hover:bg-[#2a2a2a] transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 rounded-xl bg-[#8b5cf6] text-white font-semibold text-sm hover:bg-[#7c3aed] transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
