import { useState } from 'react';
import { Button, Flex, TextField, Select, TextArea } from '@radix-ui/themes';
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
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-mission-control-bg/50 rounded border border-mission-control-border">
      <TextField.Root
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (required)"
        size="1"
      />
      <TextField.Root
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author"
        size="1"
      />
      <Select.Root value={type} onValueChange={(val) => setType(val as ResearchSource['type'])} size="1">
        <Select.Trigger className="w-full" />
        <Select.Content>
          {SOURCE_TYPES.map((t) => (
            <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      <TextField.Root
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL"
        size="1"
      />
      <TextArea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        rows={2}
        size="1"
        style={{ resize: 'none' }}
      />
      <Flex gap="1">
        <Button
          type="submit"
          size="1"
          variant="solid"
          disabled={!title.trim() || saving}
        >
          {saving ? '...' : source ? 'Update' : 'Add'}
        </Button>
        <Button
          type="button"
          size="1"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </Flex>
    </form>
  );
}
