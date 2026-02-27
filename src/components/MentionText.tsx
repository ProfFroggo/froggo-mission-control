import { useMemo } from 'react';

interface MentionTextProps {
  text: string;
  agentIds: string[];
  agentNames: Record<string, string>; // id -> name mapping
  currentUserId?: string; // highlight differently if mentioning current user
}

/**
 * Renders text with highlighted @mentions
 */
export default function MentionText({ text, agentIds, agentNames, currentUserId }: MentionTextProps) {
  const rendered = useMemo(() => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    
    // Build regex to match @agentName or @agent-id
    const patterns: { id: string; pattern: RegExp }[] = [];
    agentIds.forEach(id => {
      const name = agentNames[id] || id;
      // Match @name or @id (case insensitive, word boundary)
      patterns.push({ 
        id, 
        pattern: new RegExp(`(@${name}\\b|@${id}\\b)`, 'gi') 
      });
    });

    // Find all mentions
    const mentions: { start: number; end: number; id: string; text: string }[] = [];
    patterns.forEach(({ id, pattern }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        mentions.push({
          start: match.index,
          end: match.index + match[0].length,
          id,
          text: match[0],
        });
      }
    });

    // Sort by position
    mentions.sort((a, b) => a.start - b.start);

    // Remove overlapping mentions (keep first match)
    const validMentions = mentions.filter((m, i) => {
      if (i === 0) return true;
      return m.start >= mentions[i - 1].end;
    });

    // Build rendered parts
    validMentions.forEach((mention, i) => {
      // Add text before mention
      if (mention.start > lastIndex) {
        parts.push(text.slice(lastIndex, mention.start));
      }

      // Add highlighted mention
      const isSelf = mention.id === currentUserId;
      parts.push(
        <span
          key={`mention-${i}`}
          className={`font-medium px-1.5 py-0.5 rounded ${
            isSelf
              ? 'bg-clawd-accent/20 text-clawd-accent'
              : 'bg-clawd-border/50 text-clawd-text'
          }`}
        >
          {mention.text}
        </span>
      );

      lastIndex = mention.end;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, [text, agentIds, agentNames, currentUserId]);

  return <span className="whitespace-pre-wrap leading-relaxed">{rendered}</span>;
}
