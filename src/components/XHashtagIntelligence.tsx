// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XHashtagIntelligence — hashtag suggestions, trending list, saved favorites, and campaign sets

import { useState, useCallback } from 'react';
import {
  Hash,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Bookmark,
  Search,
  Copy,
  Layers,
} from 'lucide-react';
import { showToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HashtagSuggestion {
  tag: string;
  engagementScore: number;
  postsPerDay: number;
  trend: 'up' | 'down' | 'stable';
}

interface HashtagSet {
  id: string;
  name: string;
  tags: string[];
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const TRENDING_HASHTAGS: HashtagSuggestion[] = [
  { tag: '#BuildInPublic', engagementScore: 92, postsPerDay: 3400, trend: 'up' },
  { tag: '#GrowthHacking', engagementScore: 78, postsPerDay: 2100, trend: 'up' },
  { tag: '#ProductLed', engagementScore: 71, postsPerDay: 890, trend: 'stable' },
  { tag: '#SaaS', engagementScore: 85, postsPerDay: 8700, trend: 'up' },
  { tag: '#StartupLife', engagementScore: 67, postsPerDay: 5200, trend: 'down' },
  { tag: '#IndieHacker', engagementScore: 88, postsPerDay: 1700, trend: 'up' },
  { tag: '#MarketingStrategy', engagementScore: 74, postsPerDay: 3300, trend: 'stable' },
  { tag: '#Bootstrapped', engagementScore: 81, postsPerDay: 1200, trend: 'up' },
  { tag: '#UserAcquisition', engagementScore: 69, postsPerDay: 640, trend: 'stable' },
  { tag: '#ContentMarketing', engagementScore: 76, postsPerDay: 4500, trend: 'down' },
];

function generateSuggestionsForTopic(topic: string): HashtagSuggestion[] {
  const seed = topic.toLowerCase().split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const base: HashtagSuggestion[] = [
    { tag: `#${topic.replace(/\s+/g, '')}`, engagementScore: 70 + (seed % 25), postsPerDay: 500 + (seed % 3000), trend: 'up' },
    { tag: `#${topic.split(' ')[0] ?? topic}Tips`, engagementScore: 55 + (seed % 30), postsPerDay: 200 + (seed % 1500), trend: 'stable' },
    { tag: `#${topic.replace(/\s+/g, '')}Growth`, engagementScore: 60 + (seed % 20), postsPerDay: 100 + (seed % 800), trend: 'up' },
    { tag: '#GrowthMarketing', engagementScore: 78, postsPerDay: 2300, trend: 'up' },
    { tag: '#SaaS', engagementScore: 85, postsPerDay: 8700, trend: 'up' },
    { tag: '#StartupTips', engagementScore: 72, postsPerDay: 4100, trend: 'stable' },
    { tag: '#BuildInPublic', engagementScore: 92, postsPerDay: 3400, trend: 'up' },
  ];
  return base.slice(0, 7);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LS_SAVED_KEY = 'x-saved-hashtags';
const LS_SETS_KEY = 'x-hashtag-sets';

function loadSaved(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_SAVED_KEY) ?? '[]'); } catch { return []; }
}
function saveSavedToLS(tags: string[]): void {
  try { localStorage.setItem(LS_SAVED_KEY, JSON.stringify(tags)); } catch {}
}
function loadSets(): HashtagSet[] {
  try { return JSON.parse(localStorage.getItem(LS_SETS_KEY) ?? '[]'); } catch { return []; }
}
function saveSetsToLS(sets: HashtagSet[]): void {
  try { localStorage.setItem(LS_SETS_KEY, JSON.stringify(sets)); } catch {}
}

function formatPostsPerDay(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K/day`;
  return `${n}/day`;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-info)' : 'var(--color-warning)';
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-mission-control-border overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs text-mission-control-text-dim w-7 text-right">{score}</span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <ArrowUp size={12} style={{ color: 'var(--color-success)' }} />;
  if (trend === 'down') return <ArrowDown size={12} style={{ color: 'var(--color-error)' }} />;
  return <span style={{ color: 'var(--color-mission-control-text-dim)', fontSize: 10 }}>—</span>;
}

// ─── Hashtag row ─────────────────────────────────────────────────────────────

interface HashtagRowProps {
  item: HashtagSuggestion;
  isSaved: boolean;
  onSave: (tag: string) => void;
  onRemoveSaved: (tag: string) => void;
  onInsert?: (tag: string) => void;
}

function HashtagRow({ item, isSaved, onSave, onRemoveSaved, onInsert }: HashtagRowProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-mission-control-surface transition-colors group">
      <TrendIcon trend={item.trend} />
      <span className="text-sm font-medium text-mission-control-text w-40 flex-shrink-0">{item.tag}</span>
      <ScoreBar score={item.engagementScore} />
      <span className="text-xs text-mission-control-text-dim w-20 text-right">{formatPostsPerDay(item.postsPerDay)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onInsert && (
          <button
            onClick={() => onInsert(item.tag)}
            title="Insert into composer"
            className="p-1 rounded hover:bg-mission-control-bg-alt transition-colors text-mission-control-text-dim"
          >
            <Copy size={12} />
          </button>
        )}
        <button
          onClick={() => isSaved ? onRemoveSaved(item.tag) : onSave(item.tag)}
          title={isSaved ? 'Remove from saved' : 'Save hashtag'}
          className="p-1 rounded hover:bg-mission-control-bg-alt transition-colors"
          style={{ color: isSaved ? 'var(--color-info)' : 'var(--color-mission-control-text-dim)' }}
        >
          <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function XHashtagIntelligence() {
  const [topicInput, setTopicInput] = useState('');
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [savedTags, setSavedTags] = useState<string[]>(loadSaved);
  const [sets, setSets] = useState<HashtagSet[]>(loadSets);
  const [newSetName, setNewSetName] = useState('');
  const [newSetTags, setNewSetTags] = useState('');
  const [showNewSetForm, setShowNewSetForm] = useState(false);

  const handleSearch = useCallback(() => {
    const topic = topicInput.trim();
    if (!topic) return;
    setSuggestions(generateSuggestionsForTopic(topic));
    setHasSearched(true);
  }, [topicInput]);

  const handleSave = (tag: string) => {
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
      .filter(Boolean);
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
    tags.forEach(tag => window.dispatchEvent(new CustomEvent('x-insert-hashtag', { detail: { tag } })));
    showToast('success', 'Inserted', `${tags.length} hashtags inserted into composer`);
  };

  const trendingWithSaved = TRENDING_HASHTAGS.map(h => ({ ...h, isSaved: savedTags.includes(h.tag) }));
  const suggestionsWithSaved = suggestions.map(h => ({ ...h, isSaved: savedTags.includes(h.tag) }));

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2 mb-1">
          <Hash size={20} style={{ color: 'var(--color-info)' }} />
          <h2 className="text-lg font-semibold text-mission-control-text">Hashtag Intelligence</h2>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Discover high-engagement hashtags, track trending tags, and build reusable sets.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Topic search */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Hashtag suggestions for a topic
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
              <input
                type="text"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="e.g. product growth, user retention, SaaS..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-mission-control-border rounded-lg bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!topicInput.trim()}
              className="px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-info)', color: '#fff' }}
            >
              Search
            </button>
          </div>
        </div>

        {/* Suggestions */}
        {hasSearched && (
          <div>
            <div className="text-sm font-medium text-mission-control-text mb-1">
              Suggestions for "{topicInput}"
            </div>
            <div className="flex items-center gap-3 text-xs text-mission-control-text-dim px-3 mb-1">
              <span className="w-40">Hashtag</span>
              <span className="flex-1">Engagement score</span>
              <span className="w-20 text-right">Volume</span>
              <span className="w-8" />
            </div>
            <div className="border border-mission-control-border rounded-lg overflow-hidden">
              {suggestionsWithSaved.map(item => (
                <HashtagRow
                  key={item.tag}
                  item={item}
                  isSaved={item.isSaved}
                  onSave={handleSave}
                  onRemoveSaved={handleRemoveSaved}
                  onInsert={handleInsert}
                />
              ))}
            </div>
          </div>
        )}

        {/* Trending hashtags */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-mission-control-text-dim" />
            <span className="text-sm font-medium text-mission-control-text">Trending Now</span>
            <span className="text-xs text-mission-control-text-dim">(mock data)</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-mission-control-text-dim px-3 mb-1">
            <span className="w-5" />
            <span className="w-40">Hashtag</span>
            <span className="flex-1">Engagement score</span>
            <span className="w-20 text-right">Volume</span>
            <span className="w-8" />
          </div>
          <div className="border border-mission-control-border rounded-lg overflow-hidden">
            {trendingWithSaved.map(item => (
              <HashtagRow
                key={item.tag}
                item={item}
                isSaved={item.isSaved}
                onSave={handleSave}
                onRemoveSaved={handleRemoveSaved}
                onInsert={handleInsert}
              />
            ))}
          </div>
        </div>

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
              Save hashtags from suggestions or trending list using the bookmark icon
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {savedTags.map(tag => (
                <div
                  key={tag}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-mission-control-border group"
                  style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
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
                  className="px-3 text-xs py-1.5 rounded border border-mission-control-border hover:bg-mission-control-bg-alt transition-colors text-mission-control-text-dim"
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
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-mission-control-border hover:bg-mission-control-bg-alt transition-colors text-mission-control-text-dim"
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
                        style={{ background: 'var(--color-mission-control-bg-alt)', color: 'var(--color-mission-control-text-dim)' }}
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
