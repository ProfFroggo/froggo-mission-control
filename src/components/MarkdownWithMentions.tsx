import { useMemo } from 'react';
import MarkdownMessage from './MarkdownMessage';

interface MarkdownWithMentionsProps {
  content: string;
  agentIds: string[];
  agentNames: Record<string, string>; // id -> name mapping
}

/**
 * Wraps MarkdownMessage with @mention highlighting preprocessing
 */
export default function MarkdownWithMentions({ content, agentIds, agentNames }: MarkdownWithMentionsProps) {
  const processedContent = useMemo(() => {
    if (!content) return content;

    let result = content;
    
    // Build patterns for @agentName or @agent-id
    agentIds.forEach(id => {
      const name = agentNames[id] || id;
      // Replace @name or @id with styled span (markdown-safe HTML)
      const namePattern = new RegExp(`(@${name}\\b)`, 'gi');
      const idPattern = new RegExp(`(@${id}\\b)`, 'gi');
      
      result = result.replace(namePattern, '<span class="mention-highlight">$1</span>');
      result = result.replace(idPattern, '<span class="mention-highlight">$1</span>');
    });

    return result;
  }, [content, agentIds, agentNames]);

  // Add CSS for mention highlighting
  return (
    <>
      <style>{`
        .mention-highlight {
          font-weight: 500;
          background-color: rgba(var(--clawd-accent-rgb, 99, 102, 241), 0.15);
          color: var(--clawd-accent, #6366f1);
          padding: 2px 6px;
          border-radius: 4px;
        }
      `}</style>
      <MarkdownMessage content={processedContent} />
    </>
  );
}
