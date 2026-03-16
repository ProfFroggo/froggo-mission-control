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
  post:    { border: 'border-info',    badge: 'bg-info-subtle text-info',       label: 'Post' },
  tweet:   { border: 'border-info',    badge: 'bg-info-subtle text-info',       label: 'Post' },
  task:    { border: 'border-warning', badge: 'bg-warning-subtle text-warning', label: 'Task' },
  meeting: { border: 'border-review',  badge: 'bg-review-subtle text-review',   label: 'Meeting' },
  event:   { border: 'border-review',  badge: 'bg-review-subtle text-review',   label: 'Event' },
  idea:    { border: 'border-success', badge: 'bg-success-subtle text-success', label: 'Idea' },
  email:   { border: 'border-success', badge: 'bg-success-subtle text-success', label: 'Email' },
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
  email:   'text-success bg-success-subtle',
  message: 'text-review bg-review-subtle',
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
        className="absolute right-0 top-full mt-1 z-50 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-card-lg p-3 min-w-[260px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-mission-control-text-dim mb-2">Reschedule to</p>
        <input
          type="datetime-local"
          value={rescheduleValue}
          onChange={(e) => setRescheduleValue(e.target.value)}
          className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent mb-2"
          aria-label="New scheduled time"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setRescheduleId(null)}
            className="px-3 py-1.5 text-xs bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReschedule}
            disabled={!rescheduleValue}
            className="px-3 py-1.5 text-xs bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
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
        className={`relative p-4 bg-mission-control-surface border border-mission-control-border border-l-4 ${style.border} rounded-lg ${
          isPending ? 'hover:border-mission-control-accent/30' : 'opacity-70'
        } transition-colors`}
      >
        <div className="flex items-start gap-3">
          {/* Type icon badge */}
          <div className={`p-2 rounded-lg shrink-0 ${iconColor}`}>
            <Icon size={14} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${style.badge}`}>
                {style.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                item.status === 'pending' ? 'bg-warning-subtle text-warning' :
                item.status === 'sent'    ? 'bg-success-subtle text-success' :
                item.status === 'failed'  ? 'bg-error-subtle text-error'     :
                'bg-muted-subtle text-muted'
              }`}>
                {item.status}
              </span>
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
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
              <div className="flex items-center gap-1 text-xs text-mission-control-accent mt-1">
                {item.metadata.mediaType === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
                <span>{item.metadata.mediaFileName}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex gap-1 relative shrink-0">
              <button
                onClick={() => handleSendNow(item.id)}
                className="p-1.5 hover:bg-success-subtle rounded-lg transition-colors"
                title="Send now"
              >
                <Play size={14} className="text-success" />
              </button>
              <button
                onClick={() => handleEdit(item)}
                className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={14} className="text-mission-control-text-dim" />
              </button>
              <div className="relative">
                <button
                  onClick={() => openReschedule(item)}
                  className="p-1.5 hover:bg-info-subtle rounded-lg transition-colors"
                  title="Reschedule"
                >
                  <CalendarClock size={14} className="text-info" />
                </button>
                {renderReschedulePopover(item)}
              </div>
              <button
                onClick={() => handleCancelItem(item.id)}
                className="p-1.5 hover:bg-error-subtle rounded-lg transition-colors"
                title="Cancel"
              >
                <Trash2 size={14} className="text-error" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render: week grid chip ────────────────────────────────────────────────
  const renderWeekChip = (item: ScheduledItem) => {
    const style = getTypeStyle(item.type);
    return (
      <div
        key={item.id}
        title={item.content}
        className={`text-xs px-1.5 py-0.5 rounded border-l-2 ${style.border} bg-mission-control-surface truncate cursor-default`}
      >
        <span className="truncate block leading-4">{item.content}</span>
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
          className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
          aria-label="Previous week"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{weekRangeLabel}</span>
          {!isCurrentWeek && (
            <button
              onClick={goToThisWeek}
              className="text-xs px-2 py-1 bg-mission-control-border rounded hover:bg-mission-control-border/80 transition-colors"
            >
              This week
            </button>
          )}
        </div>
        <button
          onClick={goToNextWeek}
          className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
          aria-label="Next week"
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
                    isToday ? 'bg-info/5 border-t-2 border-t-info' : ''
                  }`}
                >
                  <div className={`text-xs font-medium ${isToday ? 'text-info' : 'text-mission-control-text-dim'}`}>
                    {DAY_NAMES[i]}
                  </div>
                  <div className="mt-0.5">
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-info text-white text-xs font-semibold">
                        {day.getDate()}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-mission-control-text">{day.getDate()}</span>
                    )}
                  </div>
                  {isToday && (
                    <div className="text-xs text-info font-medium mt-0.5">Today</div>
                  )}
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
              <div className="py-1 pr-2 text-right text-xs text-mission-control-text-dim pt-1.5 select-none">
                {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
              </div>
              {weekDays.map((day, dayIdx) => {
                const isToday    = isSameDay(day, new Date());
                const cellItems  = weekGrid[dayIdx][hourIdx];
                return (
                  <div
                    key={dayIdx}
                    className={`border-l border-mission-control-border/40 p-0.5 min-h-[52px] ${
                      isToday ? 'bg-info/5' : ''
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
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors"
      >
        <Plus size={15} />
        Schedule something
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
              <Calendar size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Schedule Queue</h1>
                {/* Items-this-week badge */}
                {thisWeekItems.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-info-subtle text-info border border-info-border font-medium">
                    {thisWeekItems.length} this week
                  </span>
                )}
              </div>
              <p className="text-xs text-mission-control-text-dim">
                {pendingCount} pending • {sentCount} sent
              </p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {/* List / Week toggle */}
            <div className="flex rounded-lg border border-mission-control-border overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
                }`}
                title="List view"
                aria-label="List view"
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`p-2 transition-colors ${
                  viewMode === 'week'
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
                }`}
                title="Week view"
                aria-label="Week view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            <button
              onClick={loadSchedule}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-sm"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm"
            >
              <Plus size={14} />
              Schedule New
            </button>
          </div>
        </div>

        {/* Filter pills — only in list view */}
        {viewMode === 'list' && (
          <div className="flex gap-2">
            {(['pending', 'sent', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === f
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                }`}
              >
                {f === 'pending' && `Pending (${pendingCount})`}
                {f === 'sent'    && `Sent (${sentCount})`}
                {f === 'all'     && `All (${items.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="p-4 border-b border-mission-control-border bg-mission-control-bg shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-mission-control-border rounded transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {(['tweet', 'email'] as const).map((t) => {
                const Icon  = getTypeIcon(t);
                const label = t === 'tweet' ? 'Post' : 'Email';
                return (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      formType === t
                        ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                        : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>

            {formType === 'email' && (
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  placeholder="Recipient email"
                  className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                  aria-label="Recipient email"
                />
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Subject"
                  className="px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                  aria-label="Email subject"
                />
              </div>
            )}

            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={formType === 'tweet' ? 'What do you want to post?' : 'Email body...'}
              rows={3}
              className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none text-sm"
              aria-label="Content"
            />
            {formType === 'tweet' && (
              <div className="text-xs text-mission-control-text-dim text-right">{formContent.length}/280</div>
            )}

            {/* Media */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-mission-control-text-dim">Media (optional)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
                >
                  <Paperclip size={10} />
                  {mediaFile ? 'Change' : 'Attach'}
                </button>
              </div>
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
                  className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-mission-control-accent bg-mission-control-accent/10'
                      : 'border-mission-control-border hover:border-mission-control-border/60'
                  }`}
                >
                  <p className="text-xs text-mission-control-text-dim">Drag & drop or click Attach</p>
                </div>
              )}
              {mediaFile && (
                <div className="flex items-center gap-3 border border-mission-control-border rounded-lg p-2 bg-mission-control-surface">
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
                  <button type="button" onClick={handleRemoveMedia} className="p-1 hover:bg-error-subtle rounded transition-colors" title="Remove">
                    <X size={12} className="text-error" />
                  </button>
                </div>
              )}
              {uploadError && <div className="text-xs text-error bg-error-subtle px-2 py-1 rounded">{uploadError}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-mission-control-text-dim mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                  aria-label="Schedule date"
                />
              </div>
              <div>
                <label className="block text-xs text-mission-control-text-dim mb-1">Time</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full px-3 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent text-sm"
                  aria-label="Schedule time"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formContent.trim() || !formDate || !formTime}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50 text-sm"
              >
                <Check size={14} />
                {editingId ? 'Update' : 'Schedule'}
              </button>
            </div>
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
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-xs font-semibold text-info uppercase tracking-wide">Today</span>
                            <span className="flex-1 h-px bg-info/20" />
                          </div>
                          <div className="rounded-lg p-3 bg-info/5 border border-info/20 space-y-2">
                            {todayItems.map((item) => renderItemCard(item))}
                          </div>
                        </section>
                      )}

                      {/* Upcoming section */}
                      {upcomingItems.length > 0 && (
                        <section className="space-y-2">
                          {todayItems.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Upcoming</span>
                              <span className="flex-1 h-px bg-mission-control-border" />
                            </div>
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
    </div>
  );
}
