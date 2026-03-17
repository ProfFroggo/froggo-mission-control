// XCompetitorTracker — tracks competitor X accounts using /api/x/search for real tweet data

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  TrendingUp,
  Plus,
  X,
  RefreshCw,
  AlertCircle,
  Users,
  BarChart2,
  Heart,
  Repeat2,
  MessageCircle,
  ExternalLink,
  FileText,
  Download,
  Zap,
  Loader2,
} from 'lucide-react';
import { showToast } from './Toast';
import MarkdownMessage from './MarkdownMessage';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompetitorTweet {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count: number;
    retweet_count: number;
    reply_count: number;
    impression_count?: number;
  };
  author_id?: string;
}

interface CompetitorUser {
  id: string;
  name: string;
  username: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
  profile_image_url?: string;
}

interface CompetitorData {
  handle: string;
  user: CompetitorUser | null;
  tweets: CompetitorTweet[];
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  avgEngagement: number;
  tweetCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_KEY = 'x-competitor-handles';

function loadHandles(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveHandles(handles: string[]): void {
  const json = JSON.stringify(handles);
  localStorage.setItem(LS_KEY, json);
  fetch(`/api/settings/${LS_KEY}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: json }),
  }).catch(() => { /* non-critical */ });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Competitor card ─────────────────────────────────────────────────────────

interface CompetitorCardProps {
  data: CompetitorData;
  onRemove: (handle: string) => void;
}

function CompetitorCard({ data, onRemove }: CompetitorCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-mission-control-border rounded-lg bg-mission-control-surface overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
          >
            {data.handle[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-mission-control-text">
              @{data.handle}
              {data.user?.name && (
                <span className="text-mission-control-text-dim font-normal ml-1">
                  ({data.user.name})
                </span>
              )}
            </div>
            <div className="text-xs text-mission-control-text-dim flex items-center gap-1">
              {data.user?.public_metrics ? (
                <>
                  <Users size={11} />
                  {formatNumber(data.user.public_metrics.followers_count)} followers
                </>
              ) : (
                <span>{data.tweetCount} tweets found via search</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`https://x.com/${data.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-info hover:underline flex items-center gap-1"
          >
            <ExternalLink size={12} />
          </a>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs px-2 py-1 rounded border border-mission-control-border hover:bg-mission-control-bg transition-colors text-mission-control-text-dim"
          >
            {expanded ? 'Less' : 'Tweets'}
          </button>
          <button
            onClick={() => onRemove(data.handle)}
            aria-label={`Remove @${data.handle}`}
            className="text-mission-control-text-dim hover:text-error transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 divide-x divide-mission-control-border text-center py-3">
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text">{data.tweetCount}</div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">tweets found</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text flex items-center justify-center gap-1">
            <Heart size={12} className="text-error" />
            {formatNumber(data.totalLikes)}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">total likes</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text flex items-center justify-center gap-1">
            <Repeat2 size={12} className="text-info" />
            {formatNumber(data.totalRetweets)}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">total retweets</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold text-mission-control-text">
            {data.avgEngagement.toFixed(1)}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-0.5">avg eng/tweet</div>
        </div>
      </div>

      {/* Expanded tweet list */}
      {expanded && data.tweets.length > 0 && (
        <div className="border-t border-mission-control-border max-h-80 overflow-y-auto">
          {data.tweets.slice(0, 10).map(tweet => (
            <div
              key={tweet.id}
              className="p-3 border-b border-mission-control-border last:border-b-0 text-sm"
            >
              <div className="text-mission-control-text mb-2 line-clamp-3">{tweet.text}</div>
              <div className="flex items-center gap-4 text-xs text-mission-control-text-dim">
                <span className="flex items-center gap-1">
                  <Heart size={11} /> {tweet.public_metrics?.like_count ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <Repeat2 size={11} /> {tweet.public_metrics?.retweet_count ?? 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={11} /> {tweet.public_metrics?.reply_count ?? 0}
                </span>
                {tweet.created_at && (
                  <span>
                    {new Date(tweet.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && data.tweets.length === 0 && (
        <div className="border-t border-mission-control-border p-4 text-center text-xs text-mission-control-text-dim">
          No tweets found for this account
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function XCompetitorTracker() {
  const [handles, setHandles] = useState<string[]>(loadHandles);
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestReport, setLatestReport] = useState<{ id: string; title: string; summary: string; content: string; created_at: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const fetchCompetitorData = useCallback(
    async (handle: string): Promise<CompetitorData> => {
      const res = await fetch(`/api/x/search?q=${encodeURIComponent(`from:${handle}`)}&max=20`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Failed to fetch data for @${handle}`);
      }
      const data = await res.json();
      const tweets: CompetitorTweet[] = data.tweets ?? [];
      const users: CompetitorUser[] = data.includes?.users ?? [];

      // Find the user in includes
      const user = users.find((u: CompetitorUser) => u.username?.toLowerCase() === handle.toLowerCase()) ?? null;

      let totalLikes = 0;
      let totalRetweets = 0;
      let totalReplies = 0;
      for (const t of tweets) {
        totalLikes += t.public_metrics?.like_count ?? 0;
        totalRetweets += t.public_metrics?.retweet_count ?? 0;
        totalReplies += t.public_metrics?.reply_count ?? 0;
      }
      const avgEngagement = tweets.length > 0 ? (totalLikes + totalRetweets + totalReplies) / tweets.length : 0;

      return {
        handle,
        user,
        tweets,
        totalLikes,
        totalRetweets,
        totalReplies,
        avgEngagement,
        tweetCount: tweets.length,
      };
    },
    [],
  );

  const fetchCompetitors = useCallback(
    async (hs: string[]) => {
      if (hs.length === 0) {
        setCompetitors([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.allSettled(hs.map(h => fetchCompetitorData(h)));
        const successResults: CompetitorData[] = [];
        const failedHandles: string[] = [];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            successResults.push(result.value);
          } else {
            failedHandles.push(hs[i]);
          }
        });
        setCompetitors(successResults);
        if (failedHandles.length > 0) {
          setError(`Failed to fetch: ${failedHandles.map(h => `@${h}`).join(', ')}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [fetchCompetitorData],
  );

  const handleAdd = () => {
    const handle = inputValue.trim().replace(/^@/, '').toLowerCase();
    if (!handle) return;
    if (handles.includes(handle)) {
      showToast('info', 'Already tracking', `@${handle} is already in your list`);
      setInputValue('');
      return;
    }
    if (handles.length >= 10) {
      showToast('error', 'Limit reached', 'You can track up to 10 competitors');
      return;
    }
    const updated = [...handles, handle];
    setHandles(updated);
    saveHandles(updated);
    setInputValue('');
    fetchCompetitors(updated);
  };

  const handleRemove = (handle: string) => {
    const updated = handles.filter(h => h !== handle);
    setHandles(updated);
    saveHandles(updated);
    setCompetitors(prev => prev.filter(c => c.handle !== handle));
  };

  const handleRefresh = () => fetchCompetitors(handles);

  // Auto-fetch on mount if handles exist + load latest report
  useEffect(() => {
    if (handles.length > 0) {
      fetchCompetitors(handles);
    }
    // Load latest competitor report
    fetch('/api/x/reports?type=competitor-analysis&limit=1')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.reports?.[0]) setLatestReport(data.reports[0]);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2 mb-1">
          <Target size={20} style={{ color: 'var(--color-warning)' }} />
          <h2 className="text-lg font-semibold text-mission-control-text">Competitor Tracker</h2>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Search competitor X accounts and analyze their recent tweet engagement.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Latest AI Report */}
        {latestReport && (
          <div className="rounded-xl border border-mission-control-border bg-mission-control-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-info" />
                <span className="text-sm font-medium text-mission-control-text">{latestReport.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-mission-control-text-dim">
                  {new Date(latestReport.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <button
                  onClick={() => setShowReport(!showReport)}
                  className="px-2 py-1 text-xs text-info hover:bg-info-subtle/50 rounded transition-colors"
                >
                  {showReport ? 'Collapse' : 'View Report'}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([latestReport.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `competitor-analysis-${new Date().toISOString().slice(0, 10)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1 text-mission-control-text-dim hover:text-mission-control-text rounded transition-colors"
                  title="Download report"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
            {!showReport && <p className="text-xs text-mission-control-text-dim">{latestReport.summary}</p>}
            {showReport && (
              <div className="mt-3 p-3 rounded-lg border border-mission-control-border bg-mission-control-bg max-h-[500px] overflow-y-auto text-sm">
                <MarkdownMessage content={latestReport.content} />
              </div>
            )}
          </div>
        )}

        {/* Generate Report Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setGeneratingReport(true);
              try {
                const res = await fetch('/api/x/reports', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'competitor-analysis', handles }),
                });
                if (res.ok) {
                  const data = await res.json();
                  if (data.report) {
                    setLatestReport(data.report);
                    setShowReport(true);
                    showToast('success', 'Report generated');
                  }
                } else {
                  showToast('error', 'Failed to generate report');
                }
              } catch { showToast('error', 'Report generation failed'); }
              setGeneratingReport(false);
            }}
            disabled={generatingReport || handles.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-info/10 text-info hover:bg-info/20 rounded-lg transition-colors disabled:opacity-40"
          >
            {generatingReport ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {generatingReport ? 'Generating...' : 'Run Competitor Analysis'}
          </button>
          {!latestReport && <span className="text-[10px] text-mission-control-text-dim">Add competitor handles below, then run analysis</span>}
        </div>

        {/* Add handle input */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Track a competitor
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mission-control-text-dim">
                @
              </span>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAdd();
                }}
                placeholder="handle"
                className="w-full pl-7 pr-3 py-2 text-sm border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-info)', color: '#fff' }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
          <p className="text-xs text-mission-control-text-dim mt-1.5">
            Track up to 10 competitors. Uses X search API to fetch recent tweets.
          </p>
        </div>

        {/* Tracked handles chips */}
        {handles.length > 0 && competitors.length === 0 && !loading && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-mission-control-text">
                Tracked accounts ({handles.length})
              </span>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                <RefreshCw size={12} />
                Load data
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {handles.map(h => (
                <div
                  key={h}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-mission-control-border text-mission-control-text"
                >
                  @{h}
                  <button onClick={() => handleRemove(h)} aria-label={`Remove @${h}`}>
                    <X size={12} className="text-mission-control-text-dim hover:text-error" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-mission-control-text-dim">
            <div className="w-6 h-6 border-2 border-info border-t-transparent rounded-full animate-spin mr-3" />
            Searching X for competitor tweets...
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
          >
            <AlertCircle size={16} />
            {error}
            <button onClick={handleRefresh} className="ml-auto underline text-xs">
              Retry
            </button>
          </div>
        )}

        {/* Competitor cards */}
        {!loading && competitors.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-mission-control-text-dim" />
                <span className="text-sm font-medium text-mission-control-text">
                  Competitor Analysis ({competitors.length})
                </span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              {competitors.map(c => (
                <CompetitorCard key={c.handle} data={c} onRemove={handleRemove} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {handles.length === 0 && (
          <div className="text-center py-12 text-mission-control-text-dim border border-dashed border-mission-control-border rounded-lg">
            <Target size={36} className="mx-auto mb-3 opacity-40" />
            <div className="text-sm font-medium mb-1">No competitors tracked yet</div>
            <div className="text-xs">Add competitor handles above to start monitoring</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XCompetitorTracker;
