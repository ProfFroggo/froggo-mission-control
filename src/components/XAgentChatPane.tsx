import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Users, AlertCircle, Zap, RotateCcw, Brain, BookOpen, MessageSquare, Archive } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import type { XTab } from './XTwitterPage';
import MarkdownMessage from './MarkdownMessage';
import { chatApi } from '../lib/api';
import { showToast } from './Toast';

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

interface SessionStatsData {
  messageCount: number;
  age: number;
  compacted: boolean;
  lastActivity: number;
  tokenEstimate: number;
  memoryFileCount: number;
  kbArticleCount: number;
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

Trigger types: mention, keyword, time, follower, dm, engagement (min_likes + min_retweets config)
Action types: reply, like, retweet, dm, add_to_list, process_mentions, report (report_type: competitor-analysis|weekly-summary), post_content (template config), custom_prompt (prompt config)
AI engine field: "gemini" (Gemini Flash Lite — fast background) or "claude" (Claude Haiku — nuanced replies)
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
  const [sessionStats, setSessionStats] = useState<SessionStatsData | null>(null);
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

  // Fetch session stats
  const fetchSessionStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/stats?key=${encodeURIComponent(sessionKey)}`);
      if (res.ok) {
        const data = await res.json();
        setSessionStats(data);
      }
    } catch { /* non-critical */ }
  }, [sessionKey]);

  // Load stats on mount and when tab changes
  useEffect(() => {
    fetchSessionStats();
  }, [fetchSessionStats]);

  // Handle new session reset
  const handleNewSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', key: sessionKey }),
      });
      if (res.ok) {
        setMessages([]);
        tabMessagesRef.current[validTab] = [];
        setSessionStats(null);
        showToast('Session reset', 'success');
        fetchSessionStats();
      }
    } catch {
      showToast('Failed to reset session', 'error');
    }
  }, [sessionKey, validTab, fetchSessionStats]);

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
      // Session service handles: user message persistence, context assembly,
      // agent invocation, and agent response persistence.
      const response = await fetch('/api/sessions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionKey,
          agentId: safeAgentId,
          surface: 'social' as const,
          contextId: validTab,
          metadata: { tab: validTab, tabContext: TAB_CONTEXT[validTab] },
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

      // Extract actionable content from response and dispatch to editor
      if (agentContent) {
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
      fetchSessionStats(); // Refresh stats after message
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
  }, [input, loading, tab, validTab, safeAgentId, safeDisplayName, sessionKey, fetchSessionStats]);

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
    <Flex direction="column" height="100%" className="bg-mission-control-surface">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <Flex align="center" justify="between" className="mb-2">
          <Flex align="center" gap="2">
            <Users className="w-4 h-4 text-mission-control-text-dim" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Agent Chat</h3>
          </Flex>
          <Flex align="center" gap="2">
            <Button
              onClick={handleNewSession}
              title="New session"
              variant="outline"
              size="1"
              radius="full"
            >
              <RotateCcw className="w-3 h-3" />
              New session
            </Button>
            <Flex align="center" gap="1" className={`px-2 py-1 text-xs rounded-full ${
              isConnected ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-error)]'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Flex>
          </Flex>
        </Flex>
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 text-[10px] font-medium bg-mission-control-accent/10 text-mission-control-accent rounded-full">
            {safeDisplayName}
          </span>
          <span className="px-2 py-0.5 text-[10px] font-medium bg-mission-control-border/40 text-mission-control-text-dim rounded-full">
            {tab}
          </span>
        </div>
        {/* Session stats indicators */}
        {sessionStats && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-mission-control-text-dim">
              <MessageSquare className="w-3 h-3" />
              {sessionStats.messageCount} msgs
            </span>
            <span className={`flex items-center gap-1 text-[10px] ${sessionStats.memoryFileCount > 0 ? 'text-mission-control-text-dim' : 'text-mission-control-text-dim/70'}`}>
              <Brain className="w-3 h-3" />
              {sessionStats.memoryFileCount > 0 ? `${sessionStats.memoryFileCount} memory files` : 'No memory'}
            </span>
            <span className={`flex items-center gap-1 text-[10px] ${sessionStats.kbArticleCount > 0 ? 'text-mission-control-text-dim' : 'text-mission-control-text-dim/70'}`}>
              <BookOpen className="w-3 h-3" />
              {sessionStats.kbArticleCount > 0 ? `${sessionStats.kbArticleCount} KB articles` : 'No KB'}
            </span>
            {sessionStats.compacted && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-info)]">
                <Archive className="w-3 h-3" />
                Compacted
              </span>
            )}
            {/* Context usage bar */}
            <Flex align="center" gap="1" className="text-[10px] text-mission-control-text-dim">
              <span>Context:</span>
              <div className="w-16 h-1.5 bg-mission-control-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-colors ${
                    (sessionStats.tokenEstimate / 32000) > 0.8
                      ? 'bg-[var(--color-error)]'
                      : (sessionStats.tokenEstimate / 32000) > 0.5
                      ? 'bg-[var(--color-warning)]'
                      : 'bg-[var(--color-success)]'
                  }`}
                  style={{ width: `${Math.min(100, (sessionStats.tokenEstimate / 32000) * 100)}%` }}
                />
              </div>
              <span>{Math.round((sessionStats.tokenEstimate / 32000) * 100)}%</span>
            </Flex>
          </div>
        )}
        {error && (
          <div className="mt-2 p-2 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 rounded-lg flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {!historyLoaded ? (
          <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
            <Flex gap="1" className="mb-2">
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </Flex>
            <span className="text-xs text-mission-control-text-dim">Loading...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-mission-control-text-dim">
            <div className="w-10 h-10 rounded-full bg-mission-control-accent/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-mission-control-accent" />
            </div>
            <p className="text-sm font-medium text-mission-control-text-dim">Start a conversation</p>
            <p className="text-xs mt-1 text-mission-control-text-dim">
              Chat with {safeDisplayName} about {tab}
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const isNewSpeaker = !prev || prev.role !== msg.role || (msg.role === 'agent' && prev.agentId !== msg.agentId);
              return (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${isNewSpeaker ? 'mt-6' : 'mt-2'}`}>
                  {msg.role === 'agent' && (
                    <div className={`flex-shrink-0 mr-2 ${isNewSpeaker ? '' : 'invisible'}`}>
                      <div className="w-8 h-8 rounded-lg bg-mission-control-border/60 flex items-center justify-center">
                        <Users className="w-4 h-4 text-mission-control-text-dim" />
                      </div>
                    </div>
                  )}
                  <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {isNewSpeaker && msg.role === 'agent' && msg.agentName && (
                      <span className="text-xs font-medium text-[var(--color-success)] mb-1 px-1">{msg.agentName}</span>
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
                    ) : msg.error ? (
                      <div className="text-sm px-4 py-2.5 bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] rounded-xl">
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-mission-control-text">
                        {msg.streaming && !msg.content ? (
                          <Flex gap="1" align="center" className="py-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-mission-control-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                            <span className="text-xs text-mission-control-text-dim ml-1">thinking...</span>
                          </Flex>
                        ) : (
                          <MarkdownMessage content={msg.content} />
                        )}
                      </div>
                    )}
                    <div className="text-[11px] tabular-nums mt-1 text-mission-control-text-dim/70 px-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="px-4 pt-3 pb-1 border-t border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-1.5 mb-2">
          <Zap className="w-3 h-3 text-mission-control-text-dim flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">Quick prompts</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(QUICK_PROMPTS[validTab] || []).slice(0, 4).map((prompt) => (
            <Button
              key={prompt}
              onClick={() => handleQuickPrompt(prompt)}
              disabled={loading}
              title={prompt}
              variant="outline"
              size="1"
              radius="full"
              className="whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis"
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-mission-control-border bg-mission-control-bg px-4 py-3">
        <Flex gap="2" align="end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask ${safeDisplayName} about ${tab}...`}
            disabled={loading}
            rows={1}
            className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-[14px] px-4 py-3 text-sm resize-none text-mission-control-text placeholder:text-mission-control-text-dim outline-none focus:border-[var(--mission-control-accent)] focus:ring-2 focus:ring-[var(--mission-control-accent)]/20 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg bg-[var(--mission-control-accent)] text-white flex items-center justify-center hover:opacity-85 transition-opacity disabled:opacity-40 flex-shrink-0"
            aria-label="Send"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </Flex>
      </div>
    </Flex>
  );
}
