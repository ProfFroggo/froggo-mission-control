import { X } from 'lucide-react';
import { Flex } from '@radix-ui/themes';

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
    <Flex direction="column" p="3" className="border-t border-mission-control-border bg-mission-control-bg max-h-[60vh]">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="text-xs font-medium text-mission-control-text truncate pr-2">
          Comparing: <span className="text-mission-control-accent">{versionLabel}</span> vs Current
        </div>
        <button
          onClick={onClose}
          title="Close diff"
          aria-label="Close diff"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-mission-control-text-dim flex-shrink-0">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-error/10 rounded-sm" />
          Removed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 bg-success/10 rounded-sm" />
          Added
        </span>
      </div>
      <div className="overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-mission-control-text">
        {changes.map((part, i) => (
          <span
            key={i}
            className={
              part.added
                ? 'bg-success/10 text-success'
                : part.removed
                  ? 'bg-error/10 text-error line-through'
                  : ''
            }
          >
            {part.value}
          </span>
        ))}
      </div>
    </Flex>
  );
}
