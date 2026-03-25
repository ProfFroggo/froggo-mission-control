import { useState } from 'react';
import { Button, Flex, TextField, TextArea } from '@radix-ui/themes';
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
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-mission-control-bg/50 rounded border border-mission-control-border">
      <TextField.Root
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        size="1"
      />
      <TextField.Root
        value={relationship}
        onChange={(e) => setRelationship(e.target.value)}
        placeholder="Relationship (e.g. father, friend)"
        size="1"
      />
      <TextArea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        rows={3}
        size="1"
        style={{ resize: 'none' }}
      />
      <TextField.Root
        value={traitsText}
        onChange={(e) => setTraitsText(e.target.value)}
        placeholder="Traits (comma-separated)"
        size="1"
      />
      <Flex gap="1">
        <Button
          type="submit"
          size="1"
          variant="solid"
          disabled={!name.trim() || saving}
        >
          {saving ? '...' : character ? 'Update' : 'Add'}
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
