import React, { useState } from 'react';
import { ChevronDown, Zap, Code, AlertTriangle, Check } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';

interface ContentBlockProps {
  block: {
    type: string;
    text?: string;
    name?: string;
    input?: any;
    id?: string;
    is_error?: boolean;
  };
  index: number;
  streaming?: boolean;
  onArtifactOpen?: (lang: string, code: string) => void;
}

const PREVIEW_LENGTH = 80;

const ContentBlock = React.memo(function ContentBlock({ block, index: _index, streaming, onArtifactOpen }: ContentBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Text blocks - render normally
  if (block.type === 'text') {
    return <MarkdownMessage content={block.text || ''} onArtifactOpen={onArtifactOpen} />;
  }

  // Thinking blocks - collapsible with info accent
  if (block.type === 'thinking') {
    if (!streaming && !block.text?.trim()) return null;
    const preview = !isExpanded && block.text && block.text.length > PREVIEW_LENGTH
      ? `${block.text.slice(0, PREVIEW_LENGTH)}…`
      : '';
    return (
      <div className="my-3 border-l-2 border-l-[var(--color-info)] bg-mission-control-bg rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/20 transition-colors justify-start"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
          <Zap size={14} className="text-[var(--color-info)] flex-shrink-0" />
          <span className="text-xs font-medium text-mission-control-text-dim">
            Thinking...
          </span>
          {!isExpanded && preview && (
            <span className="text-[10px] text-mission-control-text-dim/60 truncate flex-1 text-left ml-1">
              {preview}
            </span>
          )}
          {streaming ? (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--color-info)] animate-pulse flex-shrink-0" />
          ) : (
            <span className="ml-auto text-[10px] text-mission-control-text-dim/60 flex-shrink-0">
              {block.text?.length || 0} chars
            </span>
          )}
        </button>
        {isExpanded && block.text && (
          <div className="px-4 py-3 border-t border-mission-control-border/50 text-xs text-mission-control-text-dim leading-relaxed whitespace-pre-wrap font-mono">
            {block.text}
          </div>
        )}
      </div>
    );
  }

  // Tool use blocks - warning accent
  if (block.type === 'tool_use') {
    const inputPreview = !isExpanded && block.input
      ? JSON.stringify(block.input).slice(0, PREVIEW_LENGTH)
      : '';
    return (
      <div className="my-3 border-l-2 border-l-[var(--color-warning)] bg-mission-control-bg rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/20 transition-colors justify-start"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
          <Code size={14} className="text-[var(--color-warning)] flex-shrink-0" />
          <span className="text-xs font-medium text-[var(--color-warning)]">
            {block.name || 'tool'}
          </span>
          {!isExpanded && inputPreview && (
            <span className="text-[10px] text-mission-control-text-dim/60 truncate flex-1 text-left ml-1">
              {inputPreview}
            </span>
          )}
          {streaming ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-info)] bg-[var(--color-info)]/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
              <span className="w-1 h-1 rounded-full bg-[var(--color-info)] animate-pulse flex-shrink-0" />
              Running...
            </span>
          ) : (
            block.id && (
              <span className="ml-auto text-[10px] text-mission-control-text-dim/60 font-mono flex-shrink-0">
                {block.id.slice(0, 8)}
              </span>
            )
          )}
        </button>
        {isExpanded && (
          <div className="px-4 py-3 border-t border-mission-control-border/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">
              Input
            </div>
            <pre className="text-xs bg-mission-control-bg rounded p-2 overflow-x-auto font-mono">
              {JSON.stringify(block.input, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Tool result blocks — success or error accent
  if (block.type === 'tool_result') {
    const isError = block.is_error || block.text?.includes('error') || block.text?.includes('Error');
    const accentClass = isError
      ? 'border-l-[var(--color-error)]'
      : 'border-l-[var(--color-success)]';
    const iconColorClass = isError ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]';
    const textPreview = !isExpanded && block.text
      ? block.text.slice(0, PREVIEW_LENGTH)
      : '';
    return (
      <div className={`my-3 border-l-2 ${accentClass} bg-mission-control-bg rounded-lg overflow-hidden`}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 w-full px-3 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/20 transition-colors justify-start"
        >
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className={`inline-flex items-center gap-1 text-xs font-medium flex-shrink-0 ${iconColorClass}`}>
            {isError ? <AlertTriangle size={14} /> : <Check size={14} />}
            {isError ? 'Error' : 'Result'}
          </span>
          {!isExpanded && textPreview && (
            <span className="text-[10px] text-mission-control-text-dim/60 truncate flex-1 text-left ml-1">
              {textPreview}
            </span>
          )}
          <span className="ml-auto text-[10px] text-mission-control-text-dim/60 flex-shrink-0">
            {block.text?.length || 0} chars
          </span>
        </button>
        {isExpanded && (
          <div className="px-4 py-3 border-t border-mission-control-border/50">
            <pre className="text-xs bg-mission-control-bg rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap">
              {block.text}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Unknown block type - render raw
  return (
    <div className="my-3 border border-mission-control-border rounded-lg bg-mission-control-bg/50 px-3 py-2">
      <div className="text-xs text-mission-control-text-dim">
        Unknown block type: <code className="font-mono">{block.type}</code>
      </div>
    </div>
  );
});

export default ContentBlock;
