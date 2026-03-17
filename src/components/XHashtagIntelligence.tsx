// XHashtagIntelligence — search hashtags via /api/x/search and track performance

import { useState, useCallback } from 'react';
import {
  Hash,
  TrendingUp,
  Plus,
  X,
  Bookmark,
  Search,
  Copy,
  Layers,
  Heart,
  Repeat2,
  MessageCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { showToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HashtagSearchResult {
  tag: string;
  tweetCount: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  avgEngagement: number;
  sampleTweets: { id: string; text: string; created_at?: string }[];
}

interface HashtagSet {
  id: string;
  name: string;
  tags: string[];
}

interface SearchHistoryEntry {
  tag: string;
  searchedAt: number;
  tweetCount: number;
  avgEngagement: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_SAVED_KEY = 'x-saved-hashtags';
const LS_SETS_KEY = 'x-hashtag-sets';
const LS_HISTORY_KEY = 'x-hashtag-search-history';

function loadSaved(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_SAVED_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveSavedToLS(tags: string[]): void {
  const json = JSON.stringify(tags);
  localStorage.setItem(LS_SAVED_KEY, json);
  fetch(`/api/settings/${LS_SAVED_KEY}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: json }) }).catch(() => {});
}
function loadSets(): HashtagSet[] {
  try {
    return JSON.parse(localStorage.getItem(LS_SETS_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveSetsToLS(sets: HashtagSet[]): void {
  const json = JSON.stringify(sets);
  localStorage.setItem(LS_SETS_KEY, json);
  fetch(`/api/settings/${LS_SETS_KEY}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: json }) }).catch(() => {});
}
function loadHistory(): SearchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveHistoryToLS(history: SearchHistoryEntry[]): void {
  const json = JSON.stringify(history);
  localStorage.setItem(LS_HISTORY_KEY, json);
  fetch(`/api/settings/${LS_HISTORY_KEY}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: json }) }).catch(() => {});
}

// ─── Main component ───────────────────────────────────────────────────────────

export function XHashtagIntelligence() {
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<HashtagSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [savedTags, setSavedTags] = useState<string[]>(loadSaved);
  const [sets, setSets] = useState<HashtagSet[]>(loadSets);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(loadHistory);
  const [newSetName, setNewSetName] = useState('');
  const [newSetTags, setNewSetTags] = useState('');
  const [showNewSetForm, setShowNewSetForm] = useState(false);

  const searchHashtag = useCallback(
    async (tag: string): Promise<HashtagSearchResult> => {
      const query = tag.startsWith('#') ? tag : `#${tag}`;
      const res = await fetch(`/api/x/search?q=${encodeURIComponent(query)}&max=20`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Search failed for ${query}`);
      }
      const data = await res.json();
      const tweets: any[] = data.tweets ?? [];

      let totalLikes = 0;
      let totalRetweets = 0;
      let totalReplies = 0;
      for (const t of tweets) {
        totalLikes += t.public_metrics?.like_count ?? 0;
        totalRetweets += t.public_metrics?.retweet_count ?? 0;
        totalReplies += t.public_metrics?.reply_count ?? 0;
      }
      const avgEngagement =
        tweets.length > 0 ? (totalLikes + totalRetweets + totalReplies) / tweets.length : 0;

      return {
        tag: query,
        tweetCount: tweets.length,
        totalLikes,
        totalRetweets,
        totalReplies,
        avgEngagement,
        sampleTweets: tweets.slice(0, 5).map((t: any) => ({
          id: t.id,
          text: t.text,
          created_at: t.created_at,
        })),
      };
    },
    [],
  );

  const handleSearch = useCallback(async () => {
    const input = searchInput.trim();
    if (!input) return;

    // Parse multiple hashtags (comma or space separated)
    const tags = input
      .split(/[\s,]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => (t.startsWith('#') ? t : `#${t}`));

    if (tags.length === 0) return;

    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const results = await Promise.allSettled(tags.map(t => searchHashtag(t)));
      const successResults: HashtagSearchResult[] = [];
      const failures: string[] = [];

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          successResults.push(result.value);
        } else {
          failures.push(tags[i]);
        }
      });

      setSearchResults(successResults);

      if (failures.length > 0) {
        setSearchError(`Failed to search: ${failures.join(', ')}`);
      }

      // Update search history
      const now = Date.now();
      const newEntries: SearchHistoryEntry[] = successResults.map(r => ({
        tag: r.tag,
        searchedAt: now,
        tweetCount: r.tweetCount,
        avgEngagement: r.avgEngagement,
      }));

      const updatedHistory = [
        ...newEntries,
        ...searchHistory.filter(h => !newEntries.some(n => n.tag === h.tag)),
      ].slice(0, 50);
      setSearchHistory(updatedHistory);
      saveHistoryToLS(updatedHistory);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [searchInput, searchHashtag, searchHistory]);

  const handleSave = (tag: string) => {
    if (savedTags.includes(tag)) return;
    const updated = [...savedTags, tag];
    setSavedTags(updated);
    saveSavedToLS(updated);
    showToast('success', 'Saved', `${tag} added to your saved hashtags`);
  };

  const handleRemoveSaved = (tag: string) => {
    const updated = savedTags.filter(t => t !== tag);
    setSavedTags(updated);
    saveSavedToLS(updated);
  };

  const handleInsert = (tag: string) => {
    window.dispatchEvent(new CustomEvent('x-insert-hashtag', { detail: { tag } }));
    showToast('success', 'Inserted', `${tag} inserted into composer`);
  };

  const handleCreateSet = () => {
    const name = newSetName.trim();
    const tags = newSetTags
      .split(/[\s,]+/)
      .map(t => (t.startsWith('#') ? t : `#${t}`))
      .filter(t => t.length > 1);
    if (!name || tags.length === 0) {
      showToast('error', 'Missing data', 'Provide a set name and at least one hashtag');
      return;
    }
    const newSet: HashtagSet = { id: `set-${Date.now()}`, name, tags };
    const updated = [...sets, newSet];
    setSets(updated);
    saveSetsToLS(updated);
    setNewSetName('');
    setNewSetTags('');
    setShowNewSetForm(false);
    showToast('success', 'Set created', `"${name}" hashtag set ready`);
  };

  const handleDeleteSet = (id: string) => {
    const updated = sets.filter(s => s.id !== id);
    setSets(updated);
    saveSetsToLS(updated);
  };

  const handleInsertSet = (tags: string[]) => {
    tags.forEach(tag =>
      window.dispatchEvent(new CustomEvent('x-insert-hashtag', { detail: { tag } })),
    );
    showToast('success', 'Inserted', `${tags.length} hashtags inserted into composer`);
  };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2 mb-1">
          <Hash size={20} style={{ color: 'var(--color-info)' }} />
          <h2 className="text-lg font-semibold text-mission-control-text">
            Hashtag Intelligence
          </h2>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Search hashtags on X to see real engagement metrics and discover opportunities.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Search hashtags
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim"
              />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="#BuildInPublic, #SaaS, #GrowthHacking..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchInput.trim() || searching}
              className="px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--color-info)', color: '#fff' }}
            >
              {searching ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </button>
          </div>
          <p className="text-xs text-mission-control-text-dim mt-1">
            Enter one or more hashtags (comma-separated) to search X for recent tweets
          </p>
        </div>

        {/* Search error */}
        {searchError && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg text-sm"
            style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
          >
            <AlertCircle size={16} />
            {searchError}
          </div>
        )}

        {/* Search results */}
        {hasSearched && !searching && (
          <div>
            <div className="text-sm font-medium text-mission-control-text mb-3">
              Search Results ({searchResults.length} hashtag{searchResults.length !== 1 ? 's' : ''})
            </div>
            {searchResults.length === 0 ? (
              <div className="text-xs text-mission-control-text-dim py-4 text-center border border-dashed border-mission-control-border rounded-lg">
                No results found. Try different hashtags.
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map(result => (
                  <div
                    key={result.tag}
                    className="border border-mission-control-border rounded-lg bg-mission-control-surface overflow-hidden"
                  >
                    {/* Result header */}
                    <div className="flex items-center justify-between p-3 border-b border-mission-control-border">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-mission-control-text">
                          {result.tag}
                        </span>
                        <span className="text-xs text-mission-control-text-dim">
                          {result.tweetCount} tweets found
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleInsert(result.tag)}
                          title="Insert into composer"
                          className="p-1 rounded hover:bg-mission-control-bg transition-colors text-mission-control-text-dim"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={() =>
                            savedTags.includes(result.tag)
                              ? handleRemoveSaved(result.tag)
                              : handleSave(result.tag)
                          }
                          title={
                            savedTags.includes(result.tag) ? 'Remove from saved' : 'Save hashtag'
                          }
                          className="p-1 rounded hover:bg-mission-control-bg transition-colors"
                          style={{
                            color: savedTags.includes(result.tag)
                              ? 'var(--color-info)'
                              : 'var(--color-mission-control-text-dim)',
                          }}
                        >
                          <Bookmark
                            size={14}
                            fill={savedTags.includes(result.tag) ? 'currentColor' : 'none'}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-4 divide-x divide-mission-control-border text-center py-2">
                      <div className="px-2">
                        <div className="text-sm font-semibold text-mission-control-text flex items-center justify-center gap-1">
                          <Heart size={11} className="text-error" />
                          {result.totalLikes}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">likes</div>
                      </div>
                      <div className="px-2">
                        <div className="text-sm font-semibold text-mission-control-text flex items-center justify-center gap-1">
                          <Repeat2 size={11} className="text-info" />
                          {result.totalRetweets}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">retweets</div>
                      </div>
                      <div className="px-2">
                        <div className="text-sm font-semibold text-mission-control-text flex items-center justify-center gap-1">
                          <MessageCircle size={11} className="text-warning" />
                          {result.totalReplies}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">replies</div>
                      </div>
                      <div className="px-2">
                        <div className="text-sm font-semibold text-mission-control-text">
                          {result.avgEngagement.toFixed(1)}
                        </div>
                        <div className="text-xs text-mission-control-text-dim">avg eng</div>
                      </div>
                    </div>

                    {/* Sample tweets */}
                    {result.sampleTweets.length > 0 && (
                      <div className="border-t border-mission-control-border">
                        {result.sampleTweets.map(tweet => (
                          <div
                            key={tweet.id}
                            className="px-3 py-2 border-b border-mission-control-border last:border-b-0 text-xs text-mission-control-text-dim line-clamp-2"
                          >
                            {tweet.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search history */}
        {searchHistory.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-mission-control-text-dim" />
              <span className="text-sm font-medium text-mission-control-text">Search History</span>
              <span className="text-xs text-mission-control-text-dim">
                ({searchHistory.length})
              </span>
            </div>
            <div className="border border-mission-control-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-2 text-xs text-mission-control-text-dim px-3 py-2 border-b border-mission-control-border bg-mission-control-surface">
                <span>Hashtag</span>
                <span>Tweets</span>
                <span>Avg Engagement</span>
                <span>Searched</span>
              </div>
              {searchHistory.slice(0, 20).map(entry => (
                <div
                  key={`${entry.tag}-${entry.searchedAt}`}
                  className="grid grid-cols-4 gap-2 text-xs px-3 py-2 border-b border-mission-control-border last:border-b-0 hover:bg-mission-control-surface transition-colors cursor-pointer group"
                  onClick={() => {
                    setSearchInput(entry.tag);
                  }}
                >
                  <span className="text-mission-control-text font-medium">{entry.tag}</span>
                  <span className="text-mission-control-text-dim">{entry.tweetCount}</span>
                  <span className="text-mission-control-text-dim">
                    {entry.avgEngagement.toFixed(1)}
                  </span>
                  <span className="text-mission-control-text-dim">
                    {new Date(entry.searchedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Saved hashtags */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bookmark size={16} className="text-mission-control-text-dim" />
            <span className="text-sm font-medium text-mission-control-text">Saved Hashtags</span>
            {savedTags.length > 0 && (
              <span
                className="px-2 py-0.5 text-xs rounded-full"
                style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
              >
                {savedTags.length}
              </span>
            )}
          </div>
          {savedTags.length === 0 ? (
            <div className="text-xs text-mission-control-text-dim py-4 text-center border border-dashed border-mission-control-border rounded-lg">
              Save hashtags from search results using the bookmark icon
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {savedTags.map(tag => (
                <div
                  key={tag}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-mission-control-border group"
                  style={{
                    background: 'var(--color-info-subtle)',
                    color: 'var(--color-info)',
                  }}
                >
                  {tag}
                  <button
                    onClick={() => handleInsert(tag)}
                    title="Insert"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy size={10} />
                  </button>
                  <button
                    onClick={() => handleRemoveSaved(tag)}
                    title="Remove"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hashtag sets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-mission-control-text-dim" />
              <span className="text-sm font-medium text-mission-control-text">Hashtag Sets</span>
            </div>
            <button
              onClick={() => setShowNewSetForm(v => !v)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-mission-control-border hover:bg-mission-control-surface transition-colors text-mission-control-text-dim"
            >
              <Plus size={12} />
              New set
            </button>
          </div>

          {showNewSetForm && (
            <div className="p-3 mb-3 rounded-lg border border-mission-control-border bg-mission-control-surface space-y-2">
              <input
                type="text"
                value={newSetName}
                onChange={e => setNewSetName(e.target.value)}
                placeholder="Set name (e.g. Growth Week)"
                className="w-full px-3 py-1.5 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none"
              />
              <input
                type="text"
                value={newSetTags}
                onChange={e => setNewSetTags(e.target.value)}
                placeholder="#tag1, #tag2, tag3..."
                className="w-full px-3 py-1.5 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateSet}
                  className="flex-1 text-xs py-1.5 rounded transition-colors"
                  style={{ background: 'var(--color-info)', color: '#fff' }}
                >
                  Create Set
                </button>
                <button
                  onClick={() => setShowNewSetForm(false)}
                  className="px-3 text-xs py-1.5 rounded border border-mission-control-border hover:bg-mission-control-bg transition-colors text-mission-control-text-dim"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sets.length === 0 ? (
            <div className="text-xs text-mission-control-text-dim py-4 text-center border border-dashed border-mission-control-border rounded-lg">
              Create grouped hashtag sets for campaigns — insert all with one click
            </div>
          ) : (
            <div className="space-y-2">
              {sets.map(set => (
                <div
                  key={set.id}
                  className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-mission-control-text">{set.name}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleInsertSet(set.tags)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-mission-control-border hover:bg-mission-control-bg transition-colors text-mission-control-text-dim"
                      >
                        <Copy size={11} />
                        Insert all
                      </button>
                      <button
                        onClick={() => handleDeleteSet(set.id)}
                        aria-label="Delete set"
                        className="text-mission-control-text-dim hover:text-error transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {set.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded"
                        style={{
                          background: 'var(--color-mission-control-bg)',
                          color: 'var(--color-mission-control-text-dim)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default XHashtagIntelligence;
