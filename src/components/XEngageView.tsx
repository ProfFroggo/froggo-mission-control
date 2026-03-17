// src/components/XEngageView.tsx
// Unified engagement inbox — merges XMentionsView and XReplyGuyView into a single stream.
// Phase 20.3 consolidation. All replies go through approval gate — no direct posting bypass.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Check,
} from 'lucide-react';
import { showToast } from './Toast';
import { scheduleApi, approvalApi, inboxApi } from '../lib/api';

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

// Settings persistence — uses settings API with localStorage fallback
async function loadFromSetting(key: string, fallback: any): Promise<any> {
  try {
    const res = await fetch(`/api/settings/${key}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.value) return JSON.parse(data.value);
    }
  } catch { /* fallback to localStorage */ }
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveToSetting(key: string, value: any): void {
  const json = JSON.stringify(value);
  // Save to both settings API and localStorage (API is persistent, localStorage is fast)
  localStorage.setItem(key, json);
  fetch(`/api/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: json }),
  }).catch(() => { /* non-critical */ });
}

function loadPriority(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_PRIORITY_KEY) ?? '[]'); } catch { return []; }
}
function savePriority(v: string[]): void { saveToSetting(LS_PRIORITY_KEY, v); }

function loadIgnored(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_IGNORED_KEY) ?? '[]'); } catch { return []; }
}
function saveIgnored(v: string[]): void { saveToSetting(LS_IGNORED_KEY, v); }

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
function saveSettings(s: EngageSettings): void { saveToSetting(LS_ENGAGE_SETTINGS_KEY, s); }

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

  // AI-generated reply suggestions per mention
  const [aiReplies, setAiReplies] = useState<Record<string, { replies: string[]; recommended: number; replies_english?: (string | null)[] | null; detected_language?: string }>>({});
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());

  // Notes
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Reply status tracking — loaded from approval api
  const [pendingReplies, setPendingReplies] = useState<Record<string, { text: string; status: 'queued' | 'approved' | 'sent' }>>({});

  // ─── Data loading ──────────────────────────────────────────────────────────

  const loadMentions = useCallback(async () => {
    try {
      // Load from dedicated x_mentions table
      const res = await fetch('/api/x/mentions/data');
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const items = data.mentions || [];

      const preGenerated: Record<string, { replies: string[]; recommended: number; replies_english?: (string | null)[] | null; detected_language?: string }> = {};

      const mentions = items.map((item: any) => {
        // Load pre-generated AI replies from columns
        if (item.ai_replies?.length) {
          preGenerated[String(item.id)] = {
            replies: item.ai_replies,
            recommended: item.ai_recommended ?? 0,
            replies_english: item.ai_replies_english || null,
            detected_language: item.detected_language || 'en',
          };
        }

        return normalizeMention({
          id: String(item.id),
          tweet_id: item.tweet_id,
          author_id: item.author_id,
          author_username: item.author_username,
          author_name: item.author_name,
          author: item.author_followers != null ? { public_metrics: { followers_count: item.author_followers } } : undefined,
          text: item.text,
          created_at: item.tweet_created_at,
          conversation_id: item.conversation_id || '',
          in_reply_to_user_id: item.in_reply_to_user_id || '',
          reply_status: item.reply_status || 'pending',
          replied_at: item.replied_at,
          fetched_at: item.fetched_at,
          metadata: JSON.stringify({
            ai_judgment: item.ai_triage ? { triage: item.ai_triage, triage_reason: item.ai_triage_reason, confidence: item.ai_confidence, safety_flags: item.ai_safety_flags } : null,
            ai_replies: item.ai_replies ? { replies: item.ai_replies, replies_english: item.ai_replies_english, recommended: item.ai_recommended, reasoning: item.ai_reasoning, detected_language: item.detected_language, mention_translation: item.mention_translation } : null,
          }),
          mention_type: item.mention_type || 'mention',
          is_reply_to_us: item.is_reply_to_us,
          parent_tweet: item.parent_tweet_text ? { type: 'replied_to', id: item.parent_tweet_id, text: item.parent_tweet_text, author: item.parent_tweet_author ? { id: '', username: item.parent_tweet_author, name: item.parent_tweet_author } : null } : null,
        });
      });

      setAllMentions(mentions);
      if (Object.keys(preGenerated).length > 0) {
        setAiReplies(prev => ({ ...prev, ...preGenerated }));
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

  // Load reply approvals to show status on cards
  const loadReplyApprovals = useCallback(async () => {
    try {
      const [pending, approved] = await Promise.all([
        approvalApi.getAll('pending'),
        approvalApi.getAll('approved'),
      ]);
      const allApprovals = [
        ...(Array.isArray(pending) ? pending : []),
        ...(Array.isArray(approved) ? approved : []),
      ];
      const replyMap: Record<string, { text: string; status: 'queued' | 'approved' | 'sent' }> = {};
      for (const a of allApprovals) {
        if (a.type === 'x-reply' && a.payload?.mentionId) {
          const mentionId = String(a.payload.mentionId);
          const status: 'queued' | 'approved' | 'sent' =
            a.status === 'approved' ? 'approved' : 'queued';
          replyMap[mentionId] = { text: a.payload.replyText || '', status };
        }
      }
      setPendingReplies(replyMap);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadReplyApprovals();
  }, [loadReplyApprovals]);

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
      await fetch('/api/x/mentions/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reply_status: status }),
      });
    } catch {
      await loadMentions();
    }
  };

  // ─── Notes ─────────────────────────────────────────────────────────────────

  const saveNotes = async (id: string, noteText: string) => {
    try {
      await fetch('/api/x/mentions/data', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, notes: noteText }),
      });
      setNotes(prev => ({ ...prev, [id]: noteText }));
      showToast('success', 'Note saved');
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
          let aiResult: { replies: string[]; recommended: number } | null = null;
          if (objMatch) {
            try {
              const parsed = JSON.parse(objMatch[0]);
              if (parsed.replies?.length > 0) {
                aiResult = {
                  replies: parsed.replies.slice(0, 3),
                  recommended: typeof parsed.recommended === 'number' ? parsed.recommended : 0,
                };
              }
            } catch { /* parse failed, try array fallback */ }
          } else if (arrMatch) {
            try {
              const options = JSON.parse(arrMatch[0]) as string[];
              if (Array.isArray(options) && options.length > 0) {
                aiResult = { replies: options.slice(0, 3), recommended: 0 };
              }
            } catch { /* parse failed, skip */ }
          }

          if (aiResult) {
            setAiReplies(prev => ({ ...prev, [mention.id]: aiResult! }));

            // Persist to DB so it doesn't regenerate on next page load
            try {
              await fetch('/api/x/mentions/data', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: mention.id,
                  ai_replies: aiResult.replies,
                  ai_recommended: aiResult.recommended,
                  ai_processed_at: Date.now(),
                }),
              });
            } catch { /* non-critical */ }
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
      // Update local reply status immediately
      setPendingReplies(prev => ({ ...prev, [mentionId]: { text: replyText.trim(), status: 'queued' } }));
      showToast('success', 'Sent for approval', fastTrack ? 'Fast-tracked (tier 1)' : 'Queued for review (tier 3)');
      setReplyText('');
      setSelectedMention(null);
      setShowTemplates(false);
      setReplyError(null);
      await loadMentions();
      await loadReplyApprovals();
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : 'Failed to submit reply for approval');
    }
  };

  // ─── One-click send from smart reply ────────────────────────────────────────

  const handleQuickSendReply = async (mention: Mention, text: string) => {
    if (!text.trim() || text.length > 280) return;
    try {
      await approvalApi.create({
        type: 'x-reply',
        tier: fastTrack ? 1 : 3,
        title: `Reply to @${mention.author_username}`,
        description: text,
        payload: { mentionId: mention.id, tweetId: mention.tweet_id, replyText: text },
        requestedBy: 'user',
      });
      setPendingReplies(prev => ({ ...prev, [mention.id]: { text, status: 'queued' } }));
      showToast('success', 'Reply queued', `Reply to @${mention.author_username} sent for approval`);
      await loadReplyApprovals();
    } catch (error) {
      showToast('error', 'Failed', error instanceof Error ? error.message : 'Could not queue reply');
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

  // ─── Stats bar data ────────────────────────────────────────────────────────

  const engageStats = useMemo(() => {
    const total = nonIgnored.length;
    const pendingNoApproval = nonIgnored.filter(
      m => m.reply_status === 'pending' && !pendingReplies[m.id]
    ).length;
    const queued = Object.values(pendingReplies).filter(r => r.status === 'queued').length;
    const replied = nonIgnored.filter(m => m.reply_status === 'replied').length;
    return { total, pendingNoApproval, queued, replied };
  }, [nonIgnored, pendingReplies]);

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

        {/* Mention type badge + AI judgment + tweet text */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
          {/* AI judgment badges */}
          {(() => {
            let meta: any = {};
            try { meta = typeof mention.metadata === 'string' ? JSON.parse(mention.metadata) : (mention.metadata || {}); } catch { /* noop */ }
            const judgment = meta.ai_judgment;
            if (!judgment) return null;
            return (
              <>
                {judgment.triage === 'escalate' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-warning-subtle text-warning font-medium">
                    Needs human review
                  </span>
                )}
                {judgment.confidence != null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    judgment.confidence >= 0.8 ? 'bg-success-subtle text-success'
                    : judgment.confidence >= 0.5 ? 'bg-info-subtle text-info'
                    : 'bg-warning-subtle text-warning'
                  }`}>
                    {Math.round(judgment.confidence * 100)}% confident
                  </span>
                )}
                {judgment.safety_flags?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-error-subtle text-error font-medium" title={judgment.safety_flags.join(', ')}>
                    {judgment.safety_flags.length} safety flag{judgment.safety_flags.length > 1 ? 's' : ''}
                  </span>
                )}
              </>
            );
          })()}
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

        {/* Tweet text + language */}
        {(() => {
          let mentionMeta: any = {};
          try { mentionMeta = typeof mention.metadata === 'string' ? JSON.parse(mention.metadata) : (mention.metadata || {}); } catch { /* noop */ }
          const lang = mentionMeta.ai_replies?.detected_language;
          const translation = mentionMeta.ai_replies?.mention_translation;
          return (
            <>
              <div className="text-sm text-mission-control-text mb-1 whitespace-pre-wrap">{mention.text}</div>
              {lang && lang !== 'en' && (
                <div className="mb-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info-subtle text-info font-medium mr-2">
                    {lang.toUpperCase()}
                  </span>
                  {translation && (
                    <span className="text-xs text-mission-control-text-dim italic">{translation}</span>
                  )}
                </div>
              )}
              {(!lang || lang === 'en') && <div className="mb-3" />}
            </>
          );
        })()}

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

        {/* Reply status bar */}
        {pendingReplies[mention.id] && (
          <div className={`mb-3 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 ${
            pendingReplies[mention.id].status === 'sent'
              ? 'bg-success-subtle text-success'
              : pendingReplies[mention.id].status === 'approved'
              ? 'bg-success-subtle text-success'
              : 'bg-info-subtle text-info'
          }`}>
            {pendingReplies[mention.id].status === 'sent' ? (
              <><Check size={12} /> Reply sent</>
            ) : pendingReplies[mention.id].status === 'approved' ? (
              <><CheckCircle size={12} /> Reply approved</>
            ) : (
              <><Clock size={12} /> Reply queued</>
            )}
            <span className="text-mission-control-text-dim ml-1 truncate max-w-[200px]">
              {pendingReplies[mention.id].text}
            </span>
          </div>
        )}

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
                  const alreadyQueued = !!pendingReplies[mention.id];
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-0 w-full rounded-lg border transition-colors ${
                        isRecommended
                          ? 'border-info bg-info-subtle/40 hover:bg-info-subtle/60'
                          : 'border-mission-control-border bg-mission-control-bg hover:border-info hover:bg-info-subtle/30'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedMention(mention.id);
                          setReplyText(reply);
                          setShowTemplates(false);
                        }}
                        className="flex-1 text-left px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          {isRecommended && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-info text-white flex-shrink-0">
                              BEST
                            </span>
                          )}
                          <span className="text-mission-control-text">{reply}</span>
                        </div>
                        {/* English translation for non-English replies */}
                        {(() => {
                          const replyData = aiReplies[mention.id] as any;
                          const eng = replyData?.replies_english?.[idx];
                          if (eng && replyData?.detected_language && replyData.detected_language !== 'en') {
                            return (
                              <div className="text-[11px] text-mission-control-text-dim mt-1 italic pl-0.5">
                                EN: {eng}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </button>
                      {!alreadyQueued && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSendReply(mention, reply);
                          }}
                          title="Send for approval"
                          className="flex-shrink-0 p-2 mr-1 rounded hover:bg-info/20 text-mission-control-text-dim hover:text-info transition-colors"
                        >
                          <Send size={13} />
                        </button>
                      )}
                    </div>
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

        {/* Stats bar + quick actions */}
        <div className="flex items-center justify-between px-3 py-1.5 mb-3 rounded-lg border border-mission-control-border bg-mission-control-surface text-xs text-mission-control-text-dim">
          <div className="flex items-center gap-4">
            <span className="whitespace-nowrap">Total: <span className="text-mission-control-text font-medium">{engageStats.total}</span></span>
            <span className="whitespace-nowrap">Pending: <span className="text-mission-control-text font-medium">{engageStats.pendingNoApproval}</span></span>
            <span className="whitespace-nowrap">Queued: <span className="text-info font-medium">{engageStats.queued}</span></span>
            <span className="whitespace-nowrap">Replied: <span className="text-success font-medium">{engageStats.replied}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            {counts.spam > 0 && (
              <button
                onClick={async () => {
                  const spamMentions = allMentions.filter(m => m.is_spam);
                  for (const m of spamMentions) {
                    await fetch('/api/x/mentions/data', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: m.id, reply_status: 'ignored' }),
                    });
                  }
                  showToast('success', `${spamMentions.length} spam ignored`);
                  loadMentions();
                }}
                className="px-2 py-1 text-xs text-error hover:bg-error/10 rounded transition-colors"
              >
                Ignore all spam ({counts.spam})
              </button>
            )}
            {filteredMentions.length > 0 && activeFilter === 'pending' && (
              <button
                onClick={async () => {
                  const pending = filteredMentions.filter(m => m.reply_status === 'pending');
                  for (const m of pending) {
                    await fetch('/api/x/mentions/data', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: m.id, reply_status: 'ignored' }),
                    });
                  }
                  showToast('success', `${pending.length} mentions ignored`);
                  loadMentions();
                }}
                className="px-2 py-1 text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt rounded transition-colors"
              >
                Ignore all pending
              </button>
            )}
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
