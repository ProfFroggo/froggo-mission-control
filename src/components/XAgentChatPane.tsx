import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Users, AlertCircle } from 'lucide-react';
import type { XTab } from './XTwitterPage';
import { gateway } from '../lib/gateway';
import MarkdownMessage from './MarkdownMessage';

interface XAgentChatPaneProps {
  tab: XTab;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  agentName?: string;
  agentId?: string;
  content: string;
  timestamp: number;
  streaming?: boolean;
  error?: boolean;
}

// Agent routing mapping: tab -> primary agent ID
const AGENT_ROUTING: Record<XTab, { agentId: string; displayName: string }> = {
  plan: { agentId: 'writer', displayName: 'Writer' },
  drafts: { agentId: 'writer', displayName: 'Writer' },
  calendar: { agentId: 'social-manager', displayName: 'Social Manager' },
  mentions: { agentId: 'social-manager', displayName: 'Social Manager' },
  'reply-guy': { agentId: 'writer', displayName: 'Writer' },
  'content-mix': { agentId: 'social-manager', displayName: 'Social Manager' },
  automations: { agentId: 'social-manager', displayName: 'Social Manager' },
  analytics: { agentId: 'social-manager', displayName: 'Social Manager' },
};

// System prompts for each tab to give context to the agent
const TAB_CONTEXT: Record<XTab, string> = {
  plan: `You are the Writer agent helping plan X/Twitter content. Current context: X/Twitter Content Planning Tab. Your role: Help plan content calendars, brainstorm tweet ideas, outline threads, and create content strategies.`,

  drafts: `You are the Writer agent helping create X/Twitter drafts. Current context: X/Twitter Drafts Tab. Your role: Write engaging tweets, craft thread hooks, polish copy, and improve messaging.`,

  calendar: `You are the Social Manager agent managing the X/Twitter content calendar. Current context: X/Twitter Calendar Tab. Your role: Help schedule content, optimize posting times, manage the editorial calendar.`,

  mentions: `You are the Social Manager agent monitoring X/Twitter mentions. Current context: X/Twitter Mentions Tab. Your role: Help monitor brand mentions, suggest responses, identify engagement opportunities.`,

  'reply-guy': `You are the Writer agent specializing in reply-style content for X/Twitter. Current context: X/Twitter Reply Guy Tab. Your role: Help craft clever replies, quote tweets, and engagement responses.`,

  'content-mix': `You are the Social Manager agent helping manage the X/Twitter content mix. Current context: X/Twitter Content Mix Tracker Tab. Your role: Help balance content types, track content distribution.`,

  automations: `You are the Social Manager agent managing X/Twitter automations. Current context: X/Twitter Automations Tab. Your role: Help set up automated workflows, schedule recurring content, manage bot behaviors.`,

  analytics: `You are the Social Manager agent reviewing X/Twitter analytics. Current context: X/Twitter Analytics Tab. Your role: Help interpret performance data, identify trends, suggest content optimizations.`,
};

export default function XAgentChatPane({ tab }: XAgentChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const agentConfig = AGENT_ROUTING[tab];
  const sessionKey = `agent:${agentConfig.agentId}:xtwitter:${tab}`;

  // Initialize gateway connection and session when component mounts or tab changes
  useEffect(() => {
    // Check and establish gateway connection
    if (!gateway.connected) {
      gateway.connect();
    }
    
    // Set the session key globally for this agent context
    gateway.setSessionKey(sessionKey);
    setIsConnected(gateway.connected);
    
    // Listen for connection state changes
    const unsubscribe = gateway.on('stateChange', ({ state }: { state: string }) => {
      setIsConnected(state === 'connected');
    });
    
    return () => {
      unsubscribe();
    };
  }, [sessionKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when tab changes
  useEffect(() => {
    setMessages([]);
    setError(null);
    // Cancel any ongoing request
    abortControllerRef.current?.abort();
  }, [tab]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Ensure gateway is connected before sending
    if (!gateway.connected) {
      setError('Not connected to Froggo. Trying to reconnect...');
      gateway.connect();
      // Wait briefly for connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!gateway.connected) {
        setError('Failed to connect to Froggo. Please check that the dashboard is running.');
        return;
      }
    }

    setError(null);
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const agentMsgId = `msg-${Date.now()}-agent`;
    let agentContent = '';

    // Add placeholder for agent response
    setMessages((prev) => [
      ...prev,
      {
        id: agentMsgId,
        role: 'agent',
        agentName: agentConfig.displayName,
        agentId: agentConfig.agentId,
        content: '',
        timestamp: Date.now(),
        streaming: true,
      },
    ]);

    try {
      // Build prompt with tab context
      const contextPrompt = `${TAB_CONTEXT[tab]}\n\nUser message: ${text}`;

      // Send to agent via gateway with streaming callbacks
      await gateway.sendChatWithCallbacks(contextPrompt, sessionKey, {
        onDelta: (delta: string) => {
          agentContent += delta;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? { ...msg, content: agentContent }
                : msg
            )
          );
        },
        onMessage: (content: string) => {
          agentContent = content;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? { ...msg, content: agentContent }
                : msg
            )
          );
        },
        onEnd: () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? { ...msg, streaming: false }
                : msg
            )
          );
          setLoading(false);
        },
        onError: (errorMsg: string) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === agentMsgId
                ? { ...msg, streaming: false, error: true, content: `Error: ${errorMsg}` }
                : msg
            )
          );
          setError(errorMsg);
          setLoading(false);
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send message';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMsgId
            ? { ...msg, streaming: false, error: true, content: `Error: ${errorMsg}` }
            : msg
        )
      );
      setError(errorMsg);
      setLoading(false);
    }
  }, [input, loading, tab, agentConfig, sessionKey]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-clawd-surface">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-info" />
            <h3 className="text-sm font-semibold text-clawd-text">Agent Chat</h3>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
            isConnected ? 'bg-success-subtle text-success' : 'bg-error-subtle text-error'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-error'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 text-xs bg-info-subtle text-info rounded-full">
            {agentConfig.displayName}
          </span>
          <span className="px-2 py-1 text-xs bg-clawd-bg-alt text-clawd-text-dim rounded-full">
            {tab}
          </span>
        </div>
        {error && (
          <div className="mt-2 p-2 bg-error-subtle border border-error-border rounded-lg flex items-center gap-2 text-xs text-error">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-clawd-text-dim">
            <Users className="w-12 h-12 text-clawd-text-dim mb-3" />
            <p className="font-medium text-clawd-text">Start a conversation</p>
            <p className="text-sm mt-1 text-clawd-text">
              Chat with {agentConfig.displayName} about {tab}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-clawd-accent/50 text-white'
                      : msg.error
                      ? 'bg-error-subtle border border-error-border text-error'
                      : 'bg-clawd-bg-alt text-clawd-text'
                  }`}
                >
                  {msg.role === 'agent' && msg.agentName && (
                    <div className="text-xs text-clawd-text-dim mb-1 flex items-center gap-1">
                      <span>{msg.agentName}</span>
                      {msg.streaming && (
                        <span className="flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          typing...
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-sm">
                    {msg.role === 'agent' && !msg.error ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    )}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      msg.role === 'user' ? 'text-clawd-text-dim' : 'text-clawd-text-dim'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-clawd-border bg-clawd-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask ${agentConfig.displayName} about ${tab}...`}
            className="flex-1 bg-clawd-bg-alt text-clawd-text placeholder-clawd-text-dim border border-clawd-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-info"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-clawd-accent hover:bg-clawd-accent-dim text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-clawd-text-dim mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
