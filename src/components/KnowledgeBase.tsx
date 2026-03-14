// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef, useMemo, KeyboardEvent } from 'react';
import {
  BookOpen, Plus, Search, Pin, Trash2, Edit2, X, Check, ChevronLeft,
  Star, Tag, ChevronRight, History, Clock, Wand2, FileText, Link, AlignLeft, Eye,
  Network, ChevronDown,
} from 'lucide-react';
import EmptyState from './EmptyState';
import ArticleRevisionHistory from './ArticleRevisionHistory';
import KnowledgeGraphPanel from './KnowledgeGraphPanel';

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

// ── Article templates ─────────────────────────────────────────────────────────

interface ArticleTemplate {
  id: string;
  label: string;
  icon: React.ElementType;
  content: string;
}

const ARTICLE_TEMPLATES: ArticleTemplate[] = [
  {
    id: 'how-to',
    label: 'How-To Guide',
    icon: FileText,
    content: `# How-To Guide Title

## Overview
Briefly describe what this guide helps the reader accomplish and who it is for.

## Prerequisites
- Requirement one
- Requirement two

## Steps
1. First step — describe what to do
2. Second step — describe what to do
3. Third step — describe what to do

## Tips
- Helpful tip or gotcha to watch out for
- Another useful tip

## Troubleshooting
**Problem**: Describe a common issue.
**Solution**: Describe how to fix it.
`,
  },
  {
    id: 'meeting-notes',
    label: 'Meeting Notes',
    icon: Clock,
    content: `# Meeting Notes — [Date]

## Attendees
- Name / Role
- Name / Role

## Agenda
1. Topic one
2. Topic two
3. Topic three

## Discussion Summary
Summarize the key points discussed for each agenda item.

## Decisions Made
- Decision one — owner: [name]
- Decision two — owner: [name]

## Action Items
- [ ] Task description — owner: [name] — due: [date]
- [ ] Task description — owner: [name] — due: [date]

## Next Meeting
Date / time / agenda preview
`,
  },
  {
    id: 'process-doc',
    label: 'Process Documentation',
    icon: BookOpen,
    content: `# Process: [Process Name]

## Purpose
Explain why this process exists and what problem it solves.

## Scope
Define what is in scope and out of scope for this process.

## Steps
1. Step one — describe the action and any inputs required
2. Step two
3. Step three

## Roles & Responsibilities
- **Owner**: [Name / Role] — responsible for maintaining this process
- **Participant**: [Name / Role] — participates in step X

## Last Updated
[Date] — [Author]
`,
  },
  {
    id: 'agent-instructions',
    label: 'Agent Instructions',
    icon: Wand2,
    content: `# Agent Instructions: [Agent Name]

## Agent Name & Role
Describe what this agent does and its primary responsibility.

## Capabilities
- Capability one
- Capability two
- Capability three

## How To Use
Explain how to interact with this agent, what inputs it expects, and what outputs it produces.

## Examples
**Example request**: "..."
**Expected response**: "..."

## Limitations
- Known limitation one
- Escalation path when the agent cannot handle a request
`,
  },
];

// ── Interfaces ────────────────────────────────────────────────────────────────

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

interface KBVersion {
  id: number;
  articleId: string;
  editedBy: string;
  editedAt: number;
  versionNote: string | null;
  content: string;
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

/** Extract a content excerpt around the first occurrence of a search term */
function getExcerpt(content: string, term: string, maxLength = 160): string {
  const plain = content.replace(/#{1,6}\s/g, '').replace(/[*`_]/g, '');
  if (!term.trim()) return plain.slice(0, maxLength);
  const idx = plain.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return plain.slice(0, maxLength);
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + term.length + 100);
  const excerpt = plain.slice(start, end);
  return (start > 0 ? '...' : '') + excerpt + (end < plain.length ? '...' : '');
}

/** Very simple markdown-ish renderer — no library needed */
function renderContent(content: string, allArticles: KBArticle[], onNavigate: (article: KBArticle) => void): React.ReactNode {
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
            <li key={j}>{renderInline(item, allArticles, onNavigate)}</li>
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
            <li key={j}>{renderInline(item, allArticles, onNavigate)}</li>
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
        {renderInline(line, allArticles, onNavigate)}
      </p>
    );
    i++;
  }

  return <>{nodes}</>;
}

/** Inline markup: **bold**, *italic*, `code`, [link](url), [[Article Title]] auto-links */
function renderInline(text: string, allArticles: KBArticle[], onNavigate: (article: KBArticle) => void): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // [[Article Title]] auto-link
    const wikiMatch = remaining.match(/^(.*?)\[\[([^\]]+)\]\](.*)/s);
    // Bold
    const boldMatch = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
    // Italic
    const italicMatch = remaining.match(/^(.*?)\*(.*?)\*(.*)/s);
    // Inline code
    const codeMatch = remaining.match(/^(.*?)`(.*?)`(.*)/s);
    // Link
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)/s);

    const candidates: Array<{ index: number; match: RegExpMatchArray; type: string }> = [];
    if (wikiMatch && wikiMatch[1] !== undefined) candidates.push({ index: wikiMatch[1].length, match: wikiMatch, type: 'wiki' });
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

    if (first.type === 'wiki') {
      const articleTitle = first.match[2];
      const target = allArticles.find(a => a.title.toLowerCase() === articleTitle.toLowerCase());
      if (target) {
        parts.push(
          <button
            key={key++}
            onClick={() => onNavigate(target)}
            className="text-blue-400 hover:underline inline font-medium"
            title={`View article: ${target.title}`}
          >
            <Link size={10} className="inline mr-0.5 opacity-70" />
            {articleTitle}
          </button>
        );
      } else {
        parts.push(<span key={key++} className="text-mission-control-text-dim">{articleTitle}</span>);
      }
      remaining = first.match[3];
    } else if (first.type === 'bold') {
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

/** Auto-detect article title mentions in content and wrap them with [[Title]] if not already */
function autoLinkContent(content: string, allArticles: { title: string; id: string }[]): string {
  let result = content;
  // Sort by title length descending to match longer titles first
  const sorted = [...allArticles].sort((a, b) => b.title.length - a.title.length);
  for (const article of sorted) {
    // Only wrap if not already wrapped
    const escaped = article.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const alreadyWrapped = new RegExp(`\\[\\[${escaped}\\]\\]`, 'g');
    if (alreadyWrapped.test(result)) continue;
    // Replace bare occurrences
    const bare = new RegExp(`(?<!\\[\\[)\\b${escaped}\\b(?!\\]\\])`, 'g');
    result = result.replace(bare, `[[${article.title}]]`);
  }
  return result;
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation state for search results
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchCursor, setSearchCursor] = useState(-1);

  // Version history drawer
  const [versionsArticleId, setVersionsArticleId] = useState<string | null>(null);
  const [versions, setVersions] = useState<KBVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<KBVersion | null>(null);

  // Quick-create modal state
  const [qcTitle, setQcTitle] = useState('');
  const [qcCategory, setQcCategory] = useState('reference');
  const [qcCategoryCustom, setQcCategoryCustom] = useState('');
  const [qcScope, setQcScope] = useState('all');
  const [qcContent, setQcContent] = useState('');
  const [qcSaving, setQcSaving] = useState(false);
  const [qcGenerating, setQcGenerating] = useState(false);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Reset search cursor when search term changes
  useEffect(() => { setSearchCursor(-1); }, [debouncedSearch]);

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

  // Load versions when drawer opens
  useEffect(() => {
    if (!versionsArticleId) { setVersions([]); return; }
    setVersionsLoading(true);
    setPreviewVersion(null);
    fetch(`/api/knowledge/${versionsArticleId}/versions`)
      .then(r => r.json())
      .then(d => { if (d.success) setVersions(d.versions); })
      .finally(() => setVersionsLoading(false));
  }, [versionsArticleId]);

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

  const restoreVersion = async (v: KBVersion) => {
    if (!confirm(`Restore this version from ${new Date(v.editedAt).toLocaleString()}?`)) return;
    await fetch(`/api/knowledge/${v.articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: v.content, versionNote: 'Restored from version history' }),
    });
    setVersionsArticleId(null);
    // If currently viewing this article, refresh it
    if (viewing?.id === v.articleId) {
      const res = await fetch(`/api/knowledge/${v.articleId}`);
      const data = await res.json();
      if (data.success) setViewing(data.article);
    }
    load();
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

  const generateContent = async () => {
    const topic = qcTitle.trim();
    if (!topic) return;
    setQcGenerating(true);
    try {
      const res = await fetch('/api/knowledge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.success) setQcContent(data.content);
    } finally {
      setQcGenerating(false);
    }
  };

  // ── Keyboard navigation for search ───────────────────────────────────────

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!searchFocused || displayedArticles.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchCursor(c => Math.min(c + 1, displayedArticles.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter' && searchCursor >= 0) {
      e.preventDefault();
      setViewing(displayedArticles[searchCursor]);
      setSearch('');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearch('');
      setSearchCursor(-1);
      searchInputRef.current?.blur();
    }
  };

  // ── Article detail view ──────────────────────────────────────────────────

  if (viewing) {
    const related = getRelated(viewing, articles);
    const isStarred = starred.has(viewing.id);
    const linkedContent = autoLinkContent(viewing.content, articles.filter(a => a.id !== viewing.id));
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
              onClick={() => setVersionsArticleId(viewing.id)}
              className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text"
              aria-label="Version history"
              title="Version history"
            >
              <History size={14} />
            </button>
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
              {renderContent(linkedContent, articles, setViewing)}

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

        {versionsArticleId && (
          <ArticleRevisionHistory
            articleId={versionsArticleId}
            currentContent={viewing.content}
            onRestore={async (content) => {
              await fetch(`/api/knowledge/${versionsArticleId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, versionNote: 'Restored from version history' }),
              });
              const res = await fetch(`/api/knowledge/${versionsArticleId}`);
              const data = await res.json();
              if (data.success) setViewing(data.article);
              setVersionsArticleId(null);
              load();
            }}
            onClose={() => setVersionsArticleId(null)}
          />
        )}
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
            Markdown supported. Pinned articles are always injected into agent context. Use [[Article Title]] to link to other articles.
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <BookOpen size={16} className="text-mission-control-text-dim" />
              <span className="font-semibold text-mission-control-text text-sm">Knowledge Base</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              <button
                onClick={() => setShowGraph(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-xs transition-colors"
                title="Graph view"
              >
                <Network size={12} />
                Graph
              </button>
              <div className="relative" ref={templateDropdownRef}>
                <button
                  onClick={() => setShowTemplateDropdown(v => !v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-xs transition-colors"
                  title="New from template"
                >
                  <FileText size={12} />
                  Template
                  <ChevronDown size={10} />
                </button>
                {showTemplateDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-48 rounded-lg bg-mission-control-surface border border-mission-control-border shadow-xl z-20 overflow-hidden">
                    {apiTemplates.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-mission-control-text-dim">No templates available</p>
                    ) : (
                      apiTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => createFromTemplate(t.id)}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-mission-control-text hover:bg-mission-control-border transition-colors"
                        >
                          <FileText size={11} className="text-mission-control-text-dim shrink-0" />
                          {t.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setQuickCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                <Plus size={12} />
                New Article
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              ref={searchInputRef}
              aria-label="Search knowledge base"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search guidelines, brand voice, context..."
              className="w-full pl-8 pr-8 py-1.5 rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text text-sm focus:outline-none focus:border-blue-500"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setSearchCursor(-1); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim hover:text-mission-control-text"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
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
                  : search
                  ? `No articles match "${search}"`
                  : category !== 'all'
                  ? 'Try a different search term or category'
                  : 'Add guidelines, brand voice, and context to help your agents work better'
              }
              action={
                search
                  ? {
                      label: `Create article about "${search}"`,
                      onClick: () => { setQcTitle(search); setSearch(''); setQuickCreate(true); },
                    }
                  : showStarred || category !== 'all'
                  ? undefined
                  : { label: 'New Article', onClick: () => setQuickCreate(true) }
              }
              size="md"
            />
          ) : (
            displayedArticles.map((article, idx) => (
              <ArticleCard
                key={article.id}
                article={article}
                searchTerm={debouncedSearch}
                isStarred={starred.has(article.id)}
                isKeyboardFocused={searchFocused && searchCursor === idx}
                onView={() => { setViewing(article); setSearchCursor(-1); }}
                onEdit={() => setEditing({ ...article, tags: article.tags.join(', ') })}
                onDelete={() => del(article.id)}
                onTogglePin={() => togglePin(article)}
                onToggleStar={() => toggleStar(article.id)}
                onVersionHistory={() => setVersionsArticleId(article.id)}
                viewCount={0}
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
          generating={qcGenerating}
          onChangeTitle={setQcTitle}
          onChangeCategory={setQcCategory}
          onChangeCategoryCustom={setQcCategoryCustom}
          onChangeScope={setQcScope}
          onChangeContent={setQcContent}
          onGenerate={generateContent}
          onSave={quickCreateSave}
          onClose={() => {
            setQuickCreate(false);
            setQcTitle(''); setQcContent(''); setQcCategory('reference'); setQcCategoryCustom(''); setQcScope('all');
          }}
        />
      )}

      {/* Version history drawer (from list view — when not in article view) */}
      {versionsArticleId && !viewing && (
        <VersionDrawer
          versions={versions}
          loading={versionsLoading}
          previewVersion={previewVersion}
          currentContent={articles.find(a => a.id === versionsArticleId)?.content ?? ''}
          onPreview={setPreviewVersion}
          onRestore={restoreVersion}
          onClose={() => { setVersionsArticleId(null); setPreviewVersion(null); }}
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
  isKeyboardFocused: boolean;
  viewCount: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onToggleStar: () => void;
  onVersionHistory: () => void;
}

function ArticleCard({
  article, searchTerm, isStarred, isKeyboardFocused, viewCount, onView, onEdit, onDelete, onTogglePin, onToggleStar, onVersionHistory,
}: ArticleCardProps) {
  const excerpt = getExcerpt(article.content, searchTerm);
  const wc = article.content.trim() ? article.content.trim().split(/\s+/).length : 0;

  return (
    <div
      className={`group rounded-lg bg-mission-control-surface border transition-colors cursor-pointer ${
        isKeyboardFocused
          ? 'border-blue-500/70 ring-1 ring-blue-500/30'
          : 'border-mission-control-border hover:border-blue-500/40'
      }`}
      style={{ padding: '0.75rem' }}
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
            onClick={e => { e.stopPropagation(); onVersionHistory(); }}
            className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text"
            aria-label="Version history"
            title="Version history"
          >
            <History size={12} />
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
        {highlightText(excerpt, searchTerm)}
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
        <span className="ml-auto flex items-center gap-2 text-xs text-mission-control-text-dim">
          <span className="flex items-center gap-0.5">
            <AlignLeft size={9} />
            {wc}w
          </span>
          {viewCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Eye size={9} />
              {viewCount}
            </span>
          )}
        </span>
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
  generating: boolean;
  onChangeTitle: (v: string) => void;
  onChangeCategory: (v: string) => void;
  onChangeCategoryCustom: (v: string) => void;
  onChangeScope: (v: string) => void;
  onChangeContent: (v: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onClose: () => void;
}

function QuickCreateModal({
  categories, title, category, categoryCustom, scope, content, saving, generating,
  onChangeTitle, onChangeCategory, onChangeCategoryCustom, onChangeScope, onChangeContent,
  onGenerate, onSave, onClose,
}: QuickCreateModalProps) {
  const canSave = title.trim() && content.trim() && !saving;
  const [showTemplates, setShowTemplates] = useState(false);

  const applyTemplate = (tmpl: ArticleTemplate) => {
    onChangeContent(tmpl.content.replace(/^\# .*\n/, `# ${title || tmpl.label}\n`));
    setShowTemplates(false);
  };

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

          {/* Template / AI generation row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-xs transition-colors"
              >
                <FileText size={12} />
                Use template
              </button>
              {showTemplates && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-mission-control-surface border border-mission-control-border shadow-xl z-10 overflow-hidden">
                  {ARTICLE_TEMPLATES.map(tmpl => {
                    const Icon = tmpl.icon;
                    return (
                      <button
                        key={tmpl.id}
                        onClick={() => applyTemplate(tmpl)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-mission-control-text hover:bg-mission-control-border transition-colors"
                      >
                        <Icon size={12} className="text-mission-control-text-dim shrink-0" />
                        {tmpl.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={onGenerate}
              disabled={!title.trim() || generating}
              title={title.trim() ? `Generate content for "${title}"` : 'Enter a title first'}
              className="flex items-center gap-1.5 px-3 py-2 rounded bg-mission-control-border/30 border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
            >
              <Wand2 size={12} />
              {generating ? 'Generating...' : 'Generate with AI'}
            </button>
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

// ── Version History Drawer ────────────────────────────────────────────────────

interface VersionDrawerProps {
  versions: KBVersion[];
  loading: boolean;
  previewVersion: KBVersion | null;
  currentContent: string;
  onPreview: (v: KBVersion | null) => void;
  onRestore: (v: KBVersion) => void;
  onClose: () => void;
}

function VersionDrawer({ versions, loading, previewVersion, currentContent, onPreview, onRestore, onClose }: VersionDrawerProps) {
  const displayContent = previewVersion?.content ?? currentContent;

  return (
    <div className="w-80 shrink-0 border-l border-mission-control-border flex flex-col h-full bg-mission-control-surface">
      <div className="flex items-center gap-2 p-3 border-b border-mission-control-border">
        <History size={14} className="text-mission-control-text-dim" />
        <span className="text-sm font-medium text-mission-control-text flex-1">Version History</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-mission-control-border text-mission-control-text-dim"
          aria-label="Close version history"
        >
          <X size={13} />
        </button>
      </div>

      {/* Content preview pane */}
      {previewVersion && (
        <div className="border-b border-mission-control-border bg-mission-control-border/20 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-mission-control-text-dim">
              Preview — {new Date(previewVersion.editedAt).toLocaleString()}
            </span>
            <button
              onClick={() => onPreview(null)}
              className="text-xs text-mission-control-text-dim hover:text-mission-control-text"
            >
              Close preview
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto rounded bg-mission-control-surface border border-mission-control-border p-2 text-xs font-mono text-mission-control-text whitespace-pre-wrap">
            {displayContent.slice(0, 600)}{displayContent.length > 600 ? '...' : ''}
          </div>
          <button
            onClick={() => onRestore(previewVersion)}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs"
          >
            <History size={11} />
            Restore this version
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-mission-control-border animate-pulse" />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div className="p-4 text-center">
            <Clock size={20} className="text-mission-control-text-dim mx-auto mb-2" />
            <p className="text-xs text-mission-control-text-dim">No version history yet.</p>
            <p className="text-xs text-mission-control-text-dim mt-1">Versions are saved each time content is edited.</p>
          </div>
        ) : (
          <div className="space-y-px px-2">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => onPreview(previewVersion?.id === v.id ? null : v)}
                className={`w-full text-left px-3 py-2.5 rounded transition-colors ${
                  previewVersion?.id === v.id
                    ? 'bg-blue-600/20 border border-blue-500/40'
                    : 'hover:bg-mission-control-border border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-mission-control-text">
                    {new Date(v.editedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-xs text-mission-control-text-dim">
                    {new Date(v.editedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-mission-control-text-dim capitalize">{v.editedBy}</span>
                  {v.versionNote && (
                    <span className="text-xs text-mission-control-text-dim truncate opacity-70">· {v.versionNote}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
