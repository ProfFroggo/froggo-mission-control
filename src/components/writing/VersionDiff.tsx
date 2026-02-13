import { X } from 'lucide-react';

interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

interface VersionDiffProps {
  changes: DiffChange[];
  versionLabel: string;
  onClose: () => void;
}

export default function VersionDiff({ changes, versionLabel, onClose }: VersionDiffProps) {
  return (
    <div className="border-t border-clawd-border bg-clawd-bg p-3 flex flex-col max-h-[60vh]">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="text-xs font-medium text-clawd-text truncate pr-2">
          Comparing: <span className="text-clawd-accent">{versionLabel}</span> vs Current
        </div>
        <button
          onClick={onClose}
          className="p-1 text-clawd-text-dim hover:text-clawd-text rounded transition-colors flex-shrink-0"
          title="Close diff"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-clawd-text-dim flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-red-900/30 rounded-sm" />
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-green-900/30 rounded-sm" />
          Added
        </span>
      </div>
      <div className="overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-clawd-text">
        {changes.map((part, i) => (
          <span
            key={i}
            className={
              part.added
                ? 'bg-green-900/30 text-green-300'
                : part.removed
                  ? 'bg-red-900/30 text-red-300 line-through'
                  : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    </div>
  );
}
