import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, ExternalLink } from 'lucide-react';
import { useResearchStore } from '../../store/researchStore';
import { useWritingStore } from '../../store/writingStore';
import SourceForm from './SourceForm';
import type { ResearchSource } from '../../store/researchStore';
import ConfirmDialog, { useConfirmDialog } from '../ConfirmDialog';

const typeBadge: Record<string, { abbr: string }> = {
  book: { abbr: 'BK' },
  article: { abbr: 'AR' },
  interview: { abbr: 'IV' },
  website: { abbr: 'WB' },
  document: { abbr: 'DC' },
  other: { abbr: 'OT' },
};

export default function SourceList() {
  const { sources, editingId, setEditingId, loadSources, addSource, updateSource, deleteSource } = useResearchStore();
  const { activeProjectId } = useWritingStore();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const deleteDialog = useConfirmDialog();

  // Load sources when tab becomes visible
  useEffect(() => {
    if (activeProjectId) {
      loadSources(activeProjectId);
    }
  }, [activeProjectId, loadSources]);

  if (!activeProjectId) return null;

  const handleDelete = (id: string) => {
    setDeleteTarget(id);
    deleteDialog.showConfirm({
      title: 'Delete Source',
      message: 'Delete this source?',
      confirmLabel: 'Delete',
      type: 'danger',
    }, () => {
      if (deleteTarget) {
        deleteSource(activeProjectId, deleteTarget);
        setDeleteTarget(null);
      }
    });
  };

  const handleSave = (data: Omit<ResearchSource, 'id' | 'created_at' | 'updated_at'>) => {
    addSource(activeProjectId, data);
  };

  const handleUpdate = (id: string, data: Omit<ResearchSource, 'id' | 'created_at' | 'updated_at'>) => {
    updateSource(activeProjectId, id, data);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {sources.length === 0 && editingId !== 'new-source' && (
          <p className="text-[11px] text-clawd-text-dim text-center py-4">No sources yet</p>
        )}

        {sources.map((source) =>
          editingId === source.id ? (
            <SourceForm
              key={source.id}
              source={source}
              onCancel={() => setEditingId(null)}
              onSave={(data) => handleUpdate(source.id, data)}
            />
          ) : (
            <div
              key={source.id}
              className="group p-2 rounded bg-clawd-bg/30 hover:bg-clawd-bg/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 bg-clawd-accent/20 text-clawd-accent">
                    {typeBadge[source.type]?.abbr ?? 'OT'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-clawd-text font-medium line-clamp-1">{source.title}</span>
                    {source.author && (
                      <p className="text-[9px] text-clawd-text-dim">{source.author}</p>
                    )}
                  </div>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-0.5 text-clawd-text-dim hover:text-clawd-accent transition-colors flex-shrink-0"
                      title={source.url}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => setEditingId(source.id)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border transition-colors"
                    title="Edit"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {source.notes && (
                <p className="text-[9px] text-clawd-text-dim mt-0.5 ml-5 line-clamp-2">{source.notes}</p>
              )}
            </div>
          ),
        )}

        {editingId === 'new-source' && (
          <SourceForm
            onCancel={() => setEditingId(null)}
            onSave={handleSave}
          />
        )}
      </div>

      {editingId !== 'new-source' && (
        <div className="p-2 border-t border-clawd-border flex-shrink-0">
          <button
            onClick={() => setEditingId('new-source')}
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
          >
            <Plus size={14} />
            Add Source
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
            deleteSource(activeProjectId, deleteTarget);
            setDeleteTarget(null);
          }
        }}
        {...deleteDialog.config}
      />
    </div>
  );
}
