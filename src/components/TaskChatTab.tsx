import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2, MessageSquare } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';

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
  const sessionKey = `task:${taskId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
  }, [messages, streaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const persistMessage = useCallback(async (role: string, content: string) => {
    try {
      await fetch(`/api/chat/sessions/${encodeURIComponent(sessionKey)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch { /* non-critical */ }
  }, [sessionKey]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending || !agentId) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    setStreaming('');

    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: Date.now() }]);
    persistMessage('user', text);

    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const res = await fetch(`/api/agents/${agentId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionKey }),
        signal: ac.signal,
      });

      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const evt = JSON.parse(raw) as {
              type?: string; text?: string;
              message?: { content?: { type: string; text: string }[] };
            };
            if (evt.type === 'text' && evt.text) {
              accumulated += evt.text;
              setStreaming(accumulated);
            } else if (evt.type === 'assistant' && evt.message?.content) {
              for (const block of evt.message.content) {
                if (block.type === 'text') {
                  accumulated += block.text;
                  setStreaming(accumulated);
                }
              }
            }
          } catch { /* not JSON */ }
        }
      }

      if (accumulated) {
        setMessages(prev => [...prev, { role: 'agent', content: accumulated, timestamp: Date.now() }]);
        persistMessage('assistant', accumulated);
      }
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Error: ${(e as Error)?.message || 'Failed to send'}`,
          timestamp: Date.now(),
        }]);
      }
    } finally {
      setStreaming('');
      setSending(false);
    }
  }, [input, sending, agentId, sessionKey, persistMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!agentId) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-mission-control-text-dim">
        <div className="text-center">
          <MessageSquare size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Assign an agent to this task to enable chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Context banner */}
      <div className="px-4 py-2 border-b border-mission-control-border flex items-center gap-2 text-xs text-mission-control-text-dim flex-shrink-0 bg-mission-control-bg">
        <Bot size={12} />
        <span>Direct session — {agentName} has full task context and memory</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-mission-control-text-dim" />
          </div>
        )}

        {!loading && messages.length === 0 && !streaming && (
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
              msg.role === 'user' ? 'bg-mission-control-accent' : 'bg-emerald-600'
            }`}>
              {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
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
              <p className="text-[10px] text-mission-control-text-dim mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Live streaming bubble */}
        {streaming && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white">
              <Bot size={12} />
            </div>
            <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-tl-sm bg-mission-control-surface border border-mission-control-border text-sm">
              <p className="whitespace-pre-wrap">{streaming}<span className="animate-pulse">▊</span></p>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {sending && !streaming && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white">
              <Bot size={12} />
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-sm bg-mission-control-surface border border-mission-control-border">
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
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}… (Enter to send, Shift+Enter for new line)`}
            className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent resize-none transition-colors"
            rows={2}
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2 bg-mission-control-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 self-end"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
