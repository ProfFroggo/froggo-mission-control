// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  Mail,
  Plus,
  Trash2,
  Edit2,
  Play,
  RefreshCw,
  X,
  Check,
  Paperclip,
  Image as ImageIcon,
  Video,
  CalendarClock,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Grid,
} from 'lucide-react';
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

type ScheduledItemType = 'tweet' | 'post' | 'email' | 'message' | 'task' | 'meeting' | 'event' | 'idea';
type ScheduledItemStatus = 'pending' | 'sent' | 'cancelled' | 'failed';
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
type ViewMode = 'list' | 'week' | 'month' | 'agenda';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;

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
  recurrence?: RecurrenceType;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyIcon = React.ComponentType<any>;

// ─── Color coding per type ──────────────────────────────────────────────────
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

// ─── Type → icon ────────────────────────────────────────────────────────────
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

// ─── Date arithmetic helpers ──────────────────────────────────────────────
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
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
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
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

// Last Friday of a month
function getLastFridayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay(); // 0=Sun, 5=Fri
  const offset = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
  return new Date(year, month, lastDay.getDate() - offset);
}

// ─── Recurrence expansion ─────────────────────────────────────────────────
/** Generate virtual occurrences of a recurring item up to 90 days from now. */
function expandRecurring(item: ScheduledItem): ScheduledItem[] {
  const rec = item.recurrence ?? 'none';
  if (rec === 'none') return [item];
  const results: ScheduledItem[] = [item];
  const origin = new Date(item.scheduledFor);
  const horizon = addDays(new Date(), 90);
  let cursor = new Date(origin);
  for (let i = 0; i < 365; i++) {
    if (rec === 'daily') {
      cursor = addDays(cursor, 1);
    } else if (rec === 'weekly') {
      cursor = addDays(cursor, 7);
    } else if (rec === 'monthly') {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, origin.getDate());
    }
    if (cursor > horizon) break;
    results.push({
      ...item,
      id: `${item.id}__virtual_${i}`,
      scheduledFor: cursor.toISOString(),
    });
  }
  return results;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8–19
const typeConfig: Record<string, { icon: AnyIcon; color: string; label: string }> = {
  tweet:   { icon: XIcon,    color: 'text-mission-control-text bg-mission-control-text/10', label: 'Post' },
  post:    { icon: XIcon,    color: 'text-mission-control-text bg-mission-control-text/10', label: 'Post' },
  email:   { icon: Mail,     color: 'text-success bg-success-subtle',                       label: 'Email' },
  message: { icon: Mail,     color: 'text-review bg-review-subtle',                         label: 'Message' },
};
// ─── Schedule Templates ───────────────────────────────────────────────────
interface ScheduleTemplate {
  label: string;
  type: 'tweet' | 'email';
  content: string;
  hour: number;
  minute: number;
  recurrence: RecurrenceType;
  /** day of week for weekly (0=Mon…6=Sun) */
  weekday?: number;
const SCHEDULE_TEMPLATES: ScheduleTemplate[] = [
  {
    label: 'Daily standup',
    type: 'tweet',
    content: 'Daily standup — team sync',
    hour: 9,
    minute: 0,
    recurrence: 'daily',
  },
    label: 'Weekly planning',
    content: 'Weekly planning session',
    hour: 10,
    recurrence: 'weekly',
    weekday: 0, // Monday
    label: 'Content review',
    content: 'Weekly content review',
    hour: 14,
    weekday: 4, // Friday
    label: 'Monthly retrospective',
    content: 'Monthly retrospective — last Friday',
    recurrence: 'monthly',
];
function getNextOccurrence(template: ScheduleTemplate): { date: string; time: string } {
  const now = new Date();
  let target = new Date(now);
  target.setHours(template.hour, template.minute, 0, 0);
  if (template.recurrence === 'weekly' && template.weekday !== undefined) {
    // Find next occurrence of the target weekday (Mon=0)
    const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1;
    let diff = template.weekday - todayIdx;
    if (diff < 0 || (diff === 0 && target <= now)) diff += 7;
    target = addDays(new Date(now), diff);
    target.setHours(template.hour, template.minute, 0, 0);
  } else if (template.recurrence === 'monthly') {
    // Last Friday of current or next month
    const lf = getLastFridayOfMonth(now.getFullYear(), now.getMonth());
    lf.setHours(template.hour, template.minute, 0, 0);
    target = lf <= now ? getLastFridayOfMonth(now.getFullYear(), now.getMonth() + 1) : lf;
  } else if (template.recurrence === 'daily') {
    if (target <= now) target = addDays(target, 1);
  return {
    date: target.toISOString().split('T')[0],
    time: `${String(template.hour).padStart(2, '0')}:${String(template.minute).padStart(2, '0')}`,
  };
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am–7pm
// ─────────────────────────────────────────────────────────────────────────────

export default function ContentScheduler() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'sent'>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Week view state
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  // Month view state
  const [monthStart, setMonthStart] = useState<Date>(() => getMonthStart(new Date()));
  // Day overflow popover
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);
  const overflowRef = useRef<HTMLDivElement>(null);
  // Reschedule popover state
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState<string>('');
  const rescheduleRef = useRef<HTMLDivElement>(null);
  // Drag-and-drop state
  const dragItemIdRef = useRef<string | null>(null);
  const dragOffsetMinRef = useRef<number>(0);
  const [dropTarget, setDropTarget] = useState<{ dayIdx: number; hourIdx: number } | null>(null);
  // Form state
  // Reschedule popover
  const [rescheduleValue, setRescheduleValue] = useState('');
  // Form
  const [formType, setFormType] = useState<'tweet' | 'email'>('tweet');
  const [formContent, setFormContent] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formRecipient, setFormRecipient] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('none');

  // Media upload state
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
      // Schedule load error
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

  // Close overflow popover on outside click
  useEffect(() => {
    if (!overflowDay) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowDay(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowDay]);

  // ── Derived values ───────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentWeekStart = getWeekStart(today);
  // Expand recurring items for display
  const allDisplayItems: ScheduledItem[] = items.flatMap(expandRecurring);
  const thisWeekItems = allDisplayItems.filter((item) => {
  // ── Derived values ────────────────────────────────────────────────────────
  const currentWeekStart = getWeekStart(new Date());
  const thisWeekItems = items.filter((item) => {
    const d = new Date(item.scheduledFor);
    return isInWeek(d, currentWeekStart) && item.status === 'pending';
  });

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending';
    if (filter === 'sent') return item.status === 'sent';
    if (filter === 'all')     return true;
    if (filter === 'sent')    return item.status === 'sent';
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const sentCount = items.filter((i) => i.status === 'sent').length;

  // ── File handlers ────────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
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

  // ── Template pre-fill ─────────────────────────────────────────────────────
  const applyTemplate = (tpl: ScheduleTemplate) => {
    const { date, time } = getNextOccurrence(tpl);
    setFormType(tpl.type);
    setFormContent(tpl.content);
    setFormDate(date);
    setFormTime(time);
    setFormRecurrence(tpl.recurrence);
    setFormRecipient('');
    setFormSubject('');
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────
  // ── CRUD ──────────────────────────────────────────────────────────────────
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
        recurrence: formRecurrence,
        metadata: {
          ...(formType === 'email' ? { recipient: formRecipient, subject: formSubject } : {}),
          ...(mediaFile ? { mediaPath: mediaFile.path, mediaFileName: mediaFile.fileName, mediaType: mediaFile.type, mediaSize: mediaFile.size } : {}),
        },
      };
      const result = editingId
        ? await fetch(`/api/schedule/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : await scheduleApi.create(item as Record<string, unknown>).catch(() => null);
    const payload = {
      type: formType,
      content: formContent,
      scheduledFor,
      metadata: {
        ...(formType === 'email' ? { recipient: formRecipient, subject: formSubject } : {}),
        ...(mediaFile ? { mediaPath: mediaFile.path, mediaFileName: mediaFile.fileName, mediaType: mediaFile.type, mediaSize: mediaFile.size } : {}),
      },
    };
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

  const handleCancel = async (id: string) => {
    const result = await fetch(`/api/schedule/${id}`, { method: 'DELETE' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
    const result = await fetch(`/api/schedule/${id}/send`, { method: 'POST' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
    // Don't edit virtual recurrence instances
    if (item.id.includes('__virtual_')) return;
    setEditingId(item.id);
    setFormType(item.type === 'email' ? 'email' : 'tweet');
    setFormContent(item.content);
    const date = new Date(item.scheduledFor);
    setFormDate(date.toISOString().split('T')[0]);
    setFormTime(date.toTimeString().slice(0, 5));
    setFormRecurrence((item.recurrence as RecurrenceType) ?? 'none');
    if (item.metadata) {
      setFormRecipient(item.metadata.recipient || '');
      setFormSubject(item.metadata.subject || '');
    }
    const d = new Date(item.scheduledFor);
    setFormDate(d.toISOString().split('T')[0]);
    setFormTime(d.toTimeString().slice(0, 5));
    setFormRecipient(item.metadata?.recipient ?? '');
    setFormSubject(item.metadata?.subject ?? '');
    setShowForm(true);
  };

  // ── Reschedule ────────────────────────────────────────────────────────────
  const openReschedule = (item: ScheduledItem) => {
    if (item.id.includes('__virtual_')) return;
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

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormType('tweet');
    setFormContent('');
    setFormDate('');
    setFormTime('');
    setFormRecipient('');
    setFormSubject('');
    setFormRecurrence('none');
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
    if (diff < 0) return 'Overdue';
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Week view navigation ─────────────────────────────────────────────────
  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekStart(getWeekStart(new Date()));
    if (diff < 0)         return 'Overdue';
    if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`;
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

  const weekGrid: ScheduledItem[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: HOURS.length }, () => [])
  );
  for (const item of allDisplayItems) {
    const d = new Date(item.scheduledFor);
    if (!isInWeek(d, weekStart)) continue;
    const dayOfWeek = d.getDay();
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const hour = d.getHours();
    const hourIdx = hour - 8;
  // Build week grid: [dayIdx 0=Mon…6=Sun][hourIdx 0=8am…11=7pm]
  for (const item of items) {
    const dow     = d.getDay();
    const dayIdx  = dow === 0 ? 6 : dow - 1; // Mon=0…Sun=6
    const hourIdx = d.getHours() - 8;
    if (hourIdx >= 0 && hourIdx < HOURS.length) {
      weekGrid[dayIdx][hourIdx].push(item);
    }
  }

  // ── Month view navigation ─────────────────────────────────────────────────
  const goToPrevMonth = () => setMonthStart((d) => addMonths(d, -1));
  const goToNextMonth = () => setMonthStart((d) => addMonths(d, 1));
  const goToThisMonth = () => setMonthStart(getMonthStart(new Date()));

  const monthLabel = `${MONTH_NAMES[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
  // Build month grid: 6 rows x 7 cols (Mon-Sun)
  const buildMonthGrid = (): Date[] => {
    const firstDay = monthStart;
    const dayOfWeek = firstDay.getDay(); // 0=Sun
    const startOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Mon=0
    const gridStart = addDays(firstDay, -startOffset);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  };
  const monthGrid = buildMonthGrid();
  const itemsForDay = (day: Date): ScheduledItem[] =>
    allDisplayItems.filter((item) => isSameDay(new Date(item.scheduledFor), day));
  // ── Drag-and-drop handlers ────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, item: ScheduledItem) => {
    // Don't drag virtual recurrence instances
    if (item.id.includes('__virtual_')) {
      e.preventDefault();
      return;
    }
    dragItemIdRef.current = item.id;
    // Calculate offset: how many minutes into the hour the item starts
    const d = new Date(item.scheduledFor);
    dragOffsetMinRef.current = d.getMinutes();
    e.dataTransfer.effectAllowed = 'move';
  const handleSlotDragOver = (e: React.DragEvent, dayIdx: number, hourIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ dayIdx, hourIdx });
  const handleSlotDragLeave = () => {
    setDropTarget(null);
  const handleSlotDrop = async (e: React.DragEvent, dayIdx: number, hourIdx: number) => {
    const itemId = dragItemIdRef.current;
    if (!itemId) return;
    dragItemIdRef.current = null;
    // Reconstruct target date from weekStart + dayIdx + hourIdx
    const targetDay = addDays(weekStart, dayIdx);
    const targetHour = HOURS[hourIdx];
    targetDay.setHours(targetHour, dragOffsetMinRef.current, 0, 0);
    const scheduledFor = targetDay.toISOString();
    const result = await fetch(`/api/schedule/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (result) {
      showToast('success', 'Rescheduled', `Moved to ${targetDay.toLocaleString()}`);
      loadSchedule();
    } else {
      showToast('error', 'Failed', 'Could not reschedule');
  // ── Render helpers ────────────────────────────────────────────────────────
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
    const isVirtual = item.id.includes('__virtual_');
    const isRecurring = (item.recurrence ?? 'none') !== 'none';

    if (compact) {
      return (
        <div
          key={item.id}
          draggable={!isVirtual}
          onDragStart={(e) => handleDragStart(e, item)}
          title={item.content}
          className={`text-xs px-1.5 py-0.5 rounded border-l-2 ${style.border} bg-mission-control-surface truncate flex items-center gap-1 ${!isVirtual ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-70'}`}
        >
          {isRecurring && <Repeat size={9} className="shrink-0 opacity-60" />}
          <span className="truncate block">{item.content}</span>
        </div>
      );
    }
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
        <div className="flex items-start gap-4">
          {config ? (
            <IconBadge icon={config.icon} size={16} color={config.color} />
          ) : (
            <div className="p-2 bg-mission-control-border/30 rounded-lg">
              <Icon size={16} className="text-mission-control-text-dim" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded ${style.badge}`}>
        <div className="flex items-start gap-3">
          {/* Type icon badge */}
          <div className={`p-2 rounded-lg shrink-0 ${iconColor}`}>
            <Icon size={14} />
          </div>
          {/* Content */}
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${style.badge}`}>
                {style.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                item.status === 'pending' ? 'bg-warning-subtle text-warning' :
                item.status === 'sent' ? 'bg-success-subtle text-success' :
                item.status === 'failed' ? 'bg-error-subtle text-error' :
                item.status === 'sent'    ? 'bg-success-subtle text-success' :
                item.status === 'failed'  ? 'bg-error-subtle text-error'     :
                'bg-muted-subtle text-muted'
              }`}>
                {item.status}
              </span>
              {isRecurring && (
                <span className="text-xs px-2 py-0.5 rounded bg-mission-control-border text-mission-control-text-dim flex items-center gap-1">
                  <Repeat size={10} />
                  {item.recurrence}
                </span>
              )}
              <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                <Clock size={12} />
                <Clock size={10} />
                {formatScheduledTime(item.scheduledFor)}
              </span>
            </div>

            <p className="text-sm mb-2 line-clamp-2">{item.content}</p>
            <p className="text-sm line-clamp-2 mb-1">{item.content}</p>

            {item.metadata?.recipient && (
              <p className="text-xs text-mission-control-text-dim">
                To: {item.metadata.recipient}
                {item.metadata.subject && ` • ${item.metadata.subject}`}
              </p>
            )}

            {item.metadata?.mediaPath && (
              <div className="flex items-center gap-1 text-xs text-mission-control-accent mt-1">
                {item.metadata.mediaType === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
                {item.metadata.mediaType === 'image' ? <ImageIcon size={10} /> : <Video size={10} />}
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
                onClick={() => handleEdit(item)}
                className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
                title="Edit"
                <Edit2 size={16} className="text-mission-control-text-dim" />
          {/* Actions */}
            <div className="flex gap-1 relative shrink-0">
                className="p-1.5 hover:bg-success-subtle rounded-lg transition-colors"
                <Play size={14} className="text-success" />
                className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
                <Edit2 size={14} className="text-mission-control-text-dim" />
              </button>
              <div className="relative">
                <button
                  onClick={() => openReschedule(item)}
                  className="p-2 hover:bg-info-subtle rounded-lg transition-colors"
                  title="Reschedule"
                >
                  <CalendarClock size={16} className="text-info" />
                  className="p-1.5 hover:bg-info-subtle rounded-lg transition-colors"
                  <CalendarClock size={14} className="text-info" />
                </button>
                {renderReschedulePopover(item)}
              </div>
              <button
                onClick={() => handleCancel(item.id)}
                className="p-2 hover:bg-error-subtle rounded-lg transition-colors"
                title="Cancel"
              >
                <Trash2 size={16} className="text-error" />
                onClick={() => handleCancelItem(item.id)}
                className="p-1.5 hover:bg-error-subtle rounded-lg transition-colors"
                <Trash2 size={14} className="text-error" />
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface shrink-0">
          <button
            onClick={goToPrevWeek}
            className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft size={16} />
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
            onClick={goToNextWeek}
            aria-label="Next week"
            <ChevronRight size={16} />
        </div>
        <div className="flex-1 overflow-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-mission-control-border sticky top-0 bg-mission-control-surface z-10">
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
                    <div className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-info' : 'text-mission-control-text'}`}>
                      {isToday ? <span className="inline-block px-1.5 py-0.5 bg-info text-white rounded-full text-xs">{day.getDate()}</span> : day.getDate()}
                    {isToday && (
                      <div className="text-xs text-info font-medium mt-0.5">Today</div>
                    )}
                  </div>
                );
              })}
            </div>
            {HOURS.map((hour, hourIdx) => (
              <div
                key={hour}
                className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-mission-control-border/50 min-h-[56px]"
                <div className="py-1 pr-2 text-right text-xs text-mission-control-text-dim shrink-0 pt-1.5">
                  {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                </div>
                {weekDays.map((day, dayIdx) => {
                  const isToday = isSameDay(day, new Date());
                  const cellItems = weekGrid[dayIdx][hourIdx];
                  const isDropTarget = dropTarget?.dayIdx === dayIdx && dropTarget?.hourIdx === hourIdx;
                  return (
                    <div
                      key={dayIdx}
                      onDragOver={(e) => handleSlotDragOver(e, dayIdx, hourIdx)}
                      onDragLeave={handleSlotDragLeave}
                      onDrop={(e) => handleSlotDrop(e, dayIdx, hourIdx)}
                      className={`border-l border-mission-control-border/50 p-0.5 min-h-[56px] transition-colors ${
                        isToday ? 'bg-info/5' : ''
                      } ${isDropTarget ? 'bg-mission-control-accent/10 border-l-2 border-mission-control-accent' : ''}`}
                    >
                      {isDropTarget && cellItems.length === 0 && (
                        <div className="h-full min-h-[40px] rounded border border-dashed border-mission-control-accent flex items-center justify-center">
                          <span className="text-xs text-mission-control-accent">Drop here</span>
                        </div>
                      )}
                      {cellItems.map((item) => (
                        <div key={item.id} className="mb-0.5">
                          {renderItemCard(item, true)}
                      ))}
                  );
                })}
              </div>
            ))}
  // ── Render: week grid chip ────────────────────────────────────────────────
  const renderWeekChip = (item: ScheduledItem) => {
    const style = getTypeStyle(item.type);
      <div
        key={item.id}
        title={item.content}
        className={`text-xs px-1.5 py-0.5 rounded border-l-2 ${style.border} bg-mission-control-surface truncate cursor-default`}
      >
        <span className="truncate block leading-4">{item.content}</span>
      </div>
    );
  };

  // ── Month View ────────────────────────────────────────────────────────────
  const renderMonthView = () => {
    const isCurrentMonth = isSameMonth(monthStart, new Date());

    return (
      <div className="flex flex-col h-full">
        {/* Month nav bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface shrink-0">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 rounded hover:bg-mission-control-border transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{monthLabel}</span>
            {!isCurrentMonth && (
              <button
                onClick={goToThisMonth}
                className="text-xs px-2 py-1 bg-mission-control-border rounded hover:bg-mission-control-border/80 transition-colors"
              >
                Today
              </button>
            )}
          </div>
            onClick={goToNextMonth}
            aria-label="Next month"
            <ChevronRight size={16} />
        </div>
        <div className="flex-1 overflow-auto">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-mission-control-border sticky top-0 bg-mission-control-surface z-10">
            {DAY_NAMES.map((name) => (
              <div key={name} className="py-2 text-center text-xs font-medium text-mission-control-text-dim border-l first:border-l-0 border-mission-control-border">
                {name}
              </div>
            ))}
          {/* 6-row grid */}
          <div className="grid grid-cols-7" style={{ gridTemplateRows: 'repeat(6, minmax(80px, 1fr))' }}>
            {monthGrid.map((day, idx) => {
              const inMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, new Date());
              const dayItems = itemsForDay(day);
              const visibleItems = dayItems.slice(0, 3);
              const overflowCount = dayItems.length - visibleItems.length;
              return (
                <div
                  key={idx}
                  className={`border-l border-b border-mission-control-border/50 p-1 min-h-[80px] relative ${
                    !inMonth ? 'opacity-40' : ''
                  } ${isToday ? 'bg-info/5' : ''} ${idx % 7 === 0 ? 'border-l-0' : ''}`}
                >
                  {/* Day number */}
                  <div className="flex items-start justify-between mb-0.5">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-info text-white'
                          : inMonth
                          ? 'text-mission-control-text'
                          : 'text-mission-control-text-dim'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  {/* Event dots / chips */}
                  <div className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const style = getTypeStyle(item.type);
                      const isRecurring = (item.recurrence ?? 'none') !== 'none';
                      return (
                        <div
                          key={item.id}
                          title={item.content}
                          className={`text-xs px-1 py-0.5 rounded border-l-2 ${style.border} bg-mission-control-surface truncate flex items-center gap-1 cursor-pointer hover:opacity-80`}
                          onClick={() => handleEdit(item)}
                        >
                          {isRecurring && <Repeat size={8} className="shrink-0 opacity-60" />}
                          <span className="truncate">{item.content}</span>
                        </div>
                      );
                    })}
                    {overflowCount > 0 && (
                      <button
                        onClick={() => setOverflowDay(day)}
                        className="text-xs text-mission-control-accent hover:underline w-full text-left px-1"
                      >
                        +{overflowCount} more
                      </button>
                    )}
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
          onClick={goToNextWeek}
          aria-label="Next week"
            <polyline points="9 18 15 12 9 6" />
      </div>
      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[640px]">
          {/* Day headers */}
          <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-mission-control-border sticky top-0 bg-mission-control-surface z-10">
            <div />
            {weekDays.map((day, i) => {
                  key={i}
                  className={`py-2 px-1 text-center border-l border-mission-control-border ${
                    isToday ? 'bg-info/5 border-t-2 border-t-info' : ''
                  }`}
                  <div className={`text-xs font-medium ${isToday ? 'text-info' : 'text-mission-control-text-dim'}`}>
                    {DAY_NAMES[i]}
                  <div className="mt-0.5">
                    {isToday ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-info text-white text-xs font-semibold">
                        {day.getDate()}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-mission-control-text">{day.getDate()}</span>
                  {isToday && (
                    <div className="text-xs text-info font-medium mt-0.5">Today</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Overflow popover */}
        {overflowDay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOverflowDay(null)}>
            <div
              ref={overflowRef}
              className="bg-mission-control-surface border border-mission-control-border rounded-xl shadow-card-lg p-4 w-80 max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  {overflowDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <button onClick={() => setOverflowDay(null)} className="p-1 hover:bg-mission-control-border rounded">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {itemsForDay(overflowDay).map((item) => {
                  const style = getTypeStyle(item.type);
                  const time = new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={item.id} className={`flex items-center gap-2 p-2 rounded border-l-2 ${style.border} bg-mission-control-bg`}>
                      <span className="text-xs text-mission-control-text-dim w-12 shrink-0">{time}</span>
                      <span className="text-xs flex-1 truncate">{item.content}</span>
                    </div>
                  );
                })}
              <button
                className="mt-3 w-full text-xs text-center py-1.5 bg-mission-control-border rounded-lg hover:bg-mission-control-border/80 transition-colors"
                onClick={() => {
                  // Switch to week view focused on the clicked day's week
                  setWeekStart(getWeekStart(overflowDay));
                  setViewMode('week');
                  setOverflowDay(null);
                }}
              >
                View week
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  // ── Agenda View ───────────────────────────────────────────────────────────
  const renderAgendaView = () => {
    const now = new Date();
    const horizon = addDays(now, 30);
    const agendaItems = allDisplayItems
      .filter((item) => {
        const d = new Date(item.scheduledFor);
        return d >= now && d <= horizon;
      })
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    // Group by day label
    const grouped: { label: string; date: Date; items: ScheduledItem[] }[] = [];
    for (const item of agendaItems) {
      const d = new Date(item.scheduledFor);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const existing = grouped.find((g) => `${g.date.getFullYear()}-${g.date.getMonth()}-${g.date.getDate()}` === dayKey);
      if (existing) {
        existing.items.push(item);
      } else {
        let label: string;
        if (isSameDay(d, now)) {
          label = 'Today';
        } else if (isSameDay(d, addDays(now, 1))) {
          label = 'Tomorrow';
        } else {
          label = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        }
        grouped.push({ label, date: d, items: [item] });
      }
    }
    if (grouped.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim py-16">
          <div className="w-16 h-16 rounded-2xl bg-mission-control-border/30 flex items-center justify-center mb-4">
            <List size={32} className="opacity-40" />
          <p className="text-base font-medium text-mission-control-text mb-1">Nothing in the next 30 days</p>
          <p className="text-sm text-center max-w-xs">Schedule something to see it here.</p>
      );
    return (
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {grouped.map(({ label, date, items: groupItems }) => {
          const isToday = isSameDay(date, now);
          return (
            <div key={label}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-info' : 'text-mission-control-text-dim'}`}>
                  {label}
                </span>
                <span className={`flex-1 h-px ${isToday ? 'bg-info/20' : 'bg-mission-control-border'}`} />
                {groupItems.length === 0 && (
                  <span className="text-xs text-mission-control-text-dim">No events today</span>
                )}
              {groupItems.length === 0 && isToday && (
                <p className="text-sm text-mission-control-text-dim px-1">No events today</p>
              )}
              <div className="space-y-2">
                {groupItems.map((item) => {
                  const Icon = getTypeIcon(item.type);
                  const isRecurring = (item.recurrence ?? 'none') !== 'none';
                  const isVirtual = item.id.includes('__virtual_');
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 bg-mission-control-surface border border-mission-control-border border-l-4 ${style.border} rounded-xl`}
                    >
                      <div className="flex items-center gap-1 text-xs text-mission-control-text-dim w-14 shrink-0">
                        <Clock size={11} />
                        <span>{time}</span>
                      </div>
                      <div className="p-1.5 bg-mission-control-border/30 rounded-lg shrink-0">
                        <Icon size={14} className="text-mission-control-text-dim" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.content}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${style.badge}`}>{style.label}</span>
                          {isRecurring && (
                            <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                              <Repeat size={10} />
                              {item.recurrence}
                            </span>
                          )}
                        </div>
                      {!isVirtual && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 hover:bg-mission-control-border rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={13} className="text-mission-control-text-dim" />
                          </button>
                            onClick={() => handleCancel(item.id)}
                            className="p-1.5 hover:bg-error-subtle rounded-lg transition-colors"
                            title="Delete"
                            <Trash2 size={13} className="text-error" />
                      )}
          );
        })}
  // ── Empty state ───────────────────────────────────────────────────────────
          {/* Hour rows */}
          {HOURS.map((hour, hourIdx) => (
              key={hour}
              className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-mission-control-border/40"
              <div className="py-1 pr-2 text-right text-xs text-mission-control-text-dim pt-1.5 select-none">
                {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
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
                );
              })}
          ))}
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
          : 'Schedule tweets, emails, and tasks to keep things moving.'}
          : 'Schedule posts, emails, and tasks to keep things moving.'}
      </p>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
      >
        <Plus size={16} />
        <Plus size={15} />
        Schedule something
      </button>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface">

      {/* ── Header ── */}
      <div className="p-4 border-b border-mission-control-border bg-mission-control-surface shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-xl">
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

          <div className="flex gap-2">
            {/* View toggle */}
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
                <List size={15} />
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
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`p-2 transition-colors ${
                  viewMode === 'month'
                    ? 'bg-mission-control-accent text-white'
                    : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
                }`}
                title="Month view"
                aria-label="Month view"
              >
                <Grid size={15} />
                onClick={() => setViewMode('agenda')}
                  viewMode === 'agenda'
                title="Agenda view"
                aria-label="Agenda view"
                <Clock size={15} />
                <LayoutGrid size={14} />
              </button>
            </div>

            <button
              onClick={loadSchedule}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors text-sm"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-3 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors"
            >
              <Plus size={15} />
              className="flex items-center gap-1.5 px-3 py-2 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent/90 transition-colors text-sm"
              <Plus size={14} />
              Schedule New
            </button>
          </div>
        </div>

        {/* Filters (only shown in list view) */}
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
                {f === 'sent' && `Sent (${sentCount})`}
                {f === 'all' && `All (${items.length})`}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-mission-control-border rounded">
              <X size={16} />
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{editingId ? 'Edit Scheduled Item' : 'Schedule New Item'}</h3>
            <button onClick={resetForm} className="p-1 hover:bg-mission-control-border rounded transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Template dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-mission-control-text-dim">Template</span>
              <select
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  if (!isNaN(idx)) applyTemplate(SCHEDULE_TEMPLATES[idx]);
                  e.target.value = '';
                }}
                defaultValue=""
                className="flex-1 px-2 py-1.5 text-xs bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                aria-label="Select a schedule template"
              >
                <option value="" disabled>Select template...</option>
                {SCHEDULE_TEMPLATES.map((tpl, i) => (
                  <option key={i} value={i}>{tpl.label}</option>
                ))}
              </select>
            </div>

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
                <span className="text-xs font-medium text-mission-control-text-dim">Media (optional)</span>
                <span className="text-xs text-mission-control-text-dim">Media (optional)</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-mission-control-border hover:bg-mission-control-border/80 rounded-lg transition-colors"
                >
                  <Paperclip size={12} />
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
                  className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
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
                  <div className="flex-shrink-0">
                    {mediaFile.type === 'image' && mediaPreview ? (
                      <img src={mediaPreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    ) : (
                      <div className="w-12 h-12 bg-mission-control-border rounded flex items-center justify-center">
                        {mediaFile.type === 'image' ? <ImageIcon size={20} className="text-mission-control-text-dim" /> : <Video size={20} className="text-mission-control-text-dim" />}
                  <div className="shrink-0">
                      <img src={mediaPreview} alt="Preview" className="w-10 h-10 object-cover rounded" />
                      <div className="w-10 h-10 bg-mission-control-border rounded flex items-center justify-center">
                        {mediaFile.type === 'image'
                          ? <ImageIcon size={16} className="text-mission-control-text-dim" />
                          : <Video     size={16} className="text-mission-control-text-dim" />}
                      </div>
                    )}
                  </div>
                  <span className="text-xs flex-1 truncate">{mediaFile.fileName}</span>
                  <button type="button" onClick={handleRemoveMedia} className="p-1 hover:bg-error-subtle rounded transition-colors" title="Remove">
                    <X size={14} className="text-error" />
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

            {/* Recurrence selector */}
            <div>
              <label className="block text-xs text-mission-control-text-dim mb-1">Recurrence</label>
              <div className="flex gap-2">
                {(['none', 'daily', 'weekly', 'monthly'] as RecurrenceType[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setFormRecurrence(r)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                      formRecurrence === r
                        ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                        : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    {r !== 'none' && <Repeat size={11} />}
                    {r === 'none' ? 'None' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors text-sm">
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
                <Check size={15} />
                <Check size={14} />
                {editingId ? 'Update' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === 'week' ? (
          renderWeekView()
        ) : viewMode === 'month' ? (
          renderMonthView()
        ) : viewMode === 'agenda' ? (
          renderAgendaView()
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
      {/* ── Content area ── */}
      <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                {(() => {
                  const todayItems = filteredItems.filter((item) => isSameDay(new Date(item.scheduledFor), new Date()));
                  const otherItems = filteredItems.filter((item) => !isSameDay(new Date(item.scheduledFor), new Date()));
                  return (
                    <>
                      {todayItems.length > 0 && (
                        <div className="mb-4">
                  const todayItems    = filteredItems.filter((i) => isSameDay(new Date(i.scheduledFor), new Date()));
                  const upcomingItems = filteredItems.filter((i) => !isSameDay(new Date(i.scheduledFor), new Date()));
                      {/* Today section — highlighted */}
                        <section className="mb-4">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <span className="text-xs font-semibold text-info uppercase tracking-wide">Today</span>
                            <span className="flex-1 h-px bg-info/20" />
                          </div>
                          <div className="rounded-xl p-3 bg-info/5 border border-info/20 space-y-2">
                            {todayItems.map((item) => renderItemCard(item))}
                          </div>
                        </div>
                      )}
                      {otherItems.length > 0 && (
                        <div className="space-y-2">
                        </section>

                      {/* Upcoming section */}
                      {upcomingItems.length > 0 && (
                        <section className="space-y-2">
                          {todayItems.length > 0 && (
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <span className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Upcoming</span>
                              <span className="flex-1 h-px bg-mission-control-border" />
                            </div>
                          )}
                          {otherItems.map((item) => renderItemCard(item))}
                        </div>
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
