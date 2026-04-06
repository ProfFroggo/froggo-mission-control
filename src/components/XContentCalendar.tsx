// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XContentCalendar — weekly 7-column grid calendar for scheduled X posts.
// Supports drag-to-reschedule (HTML5 drag API), post detail drawer,
// per-day "Schedule new post" button, and status color coding.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  X,
  Check,
  FileText,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Button, Badge, TextArea, Spinner, Flex } from '@radix-ui/themes';
import { showToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type PostStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

interface ScheduledPost {
  id: string;
  content: string;
  scheduledAt: string;
  status: PostStatus;
  platform: string;
  agentId: string | null;
  metadata: string;
  createdAt: string;
  updatedAt: string;
}

interface NewPostForm {
  content: string;
  scheduledAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function getWeekDays(weekStr: string): Date[] {
  const match = weekStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setDate(jan4.getDate() - (dayOfWeek - 1));

  const monday = new Date(weekOneMonday);
  monday.setDate(weekOneMonday.getDate() + (week - 1) * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: PostStatus): { bg: string; text: string; border: string } {
  switch (status) {
    case 'draft':
      return {
        bg: 'var(--mission-control-surface)',
        text: 'var(--mission-control-text-dim)',
        border: 'var(--mission-control-border)',
      };
    case 'scheduled':
      return {
        bg: 'var(--color-info-bg)',
        text: 'var(--color-info)',
        border: 'var(--color-info)',
      };
    case 'posted':
      return {
        bg: 'var(--color-success-bg)',
        text: 'var(--color-success)',
        border: 'var(--color-success)',
      };
    case 'failed':
      return {
        bg: 'var(--color-error-bg)',
        text: 'var(--color-error)',
        border: 'var(--color-error)',
      };
  }
}

function statusLabel(status: PostStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'scheduled': return 'Scheduled';
    case 'posted': return 'Posted';
    case 'failed': return 'Failed';
  }
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const X_CHAR_LIMIT = 280;

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: ScheduledPost;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

function PostCard({ post, onClick, onDragStart }: PostCardProps) {
  const colors = statusColor(post.status);
  const preview = post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="rounded-lg p-1.5 cursor-pointer border transition-opacity hover:opacity-90 active:scale-95"
      style={{
        background: colors.bg,
        borderColor: colors.border,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      <p className="text-[10px] font-medium truncate leading-relaxed mb-1 text-mission-control-text">
        {preview}
      </p>
      <Flex align="center" justify="between" gap="1">
        <span className="text-[10px] font-medium" style={{ color: colors.text }}>
          {statusLabel(post.status)}
        </span>
        <span className="text-[10px] text-mission-control-text-dim tabular-nums">
          {formatTime(post.scheduledAt)}
        </span>
      </Flex>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

interface DrawerProps {
  post: ScheduledPost | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: PostStatus) => void;
}

function PostDetailDrawer({ post, onClose, onDelete, onStatusChange }: DrawerProps) {
  if (!post) return null;
  const colors = statusColor(post.status);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={onClose}
    >
      <div className="flex-1" />
      <div
        className="w-96 h-full border-l border-mission-control-border overflow-y-auto shadow-xl flex flex-col bg-mission-control-bg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Flex
          align="center"
          justify="between"
          className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0"
        >
          <Flex align="center" gap="2">
            <FileText size={16} className="text-info" />
            <span className="text-sm font-semibold text-mission-control-text">
              Post Detail
            </span>
          </Flex>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </Flex>

        <div className="flex-1 p-4 space-y-4">
          {/* Status badge */}
          <Flex align="center" gap="2">
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
              style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {statusLabel(post.status)}
            </span>
            <span className="text-xs text-mission-control-text-dim">
              {new Date(post.scheduledAt).toLocaleString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </Flex>

          {/* Content */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">
              Content
            </div>
            <p className="text-sm leading-relaxed p-3 rounded-lg border border-mission-control-border bg-mission-control-surface text-mission-control-text">
              {post.content}
            </p>
            <div
              className={`text-xs mt-1 text-right ${post.content.length > X_CHAR_LIMIT ? 'text-error' : 'text-mission-control-text-dim'}`}
            >
              {post.content.length} / {X_CHAR_LIMIT}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs space-y-1 text-mission-control-text-dim">
            <div>Platform: {post.platform}</div>
            {post.agentId && <div>Agent: {post.agentId}</div>}
            <div>Created: {new Date(post.createdAt).toLocaleString()}</div>
          </div>

          {/* Status actions */}
          {post.status !== 'posted' && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">
                Change Status
              </div>
              <div className="flex flex-wrap gap-2">
                {(['draft', 'scheduled', 'posted', 'failed'] as PostStatus[])
                  .filter((s) => s !== post.status)
                  .map((s) => {
                    const colorMap: Record<PostStatus, 'gray' | 'blue' | 'grass' | 'red'> = {
                      draft: 'gray',
                      scheduled: 'blue',
                      posted: 'grass',
                      failed: 'red',
                    };
                    return (
                      <Button
                        key={s}
                        onClick={() => onStatusChange(post.id, s)}
                        variant="soft"
                        color={colorMap[s]}
                        size="1"
                      >
                        {statusLabel(s)}
                      </Button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mission-control-border">
          <Button
            onClick={() => onDelete(post.id)}
            variant="soft"
            color="red"
            size="2"
            className="w-full"
          >
            Delete Post
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── New Post Modal ───────────────────────────────────────────────────────────

interface NewPostModalProps {
  defaultDate: string;
  onSubmit: (form: NewPostForm) => Promise<void>;
  onClose: () => void;
}

function NewPostModal({ defaultDate, onSubmit, onClose }: NewPostModalProps) {
  const [content, setContent] = useState('');
  const [scheduledAt, setScheduledAt] = useState(`${defaultDate}T09:00`);
  const [submitting, setSubmitting] = useState(false);
  const overLimit = content.length > X_CHAR_LIMIT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || overLimit) return;
    setSubmitting(true);
    try {
      await onSubmit({ content: content.trim(), scheduledAt: new Date(scheduledAt).toISOString() });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-mission-control-border bg-mission-control-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Flex
          align="center"
          justify="between"
          className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0"
        >
          <Flex align="center" gap="2">
            <Plus size={16} className="text-info" />
            <span className="text-sm font-semibold text-mission-control-text">
              Schedule New Post
            </span>
          </Flex>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </Flex>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-mission-control-text-dim">
              Post Content
            </label>
            <TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="What do you want to post?"
              variant="soft"
              resize="vertical"
              color={overLimit ? 'red' : undefined}
            />
            <div
              className={`text-xs mt-1 text-right ${overLimit ? 'text-error' : 'text-mission-control-text-dim'}`}
            >
              {content.length} / {X_CHAR_LIMIT}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5 text-mission-control-text-dim">
              Scheduled Time
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            />
          </div>

          <Flex align="center" gap="2" className="pt-1">
            <Button
              type="submit"
              disabled={!content.trim() || overLimit || submitting}
              variant="solid"
              color="blue"
              size="2"
              className="flex-1"
            >
              {submitting ? <Spinner size="1" /> : null}
              {submitting ? 'Scheduling...' : 'Schedule Post'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="soft"
              color="gray"
              size="2"
            >
              Cancel
            </Button>
          </Flex>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function XContentCalendar() {
  const [currentWeek, setCurrentWeek] = useState<string>(getISOWeek(new Date()));
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [newPostDay, setNewPostDay] = useState<string | null>(null);
  const dragPostRef = useRef<ScheduledPost | null>(null);

  const weekDays = getWeekDays(currentWeek);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/schedule?week=${currentWeek}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch (err) {
      console.warn('[XContentCalendar] Non-critical:', err);
      showToast('error', 'Error', 'Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const postsForDay = (day: Date): ScheduledPost[] => {
    const key = dateKey(day);
    return posts.filter((p) => p.scheduledAt.startsWith(key));
  };

  const handlePrevWeek = () => {
    const days = getWeekDays(currentWeek);
    const firstDay = days[0];
    const prevMonday = new Date(firstDay);
    prevMonday.setDate(firstDay.getDate() - 7);
    setCurrentWeek(getISOWeek(prevMonday));
  };

  const handleNextWeek = () => {
    const days = getWeekDays(currentWeek);
    const firstDay = days[0];
    const nextMonday = new Date(firstDay);
    nextMonday.setDate(firstDay.getDate() + 7);
    setCurrentWeek(getISOWeek(nextMonday));
  };

  const handleNewPost = async (form: NewPostForm) => {
    try {
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, platform: 'x', status: 'draft' }),
      });
      if (!res.ok) throw new Error('Failed to create');
      showToast('success', 'Scheduled', 'Post added to calendar');
      await loadPosts();
    } catch (err) {
      console.warn('[XContentCalendar] Non-critical:', err);
      showToast('error', 'Error', 'Failed to schedule post');
      throw new Error('failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/social/schedule/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setPosts((prev) => prev.filter((p) => p.id !== id));
      setSelectedPost(null);
      showToast('success', 'Deleted', 'Post removed from calendar');
    } catch (err) {
      console.warn('[XContentCalendar] Non-critical:', err);
      showToast('error', 'Error', 'Failed to delete post');
    }
  };

  const handleStatusChange = async (id: string, status: PostStatus) => {
    try {
      const res = await fetch(`/api/social/schedule/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? data.post : p)));
      if (selectedPost?.id === id) setSelectedPost(data.post);
      showToast('success', 'Updated', `Status changed to ${status}`);
    } catch (err) {
      console.warn('[XContentCalendar] Non-critical:', err);
      showToast('error', 'Error', 'Failed to update status');
    }
  };

  const handleDragStart = (post: ScheduledPost) => (e: React.DragEvent) => {
    dragPostRef.current = post;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (day: Date) => {
    const post = dragPostRef.current;
    dragPostRef.current = null;
    if (!post) return;

    // Keep existing time, change date
    const existing = new Date(post.scheduledAt);
    const newDate = new Date(day);
    newDate.setHours(existing.getHours(), existing.getMinutes(), 0, 0);
    const newScheduledAt = newDate.toISOString();

    try {
      const res = await fetch(`/api/social/schedule/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt: newScheduledAt }),
      });
      if (!res.ok) throw new Error('Failed to reschedule');
      const data = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
      showToast('success', 'Rescheduled', `Moved to ${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}`);
    } catch (err) {
      console.warn('[XContentCalendar] Non-critical:', err);
      showToast('error', 'Error', 'Failed to reschedule post');
    }
  };

  const weekLabel = () => {
    const days = getWeekDays(currentWeek);
    if (days.length === 0) return currentWeek;
    const first = days[0];
    const last = days[6];
    const fmt = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${fmt(first)} — ${fmt(last)}, ${first.getFullYear()}`;
  };

  return (
    <Flex
      direction="column"
      height="100%"
      className="bg-mission-control-bg"
    >
      {/* Header */}
      <Flex
        align="center"
        justify="between"
        className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border flex-shrink-0"
      >
        <Flex align="center" gap="3">
          <Calendar size={18} className="text-info" />
          <span className="text-sm font-semibold text-mission-control-text">
            Content Calendar
          </span>
          <span className="text-sm text-mission-control-text-dim">
            {weekLabel()}
          </span>
        </Flex>
        <Flex align="center" gap="2">
          {loading && <Spinner size="1" />}
          <button
            type="button"
            onClick={loadPosts}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={handlePrevWeek}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <Button
            onClick={() => setCurrentWeek(getISOWeek(new Date()))}
            variant="soft"
            color="blue"
            size="1"
          >
            Today
          </Button>
          <button
            type="button"
            onClick={handleNextWeek}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </Flex>
      </Flex>

      {/* Status legend */}
      <Flex
        align="center"
        gap="4"
        className="px-4 py-2 border-b border-mission-control-border text-[10px] text-mission-control-text-dim"
      >
        {(['draft', 'scheduled', 'posted', 'failed'] as PostStatus[]).map((s) => {
          const c = statusColor(s);
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block border"
                style={{ background: c.bg, borderColor: c.border }}
              />
              {statusLabel(s)}
            </span>
          );
        })}
      </Flex>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-w-[700px] min-h-[400px]">
          {weekDays.map((day, idx) => {
            const dayPosts = postsForDay(day);
            const today = isToday(day);
            const key = dateKey(day);

            return (
              <div
                key={key}
                className="flex flex-col border-r border-mission-control-border last:border-r-0"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(day)}
              >
                {/* Day header */}
                <div
                  className={`p-2 border-b border-mission-control-border text-center ${today ? 'bg-info/10' : 'bg-mission-control-surface'}`}
                >
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${today ? 'text-info' : 'text-mission-control-text-dim'}`}>
                    {DAY_LABELS[idx]}
                  </div>
                  <div className={`text-sm font-semibold ${today ? 'text-info' : 'text-mission-control-text'}`}>
                    {day.getDate()}
                  </div>
                </div>

                {/* Posts */}
                <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                  {dayPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onClick={() => setSelectedPost(post)}
                      onDragStart={handleDragStart(post)}
                    />
                  ))}

                  {dayPosts.length === 0 && !loading && (
                    <div
                      className="text-xs text-center py-4 opacity-40 text-mission-control-text-dim"
                    >
                      No posts
                    </div>
                  )}
                </div>

                {/* Add button */}
                <div className="p-1.5 border-t border-mission-control-border">
                  <button
                    type="button"
                    onClick={() => setNewPostDay(key)}
                    className="inline-flex items-center justify-center gap-1 w-full px-2 py-1 rounded-md text-xs text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  >
                    <Plus size={12} />
                    Schedule
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post count summary */}
      <div className="px-4 py-2 border-t border-mission-control-border text-[10px] text-mission-control-text-dim">
        {posts.length} post{posts.length !== 1 ? 's' : ''} this week
        {' · '}
        {posts.filter((p) => p.status === 'scheduled').length} scheduled
        {' · '}
        {posts.filter((p) => p.status === 'draft').length} drafts
      </div>

      {/* Detail drawer */}
      {selectedPost && (
        <PostDetailDrawer
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* New post modal */}
      {newPostDay && (
        <NewPostModal
          defaultDate={newPostDay}
          onSubmit={handleNewPost}
          onClose={() => setNewPostDay(null)}
        />
      )}
    </Flex>
  );
}

export default XContentCalendar;
