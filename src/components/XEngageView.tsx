// src/components/XEngageView.tsx
// Unified engagement inbox — merges XMentionsView and XReplyGuyView into a single stream.
// Phase 20.3 consolidation. All replies go through approval gate — no direct posting bypass.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Heart,
  Repeat2,
  MessageCircle,
  Clock,
  HelpCircle,
  Ban,
  CheckCircle,
  StickyNote,
  RefreshCw,
  Inbox,
  Star,
  StarOff,
  Zap,
  Send,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Settings,
  EyeOff,
  UserX,
} from 'lucide-react';
import { showToast } from './Toast';
import { inboxApi, approvalApi } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParentTweet {
  type: string; // 'replied_to' | 'quoted'
  id: string;
  text: string | null;
  author: { id: string; username: string; name: string } | null;
}

interface Mention {
  id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  author_followers?: number;
  text: string;
  created_at: number;
  conversation_id: string;
  in_reply_to_user_id: string;
  reply_status: 'pending' | 'considering' | 'ignored' | 'replied';
  replied_at?: number;
  replied_with_id?: string;
  fetched_at: number;
  metadata: any;
  // Engagement metrics
  like_count: number;
  retweet_count: number;
  reply_count: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  // Context: what kind of mention is this?
  mention_type: 'reply' | 'quote' | 'mention';
  is_reply_to_us: boolean;
  parent_tweet: ParentTweet | null;
  is_spam: boolean;
}

type FilterTab = 'all' | 'hot' | 'pending' | 'replied' | 'ignored' | 'replies' | 'quotes' | 'direct' | 'spam';

interface ReplyTemplate {
  id: string;
  name: string;
  body: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_PRIORITY_KEY = 'x-reply-priority-accounts';
const LS_IGNORED_KEY = 'x-reply-ignored-accounts';
const LS_TEMPLATE_KEY = 'x-reply-templates';
const LS_ENGAGE_SETTINGS_KEY = 'x-engage-settings';
const POLL_INTERVAL = 60_000; // auto-refresh mentions every 60s

const DEFAULT_TEMPLATES: ReplyTemplate[] = [
  { id: 'tpl-1', name: 'Agree + Add', body: 'Totally agree, {{username}}. Building on that — [add your point here].' },
  { id: 'tpl-2', name: 'Question back', body: 'Great point on {{topic}}, {{username}}. Curious — how are you thinking about [follow-up question]?' },
  { id: 'tpl-3', name: 'Resource share', body: 'We wrote about this exact thing, {{username}}. Happy to share the thread if helpful.' },
  { id: 'tpl-4', name: 'Validate + Engage', body: 'This resonates, {{username}}. The {{topic}} angle is one we see a lot too.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface EngageSettings {
  autoIgnoreBots: boolean;
  autoIgnoreLowEngagement: boolean;
  lowEngagementThreshold: number; // ignore mentions with < N followers
  defaultReplyTier: 1 | 3;
  showSentiment: boolean;
  showNotes: boolean;
}

const DEFAULT_SETTINGS: EngageSettings = {
  autoIgnoreBots: false,
  autoIgnoreLowEngagement: false,
  lowEngagementThreshold: 10,
  defaultReplyTier: 3,
  showSentiment: true,
  showNotes: true,
};

function loadPriority(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_PRIORITY_KEY) ?? '[]'); } catch { return []; }
}
function savePriority(v: string[]): void {
  try { localStorage.setItem(LS_PRIORITY_KEY, JSON.stringify(v)); } catch { /* noop */ }
}
function loadIgnored(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_IGNORED_KEY) ?? '[]'); } catch { return []; }
}
function saveIgnored(v: string[]): void {
  try { localStorage.setItem(LS_IGNORED_KEY, JSON.stringify(v)); } catch { /* noop */ }
}
function loadTemplates(): ReplyTemplate[] {
  try {
    const raw = localStorage.getItem(LS_TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}
function loadSettings(): EngageSettings {
  try {
    const raw = localStorage.getItem(LS_ENGAGE_SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: EngageSettings): void {
  try { localStorage.setItem(LS_ENGAGE_SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

function inferSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const pos = ['great', 'love', 'excellent', 'awesome', 'fantastic', 'congrats', 'amazing', 'nice', 'good', 'helpful', 'thanks', 'thank you', 'brilliant'];
  const neg = ['bad', 'terrible', 'awful', 'broken', 'hate', 'wrong', 'sucks', 'issue', 'problem', 'failed', 'crash', 'worst', 'annoying'];
  if (pos.some(w => lower.includes(w))) return 'positive';
  if (neg.some(w => lower.includes(w))) return 'negative';
  return 'neutral';
}

function applyTemplate(template: string, username: string, topic: string): string {
  return template.replace(/\{\{username\}\}/g, `@${username}`).replace(/\{\{topic\}\}/g, topic || 'this topic');
}

function extractTopic(text: string): string {
  const words = text.replace(/https?:\/\/\S+/g, '').split(/\s+/).slice(0, 3).join(' ');
  return words.length > 30 ? words.slice(0, 30) + '...' : words;
}

/** Simple spam detection heuristics */
function isLikelySpam(text: string, username: string, followers?: number): boolean {
  const lower = text.toLowerCase();
  const spamSignals = [
    // Crypto/money spam
    /\b(airdrop|giveaway|free (money|crypto|nft)|send \d+ (sol|eth|btc))\b/i.test(lower),
    // Excessive caps (>60% uppercase)
    text.replace(/[^A-Z]/g, '').length > text.length * 0.6 && text.length > 20,
    // Excessive hashtags (>5)
    (text.match(/#/g) || []).length > 5,
    // Suspicious URLs
    /\b(bit\.ly|tinyurl|t\.co\/\w+.*t\.co\/\w+)\b/i.test(lower),
    // Bot-like patterns
    /\b(dm me|check (my|the) (bio|link|pinned))\b/i.test(lower),
    // Very low followers + promotional content
    (followers != null && followers < 5 && /\b(follow|subscribe|join)\b/i.test(lower)),
    // Repeated characters
    /(.)\1{5,}/.test(text),
    // Common spam usernames
    /^\w+\d{5,}$/.test(username),
  ];
  // If 2+ signals trigger, it's likely spam
  return spamSignals.filter(Boolean).length >= 2;
}

function sentimentBadgeClasses(s: 'positive' | 'negative' | 'neutral'): string {
  if (s === 'positive') return 'bg-success-subtle text-success';
  if (s === 'negative') return 'bg-error-subtle text-error';
  return 'bg-mission-control-surface text-mission-control-text-dim';
}

/** Parse metadata blob and extract engagement metrics */
function parseMetrics(item: any): { like_count: number; retweet_count: number; reply_count: number } {
  // Try flattened top-level fields first (from inbox items)
  if (typeof item.like_count === 'number') {
    return {
      like_count: item.like_count,
      retweet_count: item.retweet_count ?? 0,
      reply_count: item.reply_count ?? 0,
    };
  }
  // Parse from metadata string/object
  let meta: any = {};
  try {
    meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
  } catch { /* noop */ }
  const metrics = meta.public_metrics || meta || {};
  return {
    like_count: metrics.like_count ?? 0,
    retweet_count: metrics.retweet_count ?? 0,
    reply_count: metrics.reply_count ?? 0,
  };
}

/** Normalize raw inbox/API items into a consistent Mention shape */
function normalizeMention(item: any): Mention {
  const metrics = parseMetrics(item);

  // Parse metadata for stored mention context
  let meta: any = {};
  try {
    meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
  } catch { /* noop */ }

  // Determine mention type from API data or stored metadata
  const mentionType: 'reply' | 'quote' | 'mention' =
    item.mention_type || meta.mention_type || 'mention';
  const isReplyToUs = item.is_reply_to_us ?? meta.is_reply_to_us ?? false;
  const parentTweet: ParentTweet | null =
    item.parent_tweet || meta.parent_tweet || null;

  // Author followers from expanded user data
  const authorFollowers = item.author?.public_metrics?.followers_count
    ?? meta.author_followers ?? undefined;

  return {
    id: item.id,
    tweet_id: item.tweet_id || item.id,
    author_id: item.author_id || item.author?.id || '',
    author_username: item.author_username || item.author?.username || 'unknown',
    author_name: item.author_name || item.author?.name || 'Unknown',
    author_followers: authorFollowers,
    text: item.text || item.content || '',
    created_at: item.created_at ? (typeof item.created_at === 'number' ? item.created_at : new Date(item.created_at).getTime()) : Date.now(),
    conversation_id: item.conversation_id || meta.conversation_id || '',
    in_reply_to_user_id: item.in_reply_to_user_id || meta.in_reply_to_user_id || '',
    reply_status: item.reply_status || meta.reply_status || 'pending',
    replied_at: item.replied_at || meta.replied_at,
    replied_with_id: item.replied_with_id || meta.replied_with_id,
    fetched_at: item.fetched_at || Date.now(),
    metadata: item.metadata,
    like_count: metrics.like_count,
    retweet_count: metrics.retweet_count,
    reply_count: metrics.reply_count,
    sentiment: inferSentiment(item.text || item.content || ''),
    mention_type: mentionType,
    is_reply_to_us: isReplyToUs,
    parent_tweet: parentTweet,
    is_spam: isLikelySpam(
      item.text || item.content || '',
      item.author_username || item.author?.username || '',
      authorFollowers,
    ),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const XEngageView: React.FC = () => {
  // Data
  const [allMentions, setAllMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  // Filters
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [minLikes, setMinLikes] = useState(10);
  const [minRetweets, setMinRetweets] = useState(5);

  // Reply composer
  const [selectedMention, setSelectedMention] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [fastTrack, setFastTrack] = useState(() => loadSettings().defaultReplyTier === 1);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates] = useState<ReplyTemplate[]>(loadTemplates);

  // Priority accounts
  const [priorityAccounts, setPriorityAccounts] = useState<string[]>(loadPriority);
  const [priorityInput, setPriorityInput] = useState('');
  const [showPriorityPanel, setShowPriorityPanel] = useState(false);

  // Ignored accounts
  const [ignoredAccounts, setIgnoredAccounts] = useState<string[]>(loadIgnored);
  const [ignoredInput, setIgnoredInput] = useState('');
  const [showIgnoredPanel, setShowIgnoredPanel] = useState(false);

  // Engagement settings
  const [settings, setSettings] = useState<EngageSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);

  // AI-generated reply suggestions per mention: { replies: string[], recommended: number }
  const [aiReplies, setAiReplies] = useState<Record<string, { replies: string[]; recommended: number }>>({});
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());

  // Notes
  const [notes, setNotes] = useState<Record<string, string>>({});

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadMentions = useCallback(async () => {
    try {
      // Primary source: inbox items of type x-mention
      const allItems = await inboxApi.getAll();
      const inboxMentions = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'x-mention')
        .map((item: any) => {
          // Inbox items store mention data in metadata
          const meta = typeof item.metadata === 'string'
            ? (() => { try { return JSON.parse(item.metadata); } catch { return {}; } })()
            : (item.metadata || {});
          return normalizeMention({
            id: String(item.id),
            tweet_id: meta.tweet_id || String(item.id),
            author_id: meta.author_id || '',
            author_username: meta.author_username || 'unknown',
            author_name: meta.author_name || 'Unknown',
            author: meta.author_followers != null ? { public_metrics: { followers_count: meta.author_followers } } : undefined,
            text: item.content || meta.text || '',
            created_at: meta.created_at || item.createdAt || Date.now(),
            conversation_id: meta.conversation_id || '',
            in_reply_to_user_id: meta.in_reply_to_user_id || '',
            reply_status: meta.reply_status || item.status || 'pending',
            replied_at: meta.replied_at,
            fetched_at: item.createdAt || Date.now(),
            metadata: item.metadata,
            mention_type: meta.mention_type || 'mention',
            is_reply_to_us: meta.is_reply_to_us || false,
            parent_tweet: meta.parent_tweet || null,
            // AI suggestions stored in metadata
            ai_replies: meta.ai_replies || null,
          });
        });

      if (inboxMentions.length > 0) {
        setAllMentions(inboxMentions);
        setLoading(false);
        // Load pre-generated AI replies from inbox metadata (from background cron)
        const preGenerated: Record<string, { replies: string[]; recommended: number }> = {};
        for (const m of inboxMentions) {
          try {
            const meta = typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {});
            if (meta.ai_replies?.replies?.length) {
              preGenerated[m.id] = {
                replies: meta.ai_replies.replies,
                recommended: meta.ai_replies.recommended ?? 0,
              };
            }
          } catch { /* noop */ }
        }
        if (Object.keys(preGenerated).length > 0) {
          setAiReplies(prev => ({ ...prev, ...preGenerated }));
        }
        // Generate for any remaining mentions without suggestions
        const needsGeneration = inboxMentions.filter(m => !preGenerated[m.id]);
        if (needsGeneration.length > 0) {
          generateAIReplies(needsGeneration);
        }
        return;
      }

      // Fallback: fetch directly from X API
      const res = await fetch('/api/x/mentions');
      if (res.ok) {
        const data = await res.json();
        if (data.mentions?.length > 0) {
          const mapped = data.mentions.map((m: any) => normalizeMention(m));
          setAllMentions(mapped);
        }
      }
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMentions();
    // Auto-refresh polling
    const interval = setInterval(loadMentions, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loadMentions]);

  // Listen for agent draft replies — when agent suggests reply text, inject into composer
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content && selectedMention) {
        setReplyText(detail.content);
      }
    };
    window.addEventListener('x-draft-proposal', handler);
    return () => window.removeEventListener('x-draft-proposal', handler);
  }, [selectedMention]);

  // ─── Fetch new mentions from X API ─────────────────────────────────────────

  const fetchNewMentions = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/x/mentions');
      if (res.ok) {
        const data = await res.json();
        if (data.mentions?.length > 0) {
          for (const m of data.mentions) {
            try {
              await inboxApi.create({
                type: 'x-mention',
                title: `@${m.author?.username || 'unknown'}: ${(m.text || '').slice(0, 80)}`,
                content: m.text,
                channel: 'x-twitter',
                status: 'pending',
                metadata: {
                  tweet_id: m.id,
                  author_id: m.author?.id || m.author_id,
                  author_username: m.author?.username || 'unknown',
                  author_name: m.author?.name || 'Unknown',
                  author_followers: m.author?.public_metrics?.followers_count,
                  conversation_id: m.conversation_id,
                  in_reply_to_user_id: m.in_reply_to_user_id || '',
                  mention_type: m.mention_type || 'mention',
                  is_reply_to_us: m.is_reply_to_us || false,
                  parent_tweet: m.parent_tweet || null,
                  reply_status: 'pending',
                  public_metrics: m.public_metrics || {},
                  created_at: new Date(m.created_at).getTime(),
                },
              });
            } catch { /* duplicate or DB error — skip */ }
          }
        }
      }
      await loadMentions();
    } catch {
      await loadMentions();
    } finally {
      setFetching(false);
    }
  };

  // ─── Status management ─────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: 'pending' | 'considering' | 'ignored' | 'replied') => {
    setAllMentions(prev => prev.map(m => m.id === id ? { ...m, reply_status: status } : m));
    try {
      await inboxApi.update(Number(id), { reply_status: status });
    } catch {
      await loadMentions();
    }
  };

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const saveNotes = async (id: string, noteText: string) => {
    try {
      await inboxApi.update(Number(id), { notes: noteText });
      setNotes(prev => ({ ...prev, [id]: noteText }));
      showToast('success', 'Note saved', 'Note updated successfully');
    } catch {
      // Keep note text in local state even if persist fails
    }
  };

  // ─── AI reply generation (background) ──────────────────────────────────────

  const generateAIReplies = useCallback(async (mentions: Mention[]) => {
    // Only generate for pending mentions without existing suggestions
    const pending = mentions.filter(m =>
      m.reply_status === 'pending' &&
      !aiReplies[m.id] &&
      !aiLoading.has(m.id)
    ).slice(0, 5); // Max 5 at a time

    if (pending.length === 0) return;

    for (const mention of pending) {
      setAiLoading(prev => new Set(prev).add(mention.id));

      try {
        const parentContext = mention.parent_tweet?.text
          ? `\n\nThis is a reply to: "${mention.parent_tweet.text}" by @${mention.parent_tweet.author?.username || 'unknown'}`
          : '';

        const typeContext = mention.mention_type === 'reply'
          ? (mention.is_reply_to_us ? 'This is a reply to YOUR tweet.' : 'This is a reply in a conversation where you were mentioned.')
          : mention.mention_type === 'quote'
          ? 'This is a quote tweet of your content.'
          : 'This is a direct mention of you.';

        // Fetch brand context from knowledge base for smarter replies
        let brandContext = '';
        try {
          const kbRes = await fetch('/api/knowledge?scope=agents&limit=3');
          if (kbRes.ok) {
            const kbData = await kbRes.json();
            const articles = Array.isArray(kbData) ? kbData : kbData.articles || [];
            if (articles.length > 0) {
              brandContext = `\n\nBrand context from knowledge base:\n${articles.slice(0, 3).map((a: any) => `- ${a.title}: ${(a.summary || a.content || '').slice(0, 150)}`).join('\n')}`;
            }
          }
        } catch { /* non-critical */ }

        const prompt = `Generate exactly 3 reply options for this X/Twitter mention. Each reply must be under 200 characters, on-brand, engaging, and contextually appropriate.

Mention from @${mention.author_username} (${mention.author_followers ? mention.author_followers + ' followers' : 'unknown followers'}): "${mention.text}"
${parentContext}
${typeContext}
Sentiment: ${mention.sentiment}
${brandContext}

Guidelines:
- Option 1: Professional/informative response
- Option 2: Casual/engaging response
- Option 3: Bold/witty response
- Reference specific details from their tweet
- If they asked a question, answer it
- If they shared feedback, acknowledge it specifically
- Never be generic — make each reply feel personal

Return ONLY a JSON object with "replies" (array of 3 strings) and "recommended" (0-indexed number of the best option). Example: {"replies": ["reply 1", "reply 2", "reply 3"], "recommended": 0}`;

        const res = await fetch('/api/chat/generate-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: prompt,
            context: 'You are a social media manager. Generate concise, engaging reply options. Return ONLY a JSON array of 3 strings.',
            tone: 'professional',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || '';
          // Parse JSON object or array from response
          const objMatch = reply.match(/\{[\s\S]*"replies"[\s\S]*\}/);
          const arrMatch = reply.match(/\[[\s\S]*?\]/);
          if (objMatch) {
            try {
              const parsed = JSON.parse(objMatch[0]);
              if (parsed.replies?.length > 0) {
                setAiReplies(prev => ({
                  ...prev,
                  [mention.id]: {
                    replies: parsed.replies.slice(0, 3),
                    recommended: typeof parsed.recommended === 'number' ? parsed.recommended : 0,
                  },
                }));
              }
            } catch { /* parse failed, try array fallback */ }
          } else if (arrMatch) {
            try {
              const options = JSON.parse(arrMatch[0]) as string[];
              if (Array.isArray(options) && options.length > 0) {
                setAiReplies(prev => ({
                  ...prev,
                  [mention.id]: { replies: options.slice(0, 3), recommended: 0 },
                }));
              }
            } catch { /* parse failed, skip */ }
          }
        }
      } catch { /* non-critical */ }

      setAiLoading(prev => {
        const next = new Set(prev);
        next.delete(mention.id);
        return next;
      });
    }
  }, [aiReplies, aiLoading]);

  // ─── Reply handling (approval gate) ────────────────────────────────────────

  const handleSendReply = async (mentionId: string, tweetId: string) => {
    if (!replyText.trim()) return;
    if (replyText.length > 280) {
      setReplyError('Reply must be 280 characters or less');
      return;
    }

    setReplyError(null);
    try {
      await approvalApi.create({
        type: 'x-reply',
        tier: fastTrack ? 1 : 3,
        payload: { mentionId, tweetId, replyText },
        requestedBy: 'user',
      });
      showToast('success', 'Sent for approval', fastTrack ? 'Fast-tracked (tier 1)' : 'Queued for review (tier 3)');
      setReplyText('');
      setSelectedMention(null);
      setShowTemplates(false);
      setReplyError(null);
      await loadMentions();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Failed to submit reply for approval');
    }
  };

  // ─── Priority accounts ─────────────────────────────────────────────────────

  const handleAddPriority = () => {
    const handle = priorityInput.trim().replace(/^@/, '').toLowerCase();
    if (!handle || priorityAccounts.includes(handle)) return;
    const updated = [...priorityAccounts, handle];
    setPriorityAccounts(updated);
    savePriority(updated);
    setPriorityInput('');
  };

  const handleRemovePriority = (handle: string) => {
    const updated = priorityAccounts.filter(h => h !== handle);
    setPriorityAccounts(updated);
    savePriority(updated);
  };

  const togglePriority = (username: string) => {
    const handle = username.toLowerCase();
    const updated = priorityAccounts.includes(handle)
      ? priorityAccounts.filter(h => h !== handle)
      : [...priorityAccounts, handle];
    setPriorityAccounts(updated);
    savePriority(updated);
  };

  // ─── Ignored accounts ────────────────────────────────────────────────────

  const handleAddIgnored = () => {
    const handle = ignoredInput.trim().replace(/^@/, '').toLowerCase();
    if (!handle || ignoredAccounts.includes(handle)) return;
    const updated = [...ignoredAccounts, handle];
    setIgnoredAccounts(updated);
    saveIgnored(updated);
    setIgnoredInput('');
  };

  const handleRemoveIgnored = (handle: string) => {
    const updated = ignoredAccounts.filter(h => h !== handle);
    setIgnoredAccounts(updated);
    saveIgnored(updated);
  };

  const toggleIgnored = (username: string) => {
    const handle = username.toLowerCase();
    const updated = ignoredAccounts.includes(handle)
      ? ignoredAccounts.filter(h => h !== handle)
      : [...ignoredAccounts, handle];
    setIgnoredAccounts(updated);
    saveIgnored(updated);
  };

  // ─── Settings management ─────────────────────────────────────────────────

  const updateSetting = <K extends keyof EngageSettings>(key: K, value: EngageSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  // ─── Template application ──────────────────────────────────────────────────

  const applyTemplateToReply = (template: ReplyTemplate, mention: Mention) => {
    const applied = applyTemplate(template.body, mention.author_username, extractTopic(mention.text));
    setReplyText(applied);
  };

  // ─── Filtering + sorting ───────────────────────────────────────────────────

  const isHot = (m: Mention): boolean => m.like_count >= minLikes || m.retweet_count >= minRetweets;

  // Filter out ignored accounts + spam (unless explicitly viewing those filters)
  const visibleMentions = allMentions.filter(m => {
    const handle = m.author_username.toLowerCase();
    if (activeFilter !== 'ignored' && activeFilter !== 'spam' && ignoredAccounts.includes(handle)) return false;
    if (activeFilter !== 'spam' && m.is_spam) return false;
    return true;
  });

  const filteredMentions = visibleMentions.filter(m => {
    switch (activeFilter) {
      case 'hot': return isHot(m);
      case 'pending': return m.reply_status === 'pending';
      case 'replied': return m.reply_status === 'replied';
      case 'ignored': return m.reply_status === 'ignored' || ignoredAccounts.includes(m.author_username.toLowerCase());
      case 'spam': return m.is_spam;
      case 'replies': return m.mention_type === 'reply';
      case 'quotes': return m.mention_type === 'quote';
      case 'direct': return m.mention_type === 'mention';
      default: return true;
    }
  });

  // Sort: priority accounts first, then by created_at descending
  const sortedMentions = [...filteredMentions].sort((a, b) => {
    const aPriority = priorityAccounts.includes(a.author_username.toLowerCase()) ? 0 : 1;
    const bPriority = priorityAccounts.includes(b.author_username.toLowerCase()) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.created_at - a.created_at;
  });

  // Filter counts (exclude ignored accounts from non-ignored counts)
  const nonIgnored = allMentions.filter(m => !ignoredAccounts.includes(m.author_username.toLowerCase()));
  const counts: Record<FilterTab, number> = {
    all: nonIgnored.length,
    hot: nonIgnored.filter(isHot).length,
    pending: nonIgnored.filter(m => m.reply_status === 'pending').length,
    replied: nonIgnored.filter(m => m.reply_status === 'replied').length,
    ignored: allMentions.filter(m => m.reply_status === 'ignored' || ignoredAccounts.includes(m.author_username.toLowerCase())).length,
    spam: allMentions.filter(m => m.is_spam).length,
    replies: nonIgnored.filter(m => !m.is_spam && m.mention_type === 'reply').length,
    quotes: nonIgnored.filter(m => !m.is_spam && m.mention_type === 'quote').length,
    direct: nonIgnored.filter(m => !m.is_spam && m.mention_type === 'mention').length,
  };

  // ─── Render: mention card ──────────────────────────────────────────────────

  const renderMentionCard = (mention: Mention) => {
    const isSelected = selectedMention === mention.id;
    const isPriority = priorityAccounts.includes(mention.author_username.toLowerCase());
    let existingNotes = '';
    try {
      const meta = typeof mention.metadata === 'string' ? JSON.parse(mention.metadata) : (mention.metadata || {});
      existingNotes = meta.notes || '';
    } catch { /* noop */ }

    return (
      <div
        key={mention.id}
        className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4 mb-3 hover:bg-mission-control-bg-alt transition-colors"
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isPriority && (
              <Star size={13} className="flex-shrink-0 text-warning" />
            )}
            <div className="font-medium text-mission-control-text truncate">@{mention.author_username}</div>
            <div className="text-sm text-mission-control-text-dim truncate">{mention.author_name}</div>
            {settings.showSentiment && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${sentimentBadgeClasses(mention.sentiment)}`}>
                {mention.sentiment}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <div className="text-xs text-mission-control-text-dim">
              {new Date(mention.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Mention type badge + tweet text */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            mention.mention_type === 'reply'
              ? mention.is_reply_to_us
                ? 'bg-success-subtle text-success'
                : 'bg-info-subtle text-info'
              : mention.mention_type === 'quote'
              ? 'bg-warning-subtle text-warning'
              : 'bg-mission-control-surface text-mission-control-text-dim border border-mission-control-border'
          }`}>
            {mention.mention_type === 'reply'
              ? mention.is_reply_to_us ? 'Reply to you' : 'Reply (tagged)'
              : mention.mention_type === 'quote'
              ? 'Quote tweet'
              : 'Mention'}
          </span>
          {mention.author_followers != null && (
            <span className="text-xs text-mission-control-text-dim">
              {mention.author_followers.toLocaleString()} followers
            </span>
          )}
        </div>

        {/* Parent tweet context (for replies) */}
        {mention.parent_tweet?.text && (
          <div className="mb-2 p-2.5 rounded-lg border border-mission-control-border bg-mission-control-bg text-xs">
            <div className="text-mission-control-text-dim mb-1 flex items-center gap-1">
              <MessageCircle size={10} />
              Replying to {mention.parent_tweet.author?.username ? `@${mention.parent_tweet.author.username}` : 'original post'}
            </div>
            <div className="text-mission-control-text line-clamp-3">{mention.parent_tweet.text}</div>
          </div>
        )}

        <div className="text-sm text-mission-control-text mb-3 whitespace-pre-wrap">{mention.text}</div>

        {/* Engagement metrics */}
        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mb-3">
          <div className="flex items-center gap-1"><Heart size={12} /> {mention.like_count}</div>
          <div className="flex items-center gap-1"><Repeat2 size={12} /> {mention.retweet_count}</div>
          <div className="flex items-center gap-1"><MessageCircle size={12} /> {mention.reply_count}</div>
          <a
            href={`https://twitter.com/${mention.author_username}/status/${mention.tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            View on X
          </a>
        </div>

        {/* Status buttons + reply toggle */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateStatus(mention.id, 'pending')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                mention.reply_status === 'pending'
                  ? 'bg-warning-subtle text-warning border border-warning'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80 border border-mission-control-border'
              }`}
            >
              <Clock size={12} className="inline mr-0.5" /> Pending
            </button>
            <button
              onClick={() => updateStatus(mention.id, 'considering')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                mention.reply_status === 'considering'
                  ? 'bg-info-subtle text-info border border-info'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80 border border-mission-control-border'
              }`}
            >
              <HelpCircle size={12} className="inline mr-0.5" /> Considering
            </button>
            <button
              onClick={() => updateStatus(mention.id, 'ignored')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                mention.reply_status === 'ignored'
                  ? 'bg-mission-control-surface text-mission-control-text border border-mission-control-border'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80 border border-mission-control-border'
              }`}
            >
              <Ban size={12} className="inline mr-0.5" /> Ignored
            </button>
            {mention.reply_status === 'replied' && (
              <div className="px-2 py-1 text-xs rounded bg-success-subtle text-success border border-success">
                <CheckCircle size={12} className="inline mr-0.5" /> Replied
                {mention.replied_at && (
                  <span className="ml-1 text-mission-control-text-dim">
                    {new Date(mention.replied_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Priority toggle */}
            <button
              onClick={() => togglePriority(mention.author_username)}
              title={isPriority ? 'Remove from priority' : 'Add to priority'}
              className="p-1.5 rounded border border-mission-control-border hover:bg-mission-control-surface transition-colors"
              aria-label={isPriority ? 'Remove from priority' : 'Add to priority'}
            >
              {isPriority
                ? <StarOff size={14} className="text-warning" />
                : <Star size={14} className="text-mission-control-text-dim" />
              }
            </button>

            {/* Ignore user toggle */}
            <button
              onClick={() => toggleIgnored(mention.author_username)}
              title={ignoredAccounts.includes(mention.author_username.toLowerCase()) ? 'Unignore user' : 'Ignore user'}
              className="p-1.5 rounded border border-mission-control-border hover:bg-mission-control-surface transition-colors"
              aria-label={ignoredAccounts.includes(mention.author_username.toLowerCase()) ? 'Unignore user' : 'Ignore user'}
            >
              {ignoredAccounts.includes(mention.author_username.toLowerCase())
                ? <EyeOff size={14} className="text-error" />
                : <UserX size={14} className="text-mission-control-text-dim" />
              }
            </button>

            {/* Suggest Reply */}
            <button
              onClick={() => {
                const prompt = `Please suggest 2-3 reply options for this mention:\n\n@${mention.author_username}: ${mention.text}\n\nKeep replies concise, engaging, and on-brand. Each reply should be under 280 characters.`;
                window.dispatchEvent(new CustomEvent('x-agent-chat-inject', { detail: { message: prompt } }));
              }}
              className="px-3 py-1 text-sm border border-mission-control-accent text-mission-control-accent rounded hover:bg-mission-control-accent/10 flex items-center gap-1"
            >
              <MessageCircle size={14} /> Suggest Reply
            </button>

            {/* Reply toggle */}
            {mention.reply_status !== 'replied' && mention.reply_status !== 'ignored' && (
              <button
                onClick={() => {
                  if (isSelected) {
                    setSelectedMention(null);
                    setReplyText('');
                    setShowTemplates(false);
                    setReplyError(null);
                  } else {
                    setSelectedMention(mention.id);
                    setReplyText('');
                    setShowTemplates(false);
                    setReplyError(null);
                  }
                }}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
                  isSelected
                    ? 'bg-info text-white'
                    : 'border border-info text-info hover:bg-info-subtle'
                }`}
              >
                <MessageCircle size={14} /> Reply
              </button>
            )}
          </div>
        </div>

        {/* AI-generated reply suggestions — auto-shown */}
        {mention.reply_status !== 'replied' && mention.reply_status !== 'ignored' && (
          <div className="mb-3">
            {aiLoading.has(mention.id) ? (
              <div className="flex items-center gap-2 text-xs text-mission-control-text-dim py-2">
                <div className="w-3 h-3 border border-info border-t-transparent rounded-full animate-spin" />
                Generating smart replies...
              </div>
            ) : aiReplies[mention.id]?.replies?.length ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-mission-control-text-dim font-medium flex items-center gap-1">
                    <Zap size={11} className="text-info" />
                    Smart replies
                  </div>
                  {aiReplies[mention.id]?.replies?.[aiReplies[mention.id]?.recommended] && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-subtle text-success">
                      Best pick queued for approval
                    </span>
                  )}
                </div>
                {aiReplies[mention.id].replies.map((reply, idx) => {
                  const isRecommended = idx === aiReplies[mention.id].recommended;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedMention(mention.id);
                        setReplyText(reply);
                        setShowTemplates(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors group ${
                        isRecommended
                          ? 'border-info bg-info-subtle/40 hover:bg-info-subtle/60'
                          : 'border-mission-control-border bg-mission-control-bg hover:border-info hover:bg-info-subtle/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isRecommended && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-info text-white flex-shrink-0">
                            BEST
                          </span>
                        )}
                        <span className="text-mission-control-text">{reply}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateAIReplies([mention])}
                  className="flex items-center gap-1.5 text-xs text-info hover:underline"
                >
                  <Zap size={11} />
                  Generate smart replies
                </button>
                <span className="text-[10px] text-mission-control-text-dim">
                  or wait for background processing
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notes (below smart replies) */}
        {settings.showNotes && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={notes[mention.id] ?? ''}
              onChange={(e) => setNotes(prev => ({ ...prev, [mention.id]: e.target.value }))}
              onBlur={() => { if (notes[mention.id]?.trim()) saveNotes(mention.id, notes[mention.id]); }}
              placeholder="Add notes..."
              className="flex-1 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
            />
            <button
              onClick={() => saveNotes(mention.id, notes[mention.id] || '')}
              disabled={!notes[mention.id]?.trim()}
              className="px-3 py-1 text-sm bg-mission-control-surface text-mission-control-text rounded hover:bg-mission-control-surface/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>
          {existingNotes && (
            <div className="mt-1 text-xs text-mission-control-text-dim bg-mission-control-surface p-2 rounded">
              <StickyNote size={12} className="inline mr-1" /> {existingNotes}
            </div>
          )}
        </div>
        )}

        {/* Inline reply composer */}
        {isSelected && (
          <div className="space-y-3 bg-mission-control-bg p-3 rounded border border-info">
            {/* Templates */}
            <div>
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text mb-2"
              >
                {showTemplates ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Reply templates
              </button>
              {showTemplates && (
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => applyTemplateToReply(tpl, mention)}
                      className="text-left px-2 py-1.5 text-xs rounded border border-mission-control-border hover:bg-mission-control-surface transition-colors text-mission-control-text"
                    >
                      <div className="font-medium">{tpl.name}</div>
                      <div className="text-mission-control-text-dim truncate">{tpl.body.slice(0, 40)}...</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              value={replyText}
              onChange={(e) => { setReplyText(e.target.value); setReplyError(null); }}
              placeholder="Write your reply..."
              className="w-full px-3 py-2 text-sm border border-mission-control-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-info bg-mission-control-bg text-mission-control-text"
              rows={3}
              maxLength={280}
              autoFocus
            />

            {replyError && (
              <div className="text-xs text-error bg-error-subtle p-2 rounded">{replyError}</div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="text-xs text-mission-control-text-dim">
                  {replyText.length}/280
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fastTrack}
                    onChange={(e) => setFastTrack(e.target.checked)}
                    className="rounded"
                  />
                  <span className="flex items-center gap-1 text-mission-control-text">
                    <Zap size={12} className="text-warning" />
                    Fast-track (tier 1)
                  </span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMention(null);
                    setReplyText('');
                    setShowTemplates(false);
                    setReplyError(null);
                  }}
                  className="px-3 py-1.5 text-sm border border-mission-control-border rounded hover:bg-mission-control-surface text-mission-control-text"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSendReply(mention.id, mention.tweet_id)}
                  disabled={!replyText.trim() || replyText.length > 280}
                  className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Send size={14} />
                  {fastTrack ? 'Send (Tier 1)' : 'Send for Approval'}
                </button>
              </div>
            </div>

            {fastTrack && (
              <div className="text-xs text-warning bg-warning-subtle p-2 rounded flex items-center gap-1">
                <Zap size={12} />
                Fast-track: routes to tier 1 approval (minimal review required)
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render: main ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-mission-control-text-dim">Loading mentions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Inbox size={20} className="text-info" />
            <div className="text-lg font-semibold text-mission-control-text">Engagement Inbox</div>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-info-subtle text-info' : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'}`}
            title="Engagement settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={fetchNewMentions}
            disabled={fetching}
            className="px-4 py-2 bg-info text-white rounded-lg hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
          >
            {fetching ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Fetching...
              </>
            ) : (
              <><RefreshCw size={16} /> Fetch New</>
            )}
          </button>
          </div>
        </div>

        {/* Filter pills — two rows: status + type */}
        <div className="space-y-2 mb-3">
          {/* Status filters */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'hot', 'pending', 'replied', 'ignored', 'spam'] as FilterTab[]).map(tab => {
              const label = tab === 'hot' ? 'Hot' : tab === 'spam' ? 'Spam' : tab.charAt(0).toUpperCase() + tab.slice(1);
              const icon = tab === 'hot' ? <TrendingUp size={12} className="mr-0.5" />
                : tab === 'spam' ? <Ban size={12} className="mr-0.5" />
                : null;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors flex items-center ${
                    activeFilter === tab
                      ? 'bg-info-subtle text-info font-medium'
                      : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80 border border-mission-control-border'
                  }`}
                >
                  {icon}{label} ({counts[tab]})
                </button>
              );
            })}
          </div>
          {/* Type filters */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-mission-control-text-dim self-center mr-1">Type:</span>
            {([
              { id: 'replies' as FilterTab, label: 'Replies', icon: <MessageCircle size={12} className="mr-0.5" /> },
              { id: 'quotes' as FilterTab, label: 'Quotes', icon: <Repeat2 size={12} className="mr-0.5" /> },
              { id: 'direct' as FilterTab, label: 'Direct Mentions', icon: <Heart size={12} className="mr-0.5" /> },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1 text-xs rounded-lg transition-colors flex items-center ${
                  activeFilter === tab.id
                    ? 'bg-info-subtle text-info font-medium'
                    : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80 border border-mission-control-border'
                }`}
              >
                {tab.icon}{tab.label} ({counts[tab.id]})
              </button>
            ))}
          </div>
        </div>

        {/* Hot filter thresholds — only visible when Hot is active */}
        {activeFilter === 'hot' && (
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label htmlFor="engage-min-likes" className="text-xs text-mission-control-text-dim">Min Likes:</label>
              <input
                id="engage-min-likes"
                type="number"
                value={minLikes}
                onChange={(e) => setMinLikes(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
                min="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="engage-min-retweets" className="text-xs text-mission-control-text-dim">Min Retweets:</label>
              <input
                id="engage-min-retweets"
                type="number"
                value={minRetweets}
                onChange={(e) => setMinRetweets(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
                min="0"
              />
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div className="mb-3 p-4 rounded-xl border border-mission-control-border bg-mission-control-surface space-y-4">
            <h4 className="text-sm font-semibold text-mission-control-text flex items-center gap-2">
              <Settings size={14} />
              Engagement Settings
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Default reply tier */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Default Reply Approval Tier</label>
                <select
                  value={settings.defaultReplyTier}
                  onChange={(e) => {
                    const tier = Number(e.target.value) as 1 | 3;
                    updateSetting('defaultReplyTier', tier);
                    setFastTrack(tier === 1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text"
                >
                  <option value={3}>Tier 3 — Standard review</option>
                  <option value={1}>Tier 1 — Fast-track (minimal review)</option>
                </select>
              </div>

              {/* Auto-ignore low engagement */}
              <div>
                <label className="text-xs text-mission-control-text-dim mb-1 block">Auto-Ignore Low Engagement</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoIgnoreLowEngagement}
                      onChange={(e) => updateSetting('autoIgnoreLowEngagement', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-mission-control-text">Ignore accounts with fewer than</span>
                  </label>
                  <input
                    type="number"
                    value={settings.lowEngagementThreshold}
                    onChange={(e) => updateSetting('lowEngagementThreshold', parseInt(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
                    min="0"
                  />
                  <span className="text-xs text-mission-control-text-dim">followers</span>
                </div>
              </div>

              {/* Show sentiment */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showSentiment}
                  onChange={(e) => updateSetting('showSentiment', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-mission-control-text">Show sentiment badges</span>
              </label>

              {/* Show notes */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showNotes}
                  onChange={(e) => updateSetting('showNotes', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-mission-control-text">Show notes on cards</span>
              </label>

              {/* Auto-ignore bots */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoIgnoreBots}
                  onChange={(e) => updateSetting('autoIgnoreBots', e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-mission-control-text">Auto-ignore suspected bots</span>
              </label>
            </div>
          </div>
        )}

        {/* Account lists: Priority + Ignored */}
        <div className="flex gap-4 flex-wrap">
        {/* Priority accounts collapsible */}
        <div className="flex-1 min-w-[200px]">
          <button
            onClick={() => setShowPriorityPanel(v => !v)}
            className="flex items-center gap-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text"
          >
            <Star size={12} className="text-warning" />
            Priority accounts
            {priorityAccounts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-warning-subtle text-warning">
                {priorityAccounts.length}
              </span>
            )}
            {showPriorityPanel ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {showPriorityPanel && (
            <div className="mt-2 p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
              <p className="text-xs text-mission-control-text-dim mb-2">
                Priority accounts always appear first in the list.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={priorityInput}
                  onChange={e => setPriorityInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPriority(); }}
                  placeholder="@username"
                  className="flex-1 px-2 py-1 text-xs border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
                />
                <button
                  onClick={handleAddPriority}
                  disabled={!priorityInput.trim()}
                  className="px-3 py-1 text-xs rounded bg-info text-white disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
              </div>
              {priorityAccounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {priorityAccounts.map(h => (
                    <span
                      key={h}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-mission-control-border bg-warning-subtle text-warning"
                    >
                      @{h}
                      <button onClick={() => handleRemovePriority(h)} aria-label={`Remove @${h}`}>
                        <span className="text-[10px]">&times;</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ignored accounts collapsible */}
        <div className="flex-1 min-w-[200px]">
          <button
            onClick={() => setShowIgnoredPanel(v => !v)}
            className="flex items-center gap-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text"
          >
            <UserX size={12} className="text-error" />
            Ignored accounts
            {ignoredAccounts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs bg-error-subtle text-error">
                {ignoredAccounts.length}
              </span>
            )}
            {showIgnoredPanel ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {showIgnoredPanel && (
            <div className="mt-2 p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
              <p className="text-xs text-mission-control-text-dim mb-2">
                Mentions from ignored accounts are hidden from all filters except Ignored.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ignoredInput}
                  onChange={e => setIgnoredInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddIgnored(); }}
                  placeholder="@username"
                  className="flex-1 px-2 py-1 text-xs border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
                />
                <button
                  onClick={handleAddIgnored}
                  disabled={!ignoredInput.trim()}
                  className="px-3 py-1 text-xs rounded bg-error/80 text-white disabled:opacity-50 transition-colors"
                >
                  Ignore
                </button>
              </div>
              {ignoredAccounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {ignoredAccounts.map(h => (
                    <span
                      key={h}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-mission-control-border bg-error-subtle text-error"
                    >
                      @{h}
                      <button onClick={() => handleRemoveIgnored(h)} aria-label={`Unignore @${h}`}>
                        <span className="text-[10px]">&times;</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Mentions list */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedMentions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div className="text-center">
              {allMentions.length === 0 ? (
                <>
                  <Inbox size={48} className="mx-auto mb-2 text-mission-control-text-dim" />
                  <div>No mentions yet</div>
                  <div className="text-sm mt-2">Click &quot;Fetch New&quot; to check for mentions</div>
                </>
              ) : (
                <>
                  <Inbox size={48} className="mx-auto mb-2 text-mission-control-text-dim" />
                  <div>No {activeFilter} mentions</div>
                  <div className="text-sm mt-2">Try a different filter</div>
                </>
              )}
            </div>
          </div>
        ) : (
          sortedMentions.map(renderMentionCard)
        )}
      </div>
    </div>
  );
};

export default XEngageView;
