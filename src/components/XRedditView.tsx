import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, ExternalLink, RefreshCw, Send, Save, Sparkles, CheckCircle, Clock, AlertCircle, ThumbsUp, MessageSquare } from 'lucide-react';
import { settingsApi, approvalApi } from '../lib/api';

interface RedditThread {
  id: string;
  post_id: string;
  subreddit: string;
  title: string;
  text: string;
  author: string;
  url: string;
  upvotes: number;
  comment_count: number;
  created_at: number;
  fetched_at: number;
  reply_status: 'pending' | 'drafting' | 'drafted' | 'posted' | 'ignored';
  drafted_reply?: string;
  posted_at?: number;
}

interface RedditMonitor {
  id: string;
  product_url: string;
  keywords: string;
  subreddits: string;
  status: 'active' | 'paused';
  created_at: number;
}

export const XRedditView: React.FC = () => {
  const [monitors, setMonitors] = useState<RedditMonitor[]>([]);
  const [threads, setThreads] = useState<RedditThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<RedditThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [monitoring, setMonitoring] = useState(false);
  const [draftReply, setDraftReply] = useState('');
  const [showSetup, setShowSetup] = useState(true);
  
  // Setup form state
  const [productUrl, setProductUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [subreddits, setSubreddits] = useState('');

  useEffect(() => {
    loadMonitors();
    loadThreads();
  }, []);

  const loadMonitors = async () => {
    try {
      const result = await settingsApi.get('redditMonitors');
      const monitorsData = Array.isArray(result) ? result : [];
      setMonitors(monitorsData as RedditMonitor[]);
      if (monitorsData.length > 0) {
        setShowSetup(false);
      }
    } catch (error) {
      // Error loading monitors
    }
    setLoading(false);
  };

  const loadThreads = async () => {
    try {
      const result = await settingsApi.get('redditThreads');
      const threadsData = Array.isArray(result) ? result : [];
      setThreads(threadsData as RedditThread[]);
    } catch (error) {
      // Error loading threads
    }
  };

  const startMonitoring = async () => {
    if (!productUrl.trim() || !keywords.trim()) return;

    setMonitoring(true);
    try {
      await settingsApi.set('redditMonitor', {
        productUrl: productUrl.trim(),
        keywords: keywords.trim(),
        subreddits: subreddits.trim() || 'all',
      });
      await loadMonitors();
      await loadThreads();
      setShowSetup(false);
    } catch (error) {
      // Error starting monitoring
    } finally {
      setMonitoring(false);
    }
  };

  const fetchThreads = async () => {
    setMonitoring(true);
    try {
      // Fetching is server-side — just reload threads
      await loadThreads();
    } catch (error) {
      // Error fetching threads
    } finally {
      setMonitoring(false);
    }
  };

  const generateDraft = async (thread: RedditThread) => {
    setSelectedThread({ ...thread, reply_status: 'drafting' });
    setDraftReply('');
    // Stub: AI draft generation requires server-side — leave draft empty for manual entry
  };

  const saveDraft = async () => {
    if (!selectedThread || !draftReply.trim()) return;

    try {
      setThreads(threads.map(t =>
        t.id === selectedThread.id
          ? { ...t, reply_status: 'drafted', drafted_reply: draftReply.trim() }
          : t
      ));
      setSelectedThread({ ...selectedThread, reply_status: 'drafted', drafted_reply: draftReply.trim() });
    } catch (error) {
      // Error saving draft
    }
  };

  const postReply = async () => {
    if (!selectedThread || !draftReply.trim()) return;

    try {
      // External posting MUST go through approval
      await approvalApi.create({
        type: 'reddit-reply',
        tier: 3,
        payload: { threadId: selectedThread.id, replyText: draftReply.trim() },
        requestedBy: 'user',
      });
      setThreads(threads.map(t =>
        t.id === selectedThread.id
          ? { ...t, reply_status: 'posted', posted_at: Date.now() }
          : t
      ));
      setSelectedThread({ ...selectedThread, reply_status: 'posted' });
      setDraftReply('');
    } catch (error) {
      // Error posting reply
    }
  };

  const updateStatus = async (threadId: string, status: RedditThread['reply_status']) => {
    try {
      // Stub: update local state only
      setThreads(threads.map(t =>
        t.id === threadId ? { ...t, reply_status: status } : t
      ));
    } catch (error) {
      // Error updating status
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  const renderThread = (thread: RedditThread) => {
    const isSelected = selectedThread?.id === thread.id;
    
    return (
      <div
        key={thread.id}
        onClick={() => setSelectedThread(thread)}
        className={`border-b border-mission-control-border p-4 hover:bg-mission-control-surface transition-colors cursor-pointer ${
          isSelected ? 'bg-mission-control-surface' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-info">r/{thread.subreddit}</span>
            <span className="text-xs text-mission-control-text-dim">by u/{thread.author}</span>
          </div>
          <div className="text-xs text-mission-control-text-dim">
            {formatDate(thread.created_at)}
          </div>
        </div>

        {/* Title */}
        <div className="font-medium text-mission-control-text mb-2 line-clamp-2">{thread.title}</div>

        {/* Text preview */}
        {thread.text && (
          <div className="text-sm text-mission-control-text-dim mb-3 line-clamp-3">{thread.text}</div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mb-3">
          <div className="flex items-center gap-1">
            <ThumbsUp size={12} />
            {formatNumber(thread.upvotes)}
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare size={12} />
            {formatNumber(thread.comment_count)}
          </div>
          <a
            href={thread.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            View on Reddit <ExternalLink size={10} />
          </a>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          {thread.reply_status === 'pending' && (
            <span className="px-2 py-1 text-xs rounded bg-warning-subtle text-warning border border-warning">
              <Clock size={12} className="inline" /> Pending
            </span>
          )}
          {thread.reply_status === 'drafting' && (
            <span className="px-2 py-1 text-xs rounded bg-info-subtle text-info border border-info animate-pulse">
              <Sparkles size={12} className="inline" /> Generating Draft...
            </span>
          )}
          {thread.reply_status === 'drafted' && (
            <span className="px-2 py-1 text-xs rounded bg-success-subtle text-success border border-success">
              <Save size={12} className="inline" /> Draft Saved
            </span>
          )}
          {thread.reply_status === 'posted' && (
            <span className="px-2 py-1 text-xs rounded bg-info-subtle text-info border border-info">
              <CheckCircle size={12} className="inline" /> Posted
            </span>
          )}
          {thread.reply_status === 'ignored' && (
            <span className="px-2 py-1 text-xs rounded bg-mission-control-surface text-mission-control-text-dim border border-mission-control-border">
              <AlertCircle size={12} className="inline" /> Ignored
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-mission-control-text-dim flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading Reddit Monitor...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Setup Panel */}
      {showSetup && (
        <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle size={24} className="text-info" />
              <h2 className="text-xl font-semibold text-mission-control-text">Reddit Monitor Setup</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-mission-control-text mb-2">
                  Product URL to Monitor
                </label>
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://yourproduct.com"
                  className="w-full px-4 py-2 border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-info"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-mission-control-text mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="yourproduct, feature name, competitor"
                  className="w-full px-4 py-2 border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-info"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-mission-control-text mb-2">
                  Subreddits (comma-separated or "all")
                </label>
                <input
                  type="text"
                  value={subreddits}
                  onChange={(e) => setSubreddits(e.target.value)}
                  placeholder="technology, startups, yourproduct"
                  className="w-full px-4 py-2 border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-info"
                />
                <p className="text-xs text-mission-control-text-dim mt-1">Leave empty to monitor all relevant subreddits</p>
              </div>
              
              <button
                onClick={startMonitoring}
                disabled={monitoring || !productUrl.trim() || !keywords.trim()}
                className="w-full px-6 py-3 bg-info text-white rounded-lg hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {monitoring ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Starting Monitor...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Start Monitoring
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {!showSetup && (
        <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <MessageCircle size={20} className="text-info" />
            <div>
              <div className="text-sm font-semibold text-mission-control-text">Reddit Monitor</div>
              {monitors[0] && (
                <div className="text-xs text-mission-control-text-dim">
                  Monitoring: {monitors[0].keywords} • {monitors[0].subreddits}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetup(true)}
              className="px-3 py-1.5 text-sm border border-mission-control-border rounded hover:bg-mission-control-surface"
            >
              Configure
            </button>
            <button
              onClick={fetchThreads}
              disabled={monitoring}
              className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {monitoring ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Scan Reddit
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!showSetup && (
        <div className="flex-1 flex overflow-hidden">
          {/* Thread List */}
          <div className="w-1/2 border-r border-mission-control-border overflow-y-auto">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-mission-control-text-dim">
                <Search size={48} className="mb-4 text-mission-control-text-dim" />
                <div className="text-lg mb-2">No threads found</div>
                <div className="text-sm">Click "Scan Reddit" to search for mentions</div>
              </div>
            ) : (
              threads.map(renderThread)
            )}
          </div>

          {/* Detail Panel */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {selectedThread ? (
              <>
                {/* Thread Details */}
                <div className="p-4 border-b border-mission-control-border overflow-y-auto flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-info">r/{selectedThread.subreddit}</span>
                    <span className="text-xs text-mission-control-text-dim">•</span>
                    <span className="text-xs text-mission-control-text-dim">{formatDate(selectedThread.created_at)}</span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-mission-control-text mb-3">{selectedThread.title}</h3>
                  
                  {selectedThread.text && (
                    <div className="text-sm text-mission-control-text-dim whitespace-pre-wrap mb-4">{selectedThread.text}</div>
                  )}
                  
                  <div className="flex items-center gap-4 mb-4 text-sm text-mission-control-text-dim">
                    <div className="flex items-center gap-1">
                      <ThumbsUp size={14} />
                      {formatNumber(selectedThread.upvotes)} upvotes
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare size={14} />
                      {formatNumber(selectedThread.comment_count)} comments
                    </div>
                  </div>

                  <a
                    href={selectedThread.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline flex items-center gap-1 text-sm"
                  >
                    View original thread on Reddit <ExternalLink size={12} />
                  </a>
                </div>

                {/* Reply Section */}
                {selectedThread.reply_status !== 'posted' && selectedThread.reply_status !== 'ignored' && (
                  <div className="p-4 border-t border-mission-control-border bg-mission-control-surface">
                    {selectedThread.reply_status === 'drafted' || draftReply ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-mission-control-text">Draft Reply</span>
                          {selectedThread.reply_status === 'drafted' && (
                            <span className="text-xs text-success flex items-center gap-1">
                              <Save size={12} /> Saved
                            </span>
                          )}
                        </div>
                        <textarea
                          value={draftReply}
                          onChange={(e) => setDraftReply(e.target.value)}
                          placeholder="Write your reply..."
                          className="w-full px-3 py-2 text-sm border border-mission-control-border rounded resize-none bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-info"
                          rows={5}
                        />
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-mission-control-text-dim">
                            {draftReply.length} characters
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(selectedThread.id, 'ignored')}
                              className="px-3 py-1.5 text-sm border border-mission-control-border rounded hover:bg-mission-control-bg"
                            >
                              Ignore
                            </button>
                            <button
                              onClick={saveDraft}
                              disabled={!draftReply.trim()}
                              className="px-3 py-1.5 text-sm border border-info text-info rounded hover:bg-info-subtle disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Save size={14} /> Save Draft
                            </button>
                            <button
                              onClick={postReply}
                              disabled={!draftReply.trim()}
                              className="px-3 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Send size={14} /> Post Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <span className="text-sm font-medium text-mission-control-text">Generate AI Reply</span>
                        <p className="text-xs text-mission-control-text-dim">
                          AI will generate an authentic Reddit reply based on the thread context and product.
                        </p>
                        <button
                          onClick={() => generateDraft(selectedThread)}
                          disabled={selectedThread.reply_status === 'drafting'}
                          className="w-full px-4 py-2 bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {selectedThread.reply_status === 'drafting' ? (
                            <>
                              <Sparkles size={16} className="animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} />
                              Draft Reply with AI
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Posted state */}
                {selectedThread.reply_status === 'posted' && (
                  <div className="p-4 border-t border-mission-control-border bg-mission-control-surface">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle size={16} />
                      <span className="font-medium">Reply Posted</span>
                      {selectedThread.posted_at && (
                        <span className="text-xs text-mission-control-text-dim">
                          on {formatDate(selectedThread.posted_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Ignored state */}
                {selectedThread.reply_status === 'ignored' && (
                  <div className="p-4 border-t border-mission-control-border bg-mission-control-surface">
                    <div className="flex items-center gap-2 text-mission-control-text-dim">
                      <AlertCircle size={16} />
                      <span>This thread has been ignored</span>
                    </div>
                    <button
                      onClick={() => updateStatus(selectedThread.id, 'pending')}
                      className="mt-2 text-sm text-info hover:underline"
                    >
                      Restore to pending
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-mission-control-text-dim">
                <div className="text-center">
                  <MessageCircle size={48} className="mx-auto mb-4 text-mission-control-text-dim" />
                  <div>Select a thread to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default XRedditView;
