// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, Mail, Plus, Trash2, Edit2, Play, RefreshCw, X, Check, Paperclip, Image as ImageIcon, Video, CalendarClock, LayoutGrid, List } from 'lucide-react';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { showToast } from './Toast';
import IconBadge from './IconBadge';
import { scheduleApi } from '../lib/api';

type ScheduledItemType = 'tweet' | 'post' | 'email' | 'message' | 'task' | 'meeting' | 'event' | 'idea';
type ScheduledItemStatus = 'pending' | 'sent' | 'cancelled' | 'failed';
type ViewMode = 'list' | 'week';

interface ScheduledItem {
  id: string;
  type: ScheduledItemType;
  content: string;
  scheduledFor: string; // ISO date
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;

// ─── Color coding per type ──────────────────────────────────────────────────
// Left border color class and badge bg/text
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

// ─── Type → icon ────────────────────────────────────────────────────────────
const typeIconMap: Record<string, AnyIcon> = {
  tweet:   XIcon,
  post:    XIcon,
  email:   Mail,
  message: Mail,
};

function getTypeIcon(type: string): AnyIcon {
  return typeIconMap[type] ?? Calendar;
}

// ─── Date arithmetic helpers ──────────────────────────────────────────────
/** Returns Monday of the ISO week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
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
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isInWeek(date: Date, weekStart: Date): boolean {
  const weekEnd = addDays(weekStart, 7);
  return date >= weekStart && date < weekEnd;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8–19

const typeConfig: Record<string, { icon: AnyIcon; color: string; label: string }> = {
  tweet:   { icon: XIcon,    color: 'text-mission-control-text bg-mission-control-text/10', label: 'Post' },
  post:    { icon: XIcon,    color: 'text-mission-control-text bg-mission-control-text/10', label: 'Post' },
  email:   { icon: Mail,     color: 'text-success bg-success-subtle',                       label: 'Email' },
  message: { icon: Mail,     color: 'text-review bg-review-subtle',                         label: 'Message' },
};

export default function ContentScheduler() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Reschedule popover state: keyed by item id
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState<string>('');
  const rescheduleRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formType, setFormType] = useState<'tweet' | 'email'>('tweet');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formSubject, setFormSubject] = useState('');

  // Media upload state
  const [mediaFile, setMediaFile] = useState<{ path: string; fileName: string; size: number; type: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scheduleApi.getAll().catch(() => null);
      if (result?.items) {
        setItems((result.items || []) as ScheduledItem[]);
      }
    } catch {
      // Schedule load error
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

  // ── Derived values ───────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentWeekStart = getWeekStart(today);

  const thisWeekItems = items.filter((item) => {
    const d = new Date(item.scheduledFor);
    return isInWeek(d, currentWeekStart) && item.status === 'pending';
  });

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'sent') return item.status === 'sent';
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const sentCount = items.filter((i) => i.status === 'sent').length;

  // ── File handlers ────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
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

  // ── CRUD ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!formContent.trim() || !formDate || !formTime) {
      showToast('error', 'Missing fields', 'Please fill in all required fields');
      return;
    }
    const scheduledFor = new Date(`${formDate}T${formTime}`).toISOString();
    try {
      const item = {
        type: formType,
        content: formContent,
        scheduledFor,
        metadata: {
          ...(formType === 'email' ? { recipient: formRecipient, subject: formSubject } : {}),
          ...(mediaFile ? { mediaPath: mediaFile.path, mediaFileName: mediaFile.fileName, mediaType: mediaFile.type, mediaSize: mediaFile.size } : {}),
        },
      };
      const result = editingId
        ? await fetch(`/api/schedule/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : await scheduleApi.create(item as Record<string, unknown>).catch(() => null);
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

  const handleCancel = async (id: string) => {
    const result = await fetch(`/api/schedule/${id}`, { method: 'DELETE' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (result) {
      showToast('success', 'Cancelled', 'Scheduled item cancelled');
      loadSchedule();
    }
  };

  const handleSendNow = async (id: string) => {
    const result = await fetch(`/api/schedule/${id}/send`, { method: 'POST' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
    const date = new Date(item.scheduledFor);
    setFormDate(date.toISOString().split('T')[0]);
    setFormTime(date.toTimeString().slice(0, 5));
    if (item.metadata) {
      setFormRecipient(item.metadata.recipient || '');
      setFormSubject(item.metadata.subject || '');
    }
    setShowForm(true);
  };

  // ── Reschedule ────────────────────────────────────────────────────────────
  const openReschedule = (item: ScheduledItem) => {
    const d = new Date(item.scheduledFor);
    // Format as YYYY-MM-DDTHH:mm for datetime-local
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

  const formatScheduledTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return 'Overdue';
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Week view navigation ─────────────────────────────────────────────────
  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekStart(getWeekStart(new Date()));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekRangeLabel = (() => {
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(weekStart)} – ${fmt(end)}`;
  })();

  // Items bucketed into week grid cells: [dayIndex][hour] = ScheduledItem[]
  const weekGrid: ScheduledItem[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: HOURS.length }, () => [])
  );
  for (const item of items) {
    const d = new Date(item.scheduledFor);
    if (!isInWeek(d, weekStart)) continue;
    const dayOfWeek = d.getDay(); // 0=Sun
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0 … Sun=6
    const hour = d.getHours();
    const hourIdx = hour - 8; // 8am = index 0
    if (hourIdx >= 0 && hourIdx < HOURS.length) {
      weekGrid[dayIdx][hourIdx].push(item);
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderReschedulePopover = (item: ScheduledItem) => {
    if (rescheduleId !== item.id) return null;
    return (
      <div
        ref={rescheduleRef}
        className="absolute right-0 top-full mt-1 z-50 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-card-lg p-3 min-w-[260px]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-mission-control-text-dim mb-2">Reschedule to</p>
        <input
          type="datetime-local"
          value={rescheduleValue}
          onChange={(e) => setRescheduleValue(e.target.value)}
          className="w-full px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm focus:outline-none focus:border-mission-control-accent mb-2"
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

  const renderItemCard = (item: ScheduledItem, compact = false) => {
    const isPending = item.status === 'pending';
    const style = getTypeStyle(item.type);
    const Icon = getTypeIcon(item.type);
    const config = typeConfig[item.type];

    if (compact) {
      // Week grid cell chip
      return (
        <div
          key={item.id}
          title={item.content}
          className={`text-xs px-1.5 py-0.5 rounded border-l-2 ${style.border} bg-mission-control-surface truncate`}
        >
          <span className="truncate block">{item.content}</span>
        </div>
      );
    }

    return (
      <div
        key={item.id}
        className={`relative p-4 bg-mission-control-surface border border-mission-control-border border-l-4 ${style.border} rounded-xl ${
          isPending ? 'hover:border-mission-control-accent/30' : 'opacity-70'
        } transition-colors`}
      >
        <div className="flex items-start gap-4">
          {config ? (
            <IconBadge icon={config.icon} size={16} color={config.color} />
          ) : (
            <div className="p-2 bg-mission-control-border/30 rounded-lg">
              <Icon size={16} className="text-mission-control-text-dim" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded ${style.badge}`}>
                {style.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                item.status === 'pending' ? 'bg-warning-subtle text-warning' :
                item.status === 'sent' ? 'bg-success-subtle text-success' :
                item.status === 'failed' ? 'bg-error-subtle text-error' :
                'bg-muted-subtle text-muted'
              }`}>
                {item.status}
              </span>
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                <Clock size={12} />
                {formatScheduledTime(item.scheduledFor)}
              </span>
            </div>

            <p className="text-sm mb-2 line-clamp-2">{item.content}</p>

            {item.metadata?.recipient && (
              <p className="text-xs text-mission-control-text-dim">
                To: {item.metadata.recipient}
                {item.metadata.subject && ` • ${item.metadata.subject}`}
              </p>
            )}

            {item.metadata?.mediaPath && (
              <div className="flex items-center gap-1 text-xs text-mission-control-accent mt-1">
                {item.metadata.mediaType === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
                <span>{item.metadata.mediaFileName}</span>
              </div>
            )}
          </div>

          {isPending && (
            <div className="flex gap-1 relative">
              <button
                onClick={() => handleSendNow(item.id)}
                className="p-2 hover:bg-success-subtle rounded-lg transition-colors"
                title="Send now"
              >
                <Play size={16} className="text-success" />
              </button>
              <button
                onClick={() => handleEdit(item)}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 size={16} className="text-mission-control-text-dim" />
              </button>
              <div className="relative">
                <button
                  onClick={() => openReschedule(item)}
                  className="p-2 hover:bg-info-subtle rounded-lg transition-colors"
                  title="Reschedule"
                >
                  <CalendarClock size={16} className="text-info" />
                </button>
                {renderReschedulePopover(item)}
              </div>
              <button
                onClick={() => handleCancel(item.id)}
                className="p-2 hover:bg-error-subtle rounded-lg transition-colors"
                title="Cancel"
              >
                <Trash2 size={16} className="text-error" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Week View ─────────────────────────────────────────────────────────────
  const renderWeekView = () => {
    const isCurrentWeek = isSameDay(weekStart, getWeekStart(new Date()));

    return (
      <div className="flex flex-col h-full">
        {/* Week nav bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface shrink-0">
          <button
            onClick={goToPrevWeek}
            className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
            aria-label="Previous week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                Today
              </button>
            )}
          </div>
          <button
            onClick={goToNextWeek}
            className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
            aria-label="Next week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-[700px]">
            {/* Day header row */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-mission-control-border sticky top-0 bg-mission-control-surface z-10">
              <div /> {/* time label col */}
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
                    <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-info' : 'text-mission-control-text'}`}>
                      {isToday ? <span className="inline-block px-1.5 py-0.5 bg-info text-white rounded-full text-xs">{day.getDate()}</span> : day.getDate()}
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
                className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-mission-control-border/50 min-h-[56px]"
              >
                {/* Time label */}
                <div className="py-1 pr-2 text-right text-xs text-mission-control-text-dim shrink-0 pt-1.5">
                  {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                </div>
                {/* Day cells */}
                {weekDays.map((day, dayIdx) => {
                  const isToday = isSameDay(day, new Date());
                  const cellItems = weekGrid[dayIdx][hourIdx];
                  return (
                    <div
                      key={dayIdx}
                      className={`border-l border-mission-control-border/50 p-0.5 min-h-[56px] ${
                        isToday ? 'bg-info/5' : ''
                      }`}
                    >
                      {cellItems.map((item) => (
                        <div key={item.id} className="mb-0.5">
                          {renderItemCard(item, true)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── Empty state ───────────────────────────────────────────────────────────
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim py-16">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-border/30 flex items-center justify-center mb-4">
        <Calendar size={32} className="opacity-40" />
      </div>
      <p className="text-base font-medium text-mission-control-text mb-1">Nothing scheduled</p>
      <p className="text-sm text-center max-w-xs mb-6">
        {filter !== 'all'
          ? `No ${filter} items. Switch to "All" or add something new.`
          : 'Schedule tweets, emails, and tasks to keep things moving.'}
      </p>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
      >
        <Plus size={16} />
        Schedule something
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
              <Calendar size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Schedule Queue</h1>
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

          <div className="flex gap-2">
            {/* View toggle */}
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
                <List size={15} />
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
                <LayoutGrid size={15} />
              </button>
            </div>

            <button
              onClick={loadSchedule}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
            >
              <Plus size={15} />
              Schedule New
            </button>
          </div>
        </div>

        {/* Filters (only shown in list view) */}
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
                {f === 'sent' && `Sent (${sentCount})`}
                {f === 'all' && `All (${items.length})`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Form */}
      {showForm && (
        <div className="p-4 border-b border-mission-control-border bg-mission-control-bg shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-mission-control-border rounded">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {(['tweet', 'email'] as const).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setFormType(t)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      formType === t
                        ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                        : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Icon size={16} />
                    {config.label}
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

            {/* Media Upload */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-mission-control-text-dim">Media (optional)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
                >
                  <Paperclip size={12} />
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
                  className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
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
                  <div className="flex-shrink-0">
                    {mediaFile.type === 'image' && mediaPreview ? (
                      <img src={mediaPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-mission-control-border rounded flex items-center justify-center">
                        {mediaFile.type === 'image' ? <ImageIcon size={20} className="text-mission-control-text-dim" /> : <Video size={20} className="text-mission-control-text-dim" />}
                      </div>
                    )}
                  </div>
                  <span className="text-xs flex-1 truncate">{mediaFile.fileName}</span>
                  <button type="button" onClick={handleRemoveMedia} className="p-1 hover:bg-error-subtle rounded transition-colors" title="Remove">
                    <X size={14} className="text-error" />
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
              <button onClick={resetForm} className="px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formContent.trim() || !formDate || !formTime}
                className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50 text-sm"
              >
                <Check size={15} />
                {editingId ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'week' ? (
          renderWeekView()
        ) : (
          <div className="h-full overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {/* Today section highlight */}
                {(() => {
                  const todayItems = filteredItems.filter((item) => isSameDay(new Date(item.scheduledFor), new Date()));
                  const otherItems = filteredItems.filter((item) => !isSameDay(new Date(item.scheduledFor), new Date()));
                  return (
                    <>
                      {todayItems.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-xs font-semibold text-info uppercase tracking-wide">Today</span>
                            <span className="flex-1 h-px bg-info/20" />
                          </div>
                          <div className={`rounded-xl p-3 bg-info/5 border border-info/20 space-y-2`}>
                            {todayItems.map((item) => renderItemCard(item))}
                          </div>
                        </div>
                      )}
                      {otherItems.length > 0 && (
                        <div className="space-y-2">
                          {todayItems.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Upcoming</span>
                              <span className="flex-1 h-px bg-mission-control-border" />
                            </div>
                          )}
                          {otherItems.map((item) => renderItemCard(item))}
                        </div>
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
