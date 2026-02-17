import { useState } from 'react';
import type { ResearchSource } from '../../store/researchStore';

interface SourceFormProps {
  source?: ResearchSource;
  onCancel: () => void;
  onSave: (data: Omit<ResearchSource, 'id' | 'created_at' | 'updated_at'>) => void;
}

const SOURCE_TYPES: { value: ResearchSource['type']; label: string }[] = [
  { value: 'book', label: 'Book' },
  { value: 'article', label: 'Article' },
  { value: 'interview', label: 'Interview' },
  { value: 'website', label: 'Website' },
  { value: 'document', label: 'Document' },
  { value: 'other', label: 'Other' },
];

export default function SourceForm({ source, onCancel, onSave }: SourceFormProps) {
  const [title, setTitle] = useState(source?.title ?? '');
  const [author, setAuthor] = useState(source?.author ?? '');
  const [type, setType] = useState<ResearchSource['type']>(source?.type ?? 'other');
  const [url, setUrl] = useState(source?.url ?? '');
  const [notes, setNotes] = useState(source?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    await onSave({
      title: title.trim(),
      author: author.trim(),
      type,
      url: url.trim(),
      notes: notes.trim(),
    });
    setSaving(false);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-clawd-bg/50 rounded border border-clawd-border">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (required)"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <input
        type="text"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as ResearchSource['type'])}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs focus:outline-none focus:border-clawd-accent"
      >
        {SOURCE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent resize-none"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="px-2 py-0.5 rounded bg-clawd-accent text-white text-[10px] font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40"
        >
          {saving ? '...' : source ? 'Update' : 'Add'}
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
