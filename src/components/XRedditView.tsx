import React, { useState, useEffect } from 'react';
import { MessageCircle, Search, ExternalLink, RefreshCw, Send, Save, Sparkles, X, CheckCircle, Clock, AlertCircle, ThumbsUp, MessageSquare, Calendar } from 'lucide-react';

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
      const result = await window.clawdbot?.xReddit?.listMonitors?.();
      if (result?.success && result.monitors) {
        setMonitors(result.monitors as RedditMonitor[]);
        if (result.monitors.length > 0) {
          setShowSetup(false);
        }
      }
    } catch (error) {
      // Error loading monitors
    }
    setLoading(false);
  };

  const loadThreads = async () => {
    try {
      const result = await window.clawdbot?.xReddit?.listThreads?.({});
      if (result?.success && result.threads) {
        setThreads(result.threads as RedditThread[]);
      }
    } catch (error) {
      // Error loading threads
    }
  };

  const startMonitoring = async () => {
    if (!productUrl.trim() || !keywords.trim()) return;
    
    setMonitoring(true);
    try {
      const result = await window.clawdbot?.xReddit?.createMonitor?.({
        productUrl: productUrl.trim(),
        keywords: keywords.trim(),
        subreddits: subreddits.trim() || 'all',
      });
      
      if (result?.success) {
        await loadMonitors();
        // Fetch threads based on new monitor
        await fetchThreads();
        setShowSetup(false);
      }
    } catch (error) {
      // Error starting monitoring
    } finally {
      setMonitoring(false);
    }
  };

  const fetchThreads = async () => {
    setMonitoring(true);
    try {
      const result = await window.clawdbot?.xReddit?.fetch?.();
      if (result?.success) {
        await loadThreads();
      }
    } catch (error) {
      // Error fetching threads
    } finally {
      setMonitoring(false);
    }
  };

  const generateDraft = async (thread: RedditThread) => {
    setSelectedThread({ ...thread, reply_status: 'drafting' });
    setDraftReply('');
    
    try {
      const result = await window.clawdbot?.xReddit?.generateDraft?.({
        threadId: thread.id,
        threadTitle: thread.title,
        threadText: thread.text,
        subreddit: thread.subreddit,
      });
      
      if (result?.success && result.draft) {
        setDraftReply(result.draft);
      }
    } catch (error) {
      // Error generating draft
    }
  };

  const saveDraft = async () => {
    if (!selectedThread || !draftReply.trim()) return;
    
    try {
      const result = await window.clawdbot?.xReddit?.saveDraft?.({
        threadId: selectedThread.id,
        replyText: draftReply.trim(),
      });
      
      if (result?.success) {
        setThreads(threads.map(t => 
          t.id === selectedThread.id 
            ? { ...t, reply_status: 'drafted', drafted_reply: draftReply.trim() }
            : t
        ));
        if (selectedThread) {
          setSelectedThread({ ...selectedThread, reply_status: 'drafted', drafted_reply: draftReply.trim() });
        }
      }
    } catch (error) {
      // Error saving draft
    }
  };

  const postReply = async () => {
    if (!selectedThread || !draftReply.trim()) return;
    
    try {
      const result = await window.clawdbot?.xReddit?.postReply?.({
        threadId: selectedThread.id,
        replyText: draftReply.trim(),
      });
      
      if (result?.success) {
        setThreads(threads.map(t => 
          t.id === selectedThread.id 
            ? { ...t, reply_status: 'posted', posted_at: Date.now() }
            : t
        ));
        if (selectedThread) {
          setSelectedThread({ ...selectedThread, reply_status: 'posted' });
        }
        setDraftReply('');
      }
    } catch (error) {
      // Error posting reply
    }
  };

  const updateStatus = async (threadId: string, status: RedditThread['reply_status']) => {
    try {
      await window.clawdbot?.xReddit?.updateThread?.({ threadId, status });
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
        className={`border-b border-clawd-border p-4 hover:bg-clawd-surface transition-colors cursor-pointer ${
          isSelected ? 'bg-clawd-surface' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-info">r/{thread.subreddit}</span>
            <span className="text-xs text-clawd-text-dim">by u/{thread.author}</span>
          </div>
          <div className="text-xs text-clawd-text-dim">
            {formatDate(thread.created_at)}
          </div>
        </div>

        {/* Title */}
        <div className="font-medium text-clawd-text mb-2 line-clamp-2">{thread.title}</div>

        {/* Text preview */}
        {thread.text && (
          <div className="text-sm text-clawd-text-dim mb-3 line-clamp-3">{thread.text}</div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs text-clawd-text-dim mb-3">
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
            <span className="px-2 py-1 text-xs rounded bg-clawd-surface text-clawd-text-dim border border-clawd-border">
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
        <div className="text-clawd-text-dim flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin" /> Loading Reddit Monitor...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Setup Panel */}
      {showSetup && (
        <div className="p-6 border-b border-clawd-border bg-clawd-surface">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-6">
              <MessageCircle size={24} className="text-info" />
              <h2 className="text-xl font-semibold text-clawd-text">Reddit Monitor Setup</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-clawd-text mb-2">
                  Product URL to Monitor
                </label>
                <input
                  type="url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://yourproduct.com"
                  className="w-full px-4 py-2 border border-clawd-border rounded-lg bg-clawd-bg text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-info"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-clawd-text mb-2">
                  Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="yourproduct, feature name, competitor"
                  className="w-full px-4 py-2 border border-clawd-border rounded-lg bg-clawd-bg text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-info"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-clawd-text mb-2">
                  Subreddits (comma-separated or "all")
                </label>
                <input
                  type="text"
                  value={subreddits}
                  onChange={(e) => setSubreddits(e.target.value)}
                  placeholder="technology, startups, yourproduct"
                  className="w-full px-4 py-2 border border-clawd-border rounded-lg bg-clawd-bg text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-info"
                />
                <p className="text-xs text-clawd-text-dim mt-1">Leave empty to monitor all relevant subreddits</p>
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
        <div className="flex items-center justify-between p-4 border-b border-clawd-border">
          <div className="flex items-center gap-3">
            <MessageCircle size={20} className="text-info" />
            <div>
              <div className="font-semibold text-clawd-text">Reddit Monitor</div>
              {monitors[0] && (
                <div className="text-xs text-clawd-text-dim">
                  Monitoring: {monitors[0].keywords} • {monitors[0].subreddits}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSetup(true)}
              className="px-3 py-1.5 text-sm border border-clawd-border rounded hover:bg-clawd-surface"
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
          <div className="w-1/2 border-r border-clawd-border overflow-y-auto">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-clawd-text-dim">
                <Search size={48} className="mb-4 text-clawd-text-dim" />
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
                <div className="p-4 border-b border-clawd-border overflow-y-auto flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-info">r/{selectedThread.subreddit}</span>
                    <span className="text-xs text-clawd-text-dim">•</span>
                    <span className="text-xs text-clawd-text-dim">{formatDate(selectedThread.created_at)}</span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-clawd-text mb-3">{selectedThread.title}</h3>
                  
                  {selectedThread.text && (
                    <div className="text-sm text-clawd-text-dim whitespace-pre-wrap mb-4">{selectedThread.text}</div>
                  )}
                  
                  <div className="flex items-center gap-4 mb-4 text-sm text-clawd-text-dim">
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
                  <div className="p-4 border-t border-clawd-border bg-clawd-surface">
                    {selectedThread.reply_status === 'drafted' || draftReply ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-clawd-text">Draft Reply</span>
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
                          className="w-full px-3 py-2 text-sm border border-clawd-border rounded resize-none bg-clawd-bg text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-info"
                          rows={5}
                        />
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-clawd-text-dim">
                            {draftReply.length} characters
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateStatus(selectedThread.id, 'ignored')}
                              className="px-3 py-1.5 text-sm border border-clawd-border rounded hover:bg-clawd-bg"
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
                        <span className="text-sm font-medium text-clawd-text">Generate AI Reply</span>
                        <p className="text-xs text-clawd-text-dim">
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
                  <div className="p-4 border-t border-clawd-border bg-clawd-surface">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle size={16} />
                      <span className="font-medium">Reply Posted</span>
                      {selectedThread.posted_at && (
                        <span className="text-xs text-clawd-text-dim">
                          on {formatDate(selectedThread.posted_at)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Ignored state */}
                {selectedThread.reply_status === 'ignored' && (
                  <div className="p-4 border-t border-clawd-border bg-clawd-surface">
                    <div className="flex items-center gap-2 text-clawd-text-dim">
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
              <div className="flex-1 flex items-center justify-center text-clawd-text-dim">
                <div className="text-center">
                  <MessageCircle size={48} className="mx-auto mb-4 text-clawd-text-dim" />
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
