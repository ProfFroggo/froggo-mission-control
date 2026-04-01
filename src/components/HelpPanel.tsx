import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  HelpCircle, X, Search, BookOpen,
  MessageCircle, Lightbulb, ChevronRight,
  Keyboard, Star, Zap
} from 'lucide-react';
import { Flex, TextField } from '@radix-ui/themes';
import { 
  helpArticles, 
  faqs, 
  quickTips, 
  getContextHelp, 
  searchHelp, 
  searchFAQs,
  type HelpArticle,
  type FAQItem,
  type QuickTip
} from '../data/helpContent';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentPanel?: string; // For context-aware help
}

type ViewMode = 'browse' | 'search' | 'article' | 'faq' | 'tips' | 'shortcuts';

export default function HelpPanel({ isOpen, onClose, currentPanel }: HelpPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  // Context-aware help articles
  const contextArticles = useMemo(() => {
    if (currentPanel) {
      return getContextHelp(currentPanel);
    }
    return [];
  }, [currentPanel]);

  // Search results
  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return { articles: [], faqs: [] };
    return {
      articles: searchHelp(searchQuery),
      faqs: searchFAQs(searchQuery)
    };
  }, [searchQuery]);

  // Categories for browsing
  const categories = useMemo(() => {
    const cats = new Map<string, HelpArticle[]>();
    helpArticles.forEach(article => {
      if (!cats.has(article.category)) {
        cats.set(article.category, []);
      }
      cats.get(article.category)!.push(article);
    });
    return cats;
  }, []);

  const faqCategories = useMemo(() => {
    const cats = new Map<string, FAQItem[]>();
    faqs.forEach(faq => {
      if (!cats.has(faq.category)) {
        cats.set(faq.category, []);
      }
      cats.get(faq.category)!.push(faq);
    });
    return cats;
  }, []);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setViewMode('browse');
      setSearchQuery('');
      setSelectedArticle(null);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedArticle) {
          setSelectedArticle(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedArticle, onClose]);

  // Toggle FAQ expansion
  const toggleFAQ = (id: string) => {
    setExpandedFAQs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-mission-control-surface rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col border border-mission-control-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-mission-control-surface border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
              <HelpCircle size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-mission-control-text">Help & Documentation</h2>
              <p className="text-sm text-mission-control-text-dim">
                {currentPanel ? `Context: ${currentPanel.charAt(0).toUpperCase() + currentPanel.slice(1)}` : 'Articles, FAQs, and keyboard shortcuts'}
              </p>
            </div>
          </Flex>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-mission-control-border flex-shrink-0">
          <div>
            <TextField.Root
              placeholder="Search help articles, FAQs, and guides..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length >= 2) {
                  setViewMode('search');
                } else {
                  setViewMode('browse');
                }
              }}
              size="2"
              className="w-full"
            >
              <TextField.Slot>
                <Search size={16} />
              </TextField.Slot>
            </TextField.Root>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-mission-control-border flex-shrink-0 overflow-x-auto">
          <NavButton
            icon={<BookOpen size={16} />}
            label="Browse"
            active={viewMode === 'browse'}
            onClick={() => setViewMode('browse')}
          />
          <NavButton
            icon={<MessageCircle size={16} />}
            label="FAQ"
            active={viewMode === 'faq'}
            onClick={() => setViewMode('faq')}
          />
          <NavButton
            icon={<Lightbulb size={16} />}
            label="Quick Tips"
            active={viewMode === 'tips'}
            onClick={() => setViewMode('tips')}
          />
          <NavButton
            icon={<Keyboard size={16} />}
            label="Shortcuts"
            active={viewMode === 'shortcuts'}
            onClick={() => setViewMode('shortcuts')}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Search Results */}
          {viewMode === 'search' && (
            <SearchResults 
              results={searchResults}
              onSelectArticle={(article) => {
                setSelectedArticle(article);
                setViewMode('article');
              }}
              onSelectFAQ={toggleFAQ}
              expandedFAQs={expandedFAQs}
            />
          )}

          {/* Browse Mode */}
          {viewMode === 'browse' && (
            <BrowseView
              contextArticles={contextArticles}
              categories={categories}
              onSelectArticle={(article) => {
                setSelectedArticle(article);
                setViewMode('article');
              }}
            />
          )}

          {/* Article View */}
          {viewMode === 'article' && selectedArticle && (
            <ArticleView 
              article={selectedArticle}
              onBack={() => {
                setSelectedArticle(null);
                setViewMode('browse');
              }}
            />
          )}

          {/* FAQ View */}
          {viewMode === 'faq' && (
            <FAQView
              categories={faqCategories}
              expandedFAQs={expandedFAQs}
              onToggle={toggleFAQ}
            />
          )}

          {/* Quick Tips */}
          {viewMode === 'tips' && <QuickTipsView tips={quickTips} />}

          {/* Shortcuts */}
          {viewMode === 'shortcuts' && <ShortcutsView />}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-mission-control-border bg-mission-control-bg text-center flex-shrink-0 space-y-2">
          <button
            type="button"
            onClick={() => window.open('mailto:support@froggo.pro', '_blank')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-mission-control-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Contact Support
          </button>
          <p className="font-mono text-[10px] text-mission-control-text-dim/70">
            © 2026 <a href="https://froggo.pro" target="_blank" rel="noopener noreferrer" className="text-mission-control-accent hover:underline">froggo.pro</a> — AGPL-3.0 — v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}

// Nav Button Component
function NavButton({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
        active
          ? 'border-mission-control-accent text-mission-control-accent'
          : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-border',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Search Results Component
function SearchResults({ 
  results, 
  onSelectArticle, 
  onSelectFAQ,
  expandedFAQs 
}: { 
  results: { articles: HelpArticle[]; faqs: FAQItem[] };
  onSelectArticle: (article: HelpArticle) => void;
  onSelectFAQ: (id: string) => void;
  expandedFAQs: Set<string>;
}) {
  if (results.articles.length === 0 && results.faqs.length === 0) {
    return (
      <div className="text-center py-12">
        <Search size={48} className="mx-auto text-mission-control-text-dim mb-4" />
        <p className="text-mission-control-text-dim">No results found. Try different keywords.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Articles */}
      {results.articles.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">
            Articles ({results.articles.length})
          </h3>
          <div className="space-y-2">
            {results.articles.map(article => (
              <ArticleCard key={article.id} article={article} onClick={() => onSelectArticle(article)} />
            ))}
          </div>
        </div>
      )}

      {/* FAQs */}
      {results.faqs.length > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">
            FAQs ({results.faqs.length})
          </h3>
          <div className="space-y-2">
            {results.faqs.map(faq => (
              <FAQCard 
                key={faq.id} 
                faq={faq} 
                expanded={expandedFAQs.has(faq.id)}
                onToggle={() => onSelectFAQ(faq.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Browse View Component
function BrowseView({ 
  contextArticles, 
  categories, 
  onSelectArticle 
}: { 
  contextArticles: HelpArticle[];
  categories: Map<string, HelpArticle[]>;
  onSelectArticle: (article: HelpArticle) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Context-Aware Help */}
      {contextArticles.length > 0 && (
        <div>
          <Flex align="center" gap="2" className="mb-3">
            <Star size={14} className="text-warning" />
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
              Relevant to Current Panel
            </h3>
          </Flex>
          <div className="space-y-2">
            {contextArticles.map(article => (
              <ArticleCard key={article.id} article={article} onClick={() => onSelectArticle(article)} />
            ))}
          </div>
        </div>
      )}

      {/* All Categories */}
      {Array.from(categories.entries()).map(([category, articles]) => (
        <div key={category}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">
            {category}
          </h3>
          <div className="space-y-2">
            {articles.map(article => (
              <ArticleCard key={article.id} article={article} onClick={() => onSelectArticle(article)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Article Card Component
function ArticleCard({ article, onClick }: { article: HelpArticle; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 w-full p-4 bg-mission-control-surface border border-mission-control-border rounded-xl hover:border-[var(--mission-control-accent)]/30 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-mission-control-text">
              {article.title}
            </h4>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-mission-control-border/40 rounded-full px-2 py-0.5 text-mission-control-text-dim/70 flex-shrink-0">
              {article.category}
            </span>
          </div>
          <p className="text-xs text-mission-control-text-dim/70 line-clamp-1">
            {article.content.split('\n')[0]}
          </p>
        </div>
        <ChevronRight size={14} className="text-mission-control-text-dim/70 flex-shrink-0 mt-0.5" />
      </div>
    </button>
  );
}

// Article View Component
function ArticleView({ article, onBack }: { article: HelpArticle; onBack: () => void }) {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-mission-control-text-dim/70 mb-4">
        <button
          type="button"
          onClick={onBack}
          className="hover:text-mission-control-text transition-colors"
        >
          Browse
        </button>
        <span>/</span>
        <span className="text-[10px] uppercase font-bold tracking-wider bg-mission-control-border/40 rounded-full px-2 py-0.5">{article.category}</span>
        <span>/</span>
        <span className="text-mission-control-text/70 truncate max-w-[200px]">{article.title}</span>
      </div>

      <div className="space-y-4">
        <div>
          <Flex align="center" gap="2" className="mb-2">
            {article.lastUpdated && (
              <span className="text-[11px] text-mission-control-text-dim/70">
                Updated {article.lastUpdated}
              </span>
            )}
          </Flex>
          <h2 className="text-2xl font-bold text-mission-control-text mb-2">{article.title}</h2>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none text-left text-mission-control-text leading-relaxed
          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
          [&_strong]:text-mission-control-text [&_strong]:font-semibold
          [&_p]:mb-3 [&_p]:text-mission-control-text
          [&_ul]:mb-3 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:text-mission-control-text
          [&_ol]:mb-3 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol]:text-mission-control-text
          [&_li]:mb-1
          [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:bg-mission-control-bg [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_code]:text-mission-control-accent
          [&_pre]:bg-mission-control-bg [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:mb-3 [&_pre]:overflow-x-auto
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm
          [&_hr]:border-mission-control-border [&_hr]:my-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// FAQ View Component
function FAQView({ 
  categories, 
  expandedFAQs, 
  onToggle 
}: { 
  categories: Map<string, FAQItem[]>;
  expandedFAQs: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      {Array.from(categories.entries()).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">
            {category}
          </h3>
          <div className="space-y-2">
            {items.map(faq => (
              <FAQCard
                key={faq.id}
                faq={faq}
                expanded={expandedFAQs.has(faq.id)}
                onToggle={() => onToggle(faq.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// FAQ Card Component
function FAQCard({ faq, expanded, onToggle }: { faq: FAQItem; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-start gap-3 w-full p-4 bg-mission-control-surface border border-mission-control-border rounded-xl hover:border-[var(--mission-control-accent)]/30 transition-colors cursor-pointer text-left"
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-mission-control-text">{faq.question}</h4>
          {expanded && (
            <p className="text-xs text-mission-control-text-dim/70 mt-2 leading-relaxed">
              {faq.answer}
            </p>
          )}
        </div>
        <ChevronRight
          size={14}
          className={`text-mission-control-text-dim/70 transition-transform flex-shrink-0 mt-0.5 ${
            expanded ? 'rotate-90' : ''
          }`}
        />
      </div>
    </button>
  );
}

// Quick Tips View
function QuickTipsView({ tips }: { tips: QuickTip[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tips.map(tip => (
        <div
          key={tip.id}
          className="p-4 bg-mission-control-surface border border-mission-control-border rounded-xl hover:border-[var(--mission-control-accent)]/30 transition-colors"
        >
          <Zap size={16} className="text-mission-control-accent mb-2" />
          <h4 className="text-sm font-semibold text-mission-control-text mb-1">{tip.title}</h4>
          <p className="text-xs text-mission-control-text-dim/70 leading-relaxed">{tip.description}</p>
        </div>
      ))}
    </div>
  );
}

// Shortcuts View - Reference to existing KeyboardShortcuts component data
function ShortcutsView() {
  const shortcuts = [
    { keys: '⌘K', label: 'Global Search' },
    { keys: '⌘1–9', label: 'Navigate panels' },
    { keys: '⌘N', label: 'New (context-aware)' },
    { keys: '⌘,', label: 'Settings' },
    { keys: '⌘M', label: 'Toggle mute' },
    { keys: '⌘?', label: 'Keyboard shortcuts' },
  ];

  return (
    <div className="space-y-4">
      <div className="p-3 bg-info/10 border border-info/30 rounded-lg">
        <p className="text-xs text-mission-control-text/70">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-mission-control-bg border border-mission-control-border rounded font-mono text-[10px]">⌘?</kbd>
          {' '}anytime to view the full keyboard shortcuts reference.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-3">Common shortcuts</p>
        {shortcuts.map(s => (
          <div key={s.keys} className="flex items-center justify-between py-2 border-b border-mission-control-border/40 last:border-0">
            <span className="text-sm text-mission-control-text">{s.label}</span>
            <kbd className="px-2 py-0.5 bg-mission-control-bg border border-mission-control-border rounded font-mono text-[10px] text-mission-control-text-dim">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}
