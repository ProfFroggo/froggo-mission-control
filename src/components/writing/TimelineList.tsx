import { Pencil, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { Flex } from '@radix-ui/themes';
import { useMemoryStore } from '../../store/memoryStore';
import { useWritingStore } from '../../store/writingStore';
import TimelineForm from './TimelineForm';
import ConfirmDialog, { useConfirmDialog } from '../ConfirmDialog';

export default function TimelineList() {
  const { timeline, editingId, setEditingId, addTimelineEvent, updateTimelineEvent, deleteTimelineEvent } =
    useMemoryStore();
  const { activeProjectId } = useWritingStore();

  const [deleteTarget, setDeleteTarget] = useState<{id: string, date: string} | null>(null);
  const deleteDialog = useConfirmDialog();

  if (!activeProjectId) return null;

  const sorted = [...timeline].sort((a, b) => a.position - b.position);

  const handleDelete = (id: string, date: string) => {
    setDeleteTarget({ id, date });
    deleteDialog.showConfirm({
      title: 'Delete Event',
      message: `Delete event "${date}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, () => {
      if (deleteTarget) {
        deleteTimelineEvent(activeProjectId, deleteTarget.id);
        setDeleteTarget(null);
      }
    });
  };

  return (
    <Flex direction="column" height="100%">
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {sorted.length === 0 && editingId !== 'new-timeline' && (
          <p className="text-[11px] text-mission-control-text-dim text-center py-4">No timeline events yet</p>
        )}

        {sorted.map((evt) =>
          editingId === evt.id ? (
            <TimelineForm
              key={evt.id}
              event={evt}
              nextPosition={sorted.length}
              onCancel={() => setEditingId(null)}
              onSave={(data) => updateTimelineEvent(activeProjectId, evt.id, data)}
            />
          ) : (
            <div
              key={evt.id}
              className="group p-2 rounded bg-mission-control-bg/30 hover:bg-mission-control-border/40 transition-colors"
            >
              <Flex align="start" justify="between" gap="1">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-mission-control-accent">{evt.date}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    onClick={() => setEditingId(evt.id)}
                    title="Edit"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                    onClick={() => handleDelete(evt.id, evt.date)}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </Flex>
              <p className="text-[10px] text-mission-control-text-dim mt-0.5 line-clamp-2">{evt.description}</p>
            </div>
          ),
        )}

        {editingId === 'new-timeline' && (
          <TimelineForm
            nextPosition={sorted.length}
            onCancel={() => setEditingId(null)}
            onSave={(data) => addTimelineEvent(activeProjectId, data)}
          />
        )}
      </div>

      {editingId !== 'new-timeline' && (
        <div className="p-2 border-t border-mission-control-border flex-shrink-0">
          <button
            className="inline-flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            onClick={() => setEditingId('new-timeline')}
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
      )}

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => {
          deleteDialog.closeConfirm();
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTimelineEvent(activeProjectId, deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        {...deleteDialog.config}
      />
    </Flex>
  );
}
