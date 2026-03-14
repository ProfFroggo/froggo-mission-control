import { useState, useEffect, useCallback } from 'react';
import { Search, Save, Trash2, ExternalLink, MessageCircle, User, Hash, Loader2, Check, Send, Lightbulb } from 'lucide-react';
import { Spinner } from './LoadingStates';
import { scheduleApi } from '../lib/api';
import { showToast } from './Toast';

interface ResearchResult {
  id: string;
  type: 'tweet' | 'thread' | 'user' | 'topic';
  content?: string;
  author?: string;
  username?: string;
  followers?: number;
  engagement?: number;
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  date?: string;
  url?: string;
  tweetCount?: number;
}

interface SavedResearch {
  id: string;
  query: string;
  results: ResearchResult[];
  savedAt: number;
}

export function XResearchView() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savedItems, setSavedItems] = useState<SavedResearch[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load saved research from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x-research-library');
    if (saved) {
      try {
        setSavedItems(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const performSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setSelectedIds(new Set());

    // Send to researcher agent via agent chat for AI-powered research
    window.dispatchEvent(new CustomEvent('x-agent-chat-inject', {
      detail: { message: `Research X/Twitter for: "${query.trim()}"\n\nSearch for relevant tweets, users, and topics. Analyze engagement patterns and content opportunities. Provide actionable insights for our content strategy.` }
    }));

    try {
      const res = await fetch(`/api/x/search?q=${encodeURIComponent(query.trim())}&max=20`);
      if (!res.ok) { setResults([]); return; }
      const data = await res.json();
      const authorMap: Record<string, any> = {};
      for (const u of data.includes?.users ?? []) authorMap[u.id] = u;
      const formatted: ResearchResult[] = (data.tweets ?? []).map((item: any) => {
        const author = authorMap[item.author_id] || {};
        return {
          id: item.id || '',
          type: 'tweet' as const,
          content: item.text,
          author: author.name,
          username: author.username,
          followers: author.public_metrics?.followers_count,
          likes: item.public_metrics?.like_count || 0,
          retweets: item.public_metrics?.retweet_count || 0,
          replies: item.public_metrics?.reply_count || 0,
          impressions: item.public_metrics?.impression_count || 0,
          date: item.created_at,
          url: author.username ? `https://x.com/${author.username}/status/${item.id}` : undefined,
        };
      });
      setResults(formatted);
    } catch (error) {
      console.error('Research search error:', error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const saveToLibrary = () => {
    const selectedResults = results.filter(r => selectedIds.has(r.id));
    if (selectedResults.length === 0) return;
    
    const newSaved: SavedResearch = {
      id: Date.now().toString(),
      query,
      results: selectedResults,
      savedAt: Date.now(),
    };
    
    const updated = [newSaved, ...savedItems];
    setSavedItems(updated);
    localStorage.setItem('x-research-library', JSON.stringify(updated));
    setSelectedIds(new Set());
    setShowLibrary(true);
  };

  const deleteSaved = (id: string) => {
    const updated = savedItems.filter(s => s.id !== id);
    setSavedItems(updated);
    localStorage.setItem('x-research-library', JSON.stringify(updated));
  };

  const loadSavedResults = (saved: SavedResearch) => {
    setQuery(saved.query);
    setResults(saved.results);
    setSelectedIds(new Set(saved.results.map(r => r.id)));
    setShowLibrary(false);
    setSearched(true);
  };

  const saveAsIdea = async (result: ResearchResult) => {
    const content = result.content || result.url || '';
    if (!content) return;
    try {
      await scheduleApi.create({
        type: 'idea',
        content: `[Research] ${content}`,
        platform: 'twitter',
        status: 'idea',
        metadata: JSON.stringify({ source: result.url, author: result.username, savedFrom: 'research' }),
      });
      showToast('success', 'Saved as idea');
    } catch {
      showToast('error', 'Failed to save idea');
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (!num) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const getTypeIcon = (type: ResearchResult['type']) => {
    switch (type) {
      case 'tweet':
      case 'thread':
        return <MessageCircle size={14} />;
      case 'user':
        return <User size={14} />;
      case 'topic':
        return <Hash size={14} />;
    }
  };

  const getTypeLabel = (type: ResearchResult['type']) => {
    switch (type) {
      case 'tweet':
        return 'Tweet';
      case 'thread':
        return 'Thread';
      case 'user':
        return 'Profile';
      case 'topic':
        return 'Topic';
    }
  };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-mission-control-text flex items-center gap-2">
              <Search size={20} className="text-mission-control-accent" />
              Research
            </h1>
            <p className="text-sm text-mission-control-text-dim mt-1">
              Search social media for content inspiration and competitive insights
            </p>
          </div>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showLibrary
                ? 'bg-mission-control-accent text-white'
                : 'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:border-mission-control-accent/50'
            }`}
          >
            <Save size={16} />
            {showLibrary ? 'Back to Results' : `Library (${savedItems.length})`}
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search tweets, users, topics..."
              className="w-full pl-10 pr-4 py-3 bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:border-mission-control-accent"
            />
          </div>
          <button
            onClick={performSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Searching...' : 'Start Research'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showLibrary ? (
          /* Library View */
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-mission-control-text">Research Library</h2>
            {savedItems.length === 0 ? (
              <div className="text-center py-12 text-mission-control-text-dim">
                <Save size={32} className="mx-auto mb-3 opacity-30" />
                <p>No saved research yet</p>
                <p className="text-sm mt-1">Search for content and save results to build your library</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedItems.map((saved) => (
                  <div
                    key={saved.id}
                    className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-mission-control-text">{saved.query}</div>
                        <div className="text-sm text-mission-control-text-dim">
                          {saved.results.length} items • Saved {new Date(saved.savedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSavedResults(saved)}
                          className="p-2 hover:bg-mission-control-bg rounded-lg text-mission-control-text-dim hover:text-mission-control-text transition-colors"
                          title="Load results"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => deleteSaved(saved.id)}
                          className="p-2 hover:bg-mission-control-bg rounded-lg text-mission-control-text-dim hover:text-review transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {saved.results.slice(0, 5).map((r) => (
                        <span
                          key={r.id}
                          className="px-2 py-1 bg-mission-control-bg rounded text-xs text-mission-control-text-dim"
                        >
                          {getTypeIcon(r.type)} {getTypeLabel(r.type)}
                        </span>
                      ))}
                      {saved.results.length > 5 && (
                        <span className="px-2 py-1 text-xs text-mission-control-text-dim">
                          +{saved.results.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner size={40} />
            <p className="text-mission-control-text-dim mt-4">Searching...</p>
          </div>
        ) : !searched ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={48} className="text-mission-control-text-dim opacity-30 mb-4" />
            <p className="text-mission-control-text font-medium mb-2">Research Social Media Content</p>
            <p className="text-mission-control-text-dim text-sm max-w-md">
              Enter a search query to find trending tweets, relevant users, and topics. Save your findings to build a research library for content planning.
            </p>
          </div>
        ) : results.length === 0 ? (
          /* No Results from API — agent is researching */
          <div className="text-center py-16 text-mission-control-text-dim">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-mission-control-text font-medium">Researcher is working on it</p>
            <p className="text-sm mt-2">Check the agent chat on the left for research results.</p>
            <p className="text-xs mt-1">Direct API returned no results for &quot;{query}&quot;</p>
          </div>
        ) : (
          /* Results */
          <div className="space-y-4">
            {/* Selection Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-mission-control-surface border border-mission-control-accent/50 rounded-xl p-3">
                <span className="text-sm text-mission-control-text">
                  <Check size={16} className="inline mr-1" />
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={saveToLibrary}
                  className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors text-sm font-medium"
                >
                  <Save size={16} />
                  Save to Library
                </button>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid gap-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  role="button"
                  tabIndex={0}
                  className={`bg-mission-control-surface border rounded-xl p-4 cursor-pointer transition-all hover:border-mission-control-accent/50 ${
                    selectedIds.has(result.id)
                      ? 'border-mission-control-accent bg-mission-control-accent/5'
                      : 'border-mission-control-border'
                  }`}
                  onClick={() => toggleSelection(result.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelection(result.id); }}
                >
                  <div className="flex items-start gap-3">
                    {/* Selection Checkbox */}
                    <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(result.id)
                        ? 'bg-mission-control-accent border-mission-control-accent'
                        : 'border-mission-control-border'
                    }`}>
                      {selectedIds.has(result.id) && <Check size={12} className="text-white" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Type Badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          result.type === 'tweet' ? 'bg-info-subtle text-info' :
                          result.type === 'thread' ? 'bg-success-subtle text-success' :
                          result.type === 'user' ? 'bg-purple-subtle text-purple-500' :
                          'bg-mission-control-accent/20 text-mission-control-accent'
                        }`}>
                          {getTypeIcon(result.type)} {getTypeLabel(result.type)}
                        </span>
                        {result.username && (
                          <span className="text-sm text-mission-control-text-dim">{result.username}</span>
                        )}
                      </div>

                      {/* Tweet Content */}
                      {result.content && (
                        <p className="text-sm text-mission-control-text mb-3 line-clamp-3">
                          {result.content}
                        </p>
                      )}

                      {/* Metrics */}
                      {(result.likes || result.retweets || result.replies || result.followers) && (
                        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim">
                          {result.followers !== undefined && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {formatNumber(result.followers)} followers
                            </span>
                          )}
                          {result.likes !== undefined && (
                            <span>{formatNumber(result.likes)} likes</span>
                          )}
                          {result.retweets !== undefined && (
                            <span>{formatNumber(result.retweets)} RT</span>
                          )}
                          {result.replies !== undefined && (
                            <span>{formatNumber(result.replies)} replies</span>
                          )}
                          {result.impressions !== undefined && (
                            <span>{formatNumber(result.impressions)} views</span>
                          )}
                        </div>
                      )}

                      {/* Topic/Thread Count */}
                      {(result.tweetCount || result.engagement) && (
                        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mt-2">
                          {result.tweetCount !== undefined && (
                            <span>{result.tweetCount.toLocaleString()} tweets</span>
                          )}
                          {result.engagement !== undefined && (
                            <span>{result.engagement}% engagement</span>
                          )}
                        </div>
                      )}

                      {/* Date & Link & Save as Idea */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-mission-control-border">
                        <span className="text-xs text-mission-control-text-dim">
                          {result.date && new Date(result.date).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); saveAsIdea(result); }}
                            className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-info transition-colors"
                            title="Save as idea draft"
                          >
                            <Lightbulb size={12} />
                            Save as Idea
                          </button>
                          {result.url && (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-info hover:underline flex items-center gap-1"
                            >
                              View on X <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XResearchView;
