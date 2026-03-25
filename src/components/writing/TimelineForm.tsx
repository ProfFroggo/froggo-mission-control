import { useState } from 'react';
import { Button, Flex, TextField, TextArea } from '@radix-ui/themes';
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
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-mission-control-bg/50 rounded border border-mission-control-border">
      <TextField.Root
        value={date}
        onChange={(e) => setDate(e.target.value)}
        placeholder="Date (e.g. Summer 1995)"
        size="1"
      />
      <TextArea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What happened?"
        rows={3}
        size="1"
        style={{ resize: 'none' }}
      />
      <Flex gap="1">
        <Button
          type="submit"
          size="1"
          variant="solid"
          disabled={!date.trim() || !description.trim() || saving}
        >
          {saving ? '...' : event ? 'Update' : 'Add'}
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
