// LEGACY: XReplyGuyView uses file-level suppression for intentional patterns.
// loadHotMentions is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe
// Updated: 2026-03-14 - added priority targets, reply templates, sentiment filter, auto-reply stub

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Zap,
  Send,
  MessageCircle,
  Heart,
  Repeat2,
  Star,
  StarOff,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { inboxApi, approvalApi } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotMention {
  id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  text: string;
  created_at: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  reply_status: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

type SentimentFilter = 'all' | 'positive' | 'negative' | 'neutral';

interface ReplyTemplate {
  id: string;
  name: string;
  body: string;
}

// ─── Default reply templates ──────────────────────────────────────────────────

const DEFAULT_TEMPLATES: ReplyTemplate[] = [
  { id: 'tpl-1', name: 'Agree + Add', body: 'Totally agree, {{username}}. Building on that — [add your point here].' },
  { id: 'tpl-2', name: 'Question back', body: 'Great point on {{topic}}, {{username}}. Curious — how are you thinking about [follow-up question]?' },
  { id: 'tpl-3', name: 'Resource share', body: 'We wrote about this exact thing, {{username}}. Happy to share the thread if helpful.' },
  { id: 'tpl-4', name: 'Validate + Engage', body: 'This resonates, {{username}}. The {{topic}} angle is one we see a lot too.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LS_PRIORITY_KEY = 'x-reply-priority-accounts';
const LS_TEMPLATE_KEY = 'x-reply-templates';
const LS_AUTO_REPLY_KEY = 'x-auto-reply-enabled';

function loadPriority(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_PRIORITY_KEY) ?? '[]'); } catch { return []; }
}
function savePriority(v: string[]): void {
  try { localStorage.setItem(LS_PRIORITY_KEY, JSON.stringify(v)); } catch {}
}
function loadTemplates(): ReplyTemplate[] {
  try {
    const raw = localStorage.getItem(LS_TEMPLATE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}
function saveTemplates(v: ReplyTemplate[]): void {
  try { localStorage.setItem(LS_TEMPLATE_KEY, JSON.stringify(v)); } catch {}
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

function sentimentColor(s: 'positive' | 'negative' | 'neutral'): string {
  if (s === 'positive') return 'var(--color-success)';
  if (s === 'negative') return 'var(--color-error)';
  return 'var(--color-mission-control-text-dim)';
}

// ─── Main component ───────────────────────────────────────────────────────────

export const XReplyGuyView: React.FC = () => {
  const [mentions, setMentions] = useState<HotMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [minLikes, setMinLikes] = useState(10);
  const [minRetweets, setMinRetweets] = useState(5);
  const [selectedMention, setSelectedMention] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [fastTrack, setFastTrack] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postNowDraftId, setPostNowDraftId] = useState<string | null>(null);
  const postConfirmDialog = useConfirmDialog();

  // --- New state ---
  const [priorityAccounts, setPriorityAccounts] = useState<string[]>(loadPriority);
  const [priorityInput, setPriorityInput] = useState('');
  const [showPriorityPanel, setShowPriorityPanel] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [templates, setTemplates] = useState<ReplyTemplate[]>(loadTemplates);
  const [showTemplates, setShowTemplates] = useState(false);
  const [autoReply, setAutoReply] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(LS_AUTO_REPLY_KEY) ?? 'false'); } catch { return false; }
  });

  useEffect(() => {
    loadHotMentions();
  }, [minLikes, minRetweets]);

  const loadHotMentions = async () => {
    setLoading(true);
    try {
      const allItems = await inboxApi.getAll();
      const items = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'x-mention')
        .filter((item: any) => {
          const likes = (item as any).like_count || 0;
          const retweets = (item as any).retweet_count || 0;
          return likes >= minLikes && retweets >= minRetweets;
        })
        .slice(0, 50)
        .map((item: any): HotMention => ({
          ...item,
          sentiment: inferSentiment(item.text ?? ''),
        }));
      setMentions(items);
    } catch (error) {
      showToast('error', 'Error', 'Failed to load hot mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (mentionId: string) => {
    if (!replyText.trim()) {
      showToast('error', 'Empty Reply', 'Please enter a reply');
      return;
    }

    if (replyText.length > 280) {
      showToast('error', 'Too Long', 'Reply must be 280 characters or less');
      return;
    }

    try {
      // External posting MUST go through approval
      await approvalApi.create({
        type: 'x-reply',
        tier: fastTrack ? 1 : 3,
        payload: { mentionId, replyText, fastTrack },
        requestedBy: 'user',
      });

      showToast('success', 'Draft Created', fastTrack ? 'Fast-tracked for approval' : 'Draft saved for approval');
      setReplyText('');
      setSelectedMention(null);
      await loadHotMentions();
    } catch (error) {
      showToast('error', 'Error', 'Failed to create draft');
    }
  };

  const handlePostNow = async (mentionId: string) => {
    const mention = mentions.find(m => m.id === mentionId);
    if (!mention || !replyText.trim()) {
      showToast('error', 'Error', 'No mention or reply text found');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/x/tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText, reply_to: mention.tweet_id }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `API error: ${res.status}`);
      }
      showToast('success', 'Reply Posted', 'Your reply has been posted to X');
      setReplyText('');
      setSelectedMention(null);
      await loadHotMentions();
    } catch (error) {
      showToast('error', 'Error', error instanceof Error ? error.message : 'Failed to post tweet');
    } finally {
      setPosting(false);
    }
  };

  const getEngagementScore = (mention: HotMention) => {
    return mention.like_count + (mention.retweet_count * 2) + mention.reply_count;
  };

  const handleAddPriority = () => {
    const handle = priorityInput.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;
    if (priorityAccounts.includes(handle)) return;
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

  const handleToggleAutoReply = () => {
    const next = !autoReply;
    setAutoReply(next);
    try { localStorage.setItem(LS_AUTO_REPLY_KEY, JSON.stringify(next)); } catch {}
    if (next) {
      showToast('info', 'Auto-reply stub enabled', 'Auto-reply requires human review before any post goes live');
    }
  };

  const applyTemplateToReply = (template: ReplyTemplate, mention: HotMention) => {
    const applied = applyTemplate(template.body, mention.author_username, extractTopic(mention.text));
    setReplyText(applied);
  };

  // Sort: priority accounts first
  const sortedMentions = [...mentions].sort((a, b) => {
    const aPriority = priorityAccounts.includes(a.author_username.toLowerCase()) ? 0 : 1;
    const bPriority = priorityAccounts.includes(b.author_username.toLowerCase()) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return getEngagementScore(b) - getEngagementScore(a);
  });

  // Sentiment filter
  const filteredMentions = sentimentFilter === 'all'
    ? sortedMentions
    : sortedMentions.filter(m => m.sentiment === sentimentFilter);

  const renderMention = (mention: HotMention) => {
    const isSelected = selectedMention === mention.id;
    const engagementScore = getEngagementScore(mention);
    const isPriority = priorityAccounts.includes(mention.author_username.toLowerCase());

    return (
      <div
        key={mention.id}
        className={`border-b border-mission-control-border p-4 transition-colors ${
          isSelected ? 'bg-info/10' : 'hover:bg-mission-control-surface'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {isPriority && (
              <Star size={13} style={{ color: 'var(--color-warning)' }} className="flex-shrink-0" />
            )}
            <div className="font-medium text-mission-control-text">@{mention.author_username}</div>
            <div className="text-sm text-mission-control-text-dim">{mention.author_name}</div>
            {mention.sentiment && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  color: sentimentColor(mention.sentiment),
                  background: `${sentimentColor(mention.sentiment)}20`,
                }}
              >
                {mention.sentiment}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-medium text-warning bg-warning-subtle px-2 py-1 rounded">
              <TrendingUp size={12} />
              {engagementScore}
            </div>
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

        {/* Tweet text */}
        <div className="text-sm text-mission-control-text mb-3 whitespace-pre-wrap">{mention.text}</div>

        {/* Engagement metrics */}
        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mb-3">
          <div className="flex items-center gap-1"><Heart size={12} className="inline" /> {mention.like_count}</div>
          <div className="flex items-center gap-1"><Repeat2 size={12} className="inline" /> {mention.retweet_count}</div>
          <div className="flex items-center gap-1"><MessageCircle size={12} className="inline" /> {mention.reply_count}</div>
          <a
            href={`https://twitter.com/${mention.author_username}/status/${mention.tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            View on X →
          </a>
        </div>

        {/* Quick reply section */}
        {isSelected ? (
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
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              className="w-full px-3 py-2 text-sm border border-mission-control-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-info bg-mission-control-bg text-mission-control-text"
              rows={4}
              maxLength={280}
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-xs text-mission-control-text-dim">
                  {replyText.length}/280
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fastTrack}
                    onChange={(e) => setFastTrack(e.target.checked)}
                    className="rounded"
                  />
                  <span className="flex items-center gap-1">
                    <Zap size={12} className="text-warning" />
                    Fast-track approval (tier 1)
                  </span>
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMention(null);
                    setReplyText('');
                    setShowTemplates(false);
                  }}
                  className="px-3 py-1.5 text-sm border border-mission-control-border rounded hover:bg-mission-control-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateDraft(mention.id)}
                  disabled={!replyText.trim() || replyText.length > 280}
                  className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Send size={14} />
                  {fastTrack ? 'Draft & Approve' : 'Create Draft'}
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
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setSelectedMention(mention.id); setShowTemplates(false); }}
              className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 flex items-center gap-1"
            >
              <Zap size={14} />
              Quick Reply
            </button>
            <button
              onClick={() => {
                const prompt = `Please suggest 2-3 reply options for this mention:\n\n@${mention.author_username}: ${mention.text}\n\nKeep replies concise, engaging, and on-brand. Each reply should be under 280 characters.`;
                window.dispatchEvent(new CustomEvent('x-agent-chat-inject', { detail: { message: prompt } }));
              }}
              className="px-4 py-1.5 text-sm border border-mission-control-accent text-mission-control-accent rounded hover:bg-mission-control-accent/10 flex items-center gap-1"
            >
              <MessageCircle size={14} />
              Suggest Reply
            </button>
            <button
              onClick={() => {
                const updated = priorityAccounts.includes(mention.author_username.toLowerCase())
                  ? priorityAccounts.filter(h => h !== mention.author_username.toLowerCase())
                  : [...priorityAccounts, mention.author_username.toLowerCase()];
                setPriorityAccounts(updated);
                savePriority(updated);
              }}
              title={isPriority ? 'Remove from priority' : 'Add to priority'}
              className="p-1.5 rounded border border-mission-control-border hover:bg-mission-control-surface transition-colors"
              style={{ color: isPriority ? 'var(--color-warning)' : 'var(--color-mission-control-text-dim)' }}
            >
              {isPriority ? <StarOff size={14} /> : <Star size={14} />}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-warning" size={20} />
            <div className="text-lg font-semibold text-mission-control-text">Reply Guy</div>
          </div>
          <button
            onClick={loadHotMentions}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="text-sm text-mission-control-text-dim mb-3">
          Fast-track high-engagement mentions. Skip approval for time-sensitive replies.
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-4 mb-3">
          <div className="flex items-center gap-2">
            <label htmlFor="min-likes" className="text-xs text-mission-control-text-dim">Min Likes:</label>
            <input
              id="min-likes"
              type="number"
              value={minLikes}
              onChange={(e) => setMinLikes(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="min-retweets" className="text-xs text-mission-control-text-dim">Min Retweets:</label>
            <input
              id="min-retweets"
              type="number"
              value={minRetweets}
              onChange={(e) => setMinRetweets(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
              min="0"
            />
          </div>
        </div>

        {/* Sentiment filter */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-mission-control-text-dim">Sentiment:</span>
          {(['all', 'positive', 'negative', 'neutral'] as SentimentFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setSentimentFilter(s)}
              className="px-2.5 py-1 text-xs rounded-full capitalize transition-colors"
              style={
                sentimentFilter === s
                  ? { background: 'var(--color-info-subtle)', color: 'var(--color-info)' }
                  : { background: 'var(--color-mission-control-surface)', color: 'var(--color-mission-control-text-dim)' }
              }
            >
              {s}
            </button>
          ))}
        </div>

        {/* Priority targets collapsible */}
        <div className="mb-3">
          <button
            onClick={() => setShowPriorityPanel(v => !v)}
            className="flex items-center gap-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text"
          >
            <Star size={12} style={{ color: 'var(--color-warning)' }} />
            Priority targets
            {priorityAccounts.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs"
                style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}
              >
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
                  className="px-3 py-1 text-xs rounded transition-colors disabled:opacity-50"
                  style={{ background: 'var(--color-info)', color: '#fff' }}
                >
                  Add
                </button>
              </div>
              {priorityAccounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {priorityAccounts.map(h => (
                    <span
                      key={h}
                      className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-mission-control-border"
                      style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}
                    >
                      @{h}
                      <button onClick={() => handleRemovePriority(h)} aria-label={`Remove @${h}`}>
                        <span style={{ fontSize: 10 }}>×</span>
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Auto-reply toggle */}
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-mission-control-border bg-mission-control-surface">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-mission-control-text">Auto-reply mode (stub)</span>
            <span className="text-xs text-mission-control-text-dim">— all replies still require human review</span>
          </div>
          <button
            onClick={handleToggleAutoReply}
            aria-label={autoReply ? 'Disable auto-reply' : 'Enable auto-reply'}
          >
            {autoReply ? (
              <ToggleRight size={24} style={{ color: 'var(--color-warning)' }} />
            ) : (
              <ToggleLeft size={24} className="text-mission-control-text-dim" />
            )}
          </button>
        </div>
        {autoReply && (
          <div
            className="flex items-center gap-2 mt-2 p-2 rounded text-xs"
            style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}
          >
            <AlertCircle size={12} />
            Auto-reply is stubbed — no posts go out without explicit human approval.
          </div>
        )}
      </div>

      {/* Mentions list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div>Loading hot mentions...</div>
          </div>
        ) : filteredMentions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div className="text-center">
              <TrendingUp size={48} className="mx-auto mb-2 text-mission-control-text-dim" />
              <div className="text-sm">No mentions match the current filters</div>
              <div className="text-xs mt-2">
                {sentimentFilter !== 'all' ? 'Try changing the sentiment filter' : 'Try lowering the engagement thresholds'}
              </div>
            </div>
          </div>
        ) : (
          filteredMentions.map(renderMention)
        )}
      </div>

      {posting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-mission-control-surface rounded-lg p-6 text-center border border-mission-control-border">
            <div className="text-lg font-semibold mb-2 text-mission-control-text">Posting...</div>
            <div className="text-sm text-mission-control-text-dim">Sending your reply to X</div>
          </div>
        </div>
      )}

      {/* Post Confirmation Dialog */}
      <ConfirmDialog
        open={postConfirmDialog.open}
        onClose={() => {
          postConfirmDialog.closeConfirm();
          setPostNowDraftId(null);
        }}
        onConfirm={() => {
          if (postNowDraftId) {
            handlePostNow(postNowDraftId);
            setPostNowDraftId(null);
          }
        }}
        {...postConfirmDialog.config}
      />
    </div>
  );
};
