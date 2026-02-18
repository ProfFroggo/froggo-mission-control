import { useState, useEffect, useRef } from 'react';
import { Send, Plus, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

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

  // Load rate limit on mount
  useEffect(() => {
    loadRateLimit();
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

  const loadRateLimit = async () => {
    try {
      setRateLimitLoading(true);
      const rl = await window.clawdbot?.xPublish?.rateLimit();
      setRateLimit(rl || null);
    } catch {
      // Rate limit fetch failed — non-blocking
      setRateLimit(null);
    } finally {
      setRateLimitLoading(false);
    }
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
    // Keep existing content when switching modes
    if (newMode === 'single' && tweets.length > 1) {
      // Keep only the first tweet when switching to single
      setTweets([tweets[0]]);
    }
    setResult(null);
  };

  const isRateLimitExhausted = rateLimit !== null && rateLimit.remaining === 0;

  const anyTweetEmpty = tweets.some((t) => !t.trim());
  const anyTweetOverLimit = tweets.some((t) => countChars(t) > TWEET_CHAR_LIMIT);
  const isPostDisabled =
    anyTweetEmpty || anyTweetOverLimit || isRateLimitExhausted || posting;

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
        // Clear form after 3 seconds
        setTimeout(() => {
          setTweets(['']);
          setResult(null);
        }, 3000);
        // Refresh rate limit
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

        {/* Result banner */}
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
      </div>

      {/* Post button */}
      <div className="px-6 pb-6 pt-4 border-t border-clawd-border">
        <button
          onClick={handlePost}
          disabled={isPostDisabled}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-clawd-accent hover:bg-clawd-accent/80 disabled:bg-clawd-bg-alt disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
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
      </div>
    </div>
  );
}
