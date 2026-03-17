import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Users, AlertCircle, Zap } from 'lucide-react';
import type { XTab } from './XTwitterPage';
import MarkdownMessage from './MarkdownMessage';
import { chatApi } from '../lib/api';

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

// Agent routing mapping: all tabs use social-manager
const AGENT_ROUTING: Record<XTab, { agentId: string; displayName: string }> = {
  pipeline: { agentId: 'social-manager', displayName: 'Social Manager' },
  engage: { agentId: 'social-manager', displayName: 'Social Manager' },
  intelligence: { agentId: 'social-manager', displayName: 'Social Manager' },
  measure: { agentId: 'social-manager', displayName: 'Social Manager' },
  configure: { agentId: 'social-manager', displayName: 'Social Manager' },
};

// Quick prompts for each consolidated tab
const QUICK_PROMPTS: Record<XTab, string[]> = {
  pipeline: [
    'What content is stuck and needs attention?',
    'Suggest scheduling for approved posts',
    'Generate a 2-week content calendar',
    'Show me bottlenecks in the pipeline',
  ],
  engage: [
    'Summarize recent mentions and sentiment',
    'Draft replies to my top mentions',
    'Who should I prioritize responding to?',
    'Find trending conversations to join',
  ],
  intelligence: [
    'What are the trending topics in my niche?',
    'Analyze my competitors\' content strategy',
    'Suggest hashtags for my next post',
    'What content gaps can I exploit?',
  ],
  measure: [
    'What\'s my best performing content type?',
    'When should I post for maximum reach?',
    'Summarize my performance this week',
    'Analyze my current content mix',
  ],
  configure: [
    'Create an automation that auto-replies to mentions with 50+ likes',
    'Set up a daily posting schedule automation',
    'What automations should I have running?',
    'Review my agent brief and improve it',
  ],
};

// Set of valid tabs for validation
const tabsWithoutUndefined = new Set<XTab>([
  'pipeline', 'engage', 'intelligence', 'measure', 'configure',
]);

// System prompts for each consolidated tab
const TAB_CONTEXT: Record<XTab, string> = {
  pipeline: `You are the Social Manager agent overseeing the content pipeline. Current context: Pipeline — unified content workflow (Kanban board, calendar, list, campaigns).

Your role: Help move content through production stages (Ideas → Drafting → Review → Approved → Scheduled → Published), advise on approval decisions, suggest scheduling strategy, plan campaigns, and identify bottlenecks.

When proposing a campaign, output as a JSON block in \`\`\`campaign fences:
\`\`\`campaign
{ "title": "...", "subject": "...", "stages": [{ "dayOffset": 0, "time": "10:00", "type": "tweet", "content": "...", "notes": "..." }] }
\`\`\``,

  engage: `You are the Social Manager agent managing community engagement. Current context: Engage — unified inbox for all incoming mentions, replies, and engagement opportunities.

Your role: Triage mentions by priority, suggest smart replies, identify high-engagement opportunities, manage reply templates, and help craft authentic responses. All replies go through human approval before posting.

When suggesting replies, provide 2-3 options with different tones (professional, casual, witty). Format each option clearly.`,

  intelligence: `You are the Social Manager agent conducting research and competitive intelligence. Current context: Intelligence — search, competitor tracking, and hashtag discovery.

Your role: Search X for trending topics, analyze competitor content strategies, discover high-performing hashtags, identify content gaps, and provide actionable research insights.

Research capabilities:
- Search recent tweets with engagement metrics
- Track competitor accounts and their performance
- Discover trending hashtags and their engagement rates
- Analyze content patterns across the niche

When presenting findings, include: content/handle, engagement metrics, why it matters, and actionable next steps.`,

  measure: `You are the Social Manager agent reviewing performance analytics. Current context: Measure — analytics dashboard with engagement metrics, content distribution, and growth tracking.

Your role: Interpret performance data, identify trends, suggest content optimizations, analyze content mix balance, and provide data-driven recommendations for improving reach and engagement.

You can run these AI-powered analyses:
- "Run competitor analysis" — search X for competitor accounts, compare engagement metrics, identify content gaps
- "Generate weekly report" — summarize post performance, engagement trends, top content, growth insights
- "Content mix audit" — analyze the balance of content types and suggest optimizations
- "Best posting times" — analyze when posts get most engagement and recommend schedule changes

When presenting analysis, use markdown tables for metrics and bold key insights.`,

  configure: `You are the Social Manager agent helping configure automation and agent settings. Current context: Configure — agent mode, automation rules, and credential management.

Your role: Help define content briefs for autonomous posting, set up automation rules (auto-reply triggers, scheduled content), review agent-generated drafts, and optimize the automated content pipeline.

When the user wants to create an automation, help them define it conversationally then output a JSON block:
\`\`\`automation
{
  "name": "Auto-reply to mentions with 50+ likes",
  "description": "Reply to high-engagement mentions automatically",
  "trigger_type": "mention",
  "trigger_config": { "min_followers": 100, "mention_type": "reply" },
  "actions": [{ "type": "reply", "config": { "template": "Thanks for the love, {{username}}!" } }],
  "max_per_hour": 5,
  "max_per_day": 20
}
\`\`\`

Trigger types: mention, keyword, time, follower, dm
Action types: reply, like, retweet, dm, add_to_list
All actions go through human approval — nothing posts directly.`,
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
  const validTab: XTab = tabsWithoutUndefined.has(tab) ? tab : 'pipeline';

  // Defensive: fallback agent config
  const agentConfig = AGENT_ROUTING[validTab] || { agentId: 'social-manager', displayName: 'Social Manager' };
  const safeAgentId = agentConfig.agentId;
  const safeDisplayName = agentConfig.displayName;
  
  const sessionKey = `agent:${safeAgentId}:xtwitter:${validTab}`;

  // Always connected via REST API — no gateway needed
  useEffect(() => {
    setIsConnected(true);
  }, []);

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
        const result = await chatApi.getMessages(sessionKey);
        const msgs = Array.isArray(result) ? result : [];
        if (msgs.length > 0) {
          setMessages(msgs.slice(-30) as ChatMessage[]);
          tabMessagesRef.current[validTab] = msgs.slice(-30) as ChatMessage[];
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

    // REST API — always available

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

    // Persist user message via REST API
    chatApi.saveMessage(sessionKey, {
      role: 'user',
      content: userMessage.content,
      timestamp: userMessage.timestamp,
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
      // Send to agent chat room — the social-manager agent has MCP tools
      // and can call X API endpoints, search, create tasks, etc.
      const contextTab = tabsWithoutUndefined.has(tab) ? tab : 'pipeline';

      // Post message to the agent's chat room so it persists
      const roomId = safeAgentId;
      try {
        await fetch(`/api/chat-rooms/${roomId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: 'human', content: text, role: 'user' }),
        });
      } catch { /* non-critical */ }

      // Server pre-fetches live data based on tab — no need for client-side tool context
      const response = await fetch('/api/chat/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: TAB_CONTEXT[contextTab],
          tone: 'professional',
          tab: contextTab,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        agentContent = data.reply || 'No response';
      } else {
        agentContent = 'Failed to get a response. Check that Claude CLI is configured.';
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === agentMsgId
            ? { ...msg, content: agentContent, streaming: false }
            : msg
        )
      );

      // Persist agent response
      if (agentContent) {
        chatApi.saveMessage(sessionKey, {
          role: 'assistant',
          content: agentContent,
          timestamp: Date.now(),
          channel: 'xtwitter',
        });

        // Extract actionable content from response and dispatch to editor
        // Campaign JSON blocks → pipeline campaigns view
        if (validTab === 'pipeline') {
          const campaignMatch = agentContent.match(/```campaign\s*\n([\s\S]*?)```/);
          if (campaignMatch) {
            try {
              const campaignData = JSON.parse(campaignMatch[1].trim());
              window.dispatchEvent(new CustomEvent('x-campaign-proposal', { detail: campaignData }));
            } catch { /* invalid JSON, ignore */ }
          }
        }

        // Tweet drafts → publish composer
        const tweetMatch = agentContent.match(/```tweet\s*\n([\s\S]*?)```/);
        if (tweetMatch) {
          window.dispatchEvent(new CustomEvent('x-draft-proposal', { detail: { content: tweetMatch[1].trim(), tab: validTab } }));
        }

        // Automation proposals → create via API
        const autoMatch = agentContent.match(/```automation\s*\n([\s\S]*?)```/);
        if (autoMatch) {
          try {
            const autoData = JSON.parse(autoMatch[1].trim());
            const res = await fetch('/api/x/automations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(autoData),
            });
            if (res.ok) {
              window.dispatchEvent(new CustomEvent('x-automation-created', { detail: autoData }));
            }
          } catch { /* invalid JSON, ignore */ }
        }
      }
      setLoading(false);
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
  }, [input, loading, tab, validTab, safeAgentId, safeDisplayName, sessionKey]);

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

  const handleQuickPrompt = useCallback((prompt: string) => {
    if (loading) return;
    setInput(prompt);
    setAutoSend(true);
  }, [loading]);

  return (
    <div className="flex flex-col h-full bg-mission-control-surface">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-info" />
            <h3 className="text-sm font-semibold text-mission-control-text">Agent Chat</h3>
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
          <span className="px-2 py-1 text-xs bg-mission-control-bg-alt text-mission-control-text-dim rounded-full">
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
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <div className="flex gap-1 mb-2">
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-mission-control-text-dim">
            <Users className="w-12 h-12 text-mission-control-text-dim mb-3" />
            <p className="font-medium text-mission-control-text">Start a conversation</p>
            <p className="text-sm mt-1 text-mission-control-text">
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
                  className={`max-w-[90%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-mission-control-accent text-white rounded-tr-sm'
                      : msg.error
                      ? 'bg-error-subtle border border-error-border text-error rounded-tl-sm'
                      : 'bg-mission-control-bg-alt text-mission-control-text rounded-tl-sm'
                  }`}
                >
                  {msg.role === 'agent' && msg.agentName && (
                    <div className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1">
                      <span>{msg.agentName}</span>
                      {msg.streaming && (
                        <span className="flex items-center gap-1">
                          <span className="flex gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
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
                      msg.role === 'user' ? 'text-mission-control-text-dim' : 'text-mission-control-text-dim'
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

      {/* Quick Prompts */}
      <div className="px-4 pt-3 pb-1 border-t border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-mission-control-text-dim flex-shrink-0" />
          <span className="text-xs text-mission-control-text-dim font-medium">Quick prompts</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(QUICK_PROMPTS[validTab] || []).slice(0, 4).map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleQuickPrompt(prompt)}
              disabled={loading}
              title={prompt}
              className="px-3 py-1.5 text-xs rounded-full border border-mission-control-border text-mission-control-text-dim hover:border-info hover:text-info transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 bg-mission-control-surface">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask ${safeDisplayName} about ${tab}...`}
            className="flex-1 bg-mission-control-bg-alt text-mission-control-text placeholder-mission-control-text-dim border border-mission-control-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-info"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-mission-control-accent hover:bg-mission-control-accent-dim text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-mission-control-text-dim mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
