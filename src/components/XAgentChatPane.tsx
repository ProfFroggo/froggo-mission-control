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

// Agent routing mapping: tab -> primary agent ID
// All social media chat surfaces use social-manager as the single agent
const AGENT_ROUTING: Record<XTab, { agentId: string; displayName: string }> = Object.fromEntries(
  (['pipeline', 'publish', 'research', 'plan', 'drafts', 'calendar', 'mentions',
    'reply-guy', 'content-mix', 'automations', 'analytics', 'reddit', 'campaigns',
    'agent-mode', 'competitors', 'hashtags'] as XTab[]).map(tab => [
    tab, { agentId: 'social-manager', displayName: 'Social Manager' }
  ])
) as Record<XTab, { agentId: string; displayName: string }>;

// Quick prompts for each tab — contextual one-click prompts that auto-send
const QUICK_PROMPTS: Record<XTab, string[]> = {
  pipeline: [
    'What content is stuck and needs attention?',
    'Move ready drafts to the approval queue',
    'Suggest scheduling for approved posts',
    'Show me bottlenecks in the content pipeline',
  ],
  publish: [
    'Write 3 tweet variations for my latest post',
    'Suggest the best hashtags for this content',
    'Rewrite this for maximum engagement',
    'Create a thread version of this tweet',
  ],
  research: [
    'What are the trending topics in my niche today?',
    'Find top-performing tweets about this topic this week',
    'Analyze my competitors\' content strategy',
    'What content format gets most engagement?',
  ],
  plan: [
    'Generate a 2-week content calendar',
    'Suggest 10 tweet ideas for this week',
    'What topics should I cover based on trends?',
    'Create a thread series plan',
  ],
  drafts: [
    'Review all my drafts and suggest improvements',
    'Which draft is ready to publish?',
    'Improve the hooks on my draft tweets',
    'Rewrite my weakest draft',
  ],
  analytics: [
    'What\'s my best performing content type?',
    'When should I post for maximum reach?',
    'What topics should I post more about?',
    'Summarize my performance this week',
  ],
  campaigns: [
    'Plan a product launch tweet campaign',
    'Create a 5-day announcement sequence',
    'Write campaign hooks for A/B testing',
    'What\'s the ideal campaign structure for my niche?',
  ],
  calendar: [
    'What should I post this week?',
    'Find gaps in my content schedule',
    'Optimize my posting times',
    'Plan content for the next 7 days',
  ],
  mentions: [
    'Summarize recent mentions and sentiment',
    'Draft replies to my top mentions',
    'Identify engagement opportunities',
    'Who should I prioritize responding to?',
  ],
  'reply-guy': [
    'Find tweets I should reply to today',
    'Write 5 clever reply hooks',
    'Identify trending conversations to join',
    'Draft a quote tweet for a trending post',
  ],
  'content-mix': [
    'Analyze my current content distribution',
    'Suggest a better content mix ratio',
    'What content type am I underusing?',
    'Plan a balanced content week',
  ],
  automations: [
    'Suggest automations for my workflow',
    'What should I automate first?',
    'Review my existing automation rules',
    'Create a welcome reply automation',
  ],
  reddit: [
    'Find relevant subreddits for my niche',
    'Draft an authentic Reddit comment',
    'Summarize this week\'s Reddit mentions',
    'Find threads I should engage with',
  ],
  'agent-mode': [
    'Suggest a content brief for a SaaS growth account',
    'What posting frequency works best for B2B?',
    'Review my agent brief and suggest improvements',
    'What topics should the agent focus on this week?',
  ],
  competitors: [
    'Analyze what my top competitor does well',
    'What content gaps can I exploit?',
    'Suggest a counter-strategy to their approach',
    'What would make my content stand out from theirs?',
  ],
  hashtags: [
    'Suggest hashtags for a product launch tweet',
    'What hashtags work best for growth content?',
    'Which hashtags are trending in the SaaS space?',
    'Create a hashtag set for a weekly series',
  ],
};

// Set of valid tabs for validation
const tabsWithoutUndefined = new Set<XTab>([
  'pipeline', 'publish', 'research', 'plan', 'drafts', 'calendar', 'mentions',
  'reply-guy', 'content-mix', 'automations', 'analytics', 'reddit', 'campaigns',
  'agent-mode', 'competitors', 'hashtags',
]);

// System prompts for each tab to give context to the agent
const TAB_CONTEXT: Record<XTab, string> = {
  pipeline: `You are the Social Manager agent overseeing the content pipeline. Current context: Pipeline (Kanban) View. Your role: Help move content through the production stages, advise on approval decisions, suggest scheduling strategy, and identify bottlenecks in the content workflow.`,

  publish: `You are the Social Manager agent helping compose and publish X/Twitter posts. Current context: X/Twitter Publish Tab. Your role: Help craft engaging tweets, suggest improvements to copy, recommend hashtags, and assist with thread composition.`,

  research: `You are the Social Manager agent doing X/Twitter research. Current context: X/Twitter Research Tab.

Your role: Search X for trending topics, find high-performing tweets, identify content opportunities, and gather competitive insights.

Research capabilities:
- Search recent tweets (last 7 days) with engagement filtering
- Filter by minimum likes, retweets, impressions
- Track specific accounts (watchlist)
- Analyze content patterns and engagement rates
- Cost: ~$0.50 per search page (~100 posts), $0.005 per post read

When presenting research results, format as:
- Tweet text (truncated if long)
- Author @handle + follower count
- Engagement: likes/retweets/replies/impressions
- Link to original tweet
- Why it's relevant

Always suggest actionable next steps: draft similar content, engage with the thread, save to content pipeline.`,

  plan: `You are the Social Manager agent helping plan X/Twitter content. Current context: X/Twitter Content Planning Tab. Your role: Help plan content calendars, brainstorm tweet ideas, outline threads, and create content strategies.`,

  drafts: `You are the Social Manager agent helping create X/Twitter drafts. Current context: X/Twitter Drafts Tab. Your role: Write engaging tweets, craft thread hooks, polish copy, and improve messaging.`,

  calendar: `You are the Social Manager agent managing the X/Twitter content calendar. Current context: X/Twitter Calendar Tab. Your role: Help schedule content, optimize posting times, manage the editorial calendar.`,

  mentions: `You are the Social Manager agent monitoring X/Twitter mentions. Current context: X/Twitter Mentions Tab. Your role: Help monitor brand mentions, suggest responses, identify engagement opportunities.`,

  'reply-guy': `You are the Social Manager agent specializing in reply-style content for X/Twitter. Current context: X/Twitter Reply Guy Tab. Your role: Help craft clever replies, quote tweets, and engagement responses.`,

  'content-mix': `You are the Social Manager agent helping manage the X/Twitter content mix. Current context: X/Twitter Content Mix Tracker Tab. Your role: Help balance content types, track content distribution.`,

  automations: `You are the Social Manager agent managing X/Twitter automations. Current context: X/Twitter Automations Tab. Your role: Help set up automated workflows, schedule recurring content, manage bot behaviors.`,

  analytics: `You are the Social Manager agent reviewing X/Twitter analytics. Current context: X/Twitter Analytics Tab. Your role: Help interpret performance data, identify trends, suggest content optimizations.`,

  reddit: `You are the Social Manager agent monitoring Reddit for product mentions. Current context: Reddit Monitor Tab. Your role: Help monitor subreddits for mentions of a product, analyze threads, and draft authentic Reddit replies. Use natural, conversational Reddit tone.`,

  'agent-mode': `You are the Social Manager agent helping configure and oversee the agentic social media workflow. Current context: Agent Mode Tab. Your role: Help define content briefs, review agent-generated drafts, suggest approval strategies, and optimize the automated content pipeline.`,

  competitors: `You are the Social Manager agent analyzing competitor social media strategies. Current context: Competitor Tracker Tab. Your role: Help analyze competitor content patterns, identify gaps and opportunities, and suggest counter-strategies to gain competitive advantage.`,

  hashtags: `You are the Social Manager agent helping discover and manage hashtags for maximum reach. Current context: Hashtag Intelligence Tab. Your role: Suggest relevant hashtags, explain trending tags, help build hashtag sets for campaigns, and advise on hashtag strategy.`,

  campaigns: `You are the Social Manager agent helping plan multi-stage social media campaigns. Current context: Campaigns Tab.

Your role: Help design campaign arcs, suggest tweet content for each stage, optimize timing and sequencing, and ensure narrative coherence across a multi-day campaign.

When you have enough information to propose a campaign, output it as a JSON block wrapped in \`\`\`campaign fences. The format:
\`\`\`campaign
{
  "title": "Campaign Title",
  "subject": "Brief description of theme/goal",
  "stages": [
    { "dayOffset": 0, "time": "10:00", "type": "tweet", "content": "Tweet text here", "notes": "Hook tweet" },
    { "dayOffset": 1, "time": "12:00", "type": "tweet", "content": "Follow-up tweet", "notes": "Build interest" },
    { "dayOffset": 3, "time": "10:00", "type": "thread", "content": "Thread content", "notes": "Deep dive" }
  ]
}
\`\`\`

Always explain the campaign strategy in plain text BEFORE the JSON block. The user can edit stages in the middle pane after you propose them. Ask clarifying questions first if needed (topic, audience, duration, tone). Build iteratively — propose, get feedback, refine.`,
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
      // Build prompt with tab context
      // Save user message to chat history
      chatApi.saveMessage(sessionKey, {
        role: 'user',
        content: text,
        timestamp: Date.now(),
        channel: 'xtwitter',
      });

      // Get AI response via generate-reply (spawns Claude)
      const contextTab = tabsWithoutUndefined.has(tab) ? tab : 'research';
      const contextPrompt = `${TAB_CONTEXT[contextTab]}\n\nUser message: ${text}`;

      const response = await fetch('/api/chat/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: TAB_CONTEXT[contextTab],
          tone: 'professional',
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
        // Campaign JSON blocks → campaign view
        if (validTab === 'campaigns') {
          const campaignMatch = agentContent.match(/```campaign\s*\n([\s\S]*?)```/);
          if (campaignMatch) {
            try {
              const campaignData = JSON.parse(campaignMatch[1].trim());
              window.dispatchEvent(new CustomEvent('x-campaign-proposal', { detail: campaignData }));
            } catch { /* invalid JSON, ignore */ }
          }
        }

        // Tweet drafts → publish composer (detect ```tweet blocks or quoted tweets)
        const tweetMatch = agentContent.match(/```tweet\s*\n([\s\S]*?)```/);
        if (tweetMatch) {
          window.dispatchEvent(new CustomEvent('x-draft-proposal', { detail: { content: tweetMatch[1].trim(), tab: validTab } }));
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
