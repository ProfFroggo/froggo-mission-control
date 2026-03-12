// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// Phase 100: StreamingText — typewriter cursor + memoized markdown rendering
import { memo } from 'react';
import MarkdownMessage from './MarkdownMessage';

interface StreamingTextProps {
  content: string;
  streaming: boolean;
  className?: string;
  onArtifactOpen?: (lang: string, code: string) => void;
}

/**
 * StreamingText renders agent response text progressively with a blinking cursor
 * while streaming is in progress. When streaming is false the cursor hides.
 *
 * Uses React.memo so the component only re-renders when content or streaming
 * changes — not when parent state unrelated to this message updates.
 */
export const StreamingText = memo(function StreamingText({
  content,
  streaming,
  className,
  onArtifactOpen,
}: StreamingTextProps) {
  return (
    <div className={className}>
      <MarkdownMessage content={content} onArtifactOpen={onArtifactOpen} />
      {streaming && (
        <span
          className="streaming-cursor"
          aria-hidden="true"
        />
      )}
    </div>
  );
});

export default StreamingText;
