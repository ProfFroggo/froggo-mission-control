/* eslint-disable react-hooks/exhaustive-deps */
// LEGACY: PokeModal uses file-level suppression for intentional stable ref patterns.
// Modal lifecycle effects and cleanup are carefully designed.
// Review: 2026-02-17 - suppression retained, patterns are safe

/**
 * PokeModal - Internal poke/nudge modal for task status updates
 * 
 * When Kevin pokes a task, this modal opens instead of posting to Discord.
 * Shows task context, agent activity, and allows task-scoped conversation.
 * Responses have Mission Control personality - casual, direct, bit of humor.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, MessageCircle, Activity, AlertTriangle } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import BaseModal from './BaseModal';
import MarkdownMessage from './MarkdownMessage';
import { useStore } from '../store/store';
import { chatApi, streamMessage } from '../lib/api';
import { gateway } from '../lib/gateway';
import { extractAllArtifacts, generateArtifactTitle } from '../utils/artifactExtractor';
import { useArtifactStore } from '../store/artifactStore';

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
          extractAllArtifacts(assistantMsg.content).forEach(a => {
            useArtifactStore.getState().addArtifact({
              type: a.type,
              title: generateArtifactTitle(a),
              content: a.content,
              messageId: `poke-${taskId}-${assistantMsg.timestamp}`,
              sessionId: `poke:${taskId}`,
              timestamp: assistantMsg.timestamp,
              metadata: a.metadata,
            });
          });
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
              extractAllArtifacts(finalContent).forEach(a => {
                useArtifactStore.getState().addArtifact({
                  type: a.type,
                  title: generateArtifactTitle(a),
                  content: a.content,
                  messageId: `poke-${taskId}-${ts}`,
                  sessionId: `poke:${taskId}`,
                  timestamp: ts,
                  metadata: a.metadata,
                });
              });
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
      case 'in-progress': return 'text-[var(--color-info)]';
      case 'review': return 'text-[var(--color-warning)]';
      case 'human-review': return 'text-[var(--color-error)]';
      case 'done': return 'text-[var(--color-success)]';
      default: return 'text-mission-control-text-dim';
    }
  };

  return (
    <BaseModal isOpen={true} onClose={onClose} size="lg" className="flex flex-col">
      {/* Header with task context */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border bg-mission-control-border/20/50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🫵</span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-mission-control-text truncate">
              Poke: {taskTitle}
            </h2>
            <Flex align="center" gap="3" className="text-xs text-mission-control-text-dim">
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
                      {task.priority === 'p0' && <AlertTriangle size={12} className="text-[var(--color-error)]" />}
                      {task.priority}
                    </span>
                  )}
                </>
              )}
            </Flex>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <X size={18} />
        </button>
      </Flex>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[500px]">
        {/* History loading state */}
        {!historyLoaded && (
          <div className="flex items-center justify-center h-full gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        {historyLoaded && messages.map((msg) => (
          <Flex
            key={`${msg.role}-${msg.timestamp}`}
            justify={msg.role === 'user' ? 'end' : 'start'}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-mission-control-accent/20 text-mission-control-accent ml-auto rounded-br-md'
                  : msg.role === 'system'
                  ? 'bg-mission-control-border/30 text-mission-control-text-dim italic text-xs'
                  : 'bg-mission-control-border/20 text-mission-control-text rounded-bl-md'
              }`}
            >
              {msg.role === 'assistant' ? (
                <MarkdownMessage content={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </Flex>
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <Flex justify="start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm bg-mission-control-border/20 text-mission-control-text">
              <MarkdownMessage content={streamingContent} />
            </div>
          </Flex>
        )}

        {/* Loading indicator */}
        {(loading || sending) && !streamingContent && (
          <Flex justify="start">
            <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-mission-control-border/20">
              <Flex gap="1" align="center">
                <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-xs text-mission-control-text-dim ml-1">thinking...</span>
              </Flex>
            </div>
          </Flex>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-mission-control-border bg-mission-control-bg">
        <Flex align="center" gap="2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={sending ? 'Waiting for response...' : 'Ask about this task...'}
            disabled={sending || loading}
            rows={2}
            className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm resize-none text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending || loading}
            aria-label="Send"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </Flex>
        <p className="text-[10px] text-mission-control-text-dim/70 mt-1.5 text-center">
          Task-scoped conversation • Responses have personality 🐸
        </p>
      </div>
    </BaseModal>
  );
}
