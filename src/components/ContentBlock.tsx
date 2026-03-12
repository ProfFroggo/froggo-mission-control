import { useState } from 'react';
import { ChevronDown, ChevronRight, Zap, Code } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';

interface ContentBlockProps {
  block: {
    type: string;
    text?: string;
    name?: string;
    input?: any;
    id?: string;
  };
  index: number;
  onArtifactOpen?: (lang: string, code: string) => void;
}

export default function ContentBlock({ block, index: _index, onArtifactOpen }: ContentBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Text blocks - render normally
  if (block.type === 'text') {
    return <MarkdownMessage content={block.text || ''} onArtifactOpen={onArtifactOpen} />;
  }

  // Thinking blocks - collapsible with icon (skip empty ones)
  if (block.type === 'thinking') {
    if (!block.text?.trim()) return null;
    return (
      <div className="my-3 border border-mission-control-border/50 rounded-lg bg-mission-control-bg/30 overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-mission-control-border/30 transition-colors text-left"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Zap size={14} className="text-violet-500" />
          <span className="text-xs font-medium text-mission-control-text-dim">
            Thinking...
          </span>
          <span className="ml-auto text-[10px] text-mission-control-text-dim/60">
            {block.text?.length || 0} chars
          </span>
        </button>
        {isExpanded && (
          <div className="px-4 py-3 border-t border-mission-control-border/50 text-xs text-mission-control-text-dim leading-relaxed whitespace-pre-wrap font-mono">
            {block.text}
          </div>
        )}
      </div>
    );
  }

  // Tool use blocks - show tool name and input
  if (block.type === 'tool_use') {
    return (
      <div className="my-3 border border-blue-500/30 rounded-lg bg-blue-500/5 overflow-hidden">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 flex items-center gap-2 hover:bg-blue-500/10 transition-colors text-left"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Code size={14} className="text-blue-500" />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            {block.name || 'tool'}
          </span>
          {block.id && (
            <span className="ml-auto text-[10px] text-mission-control-text-dim/60 font-mono">
              {block.id.slice(0, 8)}
            </span>
          )}
        </button>
        {isExpanded && (
          <div className="px-4 py-3 border-t border-blue-500/30">
            <div className="text-[10px] text-mission-control-text-dim/60 uppercase tracking-wide mb-1">
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

  // Tool result blocks
  if (block.type === 'tool_result') {
    const isError = block.text?.includes('error') || block.text?.includes('Error');
    return (
      <div className={`my-3 border rounded-lg overflow-hidden ${
        isError 
          ? 'border-red-500/30 bg-red-500/5' 
          : 'border-green-500/30 bg-green-500/5'
      }`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`w-full px-3 py-2 flex items-center gap-2 transition-colors text-left ${
            isError ? 'hover:bg-red-500/10' : 'hover:bg-green-500/10'
          }`}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className={`text-xs font-medium ${
            isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
          }`}>
            {isError ? '⚠️ Error' : '✓ Result'}
          </span>
          <span className="ml-auto text-[10px] text-mission-control-text-dim/60">
            {block.text?.length || 0} chars
          </span>
        </button>
        {isExpanded && (
          <div className={`px-4 py-3 border-t ${
            isError ? 'border-red-500/30' : 'border-green-500/30'
          }`}>
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
}
