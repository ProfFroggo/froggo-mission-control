import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, RefreshCw, ToggleLeft, ToggleRight, List, MessageCircle } from 'lucide-react';
import ThreadListItem from './ThreadListItem';
import InboxFilter, { FilterCriteria } from './InboxFilter';

interface ThreadMetadata {
  thread_id: string;
  platform: string;
  subject?: string;
  participants: string[];
  message_count: number;
  last_activity: string;
  unread_count: number;
  unreplied_count: number;
  has_starred: boolean;
  root_message_id?: string;
  root_preview?: string;
  sender?: string;
  sender_name?: string;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function ThreadedCommsInbox() {
  const [threads, setThreads] = useState<ThreadMetadata[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<ThreadMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [threadedView, setThreadedView] = useState(true); // Toggle between threaded and flat view

  // Platform filter state
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  // Load threads from backend
  const loadThreads = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await (window as any).clawdbot?.inbox?.listThreads?.();
      
      if (result?.success && result.threads) {
        setThreads(result.threads);
        setLastUpdated(Date.now());
      }
    } catch (e) {
      console.error('[ThreadedCommsInbox] Failed to load threads:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Apply filters to threads
  const applyFilters = useCallback((allThreads: ThreadMetadata[], criteria: FilterCriteria) => {
    let filtered = [...allThreads];

    // Platform filter
    if (criteria.platforms && criteria.platforms.length > 0) {
      filtered = filtered.filter((t) => criteria.platforms!.includes(t.platform));
    }

    // Sender filter
    if (criteria.senders && criteria.senders.length > 0) {
      filtered = filtered.filter((t) =>
        criteria.senders!.some((sender) =>
          t.participants.some((p) => p.toLowerCase().includes(sender.toLowerCase()))
        )
      );
    }

    // Flags
    if (criteria.flags) {
      if (criteria.flags.unread) {
        filtered = filtered.filter((t) => t.unread_count > 0);
      }
      if (criteria.flags.unreplied) {
        filtered = filtered.filter((t) => t.unreplied_count > 0);
      }
      if (criteria.flags.starred) {
        filtered = filtered.filter((t) => t.has_starred);
      }
      // TODO: Add attachment filter when available
    }

    // Text search
    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          (t.subject && t.subject.toLowerCase().includes(searchLower)) ||
          (t.root_preview && t.root_preview.toLowerCase().includes(searchLower)) ||
          t.participants.some((p) => p.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, []);

  // Update filtered threads when filter criteria or threads change
  useEffect(() => {
    const filtered = applyFilters(threads, filterCriteria);
    setFilteredThreads(filtered);
  }, [threads, filterCriteria, applyFilters]);

  // Initial load
  useEffect(() => {
    loadThreads();
    const interval = setInterval(() => loadThreads(true), 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadThreads]);

  const handleFilterChange = useCallback((criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
  }, []);

  const handleToggleStar = async (threadId: string) => {
    try {
      const result = await (window as any).clawdbot?.inbox?.toggleThreadStar?.(threadId);
      if (result?.success) {
        // Update local state
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === threadId ? { ...t, has_starred: result.has_starred } : t
          )
        );
      }
    } catch (e) {
      console.error('[ThreadedCommsInbox] Failed to toggle star:', e);
    }
  };

  const handleMarkRead = async (threadId: string, isRead: boolean) => {
    try {
      const result = await (window as any).clawdbot?.inbox?.markThreadRead?.(threadId, isRead);
      if (result?.success) {
        // Update local state
        setThreads((prev) =>
          prev.map((t) =>
            t.thread_id === threadId ? { ...t, unread_count: isRead ? 0 : t.message_count } : t
          )
        );
      }
    } catch (e) {
      console.error('[ThreadedCommsInbox] Failed to mark thread read:', e);
    }
  };

  // Group threads by platform for display
  const threadsByPlatform = filteredThreads.reduce((acc, thread) => {
    if (!acc[thread.platform]) {
      acc[thread.platform] = [];
    }
    acc[thread.platform].push(thread);
    return acc;
  }, {} as Record<string, ThreadMetadata[]>);

  const platformCounts = {
    all: filteredThreads.length,
    email: threadsByPlatform.email?.length || 0,
    whatsapp: threadsByPlatform.whatsapp?.length || 0,
    telegram: threadsByPlatform.telegram?.length || 0,
    discord: threadsByPlatform.discord?.length || 0,
    twitter: threadsByPlatform.twitter?.length || 0,
  };

  const displayThreads =
    platformFilter === 'all' ? filteredThreads : threadsByPlatform[platformFilter] || [];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter Bar */}
      <InboxFilter
        onFilterChange={handleFilterChange}
        totalMessages={threads.length}
        filteredCount={filteredThreads.length}
      />

      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare size={24} /> Conversations
            </h1>
            {lastUpdated && (
              <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                {refreshing ? 'Updating...' : `Updated ${formatRelativeTime(lastUpdated)}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <button
              onClick={() => setThreadedView(!threadedView)}
              className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:bg-clawd-border transition-colors"
              title={threadedView ? 'Switch to list view' : 'Switch to threaded view'}
            >
              {threadedView ? (
                <>
                  <MessageCircle size={14} />
                  Threaded
                </>
              ) : (
                <>
                  <List size={14} />
                  List
                </>
              )}
            </button>

            {/* Refresh button */}
            <button
              onClick={() => loadThreads(true)}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:bg-clawd-border disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Platform filter tabs */}
        <div className="flex gap-2 mb-4 border-b border-clawd-border pb-2 overflow-x-auto">
          {['all', 'email', 'whatsapp', 'telegram', 'discord', 'twitter'].map((platform) => {
            const count = platformCounts[platform as keyof typeof platformCounts];
            if (platform !== 'all' && count === 0) return null;

            return (
              <button
                key={platform}
                onClick={() => setPlatformFilter(platform)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap ${
                  platformFilter === platform
                    ? 'bg-clawd-accent text-white'
                    : 'bg-clawd-surface text-clawd-text-dim hover:bg-clawd-border'
                }`}
              >
                {platform.charAt(0).toUpperCase() + platform.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading && threads.length === 0 ? (
            <div className="text-center text-clawd-text-dim py-8">Loading conversations...</div>
          ) : displayThreads.length === 0 ? (
            <div className="text-center text-clawd-text-dim py-8">
              <MessageSquare size={48} className="mx-auto mb-2 opacity-30" />
              <p>No conversations found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayThreads.map((thread) => (
                <ThreadListItem
                  key={thread.thread_id}
                  thread={thread}
                  onToggleStar={handleToggleStar}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
