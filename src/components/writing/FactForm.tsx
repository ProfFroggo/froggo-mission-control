import { useState } from 'react';
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
    <form onSubmit={handleSubmit} className="p-2 space-y-2 bg-clawd-bg/50 rounded border border-clawd-border">
      <textarea
        value={claim}
        onChange={(e) => setClaim(e.target.value)}
        placeholder="Fact or claim"
        rows={2}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent resize-none"
      />
      <input
        type="text"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Source (e.g. interview, document)"
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as VerifiedFact['status'])}
        className="w-full px-2 py-1 rounded bg-clawd-bg border border-clawd-border text-clawd-text text-xs focus:outline-none focus:border-clawd-accent"
      >
        <option value="unverified">Unverified</option>
        <option value="verified">Verified</option>
        <option value="disputed">Disputed</option>
        <option value="needs-source">Needs Source</option>
      </select>
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={!claim.trim() || saving}
          className="px-2 py-0.5 rounded bg-clawd-accent text-white text-[10px] font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40"
        >
          {saving ? '...' : fact ? 'Update' : 'Add'}
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
