import { useState, useEffect } from 'react';
import { Star, Search, X, Trash2, Tag, Calendar, MessageCircle, Filter, ExternalLink } from 'lucide-react';
import MarkdownMessage from './MarkdownMessage';
import { showToast } from './Toast';

interface StarredMessage {
  id: number;
  message_id: number;
  session_key: string;
  channel: string;
  message_role: string;
  message_content: string;
  message_timestamp: string;
  starred_at: string;
  starred_by: string;
  note?: string;
  category?: string;
}

export default function StarredMessagesPanel() {
  const [starred, setStarred] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sessionFilter, setSessionFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<{ total: number }>({ total: 0 });

  useEffect(() => {
    loadStarred();
    loadStats();
  }, [categoryFilter, sessionFilter]);

  const loadStarred = async () => {
    setLoading(true);
    try {
      const options: any = { limit: 100 };
      if (categoryFilter) options.category = categoryFilter;
      if (sessionFilter) options.sessionKey = sessionFilter;

      const result = await window.clawdbot?.starred?.list(options);
      if (result?.success) {
        setStarred(result.starred || []);
      } else {
        showToast('Failed to load starred messages', 'error');
      }
    } catch (error: any) {
      console.error('Load starred error:', error);
      showToast('Error loading starred messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.clawdbot?.starred?.stats();
      if (result?.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadStarred();
      return;
    }

    setLoading(true);
    try {
      const result = await window.clawdbot?.starred?.search(searchQuery, 50);
      if (result?.success) {
        setStarred(result.results || []);
      } else {
        showToast('Search failed', 'error');
      }
    } catch (error) {
      console.error('Search error:', error);
      showToast('Error searching starred messages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnstar = async (messageId: number) => {
    try {
      const result = await window.clawdbot?.starred?.unstar(messageId);
      if (result?.success) {
        showToast('Message unstarred', 'success');
        loadStarred();
        loadStats();
      } else {
        showToast('Failed to unstar message', 'error');
      }
    } catch (error) {
      console.error('Unstar error:', error);
      showToast('Error unstarring message', 'error');
    }
  };

  const clearFilters = () => {
    setCategoryFilter('');
    setSessionFilter('');
    setSearchQuery('');
  };

  const uniqueCategories = Array.from(new Set(starred.map(s => s.category).filter(Boolean))) as string[];
  const uniqueSessions = Array.from(new Set(starred.map(s => s.session_key).filter(Boolean))) as string[];

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="bg-clawd-surface border-b border-clawd-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            <div>
              <h2 className="text-xl font-bold text-clawd-text">Starred Messages</h2>
              <p className="text-sm text-clawd-text-dim">{stats.total} starred</p>
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-3 py-2 bg-clawd-surface hover:bg-clawd-border/50 rounded-lg flex items-center gap-2 text-sm"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-clawd-text-dim" />
            <input
              type="text"
              placeholder="Search starred messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Search
          </button>
          {(searchQuery || categoryFilter || sessionFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-clawd-border/50 hover:bg-clawd-border rounded-lg flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-clawd-bg rounded-lg space-y-3">
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-clawd-text mb-1">
                Session
              </label>
              <select
                value={sessionFilter}
                onChange={(e) => setSessionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-clawd-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All sessions</option>
                {uniqueSessions.map(session => (
                  <option key={session} value={session}>
                    {session.split(':').pop()?.substring(0, 20) || session}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-12 text-clawd-text-dim">
            Loading starred messages...
          </div>
        ) : starred.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-16 h-16 text-clawd-text-dim mx-auto mb-4" />
            <p className="text-clawd-text-dim text-lg">No starred messages</p>
            <p className="text-clawd-text-dim text-sm mt-2">
              Star messages to bookmark them for quick reference
            </p>
          </div>
        ) : (
          starred.map((msg) => (
            <div
              key={msg.id}
              className="bg-clawd-surface rounded-lg border border-clawd-border p-4 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-clawd-text">
                        {msg.channel || 'unknown'}
                      </span>
                      <span className="text-xs text-clawd-text-dim">•</span>
                      <span className="text-sm text-clawd-text-dim">
                        {msg.message_role === 'user' ? 'You' : 'Assistant'}
                      </span>
                      {msg.category && (
                        <>
                          <span className="text-xs text-clawd-text-dim">•</span>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            <Tag className="w-3 h-3" />
                            {msg.category}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-clawd-text-dim">
                      <Calendar className="w-3 h-3" />
                      <span>
                        {new Date(msg.message_timestamp).toLocaleString()}
                      </span>
                      <span className="text-clawd-text-dim">•</span>
                      <span>
                        Starred {new Date(msg.starred_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnstar(msg.message_id)}
                  className="p-2 text-clawd-text-dim hover:text-red-600 hover:bg-error-subtle rounded-lg transition-colors"
                  title="Remove star"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Note */}
              {msg.note && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">{msg.note}</p>
                  </div>
                </div>
              )}

              {/* Message Content */}
              <div className="prose prose-sm max-w-none">
                <MarkdownMessage content={msg.message_content} />
              </div>

              {/* Session Link */}
              {msg.session_key && (
                <div className="mt-3 pt-3 border-t border-clawd-border">
                  <button
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    onClick={() => {
                      // TODO: Navigate to session
                      showToast('Session navigation coming soon', 'info');
                    }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    View in conversation
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
