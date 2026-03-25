import { useState } from 'react';
import { Button, Flex, TextField, Select, TextArea } from '@radix-ui/themes';
import type { VerifiedFact } from '../../store/memoryStore';

interface FactFormProps {
  fact?: VerifiedFact;
  onCancel: () => void;
  onSave: (data: Omit<VerifiedFact, 'id'>) => void;
}

export default function FactForm({ fact, onCancel, onSave }: FactFormProps) {
  const [claim, setClaim] = useState(fact?.claim ?? '');
  const [source, setSource] = useState(fact?.source ?? '');
  const [status, setStatus] = useState<VerifiedFact['status']>(fact?.status ?? 'unverified');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim.trim() || saving) return;

    setSaving(true);
    await onSave({ claim: claim.trim(), source: source.trim(), status });
    setSaving(false);
    onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-mission-control-surface rounded border border-mission-control-border">
      <TextArea
        value={claim}
        onChange={(e) => setClaim(e.target.value)}
        placeholder="Fact or claim"
        rows={2}
        size="1"
        style={{ resize: 'none' }}
      />
      <TextField.Root
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Source (e.g. interview, document)"
        size="1"
      />
      <Select.Root value={status} onValueChange={(val) => setStatus(val as VerifiedFact['status'])} size="1">
        <Select.Trigger className="w-full" />
        <Select.Content>
          <Select.Item value="unverified">Unverified</Select.Item>
          <Select.Item value="verified">Verified</Select.Item>
          <Select.Item value="disputed">Disputed</Select.Item>
          <Select.Item value="needs-source">Needs Source</Select.Item>
        </Select.Content>
      </Select.Root>
      <Flex gap="1">
        <Button
          type="submit"
          size="1"
          variant="solid"
          disabled={!claim.trim() || saving}
        >
          {saving ? '...' : fact ? 'Update' : 'Add'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          Cancel
        </button>
      </Flex>
    </form>
  );
}
