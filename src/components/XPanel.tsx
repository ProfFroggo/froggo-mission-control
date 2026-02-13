import { useState, useEffect, useRef } from 'react';
import { Send, Heart, MessageCircle, Repeat, BarChart2, RefreshCw, Edit, Trash2, Eye, Users, Sparkles, Image, Calendar, X, Lightbulb, ArrowRight, Search, FileText, Zap } from 'lucide-react';
import { useStore, XDraft } from '../store/store';
import { LoadingButton } from './LoadingStates';
import ContentCalendar from './ContentCalendar';
import XAutomationsTab from './XAutomationsTab';

// Chat message type
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// X logo as SVG component
const XLogo = ({ size = 24, className = '' }: { size?: number; className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface Tweet {
  id: string;
  text: string;
  author: string;
  authorName?: string;
  timestamp: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  url?: string;
}

// Using XDraft from store instead of local interface

interface EngagementStats {
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalViews: number;
  avgEngagement: number;
}

export default function XPanel() {
  const { connected, addActivity, xDrafts: rawXDrafts, addXDraft, updateXDraft, deleteXDraft, markXDraftPosted } = useStore();
  // Defensive: ensure xDrafts is always an array (handles stale localStorage without xDrafts key)
  const xDrafts = rawXDrafts || [];
  
  // ALL useState hooks FIRST (React hooks rule)
  const [activeTab, setActiveTab] = useState<'research' | 'plan' | 'drafts' | 'calendar' | 'automations' | 'mentions' | 'timeline' | 'analytics'>('research');
  const [mentions, setMentions] = useState<Tweet[]>([]);
  const [timeline, setTimeline] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<EngagementStats | null>(null);
  const [posting, setPosting] = useState(false);
  
  // Research tab state (chat with research agent)
  const [researchMessages, setResearchMessages] = useState<ChatMessage[]>([]);
  const [researchInput, setResearchInput] = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
  const researchEndRef = useRef<HTMLDivElement>(null);
  
  // Plan tab state (chat with planning agent)
  const [planMessages, setPlanMessages] = useState<ChatMessage[]>([]);
  const [planInput, setPlanInput] = useState('');
  const [planChatLoading, setPlanChatLoading] = useState(false);
  const planEndRef = useRef<HTMLDivElement>(null);
  
  // Plan tab compose state
  const [planTopic, setPlanTopic] = useState('');
  const [planIdeas, setPlanIdeas] = useState<{ idea: string; hook: string }[]>([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planComposeText, setPlanComposeText] = useState('');
  const [planImage, setPlanImage] = useState<{ path: string; preview: string } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: Log on mount to verify clawdbot is available
  useEffect(() => {
    console.log('[XPanel] Component mounted');
    console.log('[XPanel] window.clawdbot available:', !!(window as any).clawdbot);
    console.log('[XPanel] window.clawdbot.twitter available:', !!(window as any).clawdbot?.twitter);
    if ((window as any).clawdbot?.twitter) {
      console.log('[XPanel] twitter.home type:', typeof (window as any).clawdbot.twitter.home);
      console.log('[XPanel] twitter.mentions type:', typeof (window as any).clawdbot.twitter.mentions);
    }
  }, []);

  // Auto-fetch when tab changes
  useEffect(() => {
    console.log('[XPanel] Tab changed to:', activeTab, 'timeline.length:', timeline.length, 'mentions.length:', mentions.length);
    if (activeTab === 'mentions' && mentions.length === 0) {
      console.log('[XPanel] Auto-fetching mentions...');
      fetchMentions();
    } else if (activeTab === 'timeline' && timeline.length === 0) {
      console.log('[XPanel] Auto-fetching timeline...');
      fetchTimeline();
    } else if (activeTab === 'analytics') {
      calculateStats();
    }
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // ⌘N - New tweet (go to Plan tab and focus compose area)
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setActiveTab('plan');
        // Focus will be on the textarea when tab renders
      }
      
      // ⌘R - Refresh current view
      if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleRefresh();
      }
      
      // ⌘1-7 - Switch tabs
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setActiveTab('research');
            break;
          case '2':
            e.preventDefault();
            setActiveTab('plan');
            break;
          case '3':
            e.preventDefault();
            setActiveTab('drafts');
            break;
          case '4':
            e.preventDefault();
            setActiveTab('calendar');
            break;
          case '5':
            e.preventDefault();
            setActiveTab('mentions');
            break;
          case '6':
            e.preventDefault();
            setActiveTab('timeline');
            break;
          case '7':
            e.preventDefault();
            setActiveTab('analytics');
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Map x-api output to our Tweet format
  const mapTweet = (t: any): Tweet => ({
    id: t.id || String(Date.now()),
    text: t.text || t.content || '',
    author: t.author?.username || t.user || 'unknown',
    authorName: t.author?.name || t.author?.username || '',
    timestamp: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
    likes: t.likeCount ?? t.likes ?? t.favorite_count ?? 0,
    retweets: t.retweetCount ?? t.retweets ?? t.retweet_count ?? 0,
    replies: t.replyCount ?? t.replies ?? t.reply_count ?? 0,
    views: t.viewCount ?? t.views ?? 0,
    url: t.url || `https://x.com/i/status/${t.id}`,
  });

  const fetchMentions = async () => {
    console.log('[XPanel] fetchMentions() called');
    const clawdbot = (window as any).clawdbot;
    
    if (!clawdbot?.twitter?.mentions) {
      console.error('[XPanel] ERROR: twitter.mentions is not available!');
      addActivity({ type: 'error', message: 'Twitter API not available (preload issue?)', timestamp: Date.now() });
      return;
    }
    
    setLoading(true);
    try {
      console.log('[XPanel] Calling twitter.mentions()...');
      const result = await clawdbot.twitter.mentions();
      console.log('[XPanel] Mentions result:', result);
      
      if (result?.success && result.mentions) {
        console.log('[XPanel] Mapping', result.mentions.length, 'mentions...');
        const mapped = result.mentions.map(mapTweet);
        setMentions(mapped);
        addActivity({ type: 'task', message: `Loaded ${mapped.length} mentions`, timestamp: Date.now() });
      } else if (result?.error) {
        console.error('[XPanel] Mentions error from API:', result.error);
        addActivity({ type: 'error', message: `Failed to load mentions: ${result.error}`, timestamp: Date.now() });
      } else {
        console.warn('[XPanel] Unexpected mentions result structure:', result);
      }
    } catch (e: any) {
      console.error('[XPanel] Exception in fetchMentions:', e);
      addActivity({ type: 'error', message: `Failed to fetch mentions: ${e?.message}`, timestamp: Date.now() });
    } finally {
      console.log('[XPanel] fetchMentions() completed');
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    console.log('[XPanel] fetchTimeline() called');
    const clawdbot = (window as any).clawdbot;
    console.log('[XPanel] window.clawdbot:', !!clawdbot);
    console.log('[XPanel] window.clawdbot.twitter:', !!clawdbot?.twitter);
    console.log('[XPanel] window.clawdbot.twitter.home:', !!clawdbot?.twitter?.home);
    
    if (!clawdbot?.twitter?.home) {
      console.error('[XPanel] ERROR: twitter.home is not available!');
      addActivity({ type: 'error', message: 'Twitter API not available (preload issue?)', timestamp: Date.now() });
      return;
    }
    
    setLoading(true);
    try {
      console.log('[XPanel] Calling twitter.home(30)...');
      const result = await clawdbot.twitter.home(30);
      console.log('[XPanel] Timeline result:', JSON.stringify(result, null, 2));
      console.log('[XPanel] result?.success:', result?.success);
      console.log('[XPanel] result?.tweets length:', result?.tweets?.length);
      console.log('[XPanel] result?.error:', result?.error);
      
      // Check if we got tweets or need to parse raw data
      let tweets = result?.tweets || [];
      
      // Fallback: if tweets array is empty but raw data exists, try to parse it
      if (tweets.length === 0 && result?.raw) {
        console.log('[XPanel] Tweets empty but raw data exists, attempting to parse...');
        try {
          // Try to find valid JSON array in the raw data
          const rawTrimmed = result.raw.trim();
          if (rawTrimmed.startsWith('[')) {
            tweets = JSON.parse(rawTrimmed);
            console.log('[XPanel] Successfully parsed raw data:', tweets.length, 'tweets');
          }
        } catch (parseErr: any) {
          console.error('[XPanel] Failed to parse raw data:', parseErr.message);
          // Try to extract partial valid JSON (common issue: truncated output)
          try {
            // Find the last complete object in the array
            const lastCloseBracket = result.raw.lastIndexOf('}');
            if (lastCloseBracket > 0) {
              const truncated = result.raw.substring(0, lastCloseBracket + 1) + ']';
              tweets = JSON.parse(truncated);
              console.log('[XPanel] Parsed partial data:', tweets.length, 'tweets');
            }
          } catch {
            console.error('[XPanel] Could not recover partial JSON');
          }
        }
      }
      
      if (result?.success && tweets.length > 0) {
        console.log('[XPanel] Mapping', tweets.length, 'tweets...');
        const mapped = tweets.map(mapTweet);
        console.log('[XPanel] Mapped', mapped.length, 'tweets, setting state...');
        setTimeline(mapped);
        addActivity({ type: 'task', message: `Loaded ${mapped.length} timeline posts`, timestamp: Date.now() });
      } else if (result?.error) {
        console.error('[XPanel] Timeline error from API:', result.error);
        addActivity({ type: 'error', message: `Failed to load timeline: ${result.error}`, timestamp: Date.now() });
      } else {
        console.warn('[XPanel] No tweets available:', result);
        addActivity({ type: 'error', message: 'No timeline data available', timestamp: Date.now() });
      }
    } catch (e: any) {
      console.error('[XPanel] Exception in fetchTimeline:', e);
      console.error('[XPanel] Stack:', e?.stack);
      addActivity({ type: 'error', message: `Failed to fetch timeline: ${e?.message}`, timestamp: Date.now() });
    } finally {
      console.log('[XPanel] fetchTimeline() completed, setting loading=false');
      setLoading(false);
    }
  };

  const calculateStats = () => {
    const allTweets = [...mentions, ...timeline];
    if (allTweets.length === 0) {
      setStats(null);
      return;
    }
    
    const totalLikes = allTweets.reduce((sum, t) => sum + (t.likes || 0), 0);
    const totalRetweets = allTweets.reduce((sum, t) => sum + (t.retweets || 0), 0);
    const totalReplies = allTweets.reduce((sum, t) => sum + (t.replies || 0), 0);
    const totalViews = allTweets.reduce((sum, t) => sum + (t.views || 0), 0);
    const avgEngagement = allTweets.length > 0 
      ? (totalLikes + totalRetweets + totalReplies) / allTweets.length 
      : 0;
    
    setStats({ totalLikes, totalRetweets, totalReplies, totalViews, avgEngagement });
  };

  const handlePost = async (draft: XDraft) => {
    // Actually post the tweet via x-api
    updateXDraft(draft.id, { status: 'pending' });
    
    try {
      const result = await (window as any).clawdbot?.execute?.tweet(draft.text);
      
      if (result?.success) {
        addActivity({ type: 'task', message: `Posted to X!`, timestamp: Date.now() });
        // Remove the draft entirely after successful post
        markXDraftPosted(draft.id);
      } else {
        console.error('[X] Failed to post:', result?.error);
        addActivity({ type: 'error', message: `Failed to post: ${result?.error}`, timestamp: Date.now() });
        // Revert status on failure
        updateXDraft(draft.id, { status: 'draft' });
      }
    } catch (e: any) {
      console.error('[X] Post error:', e);
      addActivity({ type: 'error', message: `Post failed: ${e.message}`, timestamp: Date.now() });
      // Revert status on failure
      updateXDraft(draft.id, { status: 'draft' });
    }
  };

  const handleDelete = (draftId: string) => {
    deleteXDraft(draftId);
  };

  const handleRefresh = () => {
    if (activeTab === 'mentions') {
      fetchMentions();
    } else if (activeTab === 'timeline') {
      fetchTimeline();
    } else if (activeTab === 'analytics') {
      // Refresh both and recalculate
      Promise.all([fetchMentions(), fetchTimeline()]).then(() => calculateStats());
    }
  };

  // Research agent chat
  const sendResearchMessage = async () => {
    if (!researchInput.trim() || researchLoading) return;
    
    const userMessage = researchInput.trim();
    setResearchInput('');
    setResearchMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setResearchLoading(true);
    
    try {
      const systemPrompt = `You are an X/Twitter research agent. You help research trends, competitors, topics, and content strategies for social media. You analyze what's working, identify opportunities, and provide actionable insights. Be concise but thorough. Focus on X/Twitter-specific strategies and current trends.`;
      
      const result = await (window as any).clawdbot?.ai?.generateContent(userMessage, 'chat', {
        systemPrompt,
        conversationHistory: researchMessages
      });
      
      if (result?.success && result.content) {
        setResearchMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
        addActivity({ type: 'task', message: 'Research agent responded', timestamp: Date.now() });
      } else {
        setResearchMessages(prev => [...prev, { role: 'assistant', content: `Error: ${result?.error || 'Failed to get response'}` }]);
        addActivity({ type: 'error', message: result?.error || 'Research agent failed', timestamp: Date.now() });
      }
    } catch (e: any) {
      setResearchMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
      addActivity({ type: 'error', message: `Research error: ${e.message}`, timestamp: Date.now() });
    } finally {
      setResearchLoading(false);
    }
  };

  // Plan agent chat
  const sendPlanMessage = async () => {
    if (!planInput.trim() || planChatLoading) return;
    
    const userMessage = planInput.trim();
    setPlanInput('');
    setPlanMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setPlanChatLoading(true);
    
    try {
      const systemPrompt = `You are an X/Twitter content planning agent. You help plan, strategize, and create content for X/Twitter. You suggest post ideas, help refine drafts, recommend posting schedules, and provide hooks and angles for content. Be creative and actionable. When suggesting post content, format it ready to copy.`;
      
      const result = await (window as any).clawdbot?.ai?.generateContent(userMessage, 'chat', {
        systemPrompt,
        conversationHistory: planMessages
      });
      
      if (result?.success && result.content) {
        setPlanMessages(prev => [...prev, { role: 'assistant', content: result.content }]);
        addActivity({ type: 'task', message: 'Plan agent responded', timestamp: Date.now() });
      } else {
        setPlanMessages(prev => [...prev, { role: 'assistant', content: `Error: ${result?.error || 'Failed to get response'}` }]);
        addActivity({ type: 'error', message: result?.error || 'Plan agent failed', timestamp: Date.now() });
      }
    } catch (e: any) {
      setPlanMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
      addActivity({ type: 'error', message: `Plan error: ${e.message}`, timestamp: Date.now() });
    } finally {
      setPlanChatLoading(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    researchEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [researchMessages]);

  useEffect(() => {
    planEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [planMessages]);

  const TweetCard = ({ tweet }: { tweet: Tweet }) => (
    <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 hover:border-clawd-border/80 transition-colors">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm">@{tweet.author}</span>
            {tweet.authorName && tweet.authorName !== tweet.author && (
              <span className="text-xs text-clawd-text-dim">{tweet.authorName}</span>
            )}
            <span className="text-xs text-clawd-text-dim">
              {new Date(tweet.timestamp).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{tweet.text}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-clawd-text-dim pt-2 border-t border-clawd-border">
        <span className="flex items-center gap-1" title="Replies">
          <MessageCircle size={14} /> {tweet.replies || 0}
        </span>
        <span className="flex items-center gap-1" title="Reposts">
          <Repeat size={14} /> {tweet.retweets || 0}
        </span>
        <span className="flex items-center gap-1" title="Likes">
          <Heart size={14} /> {tweet.likes || 0}
        </span>
        {tweet.views !== undefined && tweet.views > 0 && (
          <span className="flex items-center gap-1" title="Views">
            <Eye size={14} /> {tweet.views.toLocaleString()}
          </span>
        )}
        {tweet.url && (
          <a 
            href={tweet.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-clawd-accent hover:underline ml-auto"
          >
            View on X →
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <XLogo size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">@Prof_Frogo</h1>
              <p className="text-sm text-clawd-text-dim">X Management</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-border rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['research', 'plan', 'drafts', 'calendar', 'automations', 'mentions', 'timeline', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === tab
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {tab === 'research' && <Search size={14} />}
              {tab === 'plan' && <FileText size={14} />}
              {tab === 'calendar' && <Calendar size={14} />}
              {tab === 'automations' && <Zap size={14} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'drafts' && xDrafts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {xDrafts.length}
                </span>
              )}
              {tab === 'mentions' && mentions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {mentions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'research' && (
          <div className="max-w-2xl mx-auto h-full flex flex-col">
            <div className="bg-clawd-surface rounded-xl border border-clawd-border flex-1 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-clawd-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Search size={20} className="text-info" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Research Agent</h3>
                    <p className="text-sm text-clawd-text-dim">Research trends, competitors, and topics</p>
                  </div>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-4">
                {researchMessages.length === 0 ? (
                  <div className="text-center py-12 text-clawd-text-dim">
                    <Search size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="mb-2">Start researching</p>
                    <p className="text-sm">Ask about trends, competitors, content strategies, or topics to explore.</p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {[
                        'What are trending topics in tech Twitter?',
                        'Analyze successful crypto accounts',
                        'Best posting times for engagement',
                        'Content ideas for AI/ML niche'
                      ].map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => setResearchInput(suggestion)}
                          className="px-3 py-1.5 text-xs bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  researchMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl p-3 ${
                          msg.role === 'user'
                            ? 'bg-clawd-accent text-white'
                            : 'bg-clawd-bg border border-clawd-border'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {researchLoading && (
                  <div className="flex justify-start">
                    <div className="bg-clawd-bg border border-clawd-border rounded-xl p-3">
                      <RefreshCw size={16} className="animate-spin text-clawd-accent" />
                    </div>
                  </div>
                )}
                <div ref={researchEndRef} />
              </div>
              
              {/* Input */}
              <div className="p-4 border-t border-clawd-border">
                <div className="flex gap-2">
                  <textarea
                    value={researchInput}
                    onChange={(e) => setResearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendResearchMessage();
                      }
                    }}
                    placeholder="Ask the research agent..."
                    className="flex-1 bg-clawd-bg border border-clawd-border rounded-xl p-3 resize-none outline-none focus:border-clawd-accent transition-colors min-h-[48px] max-h-32"
                    rows={1}
                  />
                  <button
                    onClick={sendResearchMessage}
                    disabled={!researchInput.trim() || researchLoading}
                    className="px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/80 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plan' && (
          <div className="max-w-8xl mx-auto space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Chat with Plan Agent */}
              <div className="bg-clawd-surface rounded-xl border border-clawd-border flex flex-col h-[500px]">
                {/* Header */}
                <div className="p-4 border-b border-clawd-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <FileText size={20} className="text-success" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Planning Agent</h3>
                      <p className="text-sm text-clawd-text-dim">Create and refine content</p>
                    </div>
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {planMessages.length === 0 ? (
                    <div className="text-center py-8 text-clawd-text-dim">
                      <Sparkles size={36} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm mb-3">Chat with the planning agent</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          'Write a thread about building in public',
                          'Give me 5 engaging post ideas',
                          'Help me refine this draft'
                        ].map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => setPlanInput(suggestion)}
                            className="px-2 py-1 text-xs bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    planMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[90%] rounded-xl p-3 ${
                            msg.role === 'user'
                              ? 'bg-clawd-accent text-white'
                              : 'bg-clawd-bg border border-clawd-border'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.role === 'assistant' && (
                            <button
                              onClick={() => setPlanComposeText(msg.content)}
                              className="mt-2 text-xs text-clawd-accent hover:underline flex items-center gap-1"
                            >
                              Use in Compose <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {planChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-clawd-bg border border-clawd-border rounded-xl p-3">
                        <RefreshCw size={16} className="animate-spin text-clawd-accent" />
                      </div>
                    </div>
                  )}
                  <div ref={planEndRef} />
                </div>
                
                {/* Input */}
                <div className="p-4 border-t border-clawd-border">
                  <div className="flex gap-2">
                    <textarea
                      value={planInput}
                      onChange={(e) => setPlanInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendPlanMessage();
                        }
                      }}
                      placeholder="Ask the planning agent..."
                      className="flex-1 bg-clawd-bg border border-clawd-border rounded-xl p-3 resize-none outline-none focus:border-clawd-accent transition-colors min-h-[48px] max-h-24"
                      rows={1}
                    />
                    <button
                      onClick={sendPlanMessage}
                      disabled={!planInput.trim() || planChatLoading}
                      className="px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/80 disabled:opacity-50 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Compose + Templates */}
              <div className="space-y-4">
                {/* Quick Templates */}
                <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
                  <h3 className="text-sm font-medium text-clawd-text-dim mb-3 flex items-center gap-2">
                    <Lightbulb size={14} />
                    Quick Templates
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'GM 🐸',
                      'Thread: [topic] 🧵',
                      'Hot take: ',
                      'Building in public update:',
                      'Unpopular opinion: ',
                      'Quick tip: ',
                    ].map((template, i) => (
                      <button
                        key={i}
                        onClick={() => setPlanComposeText(template)}
                        className="p-2 text-left text-sm bg-clawd-bg rounded-lg border border-clawd-border hover:border-clawd-accent transition-colors truncate"
                      >
                        {template}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic + Generate Ideas */}
                <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-clawd-accent" />
                    <span className="text-sm font-medium">Generate Ideas</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={planTopic}
                      onChange={(e) => setPlanTopic(e.target.value)}
                      placeholder="Topic (e.g., AI trends, startup advice...)"
                      className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg p-2 text-sm outline-none focus:border-clawd-accent"
                    />
                    <button
                      onClick={async () => {
                        if (!planTopic.trim()) return;
                        setPlanLoading(true);
                        setPlanIdeas([]);
                        try {
                          const result = await (window as any).clawdbot?.ai?.generateContent(planTopic, 'ideas');
                          if (result?.success && result.ideas) {
                            setPlanIdeas(result.ideas);
                            addActivity({ type: 'task', message: `Generated ${result.ideas.length} content ideas`, timestamp: Date.now() });
                          } else {
                            addActivity({ type: 'error', message: result?.error || 'Failed to generate ideas', timestamp: Date.now() });
                          }
                        } catch (e: any) {
                          addActivity({ type: 'error', message: `AI error: ${e.message}`, timestamp: Date.now() });
                        } finally {
                          setPlanLoading(false);
                        }
                      }}
                      disabled={!planTopic.trim() || planLoading}
                      className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 disabled:opacity-50 transition-colors text-sm"
                    >
                      {planLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Generate'}
                    </button>
                  </div>
                  
                  {/* Ideas List */}
                  {planIdeas.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-32 overflow-auto">
                      {planIdeas.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setPlanComposeText(item.idea);
                            addActivity({ type: 'task', message: 'Moved idea to compose', timestamp: Date.now() });
                          }}
                          className="w-full text-left p-2 text-sm bg-clawd-bg rounded-lg border border-clawd-border hover:border-clawd-accent transition-colors"
                        >
                          <p className="line-clamp-2">{item.idea}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compose Section */}
                <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Edit size={16} />
                    Compose
                  </h3>
                  
                  <textarea
                    value={planComposeText}
                    onChange={(e) => setPlanComposeText(e.target.value)}
                    placeholder="Write or edit your post here..."
                    className="w-full bg-clawd-bg border border-clawd-border rounded-xl p-3 resize-none outline-none focus:border-clawd-accent transition-colors min-h-24"
                    maxLength={280}
                  />
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${planComposeText.length > 260 ? 'text-yellow-500' : planComposeText.length > 280 ? 'text-red-500' : 'text-clawd-text-dim'}`}>
                        {planComposeText.length}/280
                      </span>
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setPlanImage({
                                path: file.name,
                                preview: ev.target?.result as string
                              });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                      >
                        <Image size={14} />
                        {planImage ? 'Change' : 'Image'}
                      </button>
                    </div>
                  </div>
                  
                  {planImage && (
                    <div className="mt-3 relative inline-block">
                      <img 
                        src={planImage.preview} 
                        alt="Attachment preview" 
                        className="max-h-24 rounded-lg border border-clawd-border"
                      />
                      <button
                        onClick={() => setPlanImage(null)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!planComposeText.trim()) return;
                      addXDraft(planComposeText);
                      setPlanComposeText('');
                      setPlanImage(null);
                      addActivity({ type: 'task', message: 'Saved to drafts', timestamp: Date.now() });
                    }}
                    disabled={!planComposeText.trim()}
                    className="px-3 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 disabled:opacity-50 transition-colors text-sm"
                  >
                    Save Draft
                  </button>
                  
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    disabled={!planComposeText.trim()}
                    className="flex items-center gap-1 px-3 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 disabled:opacity-50 transition-colors text-sm"
                  >
                    <Calendar size={14} />
                    Schedule
                  </button>
                  
                  <LoadingButton
                    loading={posting}
                    onClick={async () => {
                      if (!planComposeText.trim() || posting) return;
                      setPosting(true);
                      try {
                        const result = await (window as any).clawdbot?.execute?.tweet(planComposeText);
                        if (result?.success) {
                          addActivity({ type: 'task', message: 'Posted to X!', timestamp: Date.now() });
                          setPlanComposeText('');
                          setPlanImage(null);
                        } else {
                          addActivity({ type: 'error', message: `Failed to post: ${result?.error}`, timestamp: Date.now() });
                        }
                      } catch (e: any) {
                        addActivity({ type: 'error', message: `Post failed: ${e.message}`, timestamp: Date.now() });
                      } finally {
                        setPosting(false);
                      }
                    }}
                    disabled={!planComposeText.trim()}
                    className="flex-1 bg-white text-black hover:bg-gray-200 font-medium text-sm"
                    icon={<Send size={14} />}
                  >
                    Post Now
                  </LoadingButton>
                </div>
              </div>
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
              <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50">
                <div className="bg-clawd-surface border border-clawd-border rounded-xl p-6 w-full max-w-md mx-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar size={20} />
                    Schedule Post
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-clawd-text-dim mb-2">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-clawd-text-dim mb-2">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full bg-clawd-bg border border-clawd-border rounded-lg p-3 outline-none focus:border-clawd-accent"
                      />
                    </div>
                    
                    <div className="bg-clawd-bg rounded-lg p-3 text-sm">
                      <p className="text-clawd-text-dim mb-1">Preview:</p>
                      <p className="line-clamp-2">{planComposeText}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={() => {
                        setShowScheduleModal(false);
                        setScheduleDate('');
                        setScheduleTime('');
                      }}
                      className="flex-1 px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!scheduleDate || !scheduleTime || !planComposeText.trim()) return;
                        
                        const scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
                        
                        try {
                          const result = await (window as any).clawdbot?.schedule?.add({
                            type: 'tweet',
                            content: planComposeText,
                            scheduledFor,
                          });
                          
                          if (result?.success) {
                            addActivity({ type: 'task', message: `Scheduled for ${scheduleDate} at ${scheduleTime}`, timestamp: Date.now() });
                            setPlanComposeText('');
                            setPlanImage(null);
                            setShowScheduleModal(false);
                            setScheduleDate('');
                            setScheduleTime('');
                          } else {
                            addActivity({ type: 'error', message: `Failed to schedule: ${result?.error}`, timestamp: Date.now() });
                          }
                        } catch (e: any) {
                          addActivity({ type: 'error', message: `Schedule failed: ${e.message}`, timestamp: Date.now() });
                        }
                      }}
                      disabled={!scheduleDate || !scheduleTime}
                      className="flex-1 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/80 disabled:opacity-50 transition-colors"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'drafts' && (
          <div className="max-w-xl mx-auto space-y-4">
            {xDrafts.length === 0 ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <Edit size={48} className="mx-auto mb-4 opacity-30" />
                <p>No drafts</p>
              </div>
            ) : (
              xDrafts.map((draft) => (
                <div key={draft.id} className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
                  <p className="whitespace-pre-wrap mb-4">{draft.text}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      draft.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-clawd-border text-clawd-text-dim'
                    }`}>
                      {draft.status}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPlanComposeText(draft.text);
                          setActiveTab('plan');
                        }}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Edit in Plan"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="p-2 hover:bg-clawd-border text-error rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        onClick={() => handlePost(draft)}
                        disabled={!connected}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white text-black text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        <Send size={14} /> Post
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <ContentCalendar />
        )}

        {activeTab === 'automations' && (
          <XAutomationsTab />
        )}

        {activeTab === 'mentions' && (
          <div className="max-w-xl mx-auto space-y-4">
            {loading ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <RefreshCw size={48} className="mx-auto mb-4 opacity-30 animate-spin" />
                <p>Loading mentions...</p>
              </div>
            ) : mentions.length === 0 ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
                <p>Click Refresh to load mentions</p>
                <p className="text-sm mt-2">Uses x-api to fetch @Prof_Frogo mentions</p>
              </div>
            ) : (
              mentions.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} />
              ))
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="max-w-xl mx-auto space-y-4">
            {loading ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <RefreshCw size={48} className="mx-auto mb-4 opacity-30 animate-spin" />
                <p>Loading timeline...</p>
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <Users size={48} className="mx-auto mb-4 opacity-30" />
                <p>Click Refresh to load your timeline</p>
                <p className="text-sm mt-2">Uses x-api to fetch your home feed</p>
              </div>
            ) : (
              timeline.map((tweet) => (
                <TweetCard key={tweet.id} tweet={tweet} />
              ))
            )}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <Heart size={24} className="mx-auto mb-2 text-error" />
                <div className="text-2xl font-bold">{stats?.totalLikes?.toLocaleString() ?? '--'}</div>
                <div className="text-sm text-clawd-text-dim">Total Likes</div>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <Repeat size={24} className="mx-auto mb-2 text-success" />
                <div className="text-2xl font-bold">{stats?.totalRetweets?.toLocaleString() ?? '--'}</div>
                <div className="text-sm text-clawd-text-dim">Reposts</div>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <MessageCircle size={24} className="mx-auto mb-2 text-info" />
                <div className="text-2xl font-bold">{stats?.totalReplies?.toLocaleString() ?? '--'}</div>
                <div className="text-sm text-clawd-text-dim">Replies</div>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <Eye size={24} className="mx-auto mb-2 text-review" />
                <div className="text-2xl font-bold">{stats?.totalViews?.toLocaleString() ?? '--'}</div>
                <div className="text-sm text-clawd-text-dim">Views</div>
              </div>
            </div>
            
            <div className="bg-clawd-surface rounded-xl border border-clawd-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <BarChart2 size={24} className="text-clawd-accent" />
                <h3 className="text-lg font-semibold">Engagement Summary</h3>
              </div>
              {stats ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-clawd-text-dim">Posts analyzed</span>
                    <span>{mentions.length + timeline.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-clawd-text-dim">Avg. engagement per post</span>
                    <span>{stats.avgEngagement.toFixed(1)}</span>
                  </div>
                  <div className="text-xs text-clawd-text-dim mt-4">
                    * Based on loaded mentions and timeline. Refresh to update.
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-clawd-text-dim">
                  <p>Load mentions or timeline to see analytics</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
