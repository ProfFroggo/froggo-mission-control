import { useEffect } from 'react';
import { Pencil, Trash2, Plus, Link2 } from 'lucide-react';
import { useMemoryStore } from '../../store/memoryStore';
import { useWritingStore } from '../../store/writingStore';
import { useResearchStore } from '../../store/researchStore';
import FactForm from './FactForm';

const statusBadge: Record<string, string> = {
  verified: 'bg-success-subtle text-success',
  unverified: 'bg-warning-subtle text-warning',
  disputed: 'bg-error-subtle text-error',
  'needs-source': 'bg-info-subtle text-info',
};

const statusLabel: Record<string, string> = {
  verified: 'V',
  unverified: '?',
  disputed: 'D',
  'needs-source': 'S',
};

export default function FactList() {
  const { facts, editingId, setEditingId, addFact, updateFact, deleteFact } = useMemoryStore();
  const { activeProjectId } = useWritingStore();
  const { factSourceMap, loadAllFactLinks } = useResearchStore();

  // Load linked source counts when facts change
  useEffect(() => {
    if (activeProjectId && facts.length > 0) {
      loadAllFactLinks(activeProjectId, facts.map((f) => f.id));
    }
  }, [activeProjectId, facts, loadAllFactLinks]);

  if (!activeProjectId) return null;

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this fact?')) {
      deleteFact(activeProjectId, id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {facts.length === 0 && editingId !== 'new-fact' && (
          <p className="text-[11px] text-clawd-text-dim text-center py-4">No facts yet</p>
        )}

        {facts.map((fact) =>
          editingId === fact.id ? (
            <FactForm
              key={fact.id}
              fact={fact}
              onCancel={() => setEditingId(null)}
              onSave={(data) => updateFact(activeProjectId, fact.id, data)}
            />
          ) : (
            <div
              key={fact.id}
              className="group p-2 rounded bg-clawd-bg/30 hover:bg-clawd-bg/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-start gap-1.5 flex-1 min-w-0">
                  <span
                    className={`text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${statusBadge[fact.status] ?? statusBadge.unverified}`}
                  >
                    {statusLabel[fact.status] ?? '?'}
                  </span>
                  {(factSourceMap[fact.id]?.length || 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] text-clawd-text-dim flex-shrink-0" title={`${factSourceMap[fact.id].length} linked source(s)`}>
                      <Link2 size={9} />
                      {factSourceMap[fact.id].length}
                    </span>
                  )}
                  <span className="text-[10px] text-clawd-text line-clamp-2">{fact.claim}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => setEditingId(fact.id)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border transition-colors"
                    title="Edit"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => handleDelete(fact.id)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {fact.source && (
                <p className="text-[9px] text-clawd-text-dim mt-0.5 ml-5">source: {fact.source}</p>
              )}
            </div>
          ),
        )}

        {editingId === 'new-fact' && (
          <FactForm
            onCancel={() => setEditingId(null)}
            onSave={(data) => addFact(activeProjectId, data)}
          />
        )}
      </div>

      {editingId !== 'new-fact' && (
        <div className="p-2 border-t border-clawd-border flex-shrink-0">
          <button
            onClick={() => setEditingId('new-fact')}
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
          >
            <Plus size={14} />
            Add Fact
          </button>
        </div>
      )}
    </div>
  );
}
