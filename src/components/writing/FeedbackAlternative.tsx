import { Check } from 'lucide-react';

interface FeedbackAlternativeProps {
  index: number;
  text: string;
  commentary?: string;
  onAccept: (text: string) => void;
}

export default function FeedbackAlternative({ index, text, commentary, onAccept }: FeedbackAlternativeProps) {
  return (
    <div className="bg-clawd-surface border-l-2 border-clawd-accent/40 rounded px-3 py-2 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-clawd-text-dim">
          Alternative {index + 1}
        </span>
        <p className="text-sm text-clawd-text mt-0.5 whitespace-pre-wrap">{text}</p>
        {commentary && (
          <p className="text-xs text-indigo-400/80 mt-1 italic">{commentary}</p>
        )}
      </div>
      <button
        onClick={() => onAccept(text)}
        className="flex-shrink-0 p-1 rounded hover:bg-clawd-accent/20 text-clawd-text-dim hover:text-clawd-accent transition-colors"
        title="Accept this alternative"
      >
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}
