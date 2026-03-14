// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Pin, Trash2, Edit2, X, Check, ChevronLeft,
  Star, Tag, ChevronRight,
} from 'lucide-react';
import EmptyState from './EmptyState';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Public' },
  { value: 'team', label: 'Team' },
  { value: 'agent', label: 'Agent' },
];

const STATIC_CATEGORIES = [
  'brand',
  'guidelines',
  'tone',
  'reference',
  'onboarding',
  'technical',
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
  createdAt?: number;
  createdBy?: string;
  links?: KBLink[];
}

// tags can be a string (comma-list from the text input) or array during editing
type EditState = Omit<Partial<KBArticle>, 'tags'> & { tags?: string[] | string };

// ── Helpers ──────────────────────────────────────────────────────────────────

const STARRED_KEY = 'knowledge.starred';

function getStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveStarred(ids: Set<string>): void {
  try {
    localStorage.setItem(STARRED_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore
  }
}

/** Highlight search term occurrences in text — returns an array of JSX spans */
function highlightText(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark
            key={i}
            className="bg-warning/20 text-warning rounded-sm"
            style={{ background: 'var(--color-warning, #f59e0b33)', color: 'var(--color-warning, #f59e0b)' }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

/** Very simple markdown-ish renderer — no library needed */
function renderContent(content: string): React.ReactNode {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 1;
      const text = line.replace(/^#+\s/, '');
      const Tag = `h${Math.min(level, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizes: Record<number, string> = {
        1: 'text-lg font-bold mt-4 mb-2',
        2: 'text-base font-bold mt-3 mb-1.5',
        3: 'text-sm font-semibold mt-2 mb-1',
      };
      nodes.push(
        <Tag
          key={i}
          className={`${sizes[level] ?? 'text-sm font-semibold mt-2 mb-1'} text-mission-control-text`}
        >
          {text}
        </Tag>
      );
      i++;
      continue;
    }

    // Unordered list items
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-2 text-sm text-mission-control-text pl-2">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 my-2 text-sm text-mission-control-text pl-2">
          {items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className="border-mission-control-border my-3" />);
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // closing ```
      nodes.push(
        <pre
          key={`code-${i}`}
          className="bg-mission-control-border/40 rounded p-3 my-2 text-xs font-mono overflow-x-auto text-mission-control-text"
        >
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    nodes.push(
      <p key={i} className="text-sm text-mission-control-text leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

/** Inline markup: **bold**, *italic*, `code`, [link](url) */
function renderInline(text: string): React.ReactNode {
  // We process sequentially with a simple state machine
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
    // Italic
    const italicMatch = remaining.match(/^(.*?)\*(.*?)\*(.*)/s);
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`(.*?)`(.*)/s);
    // Link
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);

    // Find which match comes first
    const candidates: Array<{ index: number; match: RegExpMatchArray; type: string }> = [];
    if (boldMatch && boldMatch[1] !== undefined) candidates.push({ index: boldMatch[1].length, match: boldMatch, type: 'bold' });
    if (italicMatch && italicMatch[1] !== undefined) candidates.push({ index: italicMatch[1].length, match: italicMatch, type: 'italic' });
    if (codeMatch && codeMatch[1] !== undefined) candidates.push({ index: codeMatch[1].length, match: codeMatch, type: 'code' });
    if (linkMatch && linkMatch[1] !== undefined) candidates.push({ index: linkMatch[1].length, match: linkMatch, type: 'link' });

    if (candidates.length === 0) {
      parts.push(remaining);
      break;
    }

    candidates.sort((a, b) => a.index - b.index);
    const first = candidates[0];

    if (first.match[1]) parts.push(first.match[1]);

    if (first.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold">{first.match[2]}</strong>);
      remaining = first.match[3];
    } else if (first.type === 'italic') {
      parts.push(<em key={key++}>{first.match[2]}</em>);
      remaining = first.match[3];
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-mission-control-border/60 font-mono text-xs">
          {first.match[2]}
        </code>
      );
      remaining = first.match[3];
    } else if (first.type === 'link') {
      parts.push(
        <a
          key={key++}
          href={first.match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          {first.match[2]}
        </a>
      );
      remaining = first.match[4];
    }
  }

  return <>{parts}</>;
}

/** Compute related articles — same category + shared words in title */
function getRelated(current: KBArticle, all: KBArticle[]): KBArticle[] {
  const titleWords = new Set(
    current.title.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );
  return all
    .filter(a => a.id !== current.id)
    .map(a => {
      const score =
        (a.category === current.category ? 2 : 0) +
        a.title
          .toLowerCase()
          .split(/\W+/)
          .filter(w => titleWords.has(w)).length;
      return { article: a, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.article);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeBase() {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [viewing, setViewing] = useState<KBArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState<Set<string>>(getStarred);
  const [showStarred, setShowStarred] = useState(false);
  const [quickCreate, setQuickCreate] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quick-create modal state
  const [qcTitle, setQcTitle] = useState('');
  const [qcCategory, setQcCategory] = useState('reference');
  const [qcCategoryCustom, setQcCategoryCustom] = useState('');
  const [qcScope, setQcScope] = useState('all');
  const [qcContent, setQcContent] = useState('');
  const [qcSaving, setQcSaving] = useState(false);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/knowledge?${params}`);
      const data = await res.json();
      if (data.success) setArticles(data.articles);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category]);

  useEffect(() => { load(); }, [load]);

  // Persist starred to localStorage whenever it changes
  useEffect(() => { saveStarred(starred); }, [starred]);

  // ── Derived categories (from loaded articles + statics) ───────────────────
  const allCategories = useMemo<string[]>(() => {
    const fromArticles = articles.map(a => a.category).filter(Boolean);
    return [...new Set([...STATIC_CATEGORIES, ...fromArticles])].sort();
  }, [articles]);

  const categoryCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const a of articles) {
      counts[a.category] = (counts[a.category] ?? 0) + 1;
    }
    return counts;
  }, [articles]);

  // ── Filtered articles (starred filter + search highlight) ─────────────────
  const displayedArticles = useMemo<KBArticle[]>(() => {
    let list = articles;
    if (showStarred) list = list.filter(a => starred.has(a.id));
    // Pinned first within the current filter
    return [...list].sort((a, b) => {
      const aStarred = starred.has(a.id) ? 1 : 0;
      const bStarred = starred.has(b.id) ? 1 : 0;
      if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (bStarred !== aStarred) return bStarred - aStarred;
      return b.updatedAt - a.updatedAt;
    });
  }, [articles, starred, showStarred]);

  // ── Actions ──────────────────────────────────────────────────────────────

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
    // Remove from starred if present
    if (starred.has(id)) {
      setStarred(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
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

  const toggleStar = (id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const quickCreateSave = async () => {
    const title = qcTitle.trim();
    const content = qcContent.trim();
    if (!title || !content) return;
    const cat = qcCategoryCustom.trim() || qcCategory;
    setQcSaving(true);
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category: cat, scope: qcScope, tags: [], pinned: false }),
      });
      setQuickCreate(false);
      setQcTitle(''); setQcContent(''); setQcCategory('reference'); setQcCategoryCustom(''); setQcScope('all');
      load();
    } finally {
      setQcSaving(false);
    }
  };

  // ── Article detail view ──────────────────────────────────────────────────

  if (viewing) {
    const related = getRelated(viewing, articles);
    const isStarred = starred.has(viewing.id);
    return (
      <div className="flex h-full">
        {/* Sidebar */}
        <CategorySidebar
          categories={allCategories}
          counts={categoryCounts}
          selected={category}
          total={articles.length}
          onSelect={cat => { setCategory(cat); setViewing(null); }}
        />

        {/* Reader */}
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
            <button
              onClick={() => setViewing(null)}
              className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text"
              aria-label="Back to list"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-mission-control-text truncate">{viewing.title}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-mission-control-text-dim capitalize flex items-center gap-1">
                  <Tag size={10} />
                  {viewing.category}
                </span>
                {viewing.scope && viewing.scope !== 'all' && (
                  <span className="text-xs text-mission-control-text-dim">· {viewing.scope}</span>
                )}
                {viewing.updatedAt && (
                  <span className="text-xs text-mission-control-text-dim">
                    · Updated {new Date(viewing.updatedAt).toLocaleDateString()}
                  </span>
                )}
                {viewing.createdBy && (
                  <span className="text-xs text-mission-control-text-dim">· by {viewing.createdBy}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => toggleStar(viewing.id)}
              className={`p-1.5 rounded hover:bg-mission-control-border transition-colors ${isStarred ? 'text-amber-400' : 'text-mission-control-text-dim hover:text-amber-400'}`}
              aria-label={isStarred ? 'Unstar article' : 'Star article'}
            >
              <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => {
                setEditing({ ...viewing, tags: viewing.tags.join(', ') });
                setViewing(null);
              }}
              className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text"
              aria-label="Edit article"
            >
              <Edit2 size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-2xl">
              {renderContent(viewing.content)}

              {viewing.links && viewing.links.length > 0 && (
                <div className="mt-6 pt-4 border-t border-mission-control-border">
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

              {related.length > 0 && (
                <div className="mt-6 pt-4 border-t border-mission-control-border">
                  <p className="text-xs font-medium text-mission-control-text-dim mb-2">Related articles</p>
                  <div className="space-y-1.5">
                    {related.map(r => (
                      <button
                        key={r.id}
                        onClick={() => setViewing(r)}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg bg-mission-control-surface hover:border-blue-500/40 border border-mission-control-border transition-colors"
                      >
                        <BookOpen size={12} className="text-mission-control-text-dim shrink-0" />
                        <span className="text-sm text-mission-control-text truncate">{r.title}</span>
                        <span className="ml-auto text-xs text-mission-control-text-dim capitalize shrink-0">{r.category}</span>
                        <ChevronRight size={12} className="text-mission-control-text-dim shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────

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
              {STATIC_CATEGORIES.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <select
              value={editing.scope || 'all'}
              onChange={e => setEditing(v => ({ ...v, scope: e.target.value }))}
              className="flex-1 px-3 py-2 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {SCOPE_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
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

  // ── Main list view ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Category sidebar */}
      <CategorySidebar
        categories={allCategories}
        counts={categoryCounts}
        selected={category}
        total={articles.length}
        onSelect={setCategory}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <div className="p-4 border-b border-mission-control-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-mission-control-text-dim" />
              <span className="font-semibold text-mission-control-text text-sm">Knowledge Base</span>
            </div>
            <button
              onClick={() => setQuickCreate(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              <Plus size={12} />
              New Article
            </button>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              aria-label="Search knowledge base"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search guidelines, brand voice, context..."
              className="w-full pl-8 pr-3 py-1.5 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Filter pills */}
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setShowStarred(v => !v)}
              className={`flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
                showStarred
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-mission-control-surface text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              <Star size={10} fill={showStarred ? 'currentColor' : 'none'} />
              Starred
              {starred.size > 0 && (
                <span className="ml-0.5 opacity-70">{starred.size}</span>
              )}
            </button>
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
          ) : displayedArticles.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={search || category !== 'all' || showStarred ? 'No articles found' : 'Knowledge base is empty'}
              description={
                showStarred
                  ? 'Star articles to quickly find them later'
                  : search || category !== 'all'
                  ? 'Try a different search term or category'
                  : 'Add guidelines, brand voice, and context to help your agents work better'
              }
              action={
                showStarred || search || category !== 'all'
                  ? undefined
                  : { label: 'New Article', onClick: () => setQuickCreate(true) }
              }
              size="md"
            />
          ) : (
            displayedArticles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                searchTerm={debouncedSearch}
                isStarred={starred.has(article.id)}
                onView={() => setViewing(article)}
                onEdit={() => setEditing({ ...article, tags: article.tags.join(', ') })}
                onDelete={() => del(article.id)}
                onTogglePin={() => togglePin(article)}
                onToggleStar={() => toggleStar(article.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Quick-create modal */}
      {quickCreate && (
        <QuickCreateModal
          categories={allCategories}
          title={qcTitle}
          category={qcCategory}
          categoryCustom={qcCategoryCustom}
          scope={qcScope}
          content={qcContent}
          saving={qcSaving}
          onChangeTitle={setQcTitle}
          onChangeCategory={setQcCategory}
          onChangeCategoryCustom={setQcCategoryCustom}
          onChangeScope={setQcScope}
          onChangeContent={setQcContent}
          onSave={quickCreateSave}
          onClose={() => {
            setQuickCreate(false);
            setQcTitle(''); setQcContent(''); setQcCategory('reference'); setQcCategoryCustom(''); setQcScope('all');
          }}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface CategorySidebarProps {
  categories: string[];
  counts: Record<string, number>;
  selected: string;
  total: number;
  onSelect: (cat: string) => void;
}

function CategorySidebar({ categories, counts, selected, total, onSelect }: CategorySidebarProps) {
  return (
    <nav className="w-36 shrink-0 border-r border-mission-control-border flex flex-col h-full overflow-y-auto py-3 px-2 space-y-0.5">
      <button
        onClick={() => onSelect('all')}
        className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
          selected === 'all'
            ? 'bg-blue-600/20 text-blue-400 font-medium'
            : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'
        }`}
      >
        <span>All</span>
        <span className="opacity-60">{total}</span>
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
            selected === cat
              ? 'bg-blue-600/20 text-blue-400 font-medium'
              : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'
          }`}
        >
          <span className="capitalize truncate">{cat}</span>
          {counts[cat] != null && (
            <span className="opacity-60 shrink-0 ml-1">{counts[cat]}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

interface ArticleCardProps {
  article: KBArticle;
  searchTerm: string;
  isStarred: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleStar: () => void;
}

function ArticleCard({
  article, searchTerm, isStarred, onView, onEdit, onDelete, onTogglePin, onToggleStar,
}: ArticleCardProps) {
  const snippet = article.content.replace(/#{1,6}\s/g, '').slice(0, 150);

  return (
    <div
      className="group rounded-lg bg-mission-control-surface border border-mission-control-border p-3 hover:border-blue-500/40 transition-colors cursor-pointer"
      onClick={onView}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {article.pinned && <Pin size={11} className="text-amber-400 shrink-0" />}
          <span className="font-medium text-mission-control-text text-sm truncate">
            {highlightText(article.title, searchTerm)}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onToggleStar(); }}
            className={`p-1 rounded hover:bg-mission-control-border transition-colors ${isStarred ? 'text-amber-400' : 'text-mission-control-text-dim hover:text-amber-400'}`}
            aria-label={isStarred ? 'Unstar article' : 'Star article'}
          >
            <Star size={12} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onTogglePin(); }}
            className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-amber-400"
            aria-label={article.pinned ? 'Unpin article' : 'Pin article'}
            title={article.pinned ? 'Unpin' : 'Pin — always inject into agent context'}
          >
            <Pin size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim"
            aria-label="Edit article"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-mission-control-border text-red-400"
            aria-label="Delete article"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <p className="text-xs text-mission-control-text-dim line-clamp-2 mb-2">
        {highlightText(snippet, searchTerm)}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-1.5 py-0.5 rounded text-xs bg-mission-control-border text-mission-control-text-dim capitalize">
          {article.category}
        </span>
        {isStarred && (
          <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 flex items-center gap-1">
            <Star size={9} fill="currentColor" />
            Starred
          </span>
        )}
        {article.tags.slice(0, 3).map(t => (
          <span key={t} className="px-1.5 py-0.5 rounded-full bg-mission-control-border text-xs text-mission-control-text-dim">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

interface QuickCreateModalProps {
  categories: string[];
  title: string;
  category: string;
  categoryCustom: string;
  scope: string;
  content: string;
  saving: boolean;
  onChangeTitle: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onChangeCategoryCustom: (v: string) => void;
  onChangeScope: (v: string) => void;
  onChangeContent: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
}

function QuickCreateModal({
  categories, title, category, categoryCustom, scope, content, saving,
  onChangeTitle, onChangeCategory, onChangeCategoryCustom, onChangeScope, onChangeContent,
  onSave, onClose,
}: QuickCreateModalProps) {
  const canSave = title.trim() && content.trim() && !saving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg mx-4 rounded-xl bg-mission-control-surface border border-mission-control-border shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border">
          <BookOpen size={16} className="text-mission-control-text-dim" />
          <span className="font-semibold text-mission-control-text flex-1 text-sm">New Article</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={e => onChangeTitle(e.target.value)}
            placeholder="Article title (required)..."
            className="w-full px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <select
                value={category}
                onChange={e => onChangeCategory(e.target.value)}
                className="w-full px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
                <option value="__custom__">New category...</option>
              </select>
              {category === '__custom__' && (
                <input
                  value={categoryCustom}
                  onChange={e => onChangeCategoryCustom(e.target.value)}
                  placeholder="Category name..."
                  className="mt-1.5 w-full px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            <select
              value={scope}
              onChange={e => onChangeScope(e.target.value)}
              className="px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text text-sm focus:outline-none"
            >
              {SCOPE_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <textarea
            value={content}
            onChange={e => onChangeContent(e.target.value)}
            placeholder="Article content (required)..."
            rows={10}
            className="w-full px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text text-sm font-mono focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-mission-control-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!canSave}
            className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm flex items-center gap-1.5"
          >
            <Check size={13} />
            {saving ? 'Saving...' : 'Save Article'}
          </button>
        </div>
      </div>
    </div>
  );
}
