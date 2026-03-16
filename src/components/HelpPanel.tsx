import { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  HelpCircle, X, Search, BookOpen,
  MessageCircle, Lightbulb, ChevronRight,
  Keyboard, Star, Zap
} from 'lucide-react';
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
      <div className="glass-modal rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-mission-control-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info-subtle rounded-lg">
              <HelpCircle size={24} className="text-info" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Help & Documentation</h2>
              <p className="text-sm text-mission-control-text-dim">
                {currentPanel && `Context: ${currentPanel.charAt(0).toUpperCase() + currentPanel.slice(1)}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-mission-control-border rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-mission-control-border flex-shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
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
              className="w-full pl-10 pr-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:ring-2 focus:ring-mission-control-accent"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 px-6 py-3 border-b border-mission-control-border flex-shrink-0 overflow-x-auto">
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
        <div className="p-4 border-t border-mission-control-border bg-mission-control-bg text-center text-sm text-mission-control-text-dim flex-shrink-0">
          <span>© 2026 <a href="https://froggo.pro" target="_blank" rel="noopener noreferrer" className="text-mission-control-accent hover:underline">froggo.pro</a> — AGPL-3.0 License</span>
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
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        active 
          ? 'bg-mission-control-accent text-white' 
          : 'bg-mission-control-bg hover:bg-mission-control-border text-mission-control-text-dim'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
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
          <h3 className="text-sm font-medium text-mission-control-text-dim mb-3 uppercase tracking-wide">
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
          <h3 className="text-sm font-medium text-mission-control-text-dim mb-3 uppercase tracking-wide">
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
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-warning" />
            <h3 className="text-sm font-medium text-mission-control-text-dim uppercase tracking-wide">
              Relevant to Current Panel
            </h3>
          </div>
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
          <h3 className="text-sm font-medium text-mission-control-text-dim mb-3 uppercase tracking-wide">
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
      onClick={onClick}
      className="w-full p-4 bg-mission-control-bg hover:bg-mission-control-border rounded-lg transition-colors text-left group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-medium mb-1 group-hover:text-mission-control-accent transition-colors">
            {article.title}
          </h4>
          <p className="text-sm text-mission-control-text-dim line-clamp-2">
            {article.content.split('\n')[0]}
          </p>
        </div>
        <ChevronRight size={20} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}

// Article View Component
function ArticleView({ article, onBack }: { article: HelpArticle; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-mission-control-text-dim hover:text-mission-control-accent mb-4 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180" />
        Back to browse
      </button>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-1 bg-mission-control-accent/20 text-mission-control-accent rounded-md">
              {article.category}
            </span>
            {article.lastUpdated && (
              <span className="text-xs text-mission-control-text-dim">
                Updated {article.lastUpdated}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">{article.title}</h2>
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
          <h3 className="text-sm font-medium text-mission-control-text-dim mb-3 uppercase tracking-wide">
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
      onClick={onToggle}
      className="w-full p-4 bg-mission-control-bg hover:bg-mission-control-border rounded-lg transition-colors text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-medium mb-1">{faq.question}</h4>
          {expanded && (
            <p className="text-sm text-mission-control-text-dim mt-2">
              {faq.answer}
            </p>
          )}
        </div>
        <ChevronRight 
          size={20} 
          className={`text-mission-control-text-dim transition-transform flex-shrink-0 ${
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
    <div className="grid grid-cols-2 gap-4">
      {tips.map(tip => (
        <div
          key={tip.id}
          className="p-4 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
        >
          <Zap size={18} className="text-mission-control-accent mb-2" />
          <h4 className="font-medium mb-1">{tip.title}</h4>
          <p className="text-sm text-mission-control-text-dim">{tip.description}</p>
        </div>
      ))}
    </div>
  );
}

// Shortcuts View - Reference to existing KeyboardShortcuts component data
function ShortcutsView() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
        <p className="text-sm">
          <strong>Tip:</strong> Press <kbd className="px-2 py-1 bg-mission-control-bg border border-mission-control-border rounded text-xs">⌘?</kbd> anytime to view the full keyboard shortcuts reference.
        </p>
      </div>
      
      <div className="text-mission-control-text-dim">
        <p>Common shortcuts:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>• ⌘K - Global Search</li>
          <li>• ⌘1-9 - Navigate panels</li>
          <li>• ⌘N - New (context-aware)</li>
          <li>• ⌘, - Settings</li>
          <li>• ⌘M - Toggle mute</li>
        </ul>
      </div>
    </div>
  );
}
