// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XPipelineView — Multi-view content pipeline (Board / Calendar / List / Campaigns)

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Lightbulb,
  Edit3,
  Clock,
  CheckCircle,
  Calendar,
  Send,
  Plus,
  Check,
  X,
  ChevronRight,
  User,
  RefreshCw,
  Columns3,
  List,
  Rocket,
  CheckCheck,
  Loader2,
  Search,
  AlertCircle,
  Heart,
  Repeat2,
  MessageCircle,
} from 'lucide-react';
import { scheduleApi, approvalApi, inboxApi } from '../lib/api';
import EpicCalendar from './EpicCalendar';
import { showToast } from './Toast';
import XCampaignView from './XCampaignView';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface ScheduledItem {
  id: string;
  type: string;
  content: string;
  scheduledFor: string;
  metadata: string;
  status: string;
  platform: string | null;
}

interface ParsedMeta {
  proposed_by?: string;
  scheduled_time?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
  };
  [key: string]: unknown;
}

interface PipelineItem extends ScheduledItem {
  parsedMeta: ParsedMeta;
  column: ColumnId;
}

type ColumnId = 'ideas' | 'drafting' | 'in-review' | 'approved' | 'scheduled' | 'published';

interface Column {
  id: ColumnId;
  label: string;
  icon: React.ReactNode;
  accent: string;
  emptyLabel: string;
}

type ViewMode = 'board' | 'calendar' | 'list' | 'campaigns';

type ListFilter = 'all' | 'ideas' | 'drafts' | 'approved' | 'rejected' | 'scheduled' | 'published';

// ─────────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────────

const COLUMNS: Column[] = [
  { id: 'ideas',     label: 'Ideas',     icon: <Lightbulb size={14} />, accent: 'var(--color-mission-control-text-dim)', emptyLabel: 'No ideas yet' },
  { id: 'drafting',  label: 'Drafting',  icon: <Edit3 size={14} />,     accent: 'var(--color-warning)',                  emptyLabel: 'Nothing drafting' },
  { id: 'in-review', label: 'In Review', icon: <Clock size={14} />,     accent: 'var(--color-info)',                     emptyLabel: 'Nothing in review' },
  { id: 'approved',  label: 'Approved',  icon: <CheckCircle size={14} />, accent: 'var(--color-success)',               emptyLabel: 'Nothing approved' },
  { id: 'scheduled', label: 'Scheduled', icon: <Calendar size={14} />,  accent: 'var(--color-purple, #a855f7)',          emptyLabel: 'Nothing scheduled' },
  { id: 'published', label: 'Published', icon: <Send size={14} />,      accent: 'var(--color-emerald, #10b981)',         emptyLabel: 'Nothing published this week' },
];

const LIST_FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'published', label: 'Published' },
];

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
  { id: 'board',     label: 'Board',     icon: <Columns3 size={14} /> },
  { id: 'calendar',  label: 'Calendar',  icon: <Calendar size={14} /> },
  { id: 'list',      label: 'List',      icon: <List size={14} /> },
  { id: 'campaigns', label: 'Campaigns', icon: <Rocket size={14} /> },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseMeta(raw: string): ParsedMeta {
  try { return JSON.parse(raw) as ParsedMeta; } catch { return {}; }
}

function relativeTime(ts: string | number): string {
  const ms = typeof ts === 'number' ? ts : Number(ts);
  if (!ms || isNaN(ms)) return '';
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ago`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ago`;
  return `${Math.floor(abs / 86_400_000)}d ago`;
}

function contentPreview(raw: string): string {
  let text = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.tweets && Array.isArray(parsed.tweets)) {
      text = parsed.tweets[0] ?? raw;
    } else if (typeof parsed === 'string') {
      text = parsed;
    }
  } catch { /* use raw */ }
  return text.slice(0, 120) + (text.length > 120 ? '...' : '');
}

function mapToColumn(item: ScheduledItem): ColumnId {
  const s = item.status?.toLowerCase() ?? '';
  const t = item.type?.toLowerCase() ?? '';
  if (s === 'idea' || t === 'idea') return 'ideas';
  if (s === 'published' || s === 'sent') return 'published';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'approved') return 'approved';
  if (s === 'pending') return 'in-review';
  if (s === 'draft') return 'drafting';
  // Plan items go to ideas by default (they appear in the board as pipeline items)
  if (t === 'plan') return 'ideas';
  return 'ideas';
}

function typeBadgeLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'thread': return 'Thread';
    case 'campaign': return 'Campaign';
    case 'draft': return 'Draft';
    case 'idea': return 'Idea';
    case 'plan': return 'Plan';
    case 'mention': return 'Mention Reply';
    default: return 'Tweet';
  }
}

function matchesListFilter(item: PipelineItem, filter: ListFilter): boolean {
  if (filter === 'all') return true;
  const s = item.status?.toLowerCase() ?? '';
  const t = item.type?.toLowerCase() ?? '';
  switch (filter) {
    case 'ideas': return s === 'idea' || t === 'idea' || t === 'plan';
    case 'drafts': return s === 'draft' || s === 'pending' || t === 'draft';
    case 'approved': return s === 'approved';
    case 'rejected': return s === 'rejected';
    case 'scheduled': return s === 'scheduled';
    case 'published': return s === 'published' || s === 'sent';
    default: return true;
  }
}

function statusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case 'approved': return 'bg-success-subtle text-success';
    case 'rejected': return 'bg-error-subtle text-error';
    case 'idea': return 'bg-info-subtle text-info';
    case 'scheduled': return 'bg-purple-500/10 text-purple-400';
    case 'published':
    case 'sent': return 'bg-emerald-500/10 text-emerald-400';
    case 'pending': return 'bg-info-subtle text-info';
    default: return 'bg-warning-subtle text-warning';
  }
}

function typeBadgeClass(type: string): string {
  switch (type?.toLowerCase()) {
    case 'plan': return 'bg-blue-500/10 text-blue-400';
    case 'thread': return 'bg-purple-500/10 text-purple-400';
    case 'campaign': return 'bg-mission-control-accent/10 text-mission-control-accent';
    case 'idea': return 'bg-info-subtle text-info';
    default: return 'bg-mission-control-surface text-mission-control-text-dim';
  }
}

// ─────────────────────────────────────────────
// Calendar event mapping (from XCalendarView)
// ─────────────────────────────────────────────

function eventColorResolver(event: CalendarEvent): string | undefined {
  const colorId = (event as unknown as { colorId?: string }).colorId || '';
  if (colorId === 'research')  return 'bg-purple-500';
  if (colorId === 'plan')      return 'bg-blue-500';
  if (colorId === 'draft')     return 'bg-amber-500';
  if (colorId === 'scheduled') return 'bg-emerald-500';
  return undefined;
}

function isEventDraggable(event: CalendarEvent): boolean {
  return (event as unknown as { colorId?: string }).colorId === 'scheduled';
}

function mapPipelineItemsToCalendarEvents(items: PipelineItem[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const item of items) {
    const t = item.type?.toLowerCase() ?? '';
    const s = item.status?.toLowerCase() ?? '';
    const ts = Number(item.scheduledFor);
    const d = !isNaN(ts) && ts > 0 ? new Date(ts) : new Date();
    const dateStr = d.toISOString().split('T')[0];

    let colorId = 'draft';
    if (t === 'idea' || s === 'idea') colorId = 'research';
    else if (t === 'plan') colorId = 'plan';
    else if (s === 'scheduled') colorId = 'scheduled';

    const preview = contentPreview(item.content);

    if (s === 'scheduled' && !isNaN(ts) && ts > 0) {
      // Scheduled items get dateTime (timed events)
      events.push({
        id: `pipeline-${item.id}`,
        summary: preview.slice(0, 60),
        description: item.content || '',
        start: { dateTime: d.toISOString() },
        end: { dateTime: new Date(d.getTime() + 3600000).toISOString() },
        colorId,
        source: 'x-pipeline' as CalendarEvent['source'],
      } as CalendarEvent);
    } else {
      // All other items are all-day events on their date
      events.push({
        id: `pipeline-${item.id}`,
        summary: `[${typeBadgeLabel(item.type)}] ${preview.slice(0, 60)}`,
        description: item.content || '',
        start: { date: dateStr },
        end: { date: dateStr },
        colorId,
        source: 'x-pipeline' as CalendarEvent['source'],
      } as CalendarEvent);
    }
  }

  return events;
}

// ─────────────────────────────────────────────
// DateTimePicker popover
// ─────────────────────────────────────────────

interface DateTimePickerProps {
  onSchedule: (iso: string) => void;
  onCancel: () => void;
}

function DateTimePicker({ onSchedule, onCancel }: DateTimePickerProps) {
  const [value, setValue] = useState(() => {
    const d = new Date(Date.now() + 3_600_000);
    return d.toISOString().slice(0, 16);
  });
  return (
    <div className="absolute z-20 bg-mission-control-surface border border-mission-control-border rounded-lg p-3 shadow-lg" style={{ top: '100%', left: 0, minWidth: 220 }}>
      <p className="text-xs text-mission-control-text-dim mb-2">Schedule for</p>
      <input
        type="datetime-local"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="w-full text-sm bg-mission-control-surface border border-mission-control-border rounded-lg px-2 py-1 text-mission-control-text mb-2 focus:outline-none focus:border-mission-control-accent"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSchedule(new Date(value).toISOString())}
          className="flex-1 text-xs px-2 py-1 bg-info hover:bg-info/80 text-white rounded transition-colors"
        >
          Schedule
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-xs px-2 py-1 bg-mission-control-bg-alt hover:bg-mission-control-border text-mission-control-text rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Detail Modal — full mention context + AI replies + reply composer
// ─────────────────────────────────────────────

function PipelineDetailModal({ item, onClose, onAction }: {
  item: PipelineItem;
  onClose: () => void;
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>;
}) {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const meta = item.parsedMeta as any;
  const isMention = item.type === 'mention' || meta.mention_reply;
  const mentionAuthor = meta.author_username || meta.mention_author || '';
  const parentTweet = meta.parent_tweet;
  const mentionType = meta.mention_type || (meta.mention_reply ? 'reply' : '');
  const isReplyToUs = meta.is_reply_to_us;
  const aiReplies = meta.ai_replies;
  const aiJudgment = meta.ai_judgment;
  const tweetId = meta.tweet_id;
  const confidence = aiJudgment?.confidence ?? aiReplies?.confidence;

  const handleSendReply = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await approvalApi.create({
        type: 'x-reply',
        tier: (confidence && confidence >= 0.9) ? 1 : 3,
        title: `Reply to @${mentionAuthor}`,
        content: text,
        metadata: {
          mentionId: item.id,
          tweetId,
          replyText: text,
          mention_author: mentionAuthor,
        },
        requester: 'user',
      });
      showToast('success', 'Sent for approval');
      onClose();
    } catch {
      showToast('error', 'Failed to queue reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-3 border-b border-mission-control-border bg-mission-control-surface rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-xs rounded ${typeBadgeClass(item.type)}`}>
              {typeBadgeLabel(item.type)}
            </span>
            {mentionType && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                mentionType === 'reply'
                  ? isReplyToUs ? 'bg-success-subtle text-success' : 'bg-info-subtle text-info'
                  : mentionType === 'quote' ? 'bg-warning-subtle text-warning'
                  : 'bg-mission-control-surface text-mission-control-text-dim border border-mission-control-border'
              }`}>
                {mentionType === 'reply'
                  ? isReplyToUs ? 'Reply to you' : 'Reply (tagged)'
                  : mentionType === 'quote' ? 'Quote tweet' : 'Mention'}
              </span>
            )}
            {confidence != null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                confidence >= 0.8 ? 'bg-success-subtle text-success'
                : confidence >= 0.5 ? 'bg-info-subtle text-info'
                : 'bg-warning-subtle text-warning'
              }`}>{Math.round(confidence * 100)}%</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded-lg hover:bg-mission-control-bg-alt">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Author */}
          {mentionAuthor && (
            <div className="flex items-center gap-2">
              <div className="font-medium text-mission-control-text">@{mentionAuthor}</div>
              {meta.author_followers != null && (
                <span className="text-xs text-mission-control-text-dim">{meta.author_followers.toLocaleString()} followers</span>
              )}
              {tweetId && (
                <a href={`https://twitter.com/${mentionAuthor}/status/${tweetId}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs text-info hover:underline">
                  View on X
                </a>
              )}
            </div>
          )}

          {/* Parent tweet context */}
          {parentTweet?.text && (
            <div className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface text-sm">
              <div className="text-xs text-mission-control-text-dim mb-1 flex items-center gap-1">
                <MessageCircle size={10} />
                Replying to {parentTweet.author?.username ? `@${parentTweet.author.username}` : 'original post'}
              </div>
              <div className="text-mission-control-text">{parentTweet.text}</div>
            </div>
          )}

          {/* Full content */}
          <div className="text-sm text-mission-control-text whitespace-pre-wrap leading-relaxed bg-mission-control-surface p-4 rounded-xl border border-mission-control-border">
            {item.content}
          </div>

          {/* AI Judgment */}
          {aiJudgment && (
            <div className="text-xs text-mission-control-text-dim bg-mission-control-surface p-3 rounded-lg border border-mission-control-border">
              <div className="font-medium text-mission-control-text mb-1">AI Assessment</div>
              <div>{aiJudgment.triage_reason}</div>
              {aiJudgment.safety_flags?.length > 0 && (
                <div className="mt-1 text-error">Safety flags: {aiJudgment.safety_flags.join(', ')}</div>
              )}
            </div>
          )}

          {/* AI Reply Options */}
          {aiReplies?.replies?.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-mission-control-text-dim">AI-Suggested Replies</div>
              {aiReplies.replies.map((reply: string, idx: number) => {
                const isRec = idx === (aiReplies.recommended ?? 0);
                return (
                  <button
                    key={idx}
                    onClick={() => setReplyText(reply)}
                    className={`w-full text-left px-4 py-3 text-sm rounded-xl border transition-colors ${
                      isRec
                        ? 'border-info bg-info-subtle/40 hover:bg-info-subtle/60'
                        : 'border-mission-control-border bg-mission-control-surface hover:border-info'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isRec && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-info text-white flex-shrink-0">BEST</span>}
                      <span className="text-mission-control-text">{reply}</span>
                    </div>
                  </button>
                );
              })}
              {aiReplies.reasoning && (
                <div className="text-[11px] text-mission-control-text-dim italic px-1">{aiReplies.reasoning}</div>
              )}
            </div>
          )}

          {/* Reply composer */}
          {isMention && (
            <div className="space-y-2 pt-2 border-t border-mission-control-border">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write or edit your reply..."
                className="w-full px-4 py-3 text-sm border border-mission-control-border rounded-xl resize-none bg-mission-control-bg text-mission-control-text focus:outline-none focus:ring-2 focus:ring-info"
                rows={3}
                maxLength={280}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-mission-control-text-dim">{replyText.length}/280</span>
                <div className="flex gap-2">
                  <button onClick={onClose} className="px-4 py-2 text-sm border border-mission-control-border rounded-lg text-mission-control-text hover:bg-mission-control-surface">
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSendReply(replyText)}
                    disabled={!replyText.trim() || replyText.length > 280 || sending}
                    className="px-4 py-2 text-sm bg-info text-white rounded-lg hover:bg-info/80 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send size={14} />
                    {sending ? 'Sending...' : 'Send for Approval'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Non-mention actions */}
          {!isMention && (
            <div className="flex gap-2 pt-2 border-t border-mission-control-border">
              {item.column === 'in-review' && (
                <>
                  <button onClick={() => { onAction(item.id, 'approve'); onClose(); }} className="flex-1 py-2 text-sm bg-success/10 text-success rounded-lg hover:bg-success/20 flex items-center justify-center gap-1.5">
                    <Check size={14} /> Approve
                  </button>
                  <button onClick={() => { onAction(item.id, 'reject'); onClose(); }} className="flex-1 py-2 text-sm bg-error/10 text-error rounded-lg hover:bg-error/20 flex items-center justify-center gap-1.5">
                    <X size={14} /> Reject
                  </button>
                </>
              )}
              {item.column === 'ideas' && (
                <button onClick={() => { onAction(item.id, 'draft'); onClose(); }} className="flex-1 py-2 text-sm bg-warning/10 text-warning rounded-lg hover:bg-warning/20 flex items-center justify-center gap-1.5">
                  <Edit3 size={14} /> Move to Drafting
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Content Card (Board view)
// ─────────────────────────────────────────────

interface CardProps {
  item: PipelineItem;
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>;
  hasPendingApproval?: boolean;
}

function PipelineCard({ item, onAction, hasPendingApproval, onSelect }: CardProps & { onSelect?: (item: PipelineItem) => void }) {
  const [hovered, setHovered] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [acting, setActing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const preview = contentPreview(item.content);
  const badgeLabel = typeBadgeLabel(item.type);
  const proposedBy = item.parsedMeta.proposed_by;
  const ts = relativeTime(Number(item.scheduledFor));

  const doAction = async (action: string, payload?: Record<string, unknown>) => {
    setActing(true);
    try { await onAction(item.id, action, payload); } finally { setActing(false); }
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowDatePicker(false); }}
      onClick={() => onSelect?.(item)}
      className="relative bg-mission-control-bg-alt border border-mission-control-border rounded-lg p-3 cursor-pointer transition-shadow hover:shadow-md"
      style={{ opacity: acting ? 0.6 : 1 }}
    >
      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`px-1.5 py-0.5 text-xs rounded ${typeBadgeClass(item.type)}`}>
          {badgeLabel}
        </span>
        {item.platform && (
          <span className="px-1.5 py-0.5 text-xs bg-info-subtle text-info rounded">{item.platform}</span>
        )}
      </div>

      {/* Content preview */}
      <p className="text-sm text-mission-control-text leading-relaxed mb-2">{preview}</p>

      {/* Footer: agent + time */}
      <div className="flex items-center gap-2 text-xs text-mission-control-text-dim">
        {proposedBy && (
          <span className="flex items-center gap-1">
            <User size={10} />
            {proposedBy}
          </span>
        )}
        {ts && <span>{ts}</span>}
      </div>

      {/* Pending approval indicator */}
      {hasPendingApproval && (item.column === 'in-review' || item.column === 'approved') && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-info">
          <Clock size={10} />
          Pending approval
        </div>
      )}

      {/* Published metrics */}
      {item.column === 'published' && item.parsedMeta.public_metrics && (
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-mission-control-text-dim">
          {item.parsedMeta.public_metrics.like_count != null && (
            <span className="flex items-center gap-0.5"><Heart size={9} /> {item.parsedMeta.public_metrics.like_count}</span>
          )}
          {item.parsedMeta.public_metrics.retweet_count != null && (
            <span className="flex items-center gap-0.5"><Repeat2 size={9} /> {item.parsedMeta.public_metrics.retweet_count}</span>
          )}
          {item.parsedMeta.public_metrics.reply_count != null && (
            <span className="flex items-center gap-0.5"><MessageCircle size={9} /> {item.parsedMeta.public_metrics.reply_count}</span>
          )}
        </div>
      )}

      {/* Hover actions — stopPropagation so clicks don't open modal */}
      {hovered && (
        <div className="mt-2 pt-2 border-t border-mission-control-border flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
          {item.column === 'ideas' && (
            <button
              onClick={() => doAction('draft')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-warning-subtle text-warning rounded hover:bg-warning/20 transition-colors"
            >
              <Edit3 size={10} /> Draft
            </button>
          )}
          {item.column === 'drafting' && (
            <button
              onClick={() => doAction('submit')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-info-subtle text-info rounded hover:bg-info/20 transition-colors"
            >
              <ChevronRight size={10} /> Submit for review
            </button>
          )}
          {item.column === 'in-review' && (
            <>
              <button
                onClick={() => doAction('approve')}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-success-subtle text-success rounded hover:bg-success/20 transition-colors"
              >
                <Check size={10} /> Approve
              </button>
              <button
                onClick={() => doAction('reject')}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-error-subtle text-error rounded hover:bg-error/20 transition-colors"
              >
                <X size={10} /> Reject
              </button>
            </>
          )}
          {item.column === 'approved' && (
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(v => !v)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-surface text-mission-control-text-dim rounded hover:text-mission-control-text transition-colors"
              >
                <Calendar size={10} /> Schedule
              </button>
              {showDatePicker && (
                <DateTimePicker
                  onSchedule={iso => { setShowDatePicker(false); doAction('schedule', { scheduledTime: iso }); }}
                  onCancel={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}
          {item.column === 'scheduled' && (
            <button
              onClick={() => doAction('publish')}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors"
            >
              <Send size={10} /> Publish now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Quick add idea form
// ─────────────────────────────────────────────

interface QuickAddProps {
  onAdd: (content: string) => Promise<void>;
}

function QuickAddIdea({ onAdd }: QuickAddProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onAdd(text.trim());
      setText('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-mission-control-text-dim hover:text-mission-control-text border border-dashed border-mission-control-border rounded-lg transition-colors"
      >
        <Plus size={12} /> New idea
      </button>
    );
  }

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-2">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Describe the content idea..."
        rows={3}
        className="w-full text-sm bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-mission-control-text resize-none mb-2 placeholder:text-mission-control-text-dim"
      />
      <div className="flex gap-1.5">
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex-1 text-xs px-2 py-1 bg-info hover:bg-info/80 text-white rounded transition-colors disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add idea'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-2 py-1 text-xs bg-mission-control-bg-alt hover:bg-mission-control-border text-mission-control-text rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Stats bar
// ─────────────────────────────────────────────

interface StatsBarProps {
  counts: Record<ColumnId, number>;
  total: number;
}

function StatsBar({ counts, total }: StatsBarProps) {
  const needsAction = (counts['in-review'] || 0) + (counts['ideas'] || 0);
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface text-xs text-mission-control-text-dim overflow-x-auto">
      <span className="text-mission-control-text font-medium whitespace-nowrap">Total: {total}</span>
      {COLUMNS.map(col => (
        <span key={col.id} className="whitespace-nowrap">
          {col.label}: <span className="text-mission-control-text font-medium">{counts[col.id]}</span>
        </span>
      ))}
      {needsAction > 0 && (
        <span className="whitespace-nowrap flex items-center gap-1 text-warning font-medium">
          <AlertCircle size={11} /> Needs action: {needsAction}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// View Mode Toggle
// ─────────────────────────────────────────────

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface">
      {VIEW_MODES.map(mode => (
        <button
          key={mode.id}
          onClick={() => onChange(mode.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            viewMode === mode.id
              ? 'bg-info-subtle text-info'
              : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
          }`}
        >
          {mode.icon}
          {mode.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// List View (inline)
// ─────────────────────────────────────────────

interface ListViewProps {
  items: PipelineItem[];
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>;
}

function PipelineListView({ items, onAction }: ListViewProps) {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvingAll, setApprovingAll] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showDatePickerFor, setShowDatePickerFor] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = items.filter(i => matchesListFilter(i, filter));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.content.toLowerCase().includes(q) ||
        (i.parsedMeta.proposed_by || '').toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
      );
    }
    // Sort by date (newest first)
    return result.sort((a, b) => Number(b.scheduledFor) - Number(a.scheduledFor));
  }, [items, filter, searchQuery]);

  const pendingItems = items.filter(i => i.status === 'pending' || (i.status === 'draft' && i.type !== 'idea'));

  const doAction = async (id: string, action: string, payload?: Record<string, unknown>) => {
    setActionLoadingId(id);
    try {
      await onAction(id, action, payload);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingItems.length === 0) return;
    setApprovingAll(true);
    let approved = 0;
    for (const item of pendingItems) {
      try {
        await approvalApi.respond(item.id, 'approve');
        approved++;
      } catch {
        // continue on individual failures
      }
    }
    // Trigger a reload via parent action
    if (approved > 0) {
      await onAction(pendingItems[0].id, 'noop');
    }
    setApprovingAll(false);
    showToast('success', `Approved ${approved} item${approved !== 1 ? 's' : ''}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter pills + search + bulk actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-mission-control-border flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {LIST_FILTERS.map(f => {
            const count = f.id === 'all' ? items.length : items.filter(i => matchesListFilter(i, f.id)).length;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  filter === f.id
                    ? 'bg-info-subtle text-info font-medium'
                    : 'bg-mission-control-bg-alt text-mission-control-text-dim hover:text-mission-control-text border border-mission-control-border'
                }`}
              >
                {f.label}
                {count > 0 && (
                  <span className={`text-xs ${filter === f.id ? 'text-info/70' : 'text-mission-control-text-dim'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {pendingItems.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={approvingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-success-subtle text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {approvingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
            Approve all ({pendingItems.length})
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="px-4 py-2 border-b border-mission-control-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search content..."
            className="w-full text-sm bg-mission-control-bg-alt border border-mission-control-border rounded-lg pl-9 pr-3 py-1.5 text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent"
          />
        </div>
      </div>

      {/* List rows */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mission-control-text-dim">
            <List size={48} className="mx-auto mb-3 text-mission-control-text-dim" />
            <p className="font-medium text-mission-control-text">
              {filter === 'all' ? 'No pipeline items yet' : `No ${filter} items`}
            </p>
            <p className="text-sm mt-1">
              {searchQuery ? 'Try a different search.' : 'Items will appear here as they are created.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-mission-control-border">
            {filtered.map(item => {
              const preview = contentPreview(item.content);
              const proposedBy = item.parsedMeta.proposed_by;
              const ts = relativeTime(Number(item.scheduledFor));
              const isLoading = actionLoadingId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-mission-control-bg-alt/50 transition-colors"
                >
                  {/* Content preview */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-mission-control-text truncate leading-relaxed">{preview}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {proposedBy && (
                        <span className="flex items-center gap-1 text-xs text-mission-control-text-dim">
                          <User size={10} />
                          {proposedBy}
                        </span>
                      )}
                      {ts && <span className="text-xs text-mission-control-text-dim">{ts}</span>}
                    </div>
                  </div>

                  {/* Type badge */}
                  <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${typeBadgeClass(item.type)}`}>
                    {typeBadgeLabel(item.type)}
                  </span>

                  {/* Status badge */}
                  <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${statusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0 relative">
                    {item.column === 'ideas' && (
                      <button
                        onClick={() => doAction(item.id, 'draft')}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-warning-subtle text-warning rounded hover:bg-warning/20 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Edit3 size={10} />} Draft
                      </button>
                    )}
                    {item.column === 'drafting' && (
                      <button
                        onClick={() => doAction(item.id, 'submit')}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-info-subtle text-info rounded hover:bg-info/20 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />} Submit
                      </button>
                    )}
                    {item.column === 'in-review' && (
                      <>
                        <button
                          onClick={() => doAction(item.id, 'approve')}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-success-subtle text-success rounded hover:bg-success/20 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Approve
                        </button>
                        <button
                          onClick={() => doAction(item.id, 'reject')}
                          disabled={isLoading}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-error-subtle text-error rounded hover:bg-error/20 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />} Reject
                        </button>
                      </>
                    )}
                    {item.column === 'approved' && (
                      <div className="relative">
                        <button
                          onClick={() => setShowDatePickerFor(showDatePickerFor === item.id ? null : item.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-surface text-mission-control-text-dim rounded hover:text-mission-control-text transition-colors"
                        >
                          <Calendar size={10} /> Schedule
                        </button>
                        {showDatePickerFor === item.id && (
                          <DateTimePicker
                            onSchedule={iso => { setShowDatePickerFor(null); doAction(item.id, 'schedule', { scheduledTime: iso }); }}
                            onCancel={() => setShowDatePickerFor(null)}
                          />
                        )}
                      </div>
                    )}
                    {item.column === 'scheduled' && (
                      <button
                        onClick={() => doAction(item.id, 'publish')}
                        disabled={isLoading}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />} Publish
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Floating Quick Compose
// ─────────────────────────────────────────────

interface FloatingQuickComposeProps {
  onAdd: (content: string) => Promise<void>;
  onClose: () => void;
}

function FloatingQuickCompose({ onAdd, onClose }: FloatingQuickComposeProps) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await onAdd(text.trim());
      setText('');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-72 bg-mission-control-surface border border-mission-control-border rounded-lg p-3 shadow-lg">
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); if (e.key === 'Escape') onClose(); }}
        placeholder="Quick idea..."
        rows={3}
        className="w-full text-sm bg-mission-control-bg border border-mission-control-border rounded px-2 py-1.5 text-mission-control-text resize-none mb-2 placeholder:text-mission-control-text-dim focus:outline-none focus:border-info"
      />
      <div className="flex gap-1.5">
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex-1 text-xs px-2 py-1.5 bg-info hover:bg-info/80 text-white rounded transition-colors disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add idea'}
        </button>
        <button
          onClick={onClose}
          className="px-2 py-1.5 text-xs bg-mission-control-bg-alt hover:bg-mission-control-border text-mission-control-text rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function XPipelineView() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [pendingApprovalIds, setPendingApprovalIds] = useState<Set<string>>(new Set());
  const [showQuickCompose, setShowQuickCompose] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PipelineItem | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await scheduleApi.getAll();
      const allRaw: ScheduledItem[] = Array.isArray(raw) ? raw : [];
      // Only show social/twitter content — not meetings, events, or other scheduled items
      const SOCIAL_TYPES = new Set(['tweet', 'thread', 'post', 'campaign', 'idea', 'draft', 'social', 'plan', 'mention']);
      const all = allRaw.filter(item =>
        item.platform === 'twitter' || item.platform === 'x' ||
        SOCIAL_TYPES.has(item.type?.toLowerCase() || '') ||
        SOCIAL_TYPES.has(item.status?.toLowerCase() || '')
      );
      const mapped: PipelineItem[] = all.map(item => ({
        ...item,
        parsedMeta: parseMeta(item.metadata),
        column: mapToColumn(item),
      }));
      setItems(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Load pending approvals for pipeline items
  const loadApprovals = useCallback(async () => {
    try {
      const pending = await approvalApi.getAll('pending');
      const ids = new Set<string>();
      for (const a of (Array.isArray(pending) ? pending : [])) {
        if (a.payload?.itemId) ids.add(String(a.payload.itemId));
        // Also match by title or description containing the item id
        if (a.payload?.scheduleId) ids.add(String(a.payload.scheduleId));
      }
      setPendingApprovalIds(ids);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadApprovals(); }, [loadApprovals]);

  const handleAction = useCallback(async (id: string, action: string, payload?: Record<string, unknown>) => {
    if (action === 'noop') {
      await load();
      return;
    }
    const actionMap: Record<string, { status?: string; type?: string; metadata?: Record<string, unknown>; scheduledFor?: string }> = {
      draft:   { status: 'draft',     type: 'draft' },
      submit:  { status: 'pending' },
      approve: { status: 'approved' },
      reject:  { status: 'draft' },
      schedule: {
        status: 'scheduled',
        scheduledFor: payload?.scheduledTime as string,
        metadata: { scheduled_time: payload?.scheduledTime },
      },
      publish: { status: 'published' },
    };
    const update = actionMap[action];
    if (!update) return;
    const body: Record<string, unknown> = {};
    if (update.status) body.status = update.status;
    if (update.type) body.type = update.type;
    if (update.scheduledFor) body.scheduledFor = String(new Date(update.scheduledFor).getTime());
    if (update.metadata) body.metadata = update.metadata;
    await scheduleApi.update(id, body);
    await load();
  }, [load]);

  const handleAddIdea = useCallback(async (content: string) => {
    await scheduleApi.create({
      type: 'idea',
      content,
      status: 'idea',
      scheduledFor: String(Date.now()),
    });
    await load();
  }, [load]);

  const byColumn = useCallback((col: ColumnId) => items.filter(i => i.column === col), [items]);

  const counts = useMemo(() => COLUMNS.reduce((acc, col) => {
    acc[col.id] = byColumn(col.id).length;
    return acc;
  }, {} as Record<ColumnId, number>), [byColumn]);

  // Calendar events derived from pipeline items
  const calendarEvents = useMemo(() => mapPipelineItemsToCalendarEvents(items), [items]);

  const handleCalendarCreateTweet = useCallback(() => {
    window.dispatchEvent(new CustomEvent('x-tab-change', { detail: 'pipeline' }));
  }, []);

  const handleCalendarExternalDrop = useCallback(async (
    _event: CalendarEvent,
    _newStart: Date,
    _newEnd: Date,
  ): Promise<boolean> => {
    await load();
    return false;
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-mission-control-bg gap-3">
        <p className="text-error text-sm">{error}</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg hover:bg-mission-control-bg-alt transition-colors text-mission-control-text"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-mission-control-bg overflow-hidden">
      {/* Stats bar */}
      <StatsBar counts={counts} total={items.length} />

      {/* View mode toggle */}
      <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />

      {/* View content */}
      {viewMode === 'board' && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-0 min-w-max">
            {COLUMNS.map((col) => {
              const colItems = byColumn(col.id);
              return (
                <div
                  key={col.id}
                  className="flex flex-col w-64 flex-shrink-0 border-r border-mission-control-border last:border-r-0"
                  style={{ height: '100%' }}
                >
                  {/* Column accent + header */}
                  <div style={{ height: 3, background: col.accent }} />
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-mission-control-border bg-mission-control-surface">
                    <div className="flex items-center gap-1.5 text-mission-control-text-dim">
                      {col.icon}
                      <span className="text-xs font-medium text-mission-control-text">{col.label}</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-xs bg-mission-control-bg text-mission-control-text-dim rounded-full min-w-[20px] text-center">
                      {colItems.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {/* Quick add — only in Ideas column, at top */}
                    {col.id === 'ideas' && (
                      <QuickAddIdea onAdd={handleAddIdea} />
                    )}

                    {colItems.length === 0 && col.id !== 'ideas' ? (
                      <p className="text-xs text-mission-control-text-dim text-center mt-6 px-2">{col.emptyLabel}</p>
                    ) : (
                      colItems.map(item => (
                        <PipelineCard key={item.id} item={item} onAction={handleAction} hasPendingApproval={pendingApprovalIds.has(item.id)} onSelect={setSelectedItem} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-hidden">
          <EpicCalendar
            externalEvents={calendarEvents}
            createButtonLabel="Create Tweet"
            onCreateClick={handleCalendarCreateTweet}
            onExternalDrop={handleCalendarExternalDrop}
            eventColorResolver={eventColorResolver}
            isEventDraggable={isEventDraggable}
          />
        </div>
      )}

      {viewMode === 'list' && (
        <div className="flex-1 overflow-hidden">
          <PipelineListView items={items} onAction={handleAction} />
        </div>
      )}

      {viewMode === 'campaigns' && (
        <div className="flex-1 overflow-hidden">
          <XCampaignView />
        </div>
      )}

      {/* Floating quick-compose button + panel */}
      <div className="absolute bottom-4 right-4 z-30">
        {showQuickCompose ? (
          <FloatingQuickCompose
            onAdd={handleAddIdea}
            onClose={() => setShowQuickCompose(false)}
          />
        ) : (
          <button
            onClick={() => setShowQuickCompose(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-info hover:bg-info/80 text-white shadow-lg transition-colors"
            title="Quick add idea"
          >
            <Plus size={20} />
          </button>
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <PipelineDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAction={async (id, action, payload) => {
            await handleAction(id, action, payload);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
