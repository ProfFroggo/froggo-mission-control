// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Mail, Plus, Trash2, Edit2, Play, RefreshCw, X, Check, Paperclip, Image as ImageIcon, Video, CalendarClock, LayoutGrid, List } from 'lucide-react';

// X logo SVG (not a LucideIcon — kept as a plain component)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const XIcon = ({ size = 16 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

import { Button, TextArea, TextField, Heading, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';
import { scheduleApi } from '../lib/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;

type ScheduledItemType = 'tweet' | 'post' | 'email' | 'message' | 'task' | 'meeting' | 'event' | 'idea';
type ScheduledItemStatus = 'pending' | 'sent' | 'cancelled' | 'failed';
type ViewMode = 'list' | 'week';

interface ScheduledItem {
  id: string;
  type: ScheduledItemType;
  content: string;
  scheduledFor: string;
  status: ScheduledItemStatus;
  createdAt: string;
  sentAt?: string;
  error?: string;
  metadata?: {
    replyTo?: string;
    recipient?: string;
    subject?: string;
    mediaPath?: string;
    mediaType?: string;
    mediaFileName?: string;
    mediaSize?: number;
  };
}

// ── Color coding per item type ───────────────────────────────────────────────
const typeStyles: Record<string, { border: string; badge: string; label: string }> = {
  post:    { border: 'border-[var(--color-info)]',    badge: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',       label: 'Post' },
  tweet:   { border: 'border-[var(--color-info)]',    badge: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',       label: 'Post' },
  task:    { border: 'border-[var(--color-warning)]', badge: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]', label: 'Task' },
  meeting: { border: 'border-[var(--color-review)]',  badge: 'bg-[var(--color-review)]-subtle text-[var(--color-review)]',   label: 'Meeting' },
  event:   { border: 'border-[var(--color-review)]',  badge: 'bg-[var(--color-review)]-subtle text-[var(--color-review)]',   label: 'Event' },
  idea:    { border: 'border-[var(--color-success)]', badge: 'bg-[var(--color-success)]/10 text-[var(--color-success)]', label: 'Idea' },
  email:   { border: 'border-[var(--color-success)]', badge: 'bg-[var(--color-success)]/10 text-[var(--color-success)]', label: 'Email' },
  message: { border: 'border-muted',   badge: 'bg-muted-subtle text-muted',     label: 'Message' },
};

function getTypeStyle(type: string) {
  return typeStyles[type] ?? { border: 'border-muted', badge: 'bg-muted-subtle text-muted', label: type };
}

// Icon per type
const typeIconMap: Record<string, AnyIcon> = {
  tweet:   XIcon,
  post:    XIcon,
  email:   Mail,
  message: Mail,
};
function getTypeIcon(type: string): AnyIcon {
  return typeIconMap[type] ?? Calendar;
}

// Icon badge color class
const typeIconColor: Record<string, string> = {
  tweet:   'text-mission-control-text bg-mission-control-text/10',
  post:    'text-mission-control-text bg-mission-control-text/10',
  email:   'text-[var(--color-success)] bg-[var(--color-success)]/10',
  message: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle',
};
function getTypeIconColor(type: string) {
  return typeIconColor[type] ?? 'text-mission-control-text-dim bg-mission-control-border/30';
}

// ── Date arithmetic (no external library) ────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function isInWeek(date: Date, weekStart: Date): boolean {
  const weekEnd = addDays(weekStart, 7);
  return date >= weekStart && date < weekEnd;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am–7pm

// ─────────────────────────────────────────────────────────────────────────────

export default function ContentScheduler() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Reschedule popover
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState('');
  const rescheduleRef = useRef<HTMLDivElement>(null);

  // Form
  const [formType, setFormType] = useState<'tweet' | 'email'>('tweet');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formSubject, setFormSubject] = useState('');

  // Media
  const [mediaFile, setMediaFile] = useState<{ path: string; fileName: string; size: number; type: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scheduleApi.getAll().catch(() => null);
      if (result?.items) {
        setItems((result.items || []) as ScheduledItem[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
    const interval = setInterval(loadSchedule, 30000);
    return () => clearInterval(interval);
  }, [loadSchedule]);

  // Close reschedule popover on outside click
  useEffect(() => {
    if (!rescheduleId) return;
    const handler = (e: MouseEvent) => {
      if (rescheduleRef.current && !rescheduleRef.current.contains(e.target as Node)) {
        setRescheduleId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [rescheduleId]);

  // ── Derived values ────────────────────────────────────────────────────────
  const currentWeekStart = getWeekStart(new Date());

  const thisWeekItems = items.filter((item) => {
    const d = new Date(item.scheduledFor);
    return isInWeek(d, currentWeekStart) && item.status === 'pending';
  });

  const filteredItems = items.filter((item) => {
    if (filter === 'all')     return true;
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'sent')    return item.status === 'sent';
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const sentCount    = items.filter((i) => i.status === 'sent').length;

  // ── Media handlers ────────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    setUploadError(null);
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime'];
    const isImage = validImageTypes.includes(file.type);
    const isVideo = validVideoTypes.includes(file.type);
    if (!isImage && !isVideo) {
      setUploadError('Invalid file type. Accepted: JPG, PNG, GIF, WEBP, MP4, MOV');
      return;
    }
    const maxSize = isImage ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError(`File too large. Max size: ${maxSize / 1024 / 1024}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaFile({ path: file.name, fileName: file.name, size: file.size, type: isImage ? 'image' : 'video' });
      if (isImage) setMediaPreview(e.target?.result as string);
      showToast('info', 'Attached', `${file.name} attached`);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formContent.trim() || !formDate || !formTime) {
      showToast('error', 'Missing fields', 'Please fill in all required fields');
      return;
    }
    const scheduledFor = new Date(`${formDate}T${formTime}`).toISOString();
    const payload = {
      type: formType,
      content: formContent,
      scheduledFor,
      metadata: {
        ...(formType === 'email' ? { recipient: formRecipient, subject: formSubject } : {}),
        ...(mediaFile ? { mediaPath: mediaFile.path, mediaFileName: mediaFile.fileName, mediaType: mediaFile.type, mediaSize: mediaFile.size } : {}),
      },
    };
    try {
      const result = editingId
        ? await fetch(`/api/schedule/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : await scheduleApi.create(payload as Record<string, unknown>).catch(() => null);

      if (result) {
        showToast('success', editingId ? 'Updated' : 'Scheduled', `Scheduled for ${new Date(scheduledFor).toLocaleString()}`);
        resetForm();
        loadSchedule();
      } else {
        showToast('error', 'Failed', 'Unknown error');
      }
    } catch (err) {
      showToast('error', 'Failed', String(err));
    }
  };

  const handleCancelItem = async (id: string) => {
    const result = await fetch(`/api/schedule/${id}`, { method: 'DELETE' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (result) {
      showToast('success', 'Cancelled', 'Scheduled item cancelled');
      loadSchedule();
    }
  };

  const handleSendNow = async (id: string) => {
    const result = await fetch(`/api/schedule/${id}/send`, { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (result) {
      showToast('success', 'Sent', 'Item sent immediately');
      loadSchedule();
    } else {
      showToast('info', 'Not available', 'Send now is not available in web mode');
    }
  };

  const handleEdit = (item: ScheduledItem) => {
    setEditingId(item.id);
    setFormType(item.type === 'email' ? 'email' : 'tweet');
    setFormContent(item.content);
    const d = new Date(item.scheduledFor);
    setFormDate(d.toISOString().split('T')[0]);
    setFormTime(d.toTimeString().slice(0, 5));
    setFormRecipient(item.metadata?.recipient ?? '');
    setFormSubject(item.metadata?.subject ?? '');
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormType('tweet');
    setFormContent('');
    setFormDate('');
    setFormTime('');
    setFormRecipient('');
    setFormSubject('');
    handleRemoveMedia();
    setUploadError(null);
  };

  // ── Reschedule ────────────────────────────────────────────────────────────
  const openReschedule = (item: ScheduledItem) => {
    const d = new Date(item.scheduledFor);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setRescheduleValue(local);
    setRescheduleId(item.id);
  };

  const handleReschedule = async () => {
    if (!rescheduleId || !rescheduleValue) return;
    const scheduledFor = new Date(rescheduleValue).toISOString();
    const result = await fetch(`/api/schedule/${rescheduleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    if (result) {
      showToast('success', 'Rescheduled', `Moved to ${new Date(scheduledFor).toLocaleString()}`);
      setRescheduleId(null);
      loadSchedule();
    } else {
      showToast('error', 'Failed', 'Could not reschedule');
    }
  };

  const formatScheduledTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now  = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0)         return 'Overdue';
    if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Week navigation ───────────────────────────────────────────────────────
  const goToPrevWeek  = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek  = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek  = () => setWeekStart(getWeekStart(new Date()));
  const isCurrentWeek = isSameDay(weekStart, getWeekStart(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekRangeLabel = (() => {
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  })();

  // Build week grid: [dayIdx 0=Mon…6=Sun][hourIdx 0=8am…11=7pm]
  const weekGrid: ScheduledItem[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: HOURS.length }, () => [])
  );
  for (const item of items) {
    const d = new Date(item.scheduledFor);
    if (!isInWeek(d, weekStart)) continue;
    const dow     = d.getDay();
    const dayIdx  = dow === 0 ? 6 : dow - 1; // Mon=0…Sun=6
    const hourIdx = d.getHours() - 8;
    if (hourIdx >= 0 && hourIdx < HOURS.length) {
      weekGrid[dayIdx][hourIdx].push(item);
    }
  }

  // ── Render: reschedule popover ────────────────────────────────────────────
  const renderReschedulePopover = (item: ScheduledItem) => {
    if (rescheduleId !== item.id) return null;
    return (
      <div
        ref={rescheduleRef}
        className="absolute right-0 top-full mt-1 z-50 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-card-lg p-3 min-w-[260px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-mission-control-text-dim mb-2">Reschedule to</p>
        <TextField.Root
          type="datetime-local"
          value={rescheduleValue}
          onChange={(e) => setRescheduleValue(e.target.value)}
          aria-label="New scheduled time"
          size="2"
          className="mb-2"
        />
        <Flex gap="2" justify="end">
          <Button
            onClick={() => setRescheduleId(null)}
            variant="outline"
            color="gray"
            size="1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!rescheduleValue}
            size="1"
          >
            Save
          </Button>
        </Flex>
      </div>
    );
  };

  // ── Render: list item card ────────────────────────────────────────────────
  const renderItemCard = (item: ScheduledItem) => {
    const isPending  = item.status === 'pending';
    const style      = getTypeStyle(item.type);
    const Icon       = getTypeIcon(item.type);
    const iconColor  = getTypeIconColor(item.type);

    return (
      <div
        key={item.id}
        className={`relative p-4 bg-mission-control-surface border border-mission-control-border border-l-4 ${style.border} rounded-xl ${
          isPending ? 'hover:border-mission-control-accent/30' : 'opacity-70'
        } transition-colors`}
      >
        <Flex align="start" gap="3">
          {/* Type icon badge */}
          <div className={`p-2 rounded-xl shrink-0 ${iconColor}`}>
            <Icon size={14} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${style.badge}`}>
                {style.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                item.status === 'pending' ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' :
                item.status === 'sent'    ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]' :
                item.status === 'failed'  ? 'bg-[var(--color-error)]/10 text-[var(--color-error)]'     :
                'bg-muted-subtle text-muted'
              }`}>
                {item.status}
              </span>
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1 tabular-nums">
                <Clock size={10} />
                {formatScheduledTime(item.scheduledFor)}
              </span>
            </div>

            <p className="text-sm line-clamp-2 mb-1">{item.content}</p>

            {item.metadata?.recipient && (
              <p className="text-xs text-mission-control-text-dim">
                To: {item.metadata.recipient}
                {item.metadata.subject && ` • ${item.metadata.subject}`}
              </p>
            )}

            {item.metadata?.mediaPath && (
              <Flex align="center" gap="1" className="text-xs text-mission-control-accent mt-1">
                {item.metadata.mediaType === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
                <span>{item.metadata.mediaFileName}</span>
              </Flex>
            )}
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex gap-1 relative shrink-0">
              <button
                onClick={() => handleSendNow(item.id)}
                title="Send now"
                aria-label="Send now"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Play size={14} />
              </button>
              <button
                onClick={() => handleEdit(item)}
                title="Edit"
                aria-label="Edit"
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
              >
                <Edit2 size={14} />
              </button>
              <div className="relative">
                <button
                  onClick={() => openReschedule(item)}
                  title="Reschedule"
                  aria-label="Reschedule"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                >
                  <CalendarClock size={14} />
                </button>
                {renderReschedulePopover(item)}
              </div>
              <button
                type="button"
                onClick={() => handleCancelItem(item.id)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
                title="Cancel"
                aria-label="Cancel"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </Flex>
      </div>
    );
  };

  // ── Render: week grid chip ────────────────────────────────────────────────
  const renderWeekChip = (item: ScheduledItem) => {
    const style = getTypeStyle(item.type);
    const time = new Date(item.scheduledFor);
    return (
      <div
        key={item.id}
        title={item.content}
        className={`flex-1 rounded-r text-[11px] pl-2 pr-1 py-0.5 border-l-2 ${style.border} bg-mission-control-accent/10 text-mission-control-accent truncate cursor-default`}
      >
        <span className="text-mission-control-text-dim/70 tabular-nums mr-1 text-[10px]">
          {time.getHours()}:{time.getMinutes().toString().padStart(2, '0')}
        </span>
        <span className="truncate">{item.content}</span>
      </div>
    );
  };

  // ── Render: week view ─────────────────────────────────────────────────────
  const renderWeekView = () => (
    <div className="flex flex-col h-full">
      {/* Week nav */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <button
          onClick={goToPrevWeek}
          aria-label="Previous week"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <Flex align="center" gap="3">
          <span className="text-sm font-medium tabular-nums">{weekRangeLabel}</span>
          {!isCurrentWeek && (
            <Button
              onClick={goToThisWeek}
              variant="outline"
              color="gray"
              size="1"
            >
              This week
            </Button>
          )}
        </Flex>
        <button
          onClick={goToNextWeek}
          aria-label="Next week"
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-mission-control-border sticky top-0 bg-mission-control-surface z-10">
            <div />
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={i}
                  className={`py-2 px-1 text-center border-l border-mission-control-border ${
                    isToday ? 'bg-mission-control-accent/5' : ''
                  }`}
                >
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-mission-control-accent' : 'text-mission-control-text-dim'}`}>
                    {DAY_NAMES[i]}
                  </div>
                  <div className="mt-0.5">
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-xs font-bold ring-2 ring-[var(--mission-control-accent)]">
                        {day.getDate()}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-mission-control-text/70">{day.getDate()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          {HOURS.map((hour, hourIdx) => (
            <div
              key={hour}
              className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-mission-control-border/40"
            >
              <div className="py-1 pr-2 text-right text-[11px] tabular-nums text-mission-control-text-dim/70 pt-1.5 select-none flex-shrink-0">
                {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
              </div>
              {weekDays.map((day, dayIdx) => {
                const isToday    = isSameDay(day, new Date());
                const cellItems  = weekGrid[dayIdx][hourIdx];
                return (
                  <div
                    key={dayIdx}
                    className={`border-l border-mission-control-border/40 p-0.5 min-h-[52px] ${
                      isToday ? 'bg-mission-control-accent/5' : ''
                    }`}
                  >
                    <div className="space-y-0.5">
                      {cellItems.map((item) => renderWeekChip(item))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render: empty state ───────────────────────────────────────────────────
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-border/30 flex items-center justify-center mb-4">
        <Calendar size={32} className="opacity-40" />
      </div>
      <p className="text-base font-medium text-mission-control-text mb-1">Nothing scheduled</p>
      <p className="text-sm text-center max-w-xs mb-6">
        {filter !== 'all'
          ? `No ${filter} items. Switch to "All" or add something new.`
          : 'Schedule posts, emails, and tasks to keep things moving.'}
      </p>
      <Button
        onClick={() => setShowForm(true)}
        size="2"
      >
        <Plus size={15} />
        Schedule something
      </Button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <Flex direction="column" height="100%">

      {/* ── Header ── */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <Flex align="center" justify="between" className="mb-3">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <Calendar size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <Flex align="center" gap="2">
                <h1 className="text-lg font-semibold">Schedule Queue</h1>
                {/* Items-this-week badge */}
                {thisWeekItems.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-info)]/10 text-[var(--color-info)] border border-[var(--color-info)]/30 font-medium tabular-nums">
                    {thisWeekItems.length} this week
                  </span>
                )}
              </Flex>
              <p className="text-xs text-mission-control-text-dim tabular-nums">
                {pendingCount} pending • {sentCount} sent
              </p>
            </div>
          </Flex>

          <Flex gap="2" align="center">
            {/* List / Week toggle */}
            <div className="flex rounded-lg border border-mission-control-border overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="List view"
                className={`p-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                }`}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('week')}
                title="Week view"
                aria-label="Week view"
                className={`p-2 transition-colors ${
                  viewMode === 'week'
                    ? 'bg-mission-control-accent/10 text-mission-control-accent'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/30'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            <Button
              onClick={loadSchedule}
              disabled={loading}
              variant="outline"
              color="gray"
              size="2"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              size="2"
            >
              <Plus size={14} />
              Schedule New
            </Button>
          </Flex>
        </Flex>

        {/* Filter pills — only in list view */}
        {viewMode === 'list' && (
          <Flex gap="2">
            {(['pending', 'sent', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                  filter === f
                    ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                    : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                <span className="tabular-nums">
                  {f === 'pending' && `Pending (${pendingCount})`}
                  {f === 'sent'    && `Sent (${sentCount})`}
                  {f === 'all'     && `All (${items.length})`}
                </span>
              </button>
            ))}
          </Flex>
        )}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="p-4 border-b border-mission-control-border bg-mission-control-bg shrink-0">
          <Flex align="center" justify="between" className="mb-3">
            <Heading size="2" weight="medium">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</Heading>
            <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={resetForm} aria-label="Close form">
              <X size={14} />
            </button>
          </Flex>

          <div className="space-y-3">
            {/* Type selector */}
            <Flex gap="2">
              {(['tweet', 'email'] as const).map((t) => {
                const Icon  = getTypeIcon(t);
                const label = t === 'tweet' ? 'Post' : 'Email';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      formType === t
                        ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                        : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </Flex>

            {formType === 'email' && (
              <div className="grid grid-cols-2 gap-3">
                <TextField.Root
                  type="text"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  placeholder="Recipient email"
                  size="2"
                  aria-label="Recipient email"
                />
                <TextField.Root
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Subject"
                  size="2"
                  aria-label="Email subject"
                />
              </div>
            )}

            <TextArea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={formType === 'tweet' ? 'What do you want to post?' : 'Email body...'}
              rows={3}
              resize="none"
              size="2"
              aria-label="Content"
            />
            {formType === 'tweet' && (
              <div className="text-xs text-mission-control-text-dim text-right tabular-nums">{formContent.length}/280</div>
            )}

            {/* Media */}
            <div className="space-y-2">
              <Flex align="center" gap="2">
                <span className="text-xs text-mission-control-text-dim">Media (optional)</span>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  color="gray"
                  size="1"
                >
                  <Paperclip size={10} />
                  {mediaFile ? 'Change' : 'Attach'}
                </Button>
              </Flex>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                onChange={handleFileInput}
                className="hidden"
              />
              {!mediaFile && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
                  aria-label="Drag and drop zone for media files"
                  className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-mission-control-accent bg-mission-control-accent/10'
                      : 'border-mission-control-border hover:border-mission-control-border/60'
                  }`}
                >
                  <p className="text-xs text-mission-control-text-dim">Drag & drop or click Attach</p>
                </div>
              )}
              {mediaFile && (
                <Flex align="center" gap="3" className="border border-mission-control-border rounded-xl p-2 bg-mission-control-surface">
                  <div className="shrink-0">
                    {mediaFile.type === 'image' && mediaPreview ? (
                      <img src={mediaPreview} alt="Preview" className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-mission-control-border rounded flex items-center justify-center">
                        {mediaFile.type === 'image'
                          ? <ImageIcon size={16} className="text-mission-control-text-dim" />
                          : <Video     size={16} className="text-mission-control-text-dim" />}
                      </div>
                    )}
                  </div>
                  <span className="text-xs flex-1 truncate">{mediaFile.fileName}</span>
                  <button type="button" className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors" onClick={handleRemoveMedia} title="Remove" aria-label="Remove media">
                    <X size={12} />
                  </button>
                </Flex>
              )}
              {uploadError && <div className="text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 px-2 py-1 rounded">{uploadError}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-mission-control-text-dim mb-1">Date</label>
                <TextField.Root
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  size="2"
                  className="w-full"
                  aria-label="Schedule date"
                />
              </div>
              <div>
                <label className="block text-xs text-mission-control-text-dim mb-1">Time</label>
                <TextField.Root
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  size="2"
                  className="w-full"
                  aria-label="Schedule time"
                />
              </div>
            </div>

            <Flex justify="end" gap="2">
              <Button
                onClick={resetForm}
                variant="outline"
                color="gray"
                size="2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formContent.trim() || !formDate || !formTime}
                size="2"
              >
                <Check size={14} />
                {editingId ? 'Update' : 'Schedule'}
              </Button>
            </Flex>
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'week' ? (
          renderWeekView()
        ) : (
          <div className="h-full overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {(() => {
                  const todayItems    = filteredItems.filter((i) => isSameDay(new Date(i.scheduledFor), new Date()));
                  const upcomingItems = filteredItems.filter((i) => !isSameDay(new Date(i.scheduledFor), new Date()));
                  return (
                    <>
                      {/* Today section — highlighted */}
                      {todayItems.length > 0 && (
                        <section className="mb-4">
                          <Flex align="center" gap="2" className="mb-2 px-1">
                            <span className="text-[10px] font-bold text-[var(--color-info)] uppercase tracking-wide">Today</span>
                            <span className="flex-1 h-px bg-[var(--color-info)]/20" />
                          </Flex>
                          <div className="rounded-xl p-3 bg-[var(--color-info)]/5 border border-[var(--color-info)]/20 space-y-2">
                            {todayItems.map((item) => renderItemCard(item))}
                          </div>
                        </section>
                      )}

                      {/* Upcoming section */}
                      {upcomingItems.length > 0 && (
                        <section className="space-y-2">
                          {todayItems.length > 0 && (
                            <Flex align="center" gap="2" className="mb-2 px-1">
                              <span className="text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wide">Upcoming</span>
                              <span className="flex-1 h-px bg-mission-control-border" />
                            </Flex>
                          )}
                          {upcomingItems.map((item) => renderItemCard(item))}
                        </section>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </Flex>
  );
}
