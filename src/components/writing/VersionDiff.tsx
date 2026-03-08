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
    <div className="border-t border-mission-control-border bg-mission-control-bg p-3 flex flex-col max-h-[60vh]">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="text-xs font-medium text-mission-control-text truncate pr-2">
          Comparing: <span className="text-mission-control-accent">{versionLabel}</span> vs Current
        </div>
        <button
          onClick={onClose}
          className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded transition-colors flex-shrink-0"
          title="Close diff"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-mission-control-text-dim flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-error-subtle rounded-sm" />
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-success-subtle rounded-sm" />
          Added
        </span>
      </div>
      <div className="overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-mission-control-text">
        {changes.map((part, i) => (
          <span
            key={i}
            className={
              part.added
                ? 'bg-success-subtle text-success'
                : part.removed
                  ? 'bg-error-subtle text-error line-through'
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
