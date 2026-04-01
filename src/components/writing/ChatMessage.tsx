import { useState } from 'react';
import MarkdownMessage from '../MarkdownMessage';
import { ArrowDownToLine, Copy, Check, RotateCcw } from 'lucide-react';
import { Flex, Box } from '@radix-ui/themes';
import { useWritingStore } from '../../store/writingStore';
import { useChatPaneStore, type ChatMessage as ChatMessageType } from '../../store/chatPaneStore';
import { copyToClipboard } from '../../utils/clipboard';

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
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
      <Flex justify="end" mb="3" className="dark">
        <Box className="max-w-[85%] bg-mission-control-accent/15 text-mission-control-text rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </Box>
      </Flex>
    );
  }

  // Assistant message
  return (
    <Flex justify="start" mb="3" className="group dark">
      <Box className="max-w-[90%]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">{message.agent}</div>
        <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-mission-control-text">
          {isStreaming ? (
            <div>
              <MarkdownMessage content={content} streaming={true} />
            </div>
          ) : (
            <div>
              <MarkdownMessage content={content} />
            </div>
          )}
        </div>
        {/* Action buttons — visible on hover, hidden while streaming */}
        {!isStreaming && message.content && (
          <Flex align="center" gap="1" mt="1" className="opacity-0 group-hover:opacity-100 transition-opacity">
            {message.insertedToEditor ? (
              <span className="flex items-center gap-1 text-xs text-mission-control-accent/70 px-1.5 py-0.5">
                <Check className="w-3 h-3" />
                Inserted
              </span>
            ) : (
              <button
                type="button"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                onClick={handleSendToEditor}
                title="Send to editor"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {onRetry && (
              <button
                type="button"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                onClick={() => onRetry(message.content)}
                title="Retry — remove this response and re-send the question"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
