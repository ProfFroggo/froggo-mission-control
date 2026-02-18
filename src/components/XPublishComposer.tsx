import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Trash2, AlertCircle, CheckCircle, Loader2, Image, Calendar, Clock, X } from 'lucide-react';

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
    ? 'text-red-500'
    : isWarning
    ? 'text-yellow-500'
    : 'text-clawd-text-dim';

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
            <div className="w-8 h-8 bg-clawd-accent rounded-full flex items-center justify-center">
              <span className="text-xs font-semibold text-white">{index + 1}</span>
            </div>
            {index < total - 1 && (
              <div className="w-0.5 bg-clawd-border flex-1 mt-1 min-h-[16px]" />
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
              className={`w-full bg-clawd-surface text-clawd-text placeholder-clawd-text-dim border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 resize-none transition-colors ${
                isOverLimit
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-clawd-border focus:ring-clawd-accent'
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
            className="mt-2 p-2 text-clawd-text-dim hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40"
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

  // Load rate limit and scheduled posts on mount
  useEffect(() => {
    loadRateLimit();
    loadScheduledList();
  }, []);

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
      const rl = await window.clawdbot?.xPublish?.rateLimit();
      setRateLimit(rl || null);
    } catch {
      setRateLimit(null);
    } finally {
      setRateLimitLoading(false);
    }
  };

  const loadScheduledList = async () => {
    try {
      setLoadingScheduled(true);
      const result = await (window.clawdbot?.xPublish?.scheduledList?.() ?? Promise.resolve({ success: true, scheduled: [] }));
      const posts = (result as any)?.scheduled ?? (Array.isArray(result) ? result : []);
      setScheduled(Array.isArray(posts) ? (posts as ScheduledPost[]) : []);
    } catch {
      setScheduled([]);
    } finally {
      setLoadingScheduled(false);
    }
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

    // Upload using Electron file path
    const filePath = (file as any).path as string | undefined;
    if (!filePath) {
      setMediaError('Cannot read file path. Please try again.');
      return;
    }

    setUploadingMedia(true);
    try {
      const result = await (window.clawdbot?.xPublish?.mediaUpload?.(filePath) ?? Promise.resolve(null));
      if (result?.mediaId) {
        setMediaId(result.mediaId);
      } else {
        setMediaError(result?.error || 'Upload failed');
      }
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingMedia(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

    try {
      let res: PostResult;
      if (mode === 'single') {
        res = (await window.clawdbot?.xPublish?.post(tweets[0])) ?? { success: false, error: 'xPublish not available' };
      } else {
        res = (await window.clawdbot?.xPublish?.thread(tweets.filter((t) => t.trim()))) ?? { success: false, error: 'xPublish not available' };
      }

      if (res.success) {
        setResult({ success: true, tweetId: res.tweetId, threadIds: res.threadIds });
        setTimeout(() => {
          setTweets(['']);
          setResult(null);
        }, 3000);
        loadRateLimit();
      } else {
        setResult({ success: false, error: res.error || 'Post failed' });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setResult({ success: false, error: message });
    } finally {
      setPosting(false);
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
      let res: any;
      if (mode === 'single') {
        res = await (window.clawdbot?.xPublish?.schedule?.(
          tweets[0],
          timestampMs,
          mediaId || undefined
        ) ?? Promise.resolve({ success: false, error: 'xPublish.schedule not available' }));
      } else {
        res = await (window.clawdbot?.xPublish?.scheduleThread?.(
          tweets.filter((t) => t.trim()),
          timestampMs
        ) ?? Promise.resolve({ success: false, error: 'xPublish.scheduleThread not available' }));
      }

      if (res?.success) {
        setScheduleResult({ success: true, message: `Scheduled for ${formatScheduledTime(timestampMs)}!` });
        // Clear form
        setTweets(['']);
        setScheduledAt('');
        setScheduling(false);
        clearMedia();
        // Refresh list
        await loadScheduledList();
      } else {
        setScheduleResult({ success: false, error: res?.error || 'Scheduling failed' });
      }
    } catch (err: unknown) {
      setScheduleResult({ success: false, error: err instanceof Error ? err.message : 'Unexpected error' });
    } finally {
      setSchedulingLoading(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    try {
      await (window.clawdbot?.xPublish?.scheduledCancel?.(id) ?? Promise.resolve());
      await loadScheduledList();
    } catch {
      // Ignore cancel errors — list will refresh anyway
    }
  };

  // Rate limit banner color
  const rateLimitBannerClass = () => {
    if (!rateLimit) return '';
    if (rateLimit.remaining === 0) return 'bg-red-500/10 border border-red-500/30 text-red-400';
    if (rateLimit.remaining <= 5) return 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400';
    return 'bg-green-500/10 border border-green-500/30 text-green-400';
  };

  const postButtonLabel = () => {
    if (posting) return null;
    if (mode === 'single') return 'Post Tweet';
    return `Post Thread (${tweets.filter((t) => t.trim()).length} tweets)`;
  };

  const showThread = mode === 'thread';

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-clawd-border">
        <div className="flex items-center gap-3">
          <Send className="w-5 h-5 text-clawd-accent" />
          <h3 className="text-lg font-semibold text-clawd-text">Post to X</h3>
        </div>
        {/* Mode toggle */}
        <div className="flex items-center bg-clawd-surface border border-clawd-border rounded-lg overflow-hidden">
          <button
            onClick={() => switchToMode('single')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'single'
                ? 'bg-clawd-accent text-white'
                : 'text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Single Tweet
          </button>
          <button
            onClick={() => switchToMode('thread')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === 'thread'
                ? 'bg-clawd-accent text-white'
                : 'text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Thread
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-surface border border-dashed border-clawd-border rounded-lg transition-colors disabled:opacity-40"
            >
              <Image className="w-4 h-4" />
              Attach Image/Video
            </button>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-clawd-surface border border-clawd-border rounded-lg">
              {/* Preview */}
              {mediaPreviewUrl && mediaFile.type.startsWith('image/') && (
                <img
                  src={mediaPreviewUrl}
                  alt="Media preview"
                  className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                />
              )}
              {mediaPreviewUrl && mediaFile.type.startsWith('video/') && (
                <div className="w-16 h-16 bg-clawd-bg-alt rounded-lg flex items-center justify-center flex-shrink-0">
                  <Image className="w-6 h-6 text-clawd-text-dim" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-clawd-text truncate">{mediaFile.name}</p>
                {uploadingMedia && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-clawd-text-dim">
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
                className="text-clawd-text-dim hover:text-clawd-text transition-colors disabled:opacity-40 flex-shrink-0"
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
            className="flex items-center gap-2 px-4 py-2 text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-surface border border-dashed border-clawd-border rounded-lg w-full transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add tweet to thread
          </button>
        )}

        {/* Schedule datetime picker */}
        {scheduling && (
          <div className="p-4 bg-clawd-surface border border-clawd-border rounded-lg space-y-3">
            <label className="block text-sm font-medium text-clawd-text">Schedule for</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={getMinScheduleTime()}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm text-clawd-text focus:outline-none focus:ring-2 focus:ring-clawd-accent"
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-clawd-accent hover:bg-clawd-accent/80 disabled:bg-clawd-bg-alt disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {schedulingLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4" />
                  {mode === 'single' ? 'Schedule Tweet' : 'Schedule Thread'}
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
            <div className="flex items-center gap-2 text-sm font-medium text-clawd-text">
              <Clock className="w-4 h-4 text-clawd-accent" />
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
                    className="flex items-start gap-3 p-3 bg-clawd-surface border border-clawd-border rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-clawd-text truncate">
                        {displayContent?.slice(0, 80) || '(empty)'}
                        {displayContent && displayContent.length > 80 ? '…' : ''}
                      </p>
                      <p className="text-xs text-clawd-text-dim mt-0.5">
                        {formatScheduledTime(post.scheduled_time)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelScheduled(post.id)}
                      className="text-clawd-text-dim hover:text-red-500 hover:bg-red-500/10 p-1.5 rounded-lg transition-colors flex-shrink-0"
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
      <div className="px-6 pb-6 pt-4 border-t border-clawd-border space-y-3">
        <div className="flex items-center gap-3">
          {/* Post button */}
          <button
            onClick={handlePost}
            disabled={isPostDisabled}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-clawd-accent hover:bg-clawd-accent/80 disabled:bg-clawd-bg-alt disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
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

          {/* Schedule button */}
          <button
            onClick={() => {
              setScheduling((s) => !s);
              setScheduleResult(null);
            }}
            disabled={isScheduleDisabled}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              scheduling
                ? 'bg-clawd-accent/20 text-clawd-accent border border-clawd-accent/40'
                : 'bg-clawd-surface border border-clawd-border text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg-alt'
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
