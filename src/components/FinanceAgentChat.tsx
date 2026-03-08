import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, X, MessageSquare, Trash2, AlertCircle } from 'lucide-react';
import { showToast } from './Toast';
import { chatApi } from '../lib/api';
import { createLogger } from '../utils/logger';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
      inputRef.current?.focus();
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
      inputRef.current?.focus();
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
    <div className="flex flex-col h-full bg-mission-control-surface border-l border-mission-control-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-success" />
          <h3 className="text-lg font-semibold text-mission-control-text">Finance Manager</h3>
          <span className="px-2 py-0.5 text-xs bg-success-subtle text-success rounded-full">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-2 hover:bg-mission-control-bg-alt rounded-lg transition-colors"
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4 text-mission-control-text-dim" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-mission-control-bg-alt rounded-lg transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4 text-mission-control-text-dim" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {initializing ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading chat...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-mission-control-text-dim space-y-3">
            <MessageSquare className="w-12 h-12 text-mission-control-text-dim" />
            <div>
              <p className="font-medium text-mission-control-text">Start a conversation</p>
              <p className="text-sm mt-1">Ask the Finance Manager about your finances</p>
            </div>
            <div className="mt-4 p-3 bg-mission-control-bg-alt rounded-lg text-xs text-left space-y-1 max-w-xs">
              <p className="text-mission-control-text font-medium">Try asking:</p>
              <p className="text-mission-control-text-dim">&quot;How much did I spend this month?&quot;</p>
              <p className="text-mission-control-text-dim">&quot;Show me my biggest expenses&quot;</p>
              <p className="text-mission-control-text-dim">&quot;Am I on track with my budget?&quot;</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-mission-control-accent text-white rounded-tr-sm'
                      : 'bg-mission-control-surface text-mission-control-text border border-mission-control-border rounded-tl-sm'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-white/60' : 'text-mission-control-text-dim'
                    }`}
                  >
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm bg-mission-control-surface text-mission-control-text border border-mission-control-border rounded-tl-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Finance Manager is thinking...</span>
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
        <div className="mx-4 mb-2 p-3 bg-error-subtle border border-error-border rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-error mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-error">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-error hover:text-error mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-mission-control-border bg-mission-control-surface">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your finances..."
            className="flex-1 bg-mission-control-surface text-mission-control-text placeholder-mission-control-text-dim border border-mission-control-border rounded-xl px-4 py-2 focus:outline-none focus:border-mission-control-accent transition-colors"
            disabled={loading || initializing}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || loading || initializing}
            className="p-2 bg-mission-control-accent hover:opacity-90 disabled:bg-mission-control-bg-alt disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            aria-label={loading ? "Sending message" : "Send message"}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <p className="text-xs text-mission-control-text-dim mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
