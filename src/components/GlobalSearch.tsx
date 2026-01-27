import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileText, Mail, MessageSquare, CheckSquare, Brain, Calendar, Twitter } from 'lucide-react';
import { SkeletonList } from './Skeleton';

interface SearchResult {
  id: string;
  type: 'task' | 'fact' | 'message' | 'email' | 'session' | 'calendar' | 'tweet';
  title: string;
  snippet: string;
  timestamp?: string;
  source?: string;
  metadata?: any;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const typeIcons = {
  task: CheckSquare,
  fact: Brain,
  message: MessageSquare,
  email: Mail,
  session: MessageSquare,
  calendar: Calendar,
  tweet: Twitter,
};

const typeColors = {
  task: 'text-blue-400 bg-blue-500/10',
  fact: 'text-purple-400 bg-purple-500/10',
  message: 'text-green-400 bg-green-500/10',
  email: 'text-yellow-400 bg-yellow-500/10',
  session: 'text-cyan-400 bg-cyan-500/10',
  calendar: 'text-orange-400 bg-orange-500/10',
  tweet: 'text-sky-400 bg-sky-500/10',
};

export default function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const allResults: SearchResult[] = [];

    try {
      // Search froggo-db (tasks, facts, messages)
      const dbResult = await (window as any).clawdbot?.search?.local(q);
      if (dbResult?.success && dbResult.results) {
        allResults.push(...dbResult.results.map((r: any) => ({
          id: r.id || `db-${Date.now()}`,
          type: r.type || 'message',
          title: r.title || r.text?.slice(0, 50) || 'Untitled',
          snippet: r.text || r.description || '',
          timestamp: r.timestamp || r.created_at,
          source: 'Local DB',
        })));
      }

      // Search emails
      const emailResult = await (window as any).clawdbot?.email?.search(q);
      if (emailResult?.success && emailResult.emails?.threads) {
        allResults.push(...emailResult.emails.threads.slice(0, 5).map((e: any) => ({
          id: e.id,
          type: 'email' as const,
          title: e.subject || 'No subject',
          snippet: `From: ${e.from}`,
          timestamp: e.date,
          source: emailResult.account || 'Email',
        })));
      }

      // Search sessions
      const sessionsResult = await (window as any).clawdbot?.sessions?.list();
      if (sessionsResult?.success && sessionsResult.sessions) {
        const matchingSessions = sessionsResult.sessions.filter((s: any) => 
          s.label?.toLowerCase().includes(q.toLowerCase()) ||
          s.channel?.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 3);
        
        allResults.push(...matchingSessions.map((s: any) => ({
          id: s.sessionKey,
          type: 'session' as const,
          title: s.label || s.sessionKey,
          snippet: `Channel: ${s.channel || 'unknown'}`,
          timestamp: s.lastActivity,
          source: 'Sessions',
        })));
      }

      // Search WhatsApp (has proper FTS5 search)
      const whatsappResult = await (window as any).clawdbot?.search?.whatsapp(q);
      if (whatsappResult?.success && whatsappResult.messages?.length > 0) {
        allResults.push(...whatsappResult.messages.slice(0, 5).map((m: any) => ({
          id: m.id || `wa-${Date.now()}`,
          type: 'message' as const,
          title: m.content?.slice(0, 50) || m.body?.slice(0, 50) || 'WhatsApp message',
          snippet: `Chat: ${m.from || 'Unknown'}`,
          timestamp: m.timestamp,
          source: 'WhatsApp',
        })));
      }

      // Note: Discord search not available (CLI limitation)
      // Note: Telegram search only finds chat names, not message content

      setResults(allResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('[GlobalSearch] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    console.log('[GlobalSearch] Selected:', result);
    // TODO: Navigate to the result
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-clawd-surface border border-clawd-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-clawd-border">
          <Search size={20} className="text-clawd-text-dim" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search everything... (tasks, emails, messages, files)"
            className="flex-1 bg-transparent text-lg outline-none placeholder-clawd-text-dim"
          />
          {loading && <div className="w-5 h-5 border-2 border-clawd-accent border-t-transparent rounded-full animate-spin" />}
          <button
            onClick={onClose}
            className="p-1 hover:bg-clawd-border rounded-lg transition-colors"
          >
            <X size={20} className="text-clawd-text-dim" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && query.length >= 2 && (
            <div className="p-4">
              <SkeletonList count={4} />
            </div>
          )}

          {results.length === 0 && query.length >= 2 && !loading && (
            <div className="p-8 text-center text-clawd-text-dim">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
            </div>
          )}

          {results.length === 0 && query.length < 2 && (
            <div className="p-8 text-center text-clawd-text-dim">
              <p className="text-sm">Type at least 2 characters to search</p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <span className="px-2 py-1 bg-clawd-border rounded text-xs">Tasks</span>
                <span className="px-2 py-1 bg-clawd-border rounded text-xs">Emails</span>
                <span className="px-2 py-1 bg-clawd-border rounded text-xs">Messages</span>
                <span className="px-2 py-1 bg-clawd-border rounded text-xs">Sessions</span>
              </div>
            </div>
          )}

          {results.map((result, index) => {
            const Icon = typeIcons[result.type];
            const colorClass = typeColors[result.type];
            
            return (
              <div
                key={result.id}
                onClick={() => handleSelect(result)}
                className={`p-4 border-b border-clawd-border cursor-pointer transition-colors ${
                  index === selectedIndex ? 'bg-clawd-accent/10' : 'hover:bg-clawd-bg/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${colorClass}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.title}</span>
                      <span className="text-xs text-clawd-text-dim px-1.5 py-0.5 bg-clawd-border rounded">
                        {result.type}
                      </span>
                    </div>
                    <p className="text-sm text-clawd-text-dim truncate mt-0.5">
                      {result.snippet}
                    </p>
                    {result.timestamp && (
                      <p className="text-xs text-clawd-text-dim mt-1">
                        {result.source} • {result.timestamp}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-clawd-border bg-clawd-bg/50 flex items-center justify-between text-xs text-clawd-text-dim">
          <div className="flex gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span>⌘/ to open search</span>
        </div>
      </div>
    </div>
  );
}
