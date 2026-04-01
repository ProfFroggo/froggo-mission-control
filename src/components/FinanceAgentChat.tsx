import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, MessageSquare, Trash2, AlertCircle } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { chatApi } from '../lib/api';
import { createLogger } from '../utils/logger';
import MarkdownMessage from './MarkdownMessage';
import { extractAllArtifacts, generateArtifactTitle } from '../utils/artifactExtractor';
import { useArtifactStore } from '../store/artifactStore';

const logger = createLogger('FinanceChat');

const FINANCE_SESSION_KEY = 'finance-agent';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  context?: any;
}

interface FinanceAgentChatProps {
  isOpen?: boolean;
  onClose?: () => void;
  prefillMessage?: string;
  onPrefillConsumed?: () => void;
}

export default function FinanceAgentChat({ isOpen = true, onClose, prefillMessage, onPrefillConsumed }: FinanceAgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLTextAreaElement>(null);

  const focusInput = () => {
    inputWrapperRef.current?.focus();
  };

  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      focusInput();
    }
  }, [isOpen]);

  // Handle prefilled messages (e.g. budget creation)
  useEffect(() => {
    if (prefillMessage && isOpen && !loading) {
      setInputMessage(prefillMessage);
      onPrefillConsumed?.();
      // Auto-send after a brief delay so user sees it
      setTimeout(() => {
        sendMessageDirect(prefillMessage);
      }, 300);
    }
  }, [prefillMessage, isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      setInitializing(true);

      const msgs = await chatApi.getMessages(FINANCE_SESSION_KEY);
      if (Array.isArray(msgs)) {
        setMessages(msgs.map((m: any) => ({
          id: m.id || `msg-${m.timestamp}`,
          role: m.role === 'user' ? 'user' : 'agent',
          content: m.content,
          timestamp: m.timestamp || Date.now(),
        })));
      }
    } catch (error) {
      logger.error('Load history error:', error);
    } finally {
      setInitializing(false);
    }
  };

  const sendMessageDirect = async (directMessage: string) => {
    const message = directMessage.trim();
    if (!message || loading) return;

    try {
      setLoading(true);
      setError(null);

      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // Save user message
      await chatApi.saveMessage(FINANCE_SESSION_KEY, {
        role: 'user',
        content: message,
        timestamp: Date.now(),
        channel: 'finance',
      });

      // Stream response from finance-manager agent
      const agentMsgId = `msg-${Date.now()}-agent`;
      const agentMessage: ChatMessage = {
        id: agentMsgId,
        role: 'agent',
        content: '',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, agentMessage]);

      let accumulated = '';
      const response = await fetch('/api/agents/finance-manager/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model: 'claude-sonnet-4-6', sessionKey: 'finance-chat' }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'assistant' && evt.message?.content) {
              for (const block of evt.message.content) {
                if (block.type === 'text') accumulated += block.text;
              }
            } else if (evt.type === 'text' && evt.text) {
              accumulated += evt.text;
            }
            setMessages(prev => prev.map(m =>
              m.id === agentMsgId ? { ...m, content: accumulated } : m
            ));
          } catch { /* skip malformed */ }
        }
      }

      // Extract artifacts from agent response
      if (accumulated) {
        const extracted = extractAllArtifacts(accumulated);
        extracted.forEach(a => {
          useArtifactStore.getState().addArtifact({
            type: a.type,
            title: generateArtifactTitle(a),
            content: a.content,
            messageId: agentMsgId,
            sessionId: FINANCE_SESSION_KEY,
            timestamp: Date.now(),
            metadata: a.metadata,
          });
        });
      }

      // Save agent response
      if (accumulated) {
        await chatApi.saveMessage(FINANCE_SESSION_KEY, {
          role: 'agent',
          content: accumulated,
          timestamp: Date.now(),
          channel: 'finance',
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      logger.error('Send message error:', errorMessage);
      setError(errorMessage);
      showToast('error', 'Failed to send message');
    } finally {
      setLoading(false);
      focusInput();
    }
  };

  const sendMessage = async () => {
    const message = inputMessage.trim();
    if (!message) return;
    await sendMessageDirect(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all chat history? This cannot be undone.')) return;

    try {
      await chatApi.deleteSession(FINANCE_SESSION_KEY);
      setMessages([]);
      showToast('success', 'Chat history cleared');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear history';
      logger.error('Clear history error:', errorMessage);
      showToast('error', 'Failed to clear chat history');
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  if (!isOpen) return null;

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-surface border-l border-mission-control-border">
      {/* Header */}
      <Flex align="center" justify="between" className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <Flex align="center" gap="2">
          <MessageSquare className="w-4 h-4 text-mission-control-text-dim" />
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Finance Manager</h3>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-mission-control-accent/10 text-mission-control-accent rounded-full">AI</span>
        </Flex>
        <Flex align="center" gap="2">
          {messages.length > 0 && (
            <button
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              onClick={clearHistory}
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </Flex>
      </Flex>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {initializing ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <Flex gap="1" className="mb-2">
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </Flex>
            <span className="text-xs text-mission-control-text-dim">Loading chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-mission-control-text-dim space-y-3">
            <div className="w-10 h-10 rounded-full bg-mission-control-accent/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-mission-control-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-mission-control-text-dim">Start a conversation</p>
              <p className="text-xs mt-1 text-mission-control-text-dim">Ask the Finance Manager about your finances</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const isNewSpeaker = !prev || prev.role !== msg.role;
              return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewSpeaker ? 'mt-6' : 'mt-2'}`}>
                  {msg.role === 'agent' && (
                    <div className={`flex-shrink-0 mr-2 ${isNewSpeaker ? '' : 'invisible'}`}>
                      <div className="w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-mission-control-text-dim" />
                      </div>
                    </div>
                  )}
                  <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {isNewSpeaker && msg.role === 'agent' && (
                      <span className="text-xs font-medium text-success mb-1 px-1">Finance Manager</span>
                    )}
                    {isNewSpeaker && msg.role === 'user' && (
                      <span className="text-xs font-medium text-mission-control-accent mb-1 px-1">You</span>
                    )}
                    {msg.role === 'user' ? (
                      <div
                        className="text-sm px-4 py-2.5 rounded-[18px_18px_4px_18px] text-mission-control-text"
                        style={{ background: 'color-mix(in srgb, var(--mission-control-accent) 11%, transparent)', border: '1px solid color-mix(in srgb, var(--mission-control-accent) 18%, transparent)' }}
                      >
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-mission-control-text">
                        <MarkdownMessage content={msg.content} />
                      </div>
                    )}
                    <div className="text-[11px] tabular-nums mt-1 text-mission-control-text-dim/70 px-1">
                      {formatTimestamp(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start mt-6">
                <div className="mr-2 w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-mission-control-text-dim" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-xs font-medium text-success mb-1 px-1">Finance Manager</span>
                  <div className="text-sm text-mission-control-text">
                    <Flex gap="1" align="center" className="py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                      <span className="text-xs text-mission-control-text-dim ml-1">thinking...</span>
                    </Flex>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Flex align="start" gap="2" className="mx-4 mb-2 p-3 bg-error/10 border border-error/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-error">{error}</p>
            <button
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors mt-1"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        </Flex>
      )}

      {/* Input */}
      <div className="border-t border-mission-control-border bg-mission-control-bg px-4 py-3">
        <Flex gap="2" align="end">
          <textarea
            ref={inputWrapperRef as React.RefObject<HTMLTextAreaElement>}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Ask about your finances..."
            disabled={loading || initializing}
            rows={2}
            className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm resize-none text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || loading || initializing}
            className="w-8 h-8 rounded-lg bg-[var(--mission-control-accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
            aria-label={loading ? 'Sending message' : 'Send message'}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </Flex>
      </div>
    </Flex>
  );
}
