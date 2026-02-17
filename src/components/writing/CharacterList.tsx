import { Pencil, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useMemoryStore } from '../../store/memoryStore';
import { useWritingStore } from '../../store/writingStore';
import CharacterForm from './CharacterForm';
import { useConfirmDialog } from '../ConfirmDialog';

export default function CharacterList() {
  const { characters, editingId, setEditingId, addCharacter, updateCharacter, deleteCharacter } = useMemoryStore();
  const { activeProjectId } = useWritingStore();

  const [deleteTarget, setDeleteTarget] = useState<{id: string, name: string} | null>(null);
  const deleteDialog = useConfirmDialog();

  if (!activeProjectId) return null;

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    deleteDialog.showConfirm({
      title: 'Delete Character',
      message: `Delete character "${name}"?`,
      confirmLabel: 'Delete',
      type: 'danger',
    }, () => {
      if (deleteTarget) {
        deleteCharacter(activeProjectId, deleteTarget.id);
        setDeleteTarget(null);
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-1 p-2">
        {characters.length === 0 && editingId !== 'new-character' && (
          <p className="text-[11px] text-clawd-text-dim text-center py-4">No characters yet</p>
        )}

        {characters.map((char) =>
          editingId === char.id ? (
            <CharacterForm
              key={char.id}
              character={char}
              onCancel={() => setEditingId(null)}
              onSave={(data) => updateCharacter(activeProjectId, char.id, data)}
            />
          ) : (
            <div
              key={char.id}
              className="group p-2 rounded bg-clawd-bg/30 hover:bg-clawd-bg/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-1">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-clawd-text">{char.name}</span>
                  {char.relationship && (
                    <span className="text-[10px] text-clawd-text-dim ml-1">({char.relationship})</span>
                  )}
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => setEditingId(char.id)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border transition-colors"
                    title="Edit"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => handleDelete(char.id, char.name)}
                    className="p-0.5 rounded text-clawd-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
              {char.description && (
                <p className="text-[10px] text-clawd-text-dim mt-0.5 line-clamp-2">{char.description}</p>
              )}
              {char.traits.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {char.traits.map((t) => (
                    <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-clawd-border/50 text-clawd-text-dim">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {editingId === 'new-character' && (
          <CharacterForm
            onCancel={() => setEditingId(null)}
            onSave={(data) => addCharacter(activeProjectId, data)}
          />
        )}
      </div>

      {editingId !== 'new-character' && (
        <div className="p-2 border-t border-clawd-border flex-shrink-0">
          <button
            onClick={() => setEditingId('new-character')}
            className="flex items-center gap-1.5 w-full px-2 py-1 rounded text-xs text-clawd-text-dim hover:bg-clawd-border hover:text-clawd-text transition-colors"
          >
            <Plus size={14} />
            Add Character
          </button>
        </div>
      )}
    </div>
  );
}
