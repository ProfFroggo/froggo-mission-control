import { useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { gateway } from '../../lib/gateway';
import { buildMemoryContext, buildChapterContext, buildOutlineContext } from '../../lib/writingContext';
import { useChatPaneStore, type ChatMessage as ChatMessageType } from '../../store/chatPaneStore';
import { useWritingStore } from '../../store/writingStore';
import { useMemoryStore } from '../../store/memoryStore';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

// Agent-specific preambles (shared with FeedbackPopover pattern)
const agentPreamble: Record<string, string> = {
  writer: 'You are a skilled writing assistant focused on style, pacing, and narrative craft. Help the writer develop their manuscript with constructive suggestions, prose drafts, and structural guidance.',
  researcher: 'You are a meticulous research assistant focused on accuracy, fact-checking, and clarity. Help the writer verify claims, find sources, and ensure factual accuracy throughout their manuscript.',
  jess: [
    'You are Jess, a therapist and editorial guide who understands memoir as psychological integration, not just storytelling.',
    'You focus on: emotional impact on the reader, emotional cost to the writer, pacing of sensitive disclosure,',
    'boundary awareness (what to reveal vs. what to protect), tone calibration (honesty without trauma performance),',
    'and the relationship between how something is written and what it does psychologically for the person writing it.',
    'You are warm but direct. You name what you see clearly and precisely. You do not use therapy cliches or empty validation.',
  ].join(' '),
};

export default function ChatPane() {
  const {
    messages, streaming, streamContent, selectedAgent, error,
    setStreaming, setStreamContent, addMessage, setError, setInput,
    removeMessagesFrom, clearMessages, loadMessages,
  } = useChatPaneStore();

  const { activeProjectId, activeChapterContent, activeProject } = useWritingStore();
  const { characters, timeline, facts } = useMemoryStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const accumulatedRef = useRef('');

  // Auto-scroll to bottom on new messages or stream updates
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamContent]);

  // Load chat history when project changes
  useEffect(() => {
    if (!activeProjectId) {
      clearMessages();
      return;
    }

    const loadHistory = async () => {
      try {
        const result = await (window as any).clawdbot?.writing?.chat?.loadHistory(activeProjectId);
        if (result?.success && result.messages) {
          loadMessages(result.messages);
        } else {
          clearMessages();
        }
      } catch {
        clearMessages();
      }
    };

    loadHistory();
  }, [activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClearChat = useCallback(async () => {
    if (!activeProjectId) return;
    clearMessages();
    try {
      await (window as any).clawdbot?.writing?.chat?.clearHistory(activeProjectId);
    } catch {
      // Clear failure is non-critical
    }
  }, [activeProjectId, clearMessages]);

  const handleRetry = useCallback((assistantMessageId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantMessageId);
    if (idx < 0) return;

    // Find the preceding user message
    const userIdx = idx - 1;
    const userMsg = userIdx >= 0 && messages[userIdx].role === 'user' ? messages[userIdx] : null;

    // Remove the assistant message and the user message before it
    removeMessagesFrom(userMsg ? userIdx : idx);

    // Prefill the input with the user message content
    if (userMsg) {
      setInput(userMsg.content);
    }
  }, [messages, removeMessagesFrom, setInput]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!activeProjectId || streaming) return;

    // Create and add user message
    const userMessage: ChatMessageType = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: text,
      agent: selectedAgent,
      timestamp: Date.now(),
    };

    addMessage(userMessage);
    setInput('');
    setStreaming(true);
    setStreamContent('');
    setError(null);
    accumulatedRef.current = '';

    // Build session key with :chat suffix
    const sessionKey = `agent:${selectedAgent}:writing:${activeProjectId}:chat`;

    // Build context
    const memoryContext = buildMemoryContext(characters, timeline, facts);
    const chapterContext = buildChapterContext(activeChapterContent);
    const outlineContext = buildOutlineContext(
      activeProject?.chapters?.map((ch) => ({ title: ch.title, position: ch.position })) || []
    );

    // Build prompt with context
    const prompt = [
      agentPreamble[selectedAgent] || agentPreamble.writer,
      '',
      '## Context',
      '',
      '### Current Chapter',
      chapterContext,
      '',
      '### Project Outline',
      outlineContext,
      '',
      ...(memoryContext ? ['### Story Context (Memory)', memoryContext, ''] : []),
      '## User Message',
      text,
    ].join('\n');

    try {
      await gateway.sendChatWithCallbacks(prompt, sessionKey, {
        onDelta: (delta) => {
          accumulatedRef.current += delta;
          setStreamContent(accumulatedRef.current);
        },
        onEnd: () => {
          const assistantMessage: ChatMessageType = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'assistant',
            content: accumulatedRef.current,
            agent: selectedAgent,
            timestamp: Date.now(),
          };
          addMessage(assistantMessage);
          setStreaming(false);
          setStreamContent('');

          // Persist both messages to disk
          try {
            (window as any).clawdbot?.writing?.chat?.appendMessage(activeProjectId, userMessage);
            (window as any).clawdbot?.writing?.chat?.appendMessage(activeProjectId, assistantMessage);
          } catch {
            // Persistence failure is non-critical
          }
        },
        onError: (err) => {
          setError(typeof err === 'string' ? err : 'An error occurred');
          setStreaming(false);
          setStreamContent('');
        },
      });
    } catch (e: any) {
      setError(e.message || 'Failed to send');
      setStreaming(false);
      setStreamContent('');
    }
  }, [
    activeProjectId, streaming, selectedAgent, activeChapterContent,
    activeProject, characters, timeline, facts,
    addMessage, setInput, setStreaming, setStreamContent, setError,
  ]);

  // Derive agent display name
  const agentNames: Record<string, string> = {
    writer: 'Writer',
    researcher: 'Researcher',
    jess: 'Jess',
  };

  return (
    <div className="flex flex-col h-full bg-clawd-surface border-r border-clawd-border dark">
      {/* Header */}
      <div className="px-3 py-2 border-b border-clawd-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-clawd-text-dim" />
          <span className="text-xs font-medium text-clawd-text-dim">
            Chat{agentNames[selectedAgent] ? ` - ${agentNames[selectedAgent]}` : ''}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="p-1 rounded text-clawd-text-dim hover:text-error hover:bg-error-subtle transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !streaming ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim text-sm text-center px-4">
            <p>Start a conversation with {agentNames[selectedAgent] || 'the agent'}</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onRetry={msg.role === 'assistant' ? () => handleRetry(msg.id) : undefined}
              />
            ))}
            {streaming && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: '',
                  agent: selectedAgent,
                  timestamp: Date.now(),
                }}
                isStreaming
                streamContent={streamContent}
              />
            )}
          </>
        )}
        {/* Error display */}
        {error && (
          <div className="text-sm text-error px-2 py-1 mb-2">{error}</div>
        )}
        {/* Scroll sentinel */}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} disabled={streaming} />
    </div>
  );
}
