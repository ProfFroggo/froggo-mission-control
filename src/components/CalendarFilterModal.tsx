import { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Calendar, RefreshCw, CheckSquare, Square } from 'lucide-react';

interface CalendarSource {
  id: string;
  name: string;
  type: 'google' | 'system' | 'social' | 'holidays' | 'mission-control';
  account?: string;
  color: string;
  enabled: boolean;
}

interface CalendarFilterModalProps {
  onClose: () => void;
  onFilterChange: (enabledSources: string[]) => void;
}

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function CalendarFilterModal({ onClose, onFilterChange }: CalendarFilterModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200);
  };

  // Load calendar sources
  const loadSources = async () => {
    setRefreshing(true);
    try {
      const loadedSources: CalendarSource[] = [];

      // Load saved filter preferences
      const savedFilters = localStorage.getItem('calendar-filter-preferences');
      const enabledIds = savedFilters ? JSON.parse(savedFilters) : null;

      // 1. Google Calendar accounts
      const googleAccounts = [
        { email: 'kevin.macarthur@bitso.com', name: 'Bitso (Work)', color: '#3b82f6' },
        { email: 'kevin@carbium.io', name: 'Carbium', color: '#8b5cf6' },
        { email: 'kmacarthur.gpt@gmail.com', name: 'Personal Gmail', color: '#22c55e' },
      ];

      for (const account of googleAccounts) {
        // Try to fetch calendars for this account
        try {
          const result = await (window as any).clawdbot?.calendar?.listCalendars(account.email);
          if (result?.success && result.calendars) {
            // Add each calendar as a separate source
            result.calendars.forEach((cal: any) => {
              const sourceId = `google:${account.email}:${cal.id}`;
              loadedSources.push({
                id: sourceId,
                name: `${account.name} - ${cal.summary}`,
                type: 'google',
                account: account.email,
                color: account.color,
                enabled: enabledIds ? enabledIds.includes(sourceId) : true,
              });
            });
          } else {
            // If can't fetch calendars, just add the account itself
            const sourceId = `google:${account.email}`;
            loadedSources.push({
              id: sourceId,
              name: account.name,
              type: 'google',
              account: account.email,
              color: account.color,
              enabled: enabledIds ? enabledIds.includes(sourceId) : true,
            });
          }
        } catch (e) {
          console.error(`Failed to load calendars for ${account.email}:`, e);
          // Still add the account even if fetch failed
          const sourceId = `google:${account.email}`;
          loadedSources.push({
            id: sourceId,
            name: account.name,
            type: 'google',
            account: account.email,
            color: account.color,
            enabled: enabledIds ? enabledIds.includes(sourceId) : true,
          });
        }
      }

      // 2. Social calendars (X/Twitter scheduled posts)
      loadedSources.push({
        id: 'social:twitter',
        name: 'Twitter/X Scheduled Posts',
        type: 'social',
        color: '#1da1f2',
        enabled: enabledIds ? enabledIds.includes('social:twitter') : true,
      });

      // 3. Mission Control (tasks with due dates)
      loadedSources.push({
        id: 'mission-control:tasks',
        name: 'Mission Control Tasks',
        type: 'mission-control',
        color: '#f59e0b',
        enabled: enabledIds ? enabledIds.includes('mission-control:tasks') : true,
      });

      // 4. Local holidays
      loadedSources.push({
        id: 'holidays:gibraltar',
        name: 'Gibraltar Holidays',
        type: 'holidays',
        color: '#ef4444',
        enabled: enabledIds ? enabledIds.includes('holidays:gibraltar') : true,
      });

      setSources(loadedSources);
    } catch (e) {
      console.error('Failed to load calendar sources:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  // ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const toggleSource = (sourceId: string) => {
    setSources(prev => 
      prev.map(s => s.id === sourceId ? { ...s, enabled: !s.enabled } : s)
    );
  };

  const selectAll = () => {
    setSources(prev => prev.map(s => ({ ...s, enabled: true })));
  };

  const deselectAll = () => {
    setSources(prev => prev.map(s => ({ ...s, enabled: false })));
  };

  const handleSave = () => {
    const enabledIds = sources.filter(s => s.enabled).map(s => s.id);
    localStorage.setItem('calendar-filter-preferences', JSON.stringify(enabledIds));
    onFilterChange(enabledIds);
    onClose();
  };

  // Group sources by type
  const groupedSources = sources.reduce((acc, source) => {
    if (!acc[source.type]) acc[source.type] = [];
    acc[source.type].push(source);
    return acc;
  }, {} as Record<string, CalendarSource[]>);

  const typeLabels: Record<string, string> = {
    google: 'Google Calendars',
    social: 'Social Media',
    'mission-control': 'Mission Control',
    holidays: 'Holidays',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    google: <Calendar size={16} />,
    social: <XIcon size={16} />,
    'mission-control': <CheckSquare size={16} />,
    holidays: <Calendar size={16} />,
  };

  return (
    <div className="fixed inset-0 modal-backdrop backdrop-blur-md modal-backdrop-enter flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="glass-modal rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-clawd-border flex items-center justify-between bg-clawd-surface sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Calendar size={20} className="text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Calendar Sources</h3>
              <p className="text-sm text-clawd-text-dim">
                {sources.filter(s => s.enabled).length} of {sources.length} enabled
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSources}
              disabled={refreshing}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
              title="Refresh sources"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-b border-clawd-border bg-clawd-bg/50 flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-sm px-3 py-1.5 bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="text-sm px-3 py-1.5 bg-clawd-border hover:bg-clawd-border/80 rounded-lg transition-colors"
          >
            Deselect All
          </button>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-clawd-text-dim">
              <RefreshCw size={32} className="mx-auto mb-4 animate-spin" />
              <p>Loading calendar sources...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSources).map(([type, typeSources]) => (
                <div key={type}>
                  <h4 className="text-sm font-medium text-clawd-text-dim mb-3 flex items-center gap-2">
                    {typeIcons[type]}
                    {typeLabels[type]}
                  </h4>
                  <div className="space-y-2">
                    {typeSources.map((source) => (
                      <button
                        key={source.id}
                        onClick={() => toggleSource(source.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          source.enabled
                            ? 'border-clawd-border bg-clawd-bg/50 hover:bg-clawd-bg'
                            : 'border-clawd-border/50 opacity-50 hover:opacity-75'
                        }`}
                      >
                        {/* Toggle Indicator */}
                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          source.enabled
                            ? 'bg-clawd-accent border-clawd-accent'
                            : 'border-clawd-border'
                        }`}>
                          {source.enabled && <Eye size={14} className="text-white" />}
                        </div>

                        {/* Color Indicator */}
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: source.color }}
                        />

                        {/* Source Name */}
                        <div className="flex-1 text-left">
                          <div className="font-medium">{source.name}</div>
                          {source.account && (
                            <div className="text-xs text-clawd-text-dim">{source.account}</div>
                          )}
                        </div>

                        {/* Status Icon */}
                        {source.enabled ? (
                          <Eye size={16} className="text-clawd-accent flex-shrink-0" />
                        ) : (
                          <EyeOff size={16} className="text-clawd-text-dim flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-clawd-border flex justify-end gap-2 bg-clawd-surface">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-clawd-border rounded-lg hover:bg-clawd-border/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Calendar size={16} />
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
