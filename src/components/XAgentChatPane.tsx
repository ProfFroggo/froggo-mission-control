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
  publish: { agentId: 'writer', displayName: 'Writer' },
  research: { agentId: 'researcher', displayName: 'Researcher' },
  plan: { agentId: 'writer', displayName: 'Writer' },
  drafts: { agentId: 'writer', displayName: 'Writer' },
  calendar: { agentId: 'social-manager', displayName: 'Social Manager' },
  mentions: { agentId: 'social-manager', displayName: 'Social Manager' },
  'reply-guy': { agentId: 'writer', displayName: 'Writer' },
  'content-mix': { agentId: 'social-manager', displayName: 'Social Manager' },
  automations: { agentId: 'social-manager', displayName: 'Social Manager' },
  analytics: { agentId: 'social-manager', displayName: 'Social Manager' },
  reddit: { agentId: 'social-manager', displayName: 'Social Manager' },
};

// Set of valid tabs for validation
const tabsWithoutUndefined = new Set<XTab>([
  'publish', 'research', 'plan', 'drafts', 'calendar', 'mentions',
  'reply-guy', 'content-mix', 'automations', 'analytics', 'reddit'
]);

// System prompts for each tab to give context to the agent
const TAB_CONTEXT: Record<XTab, string> = {
  publish: `You are the Writer agent helping compose and publish X/Twitter posts. Current context: X/Twitter Publish Tab. Your role: Help craft engaging tweets, suggest improvements to copy, recommend hashtags, and assist with thread composition.`,

  research: `You are the Researcher agent helping find X/Twitter content inspiration. Current context: X/Twitter Research Tab. Your role: Search for trending topics, find relevant tweets, identify content opportunities, analyze competitors, and gather insights for content planning.`,

  plan: `You are the Writer agent helping plan X/Twitter content. Current context: X/Twitter Content Planning Tab. Your role: Help plan content calendars, brainstorm tweet ideas, outline threads, and create content strategies.`,

  drafts: `You are the Writer agent helping create X/Twitter drafts. Current context: X/Twitter Drafts Tab. Your role: Write engaging tweets, craft thread hooks, polish copy, and improve messaging.`,

  calendar: `You are the Social Manager agent managing the X/Twitter content calendar. Current context: X/Twitter Calendar Tab. Your role: Help schedule content, optimize posting times, manage the editorial calendar.`,

  mentions: `You are the Social Manager agent monitoring X/Twitter mentions. Current context: X/Twitter Mentions Tab. Your role: Help monitor brand mentions, suggest responses, identify engagement opportunities.`,

  'reply-guy': `You are the Writer agent specializing in reply-style content for X/Twitter. Current context: X/Twitter Reply Guy Tab. Your role: Help craft clever replies, quote tweets, and engagement responses.`,

  'content-mix': `You are the Social Manager agent helping manage the X/Twitter content mix. Current context: X/Twitter Content Mix Tracker Tab. Your role: Help balance content types, track content distribution.`,

  automations: `You are the Social Manager agent managing X/Twitter automations. Current context: X/Twitter Automations Tab. Your role: Help set up automated workflows, schedule recurring content, manage bot behaviors.`,

  analytics: `You are the Social Manager agent reviewing X/Twitter analytics. Current context: X/Twitter Analytics Tab. Your role: Help interpret performance data, identify trends, suggest content optimizations.`,

  reddit: `You are the Social Manager agent monitoring Reddit for product mentions. Current context: Reddit Monitor Tab. Your role: Help monitor subreddits for mentions of a product, analyze threads, and draft authentic Reddit replies. Use natural, conversational Reddit tone.`,
};

export default function XAgentChatPane({ tab }: XAgentChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Per-tab message cache to preserve messages across tab switches
  const tabMessagesRef = useRef<Record<string, ChatMessage[]>>({});
  const prevTabRef = useRef<XTab>(tab);

  // Defensive: validate tab and provide fallback for unknown tabs
  const validTab: XTab = tabsWithoutUndefined.has(tab) ? tab : 'research';
  
  // Defensive: fallback to 'research' agent if tab is not in routing
  const agentConfig = AGENT_ROUTING[validTab] || { agentId: 'researcher', displayName: 'Researcher' };
  
  // Defensive: ensure agentId is always defined
  const safeAgentId = agentConfig?.agentId || 'researcher';
  const safeDisplayName = agentConfig?.displayName || 'Researcher';
  
  const sessionKey = `agent:${safeAgentId}:xtwitter:${validTab}`;

  // Ensure gateway connection and pre-warm agent session on mount/tab change
  useEffect(() => {
    if (!gateway.connected) {
      gateway.connect();
    }
    setIsConnected(gateway.connected);

    // Pre-warm: create the agent session on the gateway so first real message
    // doesn't hit cold-start latency. Uses same pattern as VoiceChatPanel.
    if (gateway.connected) {
      gateway.request('chat.send', {
        message: `[Session initialized for ${safeDisplayName} — ${validTab} context]`,
        sessionKey,
        idempotencyKey: `warmup-${safeAgentId}-${validTab}-${Date.now()}`,
      }).catch(() => { /* best-effort */ });
    }

    // Listen for connection state changes — also pre-warm on reconnect
    const unsubscribe = gateway.on('stateChange', ({ state }: { state: string }) => {
      setIsConnected(state === 'connected');
      if (state === 'connected') {
        gateway.request('chat.send', {
          message: `[Session initialized for ${safeDisplayName} — ${validTab} context]`,
          sessionKey,
          idempotencyKey: `warmup-${safeAgentId}-${validTab}-${Date.now()}`,
        }).catch(() => { /* best-effort */ });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionKey, safeAgentId, safeDisplayName, validTab]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Store/restore messages when tab changes (preserve per-tab history via DB + ref cache)
  useEffect(() => {
    const prevTab = prevTabRef.current;
    if (prevTab !== tab) {
      // Save current tab's messages to ref before switching
      tabMessagesRef.current[prevTab] = messages;
      prevTabRef.current = tab;
    }
    setError(null);
    // Cancel any ongoing request
    abortControllerRef.current?.abort();

    // Load from DB for the new tab (ref cache used as fast fallback)
    const loadFromDb = async () => {
      setHistoryLoaded(false);
      try {
        const result = await window.clawdbot?.chat?.loadMessages(30, sessionKey, 'xtwitter');
        if (result?.success && result.messages?.length > 0) {
          setMessages(result.messages as ChatMessage[]);
          tabMessagesRef.current[validTab] = result.messages as ChatMessage[];
        } else {
          setMessages(tabMessagesRef.current[validTab] || []);
        }
      } catch {
        setMessages(tabMessagesRef.current[validTab] || []);
      }
      setHistoryLoaded(true);
    };
    loadFromDb();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for external message injection (e.g. "Suggest Reply" from XReplyGuyView)
  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent).detail?.message as string;
      if (message && !loading) {
        setInput(message);
        setAutoSend(true);
      }
    };
    window.addEventListener('x-agent-chat-inject', handler);
    return () => window.removeEventListener('x-agent-chat-inject', handler);
  }, [loading]);

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

    // Persist user message to SQLite
    window.clawdbot?.chat?.saveMessage({
      role: 'user',
      content: userMessage.content,
      timestamp: userMessage.timestamp,
      sessionKey,
      channel: 'xtwitter',
    });

    const agentMsgId = `msg-${Date.now()}-agent`;
    let agentContent = '';

    // Add placeholder for agent response
    setMessages((prev) => [
      ...prev,
      {
        id: agentMsgId,
        role: 'agent',
        agentName: safeDisplayName,
        agentId: safeAgentId,
        content: '',
        timestamp: Date.now(),
        streaming: true,
      },
    ]);

    try {
      // Build prompt with tab context - use validTab to ensure valid key
      const contextTab = tabsWithoutUndefined.has(tab) ? tab : 'research';
      const contextPrompt = `${TAB_CONTEXT[contextTab]}\n\nUser message: ${text}`;

      // Send to agent via gateway with streaming callbacks (explicit agentId for routing)
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
          // Persist final assistant message to SQLite
          if (agentContent) {
            window.clawdbot?.chat?.saveMessage({
              role: 'assistant',
              content: agentContent,
              timestamp: Date.now(),
              sessionKey,
              channel: 'xtwitter',
            });
          }
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
  }, [input, loading, tab, validTab, safeAgentId, sessionKey]);

  // Auto-send when flagged by external injection
  useEffect(() => {
    if (autoSend && input.trim() && !loading) {
      setAutoSend(false);
      handleSend();
    }
  }, [autoSend, input, loading, handleSend]);

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
            {safeDisplayName}
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
        {!historyLoaded ? (
          <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-clawd-text-dim">
            <Users className="w-12 h-12 text-clawd-text-dim mb-3" />
            <p className="font-medium text-clawd-text">Start a conversation</p>
            <p className="text-sm mt-1 text-clawd-text">
              Chat with {safeDisplayName} about {tab}
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
            placeholder={`Ask ${safeDisplayName} about ${tab}...`}
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
