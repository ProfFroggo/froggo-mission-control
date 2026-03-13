// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Search, Pin, Trash2, Edit2, X, Check, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'brand', label: 'Brand' },
  { value: 'guidelines', label: 'Guidelines' },
  { value: 'tone', label: 'Tone & Voice' },
  { value: 'reference', label: 'Reference' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'technical', label: 'Technical' },
];

interface KBLink {
  title: string;
  url: string;
  description?: string;
}

interface KBArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  scope: string;
  pinned: boolean;
  version: number;
  updatedAt: number;
  links?: KBLink[];
}

// tags can be a string (comma-list from the text input) or array during editing
type EditState = Omit<Partial<KBArticle>, 'tags'> & { tags?: string[] | string };

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [viewing, setViewing] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/knowledge?${params}`);
      const data = await res.json();
      if (data.success) setArticles(data.articles);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew ? '/api/knowledge' : `/api/knowledge/${editing.id}`;
    const method = isNew ? 'POST' : 'PATCH';
    const tagsRaw = editing.tags;
    const tagsArray = typeof tagsRaw === 'string'
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : (tagsRaw || []);
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editing.title,
        content: editing.content,
        category: editing.category || 'reference',
        tags: tagsArray,
        scope: editing.scope || 'all',
        pinned: editing.pinned || false,
      }),
    });
    setEditing(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    if (viewing?.id === id) setViewing(null);
    load();
  };

  const togglePin = async (article: KBArticle) => {
    await fetch(`/api/knowledge/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !article.pinned }),
    });
    load();
  };

  // ── Article detail view ──────────────────────────────────────────────────────
  if (viewing) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <button
            onClick={() => setViewing(null)}
            className="text-mission-control-text-dim hover:text-mission-control-text"
            aria-label="Back to list"
          >
            <ChevronRight size={16} className="rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-mission-control-text truncate">{viewing.title}</h2>
            <span className="text-xs text-mission-control-text-dim capitalize">{viewing.category}</span>
          </div>
          <button
            onClick={() => {
              setEditing({ ...viewing, tags: viewing.tags.join(', ') });
              setViewing(null);
            }}
            className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim"
            aria-label="Edit article"
          >
            <Edit2 size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm text-mission-control-text leading-relaxed">
            {viewing.content}
          </pre>
          {viewing.links && viewing.links.length > 0 && (
            <div className="mt-4 pt-4 border-t border-mission-control-border">
              <p className="text-xs font-medium text-mission-control-text-dim mb-2">Links</p>
              {viewing.links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-400 hover:underline mb-1"
                >
                  {l.title || l.url}
                </a>
              ))}
            </div>
          )}
          {viewing.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1">
              {viewing.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-mission-control-surface text-xs text-mission-control-text-dim">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Editor ───────────────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <span className="font-semibold text-mission-control-text flex-1">
            {editing.id ? 'Edit Article' : 'New Article'}
          </span>
          <button
            onClick={() => setEditing(null)}
            className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim"
            aria-label="Cancel"
          >
            <X size={14} />
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm flex items-center gap-1.5"
          >
            <Check size={13} />
            Save
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <input
            value={editing.title || ''}
            onChange={e => setEditing(v => ({ ...v, title: e.target.value }))}
            placeholder="Article title..."
            className="w-full px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={editing.category || 'reference'}
              onChange={e => setEditing(v => ({ ...v, category: e.target.value }))}
              className="flex-1 px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {CATEGORIES.filter(c => c.value !== 'all').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-sm text-mission-control-text cursor-pointer select-none">
              <Pin size={13} className={editing.pinned ? 'text-amber-400' : 'text-mission-control-text-dim'} />
              <input
                type="checkbox"
                checked={!!editing.pinned}
                onChange={e => setEditing(v => ({ ...v, pinned: e.target.checked }))}
                className="sr-only"
              />
              Always inject
            </label>
          </div>
          <input
            value={typeof editing.tags === 'string' ? editing.tags : (editing.tags || []).join(', ')}
            onChange={e => setEditing(v => ({ ...v, tags: e.target.value }))}
            placeholder="Tags: brand, design, tone (comma-separated)..."
            className="w-full px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={editing.content || ''}
            onChange={e => setEditing(v => ({ ...v, content: e.target.value }))}
            placeholder="Write your guidelines in Markdown..."
            rows={18}
            className="w-full px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
          />
          <p className="text-xs text-mission-control-text-dim">
            Markdown supported. Pinned articles are always injected into agent context.
          </p>
        </div>
      </div>
    );
  }

  // ── Main list view ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-mission-control-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-mission-control-text-dim" />
            <span className="font-semibold text-mission-control-text text-sm">Knowledge Base</span>
          </div>
          <button
            onClick={() => setEditing({ category: 'reference', scope: 'all', pinned: false, tags: [] })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
          >
            <Plus size={12} />
            New Article
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search guidelines, brand voice, context..."
            className="w-full pl-8 pr-3 py-1.5 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
                category === c.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg bg-mission-control-surface border border-mission-control-border p-3 animate-pulse">
              <div className="h-4 bg-mission-control-border rounded w-2/3 mb-2" />
              <div className="h-3 bg-mission-control-border rounded w-full mb-1" />
              <div className="h-3 bg-mission-control-border rounded w-4/5" />
            </div>
          ))
        ) : articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={search || category !== 'all' ? 'No articles found' : 'Knowledge base is empty'}
            description={search || category !== 'all' ? 'Try a different search term or category' : 'Add guidelines, brand voice, and context to help your agents work better'}
            action={search || category !== 'all' ? undefined : { label: 'New Article', onClick: () => setEditing({ category: 'reference', scope: 'all', pinned: false, tags: [] }) }}
            size="md"
          />
        ) : (
          articles.map(article => (
            <div
              key={article.id}
              className="group rounded-lg bg-mission-control-surface border border-mission-control-border p-3 hover:border-blue-500/40 transition-colors cursor-pointer"
              onClick={() => setViewing(article)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {article.pinned && <Pin size={11} className="text-amber-400 shrink-0" />}
                  <span className="font-medium text-mission-control-text text-sm truncate">{article.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(article); }}
                    className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-amber-400"
                    aria-label={article.pinned ? 'Unpin article' : 'Pin article'}
                    title={article.pinned ? 'Unpin' : 'Pin — always inject into agent context'}
                  >
                    <Pin size={12} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setEditing({ ...article, tags: article.tags.join(', ') });
                    }}
                    className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim"
                    aria-label="Edit article"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); del(article.id); }}
                    className="p-1 rounded hover:bg-mission-control-border text-red-400"
                    aria-label="Delete article"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-mission-control-text-dim line-clamp-2 mb-2">
                {article.content.replace(/#{1,6}\s/g, '').slice(0, 150)}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded text-xs bg-mission-control-border text-mission-control-text-dim capitalize">
                  {article.category}
                </span>
                {article.tags.slice(0, 3).map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded-full bg-mission-control-border text-xs text-mission-control-text-dim">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
