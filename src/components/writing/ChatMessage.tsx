import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowDownToLine, Copy, Check, RotateCcw } from 'lucide-react';
import { useWritingStore } from '../../store/writingStore';
import { useChatPaneStore, type ChatMessage as ChatMessageType } from '../../store/chatPaneStore';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  streamContent?: string;
  onRetry?: (userContent: string) => void;
}

export default function ChatMessage({ message, isStreaming, streamContent, onRetry }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const content = isStreaming ? (streamContent || '') : message.content;
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some contexts
    }
  };

  const handleSendToEditor = () => {
    useWritingStore.getState().setPendingInsert({
      content: message.content,
      mode: 'append',
      sourceMessageId: message.id,
    });
    useChatPaneStore.getState().markInserted(message.id);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-3 dark">
        <div className="max-w-[85%] bg-clawd-accent/50 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start mb-3 group dark">
      <div className="max-w-[90%]">
        <div className="text-xs text-clawd-text-dim mb-1 capitalize">{message.agent}</div>
        <div className="bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-sm text-clawd-text">
          {isStreaming ? (
            <div className="prose-sm">
              <ReactMarkdown>{content}</ReactMarkdown>
              <span className="inline-block w-1.5 h-4 bg-clawd-accent/70 animate-pulse ml-0.5 align-text-bottom" />
            </div>
          ) : (
            <div className="prose-sm">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
        {/* Action buttons — visible on hover, hidden while streaming */}
        {!isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {message.insertedToEditor ? (
              <span className="flex items-center gap-1 text-xs text-clawd-accent/70 px-1.5 py-0.5">
                <Check className="w-3 h-3" />
                Inserted
              </span>
            ) : (
              <button
                onClick={handleSendToEditor}
                className="flex items-center gap-1 text-xs text-clawd-text-dim hover:text-clawd-accent px-1.5 py-0.5 rounded hover:bg-clawd-accent/10 transition-colors"
                title="Send to editor"
              >
                <ArrowDownToLine className="w-3 h-3" />
                Send to editor
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-clawd-text-dim hover:text-clawd-text px-1.5 py-0.5 rounded hover:bg-clawd-border transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {onRetry && (
              <button
                onClick={() => onRetry(message.content)}
                className="flex items-center gap-1 text-xs text-clawd-text-dim hover:text-clawd-text px-1.5 py-0.5 rounded hover:bg-clawd-border transition-colors"
                title="Retry — remove this response and re-send the question"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
