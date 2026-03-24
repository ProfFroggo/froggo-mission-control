import { Check } from 'lucide-react';
import { IconButton } from '@radix-ui/themes';

interface FeedbackAlternativeProps {
  index: number;
  text: string;
  commentary?: string;
  onAccept: (text: string) => void;
}

export default function FeedbackAlternative({ index, text, commentary, onAccept }: FeedbackAlternativeProps) {
  return (
    <div className="bg-mission-control-surface border-l-2 border-mission-control-accent/40 rounded px-3 py-2 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-mission-control-text-dim">
          Alternative {index + 1}
        </span>
        <p className="text-sm text-mission-control-text mt-0.5 whitespace-pre-wrap">{text}</p>
        {commentary && (
          <p className="text-xs text-mission-control-accent/80 mt-1 italic">{commentary}</p>
        )}
      </div>
      <IconButton
        onClick={() => onAccept(text)}
        size="1"
        variant="ghost"
       
        title="Accept this alternative"
        aria-label="Accept this alternative"
      >
        <Check className="w-4 h-4" />
      </IconButton>
    </div>
  );
}
