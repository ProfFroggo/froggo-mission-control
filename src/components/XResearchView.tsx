import { useState, useEffect, useCallback } from 'react';
import { Search, Save, Trash2, ExternalLink, MessageCircle, User, Hash, Check, Send, Lightbulb } from 'lucide-react';
import { Button, Spinner, TextField, Flex } from '@radix-ui/themes';
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
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-mission-control-border flex-shrink-0">
        <Flex align="center" justify="between" className="mb-4">
          <div>
            <h1 className="text-lg font-semibold text-mission-control-text flex items-center gap-2">
              <Search size={20} className="text-mission-control-accent" />
              Research
            </h1>
            <p className="text-sm text-mission-control-text-dim mt-1">
              Search social media for content inspiration and competitive insights
            </p>
          </div>
          <Button
            onClick={() => setShowLibrary(!showLibrary)}
            variant={showLibrary ? 'solid' : 'outline'}
            color={showLibrary ? 'violet' : 'gray'}
            size="2"
          >
            <Save size={16} />
            {showLibrary ? 'Back to Results' : `Library (${savedItems.length})`}
          </Button>
        </Flex>

        {/* Search Input */}
        <Flex gap="2">
          <div className="flex-1">
            <TextField.Root
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performSearch()}
              placeholder="Search tweets, users, topics..."
              className="w-full"
            >
              <TextField.Slot>
                <Search size={16} />
              </TextField.Slot>
            </TextField.Root>
          </div>
          <Button
            onClick={performSearch}
            disabled={loading || !query.trim()}
            variant="solid"
            color="violet"
            size="3"
          >
            {loading ? <><Spinner size="1" /> Searching...</> : <><Send size={16} /> Start Research</>}
          </Button>
        </Flex>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showLibrary ? (
          /* Library View */
          <div className="space-y-4">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Research Library</h2>
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
                    className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/30 transition-colors"
                  >
                    <Flex align="center" justify="between" className="mb-3">
                      <div>
                        <div className="font-medium text-mission-control-text">{saved.query}</div>
                        <div className="text-sm text-mission-control-text-dim">
                          {saved.results.length} items • Saved {new Date(saved.savedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Flex align="center" gap="2">
                        <button
                          onClick={() => loadSavedResults(saved)}
                          title="Load results"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => deleteSaved(saved.id)}
                          title="Delete"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Flex>
                    </Flex>
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
            <Spinner size="3" />
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
              <Flex align="center" justify="between" className="bg-mission-control-surface border border-mission-control-accent/50 rounded-lg p-3">
                <span className="text-sm text-mission-control-text">
                  <Check size={16} className="inline mr-1" />
                  {selectedIds.size} selected
                </span>
                <Button
                  onClick={saveToLibrary}
                  variant="solid"
                  color="violet"
                  size="2"
                >
                  <Save size={16} />
                  Save to Library
                </Button>
              </Flex>
            )}

            {/* Results Grid */}
            <div className="grid gap-4">
              {results.map((result) => (
                <div
                  key={result.id}
                  role="button"
                  tabIndex={0}
                  className={`bg-mission-control-surface border rounded-xl p-4 cursor-pointer transition-colors hover:border-mission-control-accent/30 ${
                    selectedIds.has(result.id)
                      ? 'border-mission-control-accent bg-mission-control-accent/5'
                      : 'border-mission-control-border'
                  }`}
                  onClick={() => toggleSelection(result.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelection(result.id); }}
                >
                  <Flex align="start" gap="3">
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
                      <Flex align="center" gap="2" className="mb-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          result.type === 'tweet' ? 'bg-info/10 text-info' :
                          result.type === 'thread' ? 'bg-success/10 text-success' :
                          result.type === 'user' ? 'bg-mission-control-border/50 text-mission-control-text-dim' :
                          'bg-mission-control-accent/10 text-mission-control-accent'
                        }`}>
                          {getTypeIcon(result.type)} {getTypeLabel(result.type)}
                        </span>
                        {result.username && (
                          <span className="text-xs text-mission-control-text-dim">{result.username}</span>
                        )}
                      </Flex>

                      {/* Tweet Content */}
                      {result.content && (
                        <p className="text-sm text-mission-control-text leading-relaxed mt-2 mb-3 line-clamp-3">
                          {result.content}
                        </p>
                      )}

                      {/* Metrics */}
                      {(result.likes || result.retweets || result.replies || result.followers) && (
                        <Flex align="center" gap="4" className="text-[10px] text-mission-control-text-dim tabular-nums">
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
                        </Flex>
                      )}

                      {/* Topic/Thread Count */}
                      {(result.tweetCount || result.engagement) && (
                        <Flex align="center" gap="4" className="text-[10px] text-mission-control-text-dim tabular-nums mt-2">
                          {result.tweetCount !== undefined && (
                            <span>{result.tweetCount.toLocaleString()} tweets</span>
                          )}
                          {result.engagement !== undefined && (
                            <span>{result.engagement}% engagement</span>
                          )}
                        </Flex>
                      )}

                      {/* Date & Link & Save as Idea */}
                      <Flex align="center" justify="between" className="mt-3 pt-3 border-t border-mission-control-border">
                        <span className="text-xs text-mission-control-text-dim">
                          {result.date && new Date(result.date).toLocaleDateString()}
                        </span>
                        <Flex align="center" gap="2">
                          <button
                            onClick={(e) => { e.stopPropagation(); saveAsIdea(result); }}
                            title="Save as idea draft"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
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
                        </Flex>
                      </Flex>
                    </div>
                  </Flex>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Flex>
  );
}

export default XResearchView;
