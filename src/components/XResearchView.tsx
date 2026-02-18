import { useState, useEffect, useCallback } from 'react';
import { Search, Save, Trash2, ExternalLink, MessageCircle, User, Hash, Loader2, Check, X, Send } from 'lucide-react';
import { Spinner } from './LoadingStates';

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
    
    try {
      // Use x-api to search
      const xApi = (window as any).xApi;
      if (xApi) {
        const searchResults = await xApi.search(query, { count: 20 });
        if (searchResults?.data) {
          const formatted: ResearchResult[] = searchResults.data.map((item: any, idx: number) => ({
            id: item.id || `search-${idx}`,
            type: 'tweet',
            content: item.text,
            author: item.author?.name,
            username: item.author?.username,
            followers: item.author?.public_metrics?.followers_count,
            likes: item.public_metrics?.like_count,
            retweets: item.public_metrics?.retweet_count,
            replies: item.public_metrics?.reply_count,
            impressions: item.public_metrics?.impression_count,
            date: item.created_at,
            url: `https://x.com/${item.author?.username}/status/${item.id}`,
          }));
          setResults(formatted);
        }
      } else {
        // Fallback to mock data for demo
        await new Promise(r => setTimeout(r, 1500));
        const mockResults: ResearchResult[] = [
          {
            id: '1',
            type: 'tweet',
            content: `Discussion about ${query} - interesting insights on current trends and best practices. #${query.replace(/\s+/g, '')}`,
            author: 'Tech Influencer',
            username: '@techinfluencer',
            followers: 125000,
            likes: 892,
            retweets: 234,
            replies: 67,
            impressions: 45000,
            date: new Date().toISOString(),
            url: 'https://x.com/techinfluencer/status/1',
          },
          {
            id: '2',
            type: 'tweet',
            content: `Hot take: ${query} is changing the game. Here is what you need to know...`,
            author: 'Industry Expert',
            username: '@industryexpert',
            followers: 89000,
            likes: 456,
            retweets: 123,
            replies: 89,
            impressions: 28000,
            date: new Date(Date.now() - 86400000).toISOString(),
            url: 'https://x.com/industryexpert/status/2',
          },
          {
            id: '3',
            type: 'user',
            username: `@${query.replace(/\s+/g, '').toLowerCase()}fan`,
            author: `${query} Enthusiast`,
            followers: 5400,
            engagement: 4.2,
          },
          {
            id: '4',
            type: 'topic',
            content: undefined,
            author: undefined,
            tweetCount: 1250,
          },
          {
            id: '5',
            type: 'tweet',
            content: `Thread on ${query}: Breaking down the fundamentals and advanced strategies. 🧵`,
            author: 'Content Creator',
            username: '@contentcreator',
            followers: 67000,
            likes: 1203,
            retweets: 567,
            replies: 234,
            impressions: 89000,
            date: new Date(Date.now() - 172800000).toISOString(),
            url: 'https://x.com/contentcreator/status/5',
          },
          {
            id: '6',
            type: 'thread',
            content: `Complete guide to ${query}: 15 tips that will transform your approach.`,
            author: 'Thought Leader',
            username: '@thoughtleader',
            followers: 234000,
            likes: 3456,
            retweets: 1234,
            replies: 567,
            impressions: 156000,
            date: new Date(Date.now() - 259200000).toISOString(),
            url: 'https://x.com/thoughtleader/status/6',
          },
        ];
        setResults(mockResults);
      }
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
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-clawd-text flex items-center gap-2">
              <Search size={20} className="text-clawd-accent" />
              Research
            </h1>
            <p className="text-sm text-clawd-text-dim mt-1">
              Search X/Twitter for content inspiration and competitive insights
            </p>
          </div>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showLibrary
                ? 'bg-clawd-accent text-white'
                : 'bg-clawd-surface border border-clawd-border text-clawd-text hover:border-clawd-accent/50'
            }`}
          >
            <Save size={16} />
            {showLibrary ? 'Back to Results' : `Library (${savedItems.length})`}
          </button>
        </div>

        {/* Search Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search tweets, users, topics..."
              className="w-full pl-10 pr-4 py-3 bg-clawd-surface border border-clawd-border rounded-lg text-clawd-text placeholder:text-clawd-text-dim focus:outline-none focus:border-clawd-accent"
            />
          </div>
          <button
            onClick={performSearch}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
            <h2 className="font-semibold text-clawd-text">Research Library</h2>
            {savedItems.length === 0 ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <Save size={32} className="mx-auto mb-3 opacity-30" />
                <p>No saved research yet</p>
                <p className="text-sm mt-1">Search for content and save results to build your library</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedItems.map((saved) => (
                  <div
                    key={saved.id}
                    className="bg-clawd-surface border border-clawd-border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium text-clawd-text">{saved.query}</div>
                        <div className="text-sm text-clawd-text-dim">
                          {saved.results.length} items • Saved {new Date(saved.savedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSavedResults(saved)}
                          className="p-2 hover:bg-clawd-bg rounded-lg text-clawd-text-dim hover:text-clawd-text transition-colors"
                          title="Load results"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => deleteSaved(saved.id)}
                          className="p-2 hover:bg-clawd-bg rounded-lg text-clawd-text-dim hover:text-review transition-colors"
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
                          className="px-2 py-1 bg-clawd-bg rounded text-xs text-clawd-text-dim"
                        >
                          {getTypeIcon(r.type)} {getTypeLabel(r.type)}
                        </span>
                      ))}
                      {saved.results.length > 5 && (
                        <span className="px-2 py-1 text-xs text-clawd-text-dim">
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
            <p className="text-clawd-text-dim mt-4">Searching X/Twitter...</p>
          </div>
        ) : !searched ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={48} className="text-clawd-text-dim opacity-30 mb-4" />
            <p className="text-clawd-text font-medium mb-2">Research X/Twitter Content</p>
            <p className="text-clawd-text-dim text-sm max-w-md">
              Enter a search query to find trending tweets, relevant users, and topics. Save your findings to build a research library for content planning.
            </p>
          </div>
        ) : results.length === 0 ? (
          /* No Results */
          <div className="text-center py-16 text-clawd-text-dim">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p>No results found for "{query}"</p>
            <p className="text-sm mt-1">Try different keywords</p>
          </div>
        ) : (
          /* Results */
          <div className="space-y-4">
            {/* Selection Actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-clawd-surface border border-clawd-accent/50 rounded-xl p-3">
                <span className="text-sm text-clawd-text">
                  <Check size={16} className="inline mr-1" />
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={saveToLibrary}
                  className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 transition-colors text-sm font-medium"
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
                  className={`bg-clawd-surface border rounded-xl p-4 cursor-pointer transition-all hover:border-clawd-accent/50 ${
                    selectedIds.has(result.id)
                      ? 'border-clawd-accent bg-clawd-accent/5'
                      : 'border-clawd-border'
                  }`}
                  onClick={() => toggleSelection(result.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Selection Checkbox */}
                    <div className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedIds.has(result.id)
                        ? 'bg-clawd-accent border-clawd-accent'
                        : 'border-clawd-border'
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
                          'bg-clawd-accent/20 text-clawd-accent'
                        }`}>
                          {getTypeIcon(result.type)} {getTypeLabel(result.type)}
                        </span>
                        {result.username && (
                          <span className="text-sm text-clawd-text-dim">{result.username}</span>
                        )}
                      </div>

                      {/* Tweet Content */}
                      {result.content && (
                        <p className="text-sm text-clawd-text mb-3 line-clamp-3">
                          {result.content}
                        </p>
                      )}

                      {/* Metrics */}
                      {(result.likes || result.retweets || result.replies || result.followers) && (
                        <div className="flex items-center gap-4 text-xs text-clawd-text-dim">
                          {result.followers !== undefined && (
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              {formatNumber(result.followers)} followers
                            </span>
                          )}
                          {result.likes !== undefined && (
                            <span>❤️ {formatNumber(result.likes)}</span>
                          )}
                          {result.retweets !== undefined && (
                            <span>🔁 {formatNumber(result.retweets)}</span>
                          )}
                          {result.replies !== undefined && (
                            <span>💬 {formatNumber(result.replies)}</span>
                          )}
                          {result.impressions !== undefined && (
                            <span>👁️ {formatNumber(result.impressions)}</span>
                          )}
                        </div>
                      )}

                      {/* Topic/Thread Count */}
                      {(result.tweetCount || result.engagement) && (
                        <div className="flex items-center gap-4 text-xs text-clawd-text-dim mt-2">
                          {result.tweetCount !== undefined && (
                            <span>{result.tweetCount.toLocaleString()} tweets</span>
                          )}
                          {result.engagement !== undefined && (
                            <span>{result.engagement}% engagement</span>
                          )}
                        </div>
                      )}

                      {/* Date & Link */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-clawd-border">
                        <span className="text-xs text-clawd-text-dim">
                          {result.date && new Date(result.date).toLocaleDateString()}
                        </span>
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default XResearchView;
