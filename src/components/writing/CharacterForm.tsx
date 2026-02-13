import { useState } from 'react';
import type { CharacterProfile } from '../../store/memoryStore';

interface CharacterFormProps {
  character?: CharacterProfile;
  onCancel: () => void;
  onSave: (data: Omit<CharacterProfile, 'id'>) => void;
}

export default function CharacterForm({ character, onCancel, onSave }: CharacterFormProps) {
  const [name, setName] = useState(character?.name ?? '');
  const [relationship, setRelationship] = useState(character?.relationship ?? '');
  const [description, setDescription] = useState(character?.description ?? '');
  const [traitsText, setTraitsText] = useState(character?.traits?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    const traits = traitsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await onSave({ name: name.trim(), relationship: relationship.trim(), description: description.trim(), traits });
    setSaving(false);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-clawd-bg/50 rounded border border-clawd-border">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
        autoFocus
      />
      <input
        type="text"
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        placeholder="Relationship (e.g. father, friend)"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent resize-none"
      />
      <input
        type="text"
        value={traitsText}
        onChange={(e) => setTraitsText(e.target.value)}
        placeholder="Traits (comma-separated)"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="px-2 py-0.5 rounded bg-clawd-accent text-white text-[10px] font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40"
        >
          {saving ? '...' : character ? 'Update' : 'Add'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2 py-0.5 rounded text-clawd-text-dim text-[10px] hover:bg-clawd-border transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
