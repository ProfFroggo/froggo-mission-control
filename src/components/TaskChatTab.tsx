import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, MessageSquare } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import SessionStatsBar from './SessionStatsBar';
// eslint-disable-next-line import/order
import { IconButton, Spinner, TextArea, Flex } from '@radix-ui/themes';

interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
}

interface TaskChatTabProps {
  taskId: string;
  agentId: string | null;
  agentName: string;
}

export default function TaskChatTab({ taskId, agentId, agentName }: TaskChatTabProps) {
  // Session key includes agentId so switching agents on same task creates new session
  const sessionKey = agentId ? `task:${agentId}:${taskId}` : `task:${taskId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionKey)}/messages`);
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        setMessages(
          data.messages
            .map((m: { role: string; content: string; timestamp: number }) => ({
              role: m.role === 'assistant' ? 'agent' : m.role as Message['role'],
              content: m.content,
              timestamp: m.timestamp,
            }))
            .filter((m: Message) => m.content?.trim())
        );
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [sessionKey]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending || !agentId) return;
    if (!overrideText) setInput('');
    setSending(true);

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);

    try {
      const res = await fetch('/api/sessions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionKey,
          agentId,
          surface: 'task',
          contextId: taskId,
          metadata: { taskId, assignedTo: agentId },
        }),
      });

      const data = await res.json();

      if (data.success && data.reply) {
        setMessages(prev => [...prev, { role: 'agent', content: data.reply, timestamp: Date.now() }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Error: ${data.error || 'Failed to get response'}`,
          timestamp: Date.now(),
        }]);
      }
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Error: ${(e as Error)?.message || 'Failed to send'}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, agentId, sessionKey, taskId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
        <MessageSquare size={32} className="text-mission-control-text-dim opacity-40" />
        <p className="text-sm font-medium text-mission-control-text">No agent assigned</p>
        <p className="text-xs text-mission-control-text-dim">Assign an agent to this task to enable chat.</p>
      </div>
    );
  }

  return (
    <Flex direction="column" className="flex-1 min-h-0 overflow-hidden">
      {/* Context banner */}
      <div className="px-4 py-2 border-b border-mission-control-border flex flex-col gap-1.5 flex-shrink-0 bg-mission-control-bg">
        <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
          <Bot size={12} />
          <span>Direct session — {agentName} has full task context and memory</span>
        </div>
        <SessionStatsBar sessionKey={sessionKey} onCompact={() => sendMessage('/compact')} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="3" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8 text-mission-control-text-dim text-sm">
            No messages yet. Ask {agentName} anything about this task.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={`${msg.timestamp}-${i}`}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white ${
              msg.role === 'user' ? 'bg-mission-control-accent' : 'bg-success'
            }`}>
              {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-mission-control-accent/20 text-mission-control-text rounded-tr-sm'
                : msg.role === 'system'
                  ? 'bg-warning-subtle border border-warning-border text-warning rounded'
                  : 'bg-mission-control-surface border border-mission-control-border rounded-tl-sm'
            }`}>
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <MarkdownMessage content={msg.content} />
              )}
              <p className="text-xs tabular-nums text-mission-control-text-dim mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {sending && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-success flex items-center justify-center text-white">
              <Bot size={12} />
            </div>
            <div className="px-3 py-2 rounded-lg rounded-tl-sm bg-mission-control-surface border border-mission-control-border">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-mission-control-border flex-shrink-0">
        <div className="flex gap-2">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}… (Enter to send, Shift+Enter for new line)`}
            rows={2}
            disabled={sending}
            resize="none"
            className="flex-1"
          />
          <IconButton
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            size="3"
            aria-label="Send message"
            className="self-end"
          >
            <Send size={16} />
          </IconButton>
        </div>
      </div>
    </Flex>
  );
}
