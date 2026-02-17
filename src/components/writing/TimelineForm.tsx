import { useState } from 'react';
import type { TimelineEvent } from '../../store/memoryStore';

interface TimelineFormProps {
  event?: TimelineEvent;
  onCancel: () => void;
  onSave: (data: Omit<TimelineEvent, 'id'>) => void;
  nextPosition: number;
}

export default function TimelineForm({ event, onCancel, onSave, nextPosition }: TimelineFormProps) {
  const [date, setDate] = useState(event?.date ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date.trim() || !description.trim() || saving) return;

    setSaving(true);
    await onSave({
      date: date.trim(),
      description: description.trim(),
      chapterRefs: event?.chapterRefs ?? [],
      position: event?.position ?? nextPosition,
    });
    setSaving(false);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-clawd-bg/50 rounded border border-clawd-border">
      <input
        type="text"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        placeholder="Date (e.g. Summer 1995)"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What happened?"
        rows={3}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent resize-none"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={!date.trim() || !description.trim() || saving}
          className="px-2 py-0.5 rounded bg-clawd-accent text-white text-[10px] font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40"
        >
          {saving ? '...' : event ? 'Update' : 'Add'}
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
