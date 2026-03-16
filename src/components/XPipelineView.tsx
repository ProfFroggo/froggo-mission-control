// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XPipelineView — Kanban-style content pipeline board (Ideas → Published)

import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { scheduleApi } from '../lib/api';

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
  return text.slice(0, 120) + (text.length > 120 ? '…' : '');
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
  return 'ideas';
}

function typeBadgeLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'thread': return 'Thread';
    case 'campaign': return 'Campaign';
    case 'draft': return 'Draft';
    case 'idea': return 'Idea';
    default: return 'Tweet';
  }
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
// Content Card
// ─────────────────────────────────────────────

interface CardProps {
  item: PipelineItem;
  onAction: (id: string, action: string, payload?: Record<string, unknown>) => Promise<void>;
}

function PipelineCard({ item, onAction }: CardProps) {
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
      className="relative bg-mission-control-bg-alt border border-mission-control-border rounded-lg p-3 cursor-default transition-shadow hover:shadow-md"
      style={{ opacity: acting ? 0.6 : 1 }}
    >
      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="px-1.5 py-0.5 text-xs bg-mission-control-surface text-mission-control-text-dim rounded">
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

      {/* Hover actions */}
      {hovered && (
        <div className="mt-2 pt-2 border-t border-mission-control-border flex flex-wrap gap-1.5">
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
        placeholder="Describe the content idea…"
        rows={3}
        className="w-full text-sm bg-mission-control-bg border border-mission-control-border rounded px-2 py-1 text-mission-control-text resize-none mb-2 placeholder:text-mission-control-text-dim"
      />
      <div className="flex gap-1.5">
        <button
          onClick={submit}
          disabled={saving || !text.trim()}
          className="flex-1 text-xs px-2 py-1 bg-info hover:bg-info/80 text-white rounded transition-colors disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add idea'}
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
  const weekStart = Date.now() - 7 * 86_400_000;
  // published this week comes from the counts since we filter at mapping time
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface text-xs text-mission-control-text-dim overflow-x-auto">
      <span className="text-mission-control-text font-medium whitespace-nowrap">Total: {total}</span>
      {COLUMNS.map(col => (
        <span key={col.id} className="whitespace-nowrap">
          {col.label}: <span className="text-mission-control-text font-medium">{counts[col.id]}</span>
        </span>
      ))}
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

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await scheduleApi.getAll();
      const allRaw: ScheduledItem[] = Array.isArray(raw) ? raw : [];
      // Only show social/twitter content — not meetings, events, or other scheduled items
      const SOCIAL_TYPES = new Set(['tweet', 'thread', 'post', 'campaign', 'idea', 'draft', 'social']);
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
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, action: string, payload?: Record<string, unknown>) => {
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
  };

  const handleAddIdea = async (content: string) => {
    await scheduleApi.create({
      type: 'idea',
      content,
      status: 'idea',
      scheduledFor: String(Date.now()),
    });
    await load();
  };

  const byColumn = (col: ColumnId) => items.filter(i => i.column === col);

  const counts = COLUMNS.reduce((acc, col) => {
    acc[col.id] = byColumn(col.id).length;
    return acc;
  }, {} as Record<ColumnId, number>);

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
    <div className="flex flex-col h-full bg-mission-control-bg overflow-hidden">
      {/* Stats bar */}
      <StatsBar counts={counts} total={items.length} />

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full gap-0 min-w-max">
          {COLUMNS.map((col, colIdx) => {
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
                      <PipelineCard key={item.id} item={item} onAction={handleAction} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
