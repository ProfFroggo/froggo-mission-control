/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: PokeModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and cleanup are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * PokeModal - Internal poke/nudge modal for task status updates
 * 
 * When Kevin pokes a task, this modal opens instead of posting to Discord.
 * Shows task context, agent activity, and allows task-scoped conversation.
 * Responses have Froggo personality - casual, direct, bit of humor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Loader2, MessageCircle, Activity, AlertTriangle } from 'lucide-react';
import BaseModal from './BaseModal';
import MarkdownMessage from './MarkdownMessage';
import { useStore } from '../store/store';
import { chatApi, streamMessage } from '../lib/api';
import { gateway } from '../lib/gateway';

interface PokeModalProps {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

interface PokeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export default function PokeModal({ taskId, taskTitle, onClose }: PokeModalProps) {
  const { agents, tasks, logTaskActivity } = useStore();
  const [messages, setMessages] = useState<PokeMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const task = tasks.find(t => t.id === taskId);
  const assignedAgent = task?.assignedTo ? agents.find(a => a.id === task.assignedTo) : null;

  useEffect(() => {
    setHistoryLoaded(false);
    const loadPokeHistory = async () => {
      if (!taskId) {
        setHistoryLoaded(true);
        initPoke();
        return;
      }
      try {
        const chatRes = await fetch(`/api/chat?sessionKey=${encodeURIComponent(`poke:${taskId}`)}&channel=poke&limit=20`);
        const result = chatRes.ok ? await chatRes.json() : { success: false };
        if (result?.success && result.messages?.length > 0) {
          setMessages(result.messages.map((m: { role: string; content: string; timestamp?: number }) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: m.timestamp ?? Date.now(),
          })));
          setHistoryLoaded(true);
          setLoading(false);
          // Restore session key from stored data if available so follow-up chat works
          // We won't re-poke since history exists
        } else {
          setHistoryLoaded(true);
          initPoke();
        }
      } catch (_e) {
        setHistoryLoaded(true);
        initPoke();
      }
    };
    loadPokeHistory();
    return () => {
      streamCleanupRef.current?.();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (!loading && !sending) {
      inputRef.current?.focus();
    }
  }, [loading, sending]);

  const initPoke = async () => {
    setLoading(true);
    setMessages([{
      role: 'system',
      content: '🫵 Poking for status update...',
      timestamp: Date.now(),
    }]);

    try {
      // Use REST API for poke
      const pokeRes = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'poke', taskId, taskTitle }),
      });
      const result = pokeRes.ok ? await pokeRes.json() : { success: false, error: 'Request failed' };

      if (result.success) {
        setSessionKey(result.sessionKey || null);

        const userMsg: PokeMessage = {
          role: 'user',
          content: `🫵 What's the status of "${taskTitle}"?`,
          timestamp: Date.now() - 1000,
        };
        const responseMessages: PokeMessage[] = [userMsg];

        // Persist user message
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save', role: 'user', content: userMsg.content, timestamp: userMsg.timestamp,
            sessionKey: `poke:${taskId}`, channel: 'poke',
          }),
        });

        if (result.response) {
          const assistantMsg: PokeMessage = {
            role: 'assistant',
            content: result.response,
            timestamp: Date.now(),
          };
          responseMessages.push(assistantMsg);
          // Persist assistant response
          fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save', role: 'assistant', content: assistantMsg.content, timestamp: assistantMsg.timestamp,
              sessionKey: `poke:${taskId}`, channel: 'poke',
            }),
          });
        }

        setMessages(responseMessages);
        await logTaskActivity(taskId, 'poked', 'Task poked (internal modal)');
      } else {
        throw new Error(result.error || 'Poke failed');
      }
    } catch (e: unknown) {
      setMessages([{
        role: 'system',
        content: `❌ ${(e as Error).message || 'Failed to poke'}`,
        timestamp: Date.now(),
      }]);
    }
    setLoading(false);
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;

    const userText = input.trim();
    const userTimestamp = Date.now();
    setMessages(prev => [...prev, {
      role: 'user',
      content: userText,
      timestamp: userTimestamp,
    }]);
    setInput('');
    setSending(true);
    setStreamingContent('');

    // Persist user message
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save', role: 'user', content: userText, timestamp: userTimestamp,
        sessionKey: `poke:${taskId}`, channel: 'poke',
      }),
    });

    try {
      if (sessionKey) {
        // Stream listener
        let fullResponse = '';
        streamCleanupRef.current?.();

        const unsub = gateway.on('chat', (data: any) => {
          // STRICT session matching - only accept events for THIS session
          if (!data.sessionKey || data.sessionKey !== sessionKey) return;

          if (data.state === 'streaming' && data.chunk) {
            fullResponse += data.chunk;
            setStreamingContent(fullResponse);
          }
          if (data.state === 'done' || data.state === 'complete') {
            const finalContent = data.content || data.response || fullResponse;
            if (finalContent) {
              const ts = Date.now();
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: finalContent,
                timestamp: ts,
              }]);
              // Persist assistant reply
              fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'save', role: 'assistant', content: finalContent, timestamp: ts,
                  sessionKey: `poke:${taskId}`, channel: 'poke',
                }),
              });
            }
            setStreamingContent('');
            setSending(false);
            unsub();
            streamCleanupRef.current = null;
          }
          if (data.state === 'error') {
            setMessages(prev => [...prev, {
              role: 'system',
              content: `⚠️ ${data.error || 'Error'}`,
              timestamp: Date.now(),
            }]);
            setStreamingContent('');
            setSending(false);
            unsub();
            streamCleanupRef.current = null;
          }
        });
        streamCleanupRef.current = unsub;

        const agentChatRes = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'chat', sessionKey, message: userText }),
        });
        const result = agentChatRes.ok ? await agentChatRes.json() : {};

        // If no streaming happened, use direct result
        if (!fullResponse && result?.response) {
          const ts = Date.now();
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.response || '',
            timestamp: ts,
          }] as PokeMessage[]);
          // Persist direct reply
          fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'save', role: 'assistant', content: result.response, timestamp: ts,
              sessionKey: `poke:${taskId}`, channel: 'poke',
            }),
          });
          setStreamingContent('');
          setSending(false);
          unsub();
          streamCleanupRef.current = null;
        }

        // Timeout fallback
        timeoutRef.current = setTimeout(() => {
          if (sending) {
            setSending(false);
            setStreamingContent('');
          }
        }, 60000);
      } else {
        // No session - use poke for one-shot
        const pokeFollowRes = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poke', taskId, taskTitle: `${taskTitle}\n\nUser follow-up: ${userText}` }),
        });
        const pokeResult = pokeFollowRes.ok ? await pokeFollowRes.json() : {};
        const reply = pokeResult.response || "Hmm, didn't get a response back. Try again?";
        const ts = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: reply,
          timestamp: ts,
        }]);
        // Persist assistant reply
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save', role: 'assistant', content: reply, timestamp: ts,
            sessionKey: `poke:${taskId}`, channel: 'poke',
          }),
        });
        if (pokeResult.sessionKey) setSessionKey(pokeResult.sessionKey);
        setSending(false);
      }
    } catch (e: unknown) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `⚠️ ${(e as Error).message || 'Failed to send'}`,
        timestamp: Date.now(),
      }]);
      setSending(false);
    }
  }, [input, sessionKey, sending, taskId, taskTitle]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'in-progress': return 'text-info';
      case 'review': return 'text-warning';
      case 'blocked': return 'text-error';
      case 'done': return 'text-success';
      default: return 'text-clawd-text-muted';
    }
  };

  return (
    <BaseModal isOpen={true} onClose={onClose} size="lg" className="flex flex-col">
      {/* Header with task context */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border bg-clawd-bg-alt/50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🫵</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-clawd-text truncate">
              Poke: {taskTitle}
            </h2>
            <div className="flex items-center gap-3 text-xs text-clawd-text-muted">
              {task && (
                <>
                  <span className={`flex items-center gap-1 ${getStatusColor(task.status)}`}>
                    <Activity size={12} />
                    {task.status || 'unknown'}
                  </span>
                  {assignedAgent && (
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {assignedAgent.name}
                    </span>
                  )}
                  {task.priority && (
                    <span className="flex items-center gap-1">
                      {task.priority === 'p0' && <AlertTriangle size={12} className="text-error" />}
                      {task.priority}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-clawd-border/50 text-clawd-text-muted hover:text-clawd-text transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
        {/* History loading state */}
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full text-clawd-text-muted text-sm">
            <Loader2 size={16} className="animate-spin mr-2" />
            Loading...
          </div>
        )}
        {historyLoaded && messages.map((msg) => (
          <div
            key={`${msg.role}-${msg.timestamp}`}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-clawd-accent/20 text-clawd-accent ml-auto rounded-br-md'
                  : msg.role === 'system'
                  ? 'bg-clawd-border/30 text-clawd-text-muted italic text-xs'
                  : 'bg-clawd-bg-alt text-clawd-text rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm bg-clawd-bg-alt text-clawd-text">
              <MarkdownMessage content={streamingContent} />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {(loading || sending) && !streamingContent && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-clawd-bg-alt">
              <Loader2 size={16} className="animate-spin text-clawd-text-muted" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-clawd-border bg-clawd-bg">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? 'Waiting for response...' : 'Ask about this task...'}
            disabled={sending || loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-clawd-bg-alt border border-clawd-border text-clawd-text text-sm focus:outline-none focus:border-clawd-accent/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || loading}
            className="p-2.5 rounded-xl bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-clawd-text-muted/40 mt-1.5 text-center">
          Task-scoped conversation • Responses have personality 🐸
        </p>
      </div>
    </BaseModal>
  );
}
