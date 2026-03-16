import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Image, Calendar, Clock, X, Lightbulb } from 'lucide-react';
import { approvalApi, scheduleApi } from '../lib/api';
import { showToast } from './Toast';

type PostMode = 'single' | 'thread';

interface RateLimit {
  remaining: number;
  used: number;
  limit: number;
  resetAt: number | null;
}

interface PostResult {
  success: boolean;
  tweetId?: string;
  threadIds?: string[];
  tweets?: Array<{ id: string; text: string }>;
  error?: string;
}

interface ScheduledPost {
  id: string;
  content: string;
  scheduled_time: number;
  status: string;
  media_id?: string | null;
  metadata?: string | null;
}

const TWEET_CHAR_LIMIT = 280;
const MAX_THREAD_TWEETS = 10;
const DRAFT_KEY = 'x-compose-draft';
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Count characters accounting for t.co URL wrapping.
 * X wraps all URLs to 23 characters regardless of actual length.
 */
function countChars(text: string): number {
  const urlRegex = /https?:\/\/\S+/g;
  const urls = text.match(urlRegex) || [];
  let count = text.length;
  for (const url of urls) {
    count = count - url.length + 23; // t.co wraps all URLs to 23 chars
  }
  return count;
}

function formatResetTime(resetAt: number | null): string {
  if (!resetAt) return '';
  const d = new Date(resetAt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatScheduledTime(timestampMs: number): string {
  const d = new Date(timestampMs);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Returns datetime-local min value (now + 5 min) */
function getMinScheduleTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  // datetime-local format: YYYY-MM-DDTHH:MM
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface TweetEditorProps {
  index: number;
  total: number;
  value: string;
  onChange: (index: number, value: string) => void;
  onRemove?: (index: number) => void;
  disabled: boolean;
  showThread: boolean;
}

function TweetEditor({ index, total, value, onChange, onRemove, disabled, showThread }: TweetEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = countChars(value);
  const isOverLimit = charCount > TWEET_CHAR_LIMIT;
  const isWarning = charCount >= 260 && charCount <= TWEET_CHAR_LIMIT;

  const charCountClass = isOverLimit
    ? 'text-error'
    : isWarning
    ? 'text-warning'
    : 'text-mission-control-text-dim';

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
    }
  }, [value]);

  const placeholder = showThread
    ? `Tweet ${index + 1}/${total}...`
    : "What's happening?";

  return (
    <div className="relative">
      <div className="flex items-start gap-2">
        {showThread && (
          <div className="flex flex-col items-center pt-3 flex-shrink-0">
            <div className="w-8 h-8 bg-mission-control-accent rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-white">{index + 1}</span>
            </div>
            {index < total - 1 && (
              <div className="w-0.5 bg-mission-control-border flex-1 mt-1 min-h-[16px]" />
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(index, e.target.value)}
              placeholder={placeholder}
              rows={3}
              disabled={disabled}
              className={`w-full bg-mission-control-surface text-mission-control-text placeholder-mission-control-text-dim border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 resize-none transition-colors ${
                isOverLimit
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-mission-control-border focus:ring-mission-control-accent'
              }`}
              style={{ minHeight: '72px' }}
            />
            <div className={`absolute bottom-2 right-3 text-xs font-mono ${charCountClass}`}>
              {charCount}/{TWEET_CHAR_LIMIT}
            </div>
          </div>
        </div>
        {showThread && onRemove && index > 0 && (
          <button
            onClick={() => onRemove(index)}
            disabled={disabled}
            className="mt-2 p-2 text-mission-control-text-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
            title="Remove tweet"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function XPublishComposer() {
  const [mode, setMode] = useState<PostMode>('single');
  const [tweets, setTweets] = useState<string[]>(['']);
  const [posting, setPosting] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [rateLimitLoading, setRateLimitLoading] = useState(true);
  const [result, setResult] = useState<PostResult | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Media attachment state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Schedule state
  const [scheduling, setScheduling] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [schedulingLoading, setSchedulingLoading] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  // Scheduled posts list state
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  // Post confirmation state
  const [showConfirm, setShowConfirm] = useState(false);

  // Edit scheduled post state
  const [editingScheduledId, setEditingScheduledId] = useState<string | null>(null);

  // Failed posts state
  const [failedPosts, setFailedPosts] = useState<Array<{ id: string; content: string; error?: string }>>([]);

  // Draft persistence timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Composer ref for scroll-to-top on edit
  const composerRef = useRef<HTMLDivElement>(null);

  // Load rate limit, scheduled posts, failed posts and restore draft on mount
  useEffect(() => {
    // Restore draft from localStorage
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.savedAt && Date.now() - draft.savedAt < DRAFT_MAX_AGE_MS) {
          if (draft.tweets?.length > 0) setTweets(draft.tweets);
          if (draft.mode) setMode(draft.mode);
        } else {
          localStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch { /* ignore parse errors */ }

    loadRateLimit();
    loadScheduledList();
    loadFailedPosts();
  }, []);

  // Debounced draft save on tweet/mode change
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const hasContent = tweets.some(t => t.trim().length > 0);
      if (hasContent) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, tweets, savedAt: Date.now() }));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [tweets, mode]);

  // Auto-dismiss success result after 5 seconds
  useEffect(() => {
    if (result?.success) {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      resultTimerRef.current = setTimeout(() => {
        setResult(null);
      }, 5000);
    }
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, [result]);

  // Revoke object URL on unmount or when mediaFile changes
  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const loadRateLimit = async () => {
    try {
      setRateLimitLoading(true);
      // Rate limit tracking not available via web — show as unlimited
      setRateLimit(null);
    } catch {
      setRateLimit(null);
    } finally {
      setRateLimitLoading(false);
    }
  };

  const loadScheduledList = async () => {
    try {
      setLoadingScheduled(true);
      const result = await scheduleApi.getAll();
      const posts = (Array.isArray(result) ? result : [])
        .filter((item: any) => item.platform === 'twitter' && item.scheduledTime);
      setScheduled(posts.map((p: any) => ({
        id: p.id,
        content: p.content,
        scheduled_time: p.scheduledTime,
        status: p.status || 'pending',
        media_id: p.mediaId || null,
        metadata: p.metadata || null,
      })));
    } catch {
      setScheduled([]);
    } finally {
      setLoadingScheduled(false);
    }
  };

  const loadFailedPosts = async () => {
    // Failed posts tracking not available via web API
    setFailedPosts([]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous preview
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);

    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setMediaId(null);
    setMediaError(null);

    // In web mode, media upload is handled via approval — just store the preview
    setUploadingMedia(false);
    setMediaId(null);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearMedia = () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaId(null);
    setMediaError(null);
    setUploadingMedia(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTweetChange = (index: number, value: string) => {
    const updated = [...tweets];
    updated[index] = value;
    setTweets(updated);
    // Dismiss confirmation if user edits after clicking Post
    if (showConfirm) setShowConfirm(false);
  };

  const addTweet = () => {
    if (tweets.length < MAX_THREAD_TWEETS) {
      setTweets([...tweets, '']);
    }
  };

  const removeTweet = (index: number) => {
    if (tweets.length > 1) {
      setTweets(tweets.filter((_, i) => i !== index));
    }
  };

  const switchToMode = (newMode: PostMode) => {
    setMode(newMode);
    if (newMode === 'single' && tweets.length > 1) {
      setTweets([tweets[0]]);
    }
    setResult(null);
  };

  const isRateLimitExhausted = rateLimit !== null && rateLimit.remaining === 0;

  const anyTweetEmpty = tweets.some((t) => !t.trim());
  const anyTweetOverLimit = tweets.some((t) => countChars(t) > TWEET_CHAR_LIMIT);
  const isPostDisabled =
    anyTweetEmpty || anyTweetOverLimit || isRateLimitExhausted || posting;
  const isScheduleDisabled =
    anyTweetEmpty || anyTweetOverLimit || posting || schedulingLoading;

  const handlePost = async () => {
    if (isPostDisabled) return;

    setPosting(true);
    setResult(null);
    setShowConfirm(false);

    try {
      // Create an approval record instead of posting directly
      const content = mode === 'single' ? tweets[0] : JSON.stringify({ tweets: tweets.filter(t => t.trim()) });
      await approvalApi.create({
        type: 'tweet',
        content,
        tier: 3,
        metadata: { mode, tweetCount: tweets.filter(t => t.trim()).length },
      });

      // Clear draft on successful approval creation
      localStorage.removeItem(DRAFT_KEY);
      setResult({ success: true });
      setTimeout(() => {
        setTweets(['']);
        setResult(null);
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setResult({ success: false, error: message });
    } finally {
      setPosting(false);
    }
  };

  const handleCaptureIdea = async () => {
    const content = mode === 'single' ? tweets[0] : JSON.stringify({ type: 'thread', tweets: tweets.filter(t => t.trim()) });
    if (!content.trim()) return;
    try {
      await scheduleApi.create({
        type: 'idea',
        content,
        platform: 'twitter',
        status: 'idea',
        metadata: JSON.stringify({ capturedAt: Date.now() }),
      });
      localStorage.removeItem(DRAFT_KEY);
      setTweets(['']);
      showToast('success', 'Idea saved to drafts');
    } catch {
      showToast('error', 'Failed to save idea');
    }
  };

  const handleScheduleSubmit = async () => {
    if (isScheduleDisabled || !scheduledAt) return;

    const timestampMs = new Date(scheduledAt).getTime();
    if (isNaN(timestampMs) || timestampMs < Date.now() + 4 * 60 * 1000) {
      setScheduleResult({ success: false, error: 'Please select a time at least 5 minutes from now.' });
      return;
    }

    setSchedulingLoading(true);
    setScheduleResult(null);

    try {
      const content = mode === 'single' ? tweets[0] : JSON.stringify({ type: 'thread', tweets: tweets.filter(t => t.trim()) });
      await scheduleApi.create({
        type: 'draft',
        content,
        platform: 'twitter',
        scheduledTime: timestampMs,
        metadata: editingScheduledId ? JSON.stringify({ replacesId: editingScheduledId }) : undefined,
      });

      // Clear draft on successful schedule
      localStorage.removeItem(DRAFT_KEY);
      setScheduleResult({ success: true, message: `Scheduled for ${formatScheduledTime(timestampMs)}!` });
      // Clear form
      setTweets(['']);
      setScheduledAt('');
      setScheduling(false);
      setEditingScheduledId(null);
      clearMedia();
      // Refresh list
      await loadScheduledList();
    } catch (err: unknown) {
      setScheduleResult({ success: false, error: err instanceof Error ? err.message : 'Unexpected error' });
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      await scheduleApi.delete(id);
      await loadScheduledList();
    } catch {
      await loadScheduledList();
    }
  };

  const editScheduledPost = (post: ScheduledPost) => {
    let postTweets: string[] = [post.content];
    let postMode: PostMode = 'single';

    if (post.metadata) {
      try {
        const meta = JSON.parse(post.metadata);
        if (meta.type === 'thread' && Array.isArray(meta.tweets)) {
          postTweets = meta.tweets;
          postMode = 'thread';
        }
      } catch { /* use defaults */ }
    }

    setTweets(postTweets);
    setMode(postMode);
    setScheduledAt(new Date(post.scheduled_time).toISOString().slice(0, 16));
    setScheduling(true);
    setEditingScheduledId(post.id);
    composerRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Rate limit banner color
  const rateLimitBannerClass = () => {
    if (!rateLimit) return '';
    if (rateLimit.remaining === 0) return 'bg-error-subtle border border-error-border text-error';
    if (rateLimit.remaining <= 5) return 'bg-warning-subtle border border-warning-border text-warning';
    return 'bg-success-subtle border border-success-border text-success';
  };

  const postButtonLabel = () => {
    if (posting) return null;
    if (mode === 'single') return 'Post Tweet';
    return `Post Thread (${tweets.filter((t) => t.trim()).length} tweets)`;
  };

  const showThread = mode === 'thread';

  return (
    <div ref={composerRef} className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-mission-control-border">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-mission-control-accent" />
          <h3 className="text-lg font-semibold text-mission-control-text">Post to X</h3>
        </div>
        {/* Mode toggle */}
        <div className="flex items-center bg-mission-control-surface border border-mission-control-border rounded-lg overflow-hidden">
          <button
            onClick={() => switchToMode('single')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-mission-control-accent text-white'
                : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            Single Tweet
          </button>
          <button
            onClick={() => switchToMode('thread')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'thread'
                ? 'bg-mission-control-accent text-white'
                : 'text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            Thread
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Failed posts notification banner */}
        {failedPosts.length > 0 && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">
                {failedPosts.length} scheduled post{failedPosts.length > 1 ? 's' : ''} failed to publish
              </span>
            </div>
            <div className="text-xs text-mission-control-text-dim mt-1 space-y-1">
              {failedPosts.slice(0, 3).map(fp => (
                <div key={fp.id} className="truncate">
                  "{fp.content.slice(0, 60)}{fp.content.length > 60 ? '...' : ''}" — {fp.error || 'Unknown error'}
                </div>
              ))}
            </div>
            <button
              onClick={() => setFailedPosts([])}
              className="mt-2 text-xs text-mission-control-text-dim hover:text-mission-control-text underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Rate limit banner */}
        {!rateLimitLoading && rateLimit !== null && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${rateLimitBannerClass()}`}>
            {rateLimit.remaining === 0 ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {rateLimit.remaining === 0 ? (
              <span>
                Daily post limit reached.{' '}
                {rateLimit.resetAt
                  ? `Resets at ${formatResetTime(rateLimit.resetAt)}`
                  : 'Resets in 24 hours'}
              </span>
            ) : (
              <span>
                {rateLimit.remaining} post{rateLimit.remaining !== 1 ? 's' : ''} remaining today
                <span className="text-mission-control-text-dim/50 ml-1">(resets on restart)</span>
              </span>
            )}
          </div>
        )}

        {/* Media attachment */}
        <div>
          <input
            type="file"
            accept="image/*,video/mp4"
            hidden
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          {!mediaFile ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={posting || schedulingLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface border border-dashed border-mission-control-border rounded-lg transition-colors disabled:opacity-40"
            >
              <Image className="w-4 h-4" />
              Attach Image/Video
            </button>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-mission-control-surface border border-mission-control-border rounded-lg">
              {/* Preview */}
              {mediaPreviewUrl && mediaFile.type.startsWith('image/') && (
                <img
                  src={mediaPreviewUrl}
                  alt="Media preview"
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              {mediaPreviewUrl && mediaFile.type.startsWith('video/') && (
                <div className="w-16 h-16 bg-mission-control-bg-alt rounded-lg flex items-center justify-center flex-shrink-0">
                  <Image className="w-6 h-6 text-mission-control-text-dim" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-mission-control-text truncate">{mediaFile.name}</p>
                {uploadingMedia && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-mission-control-text-dim">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading...
                  </div>
                )}
                {!uploadingMedia && mediaId && (
                  <p className="mt-1 text-xs text-green-400 font-medium">Media ready</p>
                )}
                {!uploadingMedia && mediaError && (
                  <p className="mt-1 text-xs text-red-400">{mediaError}</p>
                )}
              </div>
              <button
                onClick={clearMedia}
                disabled={posting || schedulingLoading}
                className="text-mission-control-text-dim hover:text-mission-control-text transition-colors disabled:opacity-40 flex-shrink-0"
                title="Remove media"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Tweet editor(s) */}
        <div className="space-y-3">
          {tweets.map((tweet, index) => (
            <TweetEditor
              key={index}
              index={index}
              total={tweets.length}
              value={tweet}
              onChange={handleTweetChange}
              onRemove={showThread ? removeTweet : undefined}
              disabled={posting}
              showThread={showThread}
            />
          ))}
        </div>

        {/* Add tweet button (thread mode) */}
        {showThread && tweets.length < MAX_THREAD_TWEETS && (
          <button
            onClick={addTweet}
            disabled={posting}
            className="flex items-center gap-2 px-4 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface border border-dashed border-mission-control-border rounded-lg w-full transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add tweet to thread
          </button>
        )}

        {/* Schedule datetime picker */}
        {scheduling && (
          <div className="p-4 bg-mission-control-surface border border-mission-control-border rounded-lg space-y-3">
            <label className="block text-sm font-medium text-mission-control-text">
              Schedule for
              {editingScheduledId && (
                <span className="text-xs text-yellow-400 ml-2">(editing scheduled post)</span>
              )}
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={getMinScheduleTime()}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            />
            {scheduleResult && !scheduleResult.success && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {scheduleResult.error}
              </div>
            )}
            <button
              onClick={handleScheduleSubmit}
              disabled={isScheduleDisabled || !scheduledAt}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-mission-control-accent hover:bg-mission-control-accent/80 disabled:bg-mission-control-bg-alt disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {schedulingLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  {editingScheduledId
                    ? (mode === 'single' ? 'Update Scheduled Tweet' : 'Update Scheduled Thread')
                    : (mode === 'single' ? 'Schedule Tweet' : 'Schedule Thread')}
                </>
              )}
            </button>
          </div>
        )}

        {/* Schedule success banner */}
        {scheduleResult?.success && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-green-500/10 border border-green-500/30 text-green-400">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {scheduleResult.message}
          </div>
        )}

        {/* Post confirmation inline bar */}
        {showConfirm && (
          <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <span className="text-sm text-mission-control-text flex-1">
              {mode === 'single' ? 'Post this tweet to X?' : `Post this ${tweets.filter(t => t.trim()).length}-tweet thread to X?`}
              {' '}This cannot be undone.
            </span>
            <button
              onClick={() => { setShowConfirm(false); handlePost(); }}
              className="px-4 py-1.5 bg-mission-control-accent text-white text-sm font-medium rounded-lg hover:bg-mission-control-accent/80 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-1.5 bg-mission-control-surface text-mission-control-text-dim text-sm font-medium rounded-lg hover:bg-mission-control-surface/80 transition-colors border border-mission-control-border"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Post result banner */}
        {result && (
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-lg text-sm ${
              result.success
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {result.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              {result.success ? (
                <>
                  <p className="font-medium">Posted successfully</p>
                  {result.tweetId && (
                    <p className="text-xs mt-0.5 opacity-80">Tweet ID: {result.tweetId}</p>
                  )}
                  {result.threadIds && result.threadIds.length > 0 && (
                    <p className="text-xs mt-0.5 opacity-80">
                      Thread posted ({result.threadIds.length} tweets)
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="font-medium">Post failed</p>
                  {result.error && <p className="text-xs mt-0.5 opacity-80">{result.error}</p>}
                </>
              )}
            </div>
            {!result.success && (
              <button
                onClick={() => setResult(null)}
                className="text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
                title="Dismiss"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Scheduled posts list */}
        {!loadingScheduled && scheduled.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-mission-control-text">
              <Clock className="w-4 h-4 text-mission-control-accent" />
              Scheduled Posts
            </div>
            <div className="space-y-2">
              {scheduled.map((post) => {
                let displayContent = post.content;
                try {
                  const meta = JSON.parse(post.metadata || '{}');
                  if (meta.type === 'thread' && Array.isArray(meta.tweets)) {
                    displayContent = meta.tweets[0] || post.content;
                  }
                } catch {}
                return (
                  <div
                    key={post.id}
                    className={`flex items-start gap-3 p-3 bg-mission-control-surface border rounded-lg ${
                      editingScheduledId === post.id
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : 'border-mission-control-border'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-mission-control-text truncate">
                        {displayContent?.slice(0, 80) || '(empty)'}
                        {displayContent && displayContent.length > 80 ? '…' : ''}
                      </p>
                      <p className="text-xs text-mission-control-text-dim mt-0.5">
                        {formatScheduledTime(post.scheduled_time)}
                      </p>
                    </div>
                    <button
                      onClick={() => editScheduledPost(post)}
                      className="px-2 py-1 text-xs text-mission-control-accent hover:bg-mission-control-accent/10 rounded transition-colors flex-shrink-0"
                      title="Edit scheduled post"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCancelScheduled(post.id)}
                      className="text-mission-control-text-dim hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex-shrink-0"
                      title="Cancel scheduled post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-6 pb-6 pt-4 border-t border-mission-control-border space-y-3">
        <div className="flex items-center gap-3">
          {/* Post button — shows confirmation first */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isPostDisabled}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-mission-control-accent hover:bg-mission-control-accent/80 disabled:bg-mission-control-bg-alt disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {posting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                {postButtonLabel()}
              </>
            )}
          </button>

          {/* Capture Idea button — saves rough draft instantly */}
          <button
            onClick={handleCaptureIdea}
            disabled={posting || !tweets.some(t => t.trim())}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-info hover:border-info hover:bg-info/5"
            title="Save as idea — capture rough draft without polishing"
          >
            <Lightbulb className="w-5 h-5" />
            Idea
          </button>

          {/* Schedule button */}
          <button
            onClick={() => {
              setScheduling((s) => !s);
              setScheduleResult(null);
              if (scheduling) {
                // Cancelling schedule mode — also clear edit state
                setEditingScheduledId(null);
              }
            }}
            disabled={isScheduleDisabled}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              scheduling
                ? 'bg-mission-control-accent/20 text-mission-control-accent border border-mission-control-accent/40'
                : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
            }`}
            title="Schedule for later"
          >
            <Calendar className="w-5 h-5" />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
