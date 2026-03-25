import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Bot, MessageSquare, CheckCircle, UserCheck, ArrowRight } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import SessionStatsBar from './SessionStatsBar';
// eslint-disable-next-line import/order
import { Spinner, Flex, Box } from '@radix-ui/themes';

interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  /** Optional: system messages can carry a status transition label */
  statusTransition?: string;
}

/** Returns true when a system message signals escalation / human review */
function isEscalationSystemMessage(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes('human-review') ||
    lower.includes('human review') ||
    lower.includes('approval needed') ||
    lower.includes('approval required') ||
    lower.includes('needs approval') ||
    lower.includes('waiting for approval') ||
    lower.includes('waiting for human') ||
    lower.includes('needs your decision') ||
    lower.includes('needs your input') ||
    lower.includes('escalat') ||
    lower.includes('blocked')
  );
}

/** Extracts a status label from a status-transition message, e.g. "status: human-review" */
function extractStatusTransition(content: string): string | null {
  const match = content.match(/status[:\s→>-]+([a-z_-]+)/i);
  return match ? match[1] : null;
}

interface TaskChatTabProps {
  taskId: string;
  agentId: string | null;
  agentName: string;
}

/** Returns a human-friendly relative time string */
function relativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  // Fall back to HH:MM for older messages
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TaskChatTab({ taskId, agentId, agentName }: TaskChatTabProps) {
  // Session key includes agentId so switching agents on same task creates new session
  const sessionKey = agentId ? `task:${agentId}:${taskId}` : `task:${taskId}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextLoaded, setContextLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Derive last agent message for quick-reply detection
  const lastAgentMessage = useMemo(() => {
    const agentMsgs = messages.filter(m => m.role === 'agent');
    return agentMsgs[agentMsgs.length - 1] ?? null;
  }, [messages]);

  const showQuickReplies =
    !sending &&
    !!lastAgentMessage &&
    lastAgentMessage.content.trimEnd().endsWith('?');

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

  const handleLoadContext = useCallback(async () => {
    await sendMessage('/context');
    setContextLoaded(true);
    setTimeout(() => setContextLoaded(false), 4000);
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!agentId) {
    return (
      <Flex direction="column" align="center" justify="center" height="100%" py="9" gap="3" className="text-center">
        <MessageSquare size={32} className="text-mission-control-text-dim opacity-40" />
        <p className="text-sm font-medium text-mission-control-text">No agent assigned</p>
        <p className="text-xs text-mission-control-text-dim">Assign an agent to this task to enable chat.</p>
      </Flex>
    );
  }

  return (
    <Flex direction="column" className="flex-1 min-h-0 overflow-hidden">
      {/* Context banner */}
      <Flex direction="column" gap="2" px="4" py="2" className="border-b border-mission-control-border flex-shrink-0 bg-mission-control-bg">
        <Flex align="center" justify="between" gap="2">
          <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
            <Bot size={12} />
            <span>Direct session — {agentName} has full task context and memory</span>
          </Flex>

          {/* Load task context action */}
          <button
            type="button"
            onClick={handleLoadContext}
            disabled={sending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[var(--color-info)]/10 text-[var(--color-info)] border border-[var(--color-info)]/20 hover:bg-[var(--color-info)]/20 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {contextLoaded ? (
              <>
                <CheckCircle size={11} />
                Context loaded
              </>
            ) : (
              <>
                Load task context
              </>
            )}
          </button>
        </Flex>
        <SessionStatsBar sessionKey={sessionKey} onCompact={() => sendMessage('/compact')} />
      </Flex>

      {/* Messages */}
      <Box p="4" className="flex-1 overflow-y-auto min-h-0">
        {loading && (
          <Flex align="center" justify="center" py="6">
            <Flex gap="1">
              <span className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </Flex>
          </Flex>
        )}

        {!loading && messages.length === 0 && (
          <Flex direction="column" align="center" justify="center" py="6" gap="2">
            <div className="w-10 h-10 rounded-full bg-mission-control-accent/10 flex items-center justify-center">
              <MessageSquare size={18} className="text-mission-control-accent" />
            </div>
            <span className="text-sm font-medium text-mission-control-text-dim">
              No messages yet
            </span>
            <span className="text-xs text-mission-control-text-dim">
              Ask {agentName} anything about this task.
            </span>
          </Flex>
        )}

        {messages.map((msg, i) => {
          // Status-transition divider — render as a centered separator, not a bubble
          const statusLabel = msg.role === 'system' ? extractStatusTransition(msg.content) : null;
          if (statusLabel) {
            return (
              <div key={`${msg.timestamp}-${i}`} className="flex items-center gap-2 py-1 my-2">
                <div className="h-px flex-1 bg-mission-control-border/40" />
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-mission-control-surface border border-mission-control-border/60 text-mission-control-text-dim whitespace-nowrap">
                  <ArrowRight size={10} aria-hidden="true" />
                  Status: {statusLabel}
                </span>
                <div className="h-px flex-1 bg-mission-control-border/40" />
              </div>
            );
          }

          // Escalation system message — prominent warning banner
          const isEscalation = msg.role === 'system' && isEscalationSystemMessage(msg.content);
          if (isEscalation) {
            return (
              <div
                key={`${msg.timestamp}-${i}`}
                className="flex items-start gap-3 px-4 py-3 bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/25 rounded-xl my-2"
                role="alert"
              >
                <UserCheck size={16} className="text-[var(--color-warning)] flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[var(--color-warning)] uppercase tracking-wider mb-1">
                    Needs your attention
                  </p>
                  <p className="text-sm text-mission-control-text leading-snug">{msg.content}</p>
                  <p className="text-[11px] tabular-nums text-[var(--color-warning)]/60 mt-1.5">
                    {relativeTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            );
          }

          // Regular system message (errors, etc.)
          if (msg.role === 'system') {
            return (
              <div
                key={`${msg.timestamp}-${i}`}
                className="flex items-start gap-2 px-3 py-2 bg-[var(--color-warning)]/6 border border-[var(--color-warning)]/15 rounded-lg text-sm text-[var(--color-warning)] my-1"
              >
                <p className="flex-1 leading-snug">{msg.content}</p>
                <p className="text-[11px] tabular-nums text-[var(--color-warning)]/50 flex-shrink-0 mt-0.5">
                  {relativeTime(msg.timestamp)}
                </p>
              </div>
            );
          }

          // User / agent bubble
          const prev = i > 0 ? messages[i - 1] : null;
          const isNewSpeaker = !prev || prev.role !== msg.role;
          return (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewSpeaker ? 'mt-6' : 'mt-2'}`}
            >
              {msg.role !== 'user' && (
                <div className={`flex-shrink-0 mr-2 ${isNewSpeaker ? '' : 'invisible'}`}>
                  <div className="w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center">
                    <Bot size={14} className="text-mission-control-text-dim" />
                  </div>
                </div>
              )}
              <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {isNewSpeaker && msg.role !== 'user' && (
                  <span className="text-xs font-medium text-[var(--color-success)] mb-1 px-1">{agentName}</span>
                )}
                {isNewSpeaker && msg.role === 'user' && (
                  <span className="text-xs font-medium text-mission-control-accent mb-1 px-1">You</span>
                )}
                {msg.role === 'user' ? (
                  <div
                    className="text-sm px-4 py-2.5 rounded-[18px_18px_4px_18px] text-mission-control-text"
                    style={{ background: 'color-mix(in srgb, var(--mission-control-accent) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)' }}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : (
                  <div className="text-sm text-mission-control-text">
                    <MarkdownMessage content={msg.content} />
                  </div>
                )}
                <p className="text-[11px] tabular-nums text-mission-control-text-dim/70 mt-1 px-1">
                  {relativeTime(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {sending && (
          <div className="flex justify-start mt-6">
            <div className="mr-2 w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-mission-control-text-dim" />
            </div>
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium text-[var(--color-success)] mb-1 px-1">{agentName}</span>
              <Flex gap="1" align="center" className="py-1">
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-mission-control-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-mission-control-text-dim ml-1">thinking...</span>
              </Flex>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Box className="border-t border-mission-control-border bg-mission-control-bg px-4 py-3 flex-shrink-0">
        {/* Quick-reply pills — shown when agent asks a question */}
        {showQuickReplies && (
          <Flex wrap="wrap" gap="1" mb="2" aria-label="Quick reply options">
            {['Yes, proceed', 'No, stop', 'Tell me more', 'Let me think about it'].map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => sendMessage(reply)}
                className="text-xs px-3 py-1.5 rounded-full border border-mission-control-border hover:border-mission-control-accent/50 hover:bg-[var(--mission-control-accent)]/5 text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              >
                {reply}
              </button>
            ))}
          </Flex>
        )}

        <Flex gap="2" align="end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}…`}
            rows={2}
            disabled={sending}
            className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm resize-none text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="w-8 h-8 rounded-lg bg-[var(--mission-control-accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
            aria-label="Send message"
          >
            {sending ? <Spinner size="1" /> : <Send size={16} />}
          </button>
        </Flex>
      </Box>
    </Flex>
  );
}
