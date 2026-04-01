// LEGACY: CalendarFilterModal uses file-level suppression for intentional stable ref patterns.
// Simple modal for calendar filters - patterns are safe.
// Review: 2026-02-17 - suppression retained, patterns are safe

import { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Calendar, RefreshCw, CheckSquare } from 'lucide-react';
import { Button, Flex } from '@radix-ui/themes';
import { useUserSettings } from '../store/userSettings';

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
  const [_isClosing, setIsClosing] = useState(false);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(() => {
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
      let enabledIds: string[] | null = null;
      if (savedFilters) {
        try {
          enabledIds = JSON.parse(savedFilters);
        } catch (e) {

          enabledIds = null;
        }
      }

      // 1. Google Calendar accounts (from user settings)
      const userAccounts = useUserSettings.getState().emailAccounts;
      const defaultColors = ['var(--color-info)', 'var(--color-review)', 'var(--color-success)', 'var(--color-error)', 'var(--color-warning)'];
      const googleAccounts = userAccounts.map((a, i) => ({
        email: a.email,
        name: a.label,
        color: defaultColors[i % defaultColors.length],
      }));

      for (const account of googleAccounts) {
        // Try to fetch calendars for this account
        try {
          const result = await fetch(`/api/calendar/calendars?account=${encodeURIComponent(account.email)}`).then(r => r.ok ? r.json() : null).catch(() => null);
          if (result?.calendars) {
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
          // `Failed to load calendars for ${account.email}:`, e;
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
        color: 'var(--channel-telegram)',
        enabled: enabledIds ? enabledIds.includes('social:twitter') : true,
      });

      // 3. Mission Control (tasks with due dates)
      loadedSources.push({
        id: 'mission-control:tasks',
        name: 'Mission Control Tasks',
        type: 'mission-control',
        color: 'var(--color-warning)',
        enabled: enabledIds ? enabledIds.includes('mission-control:tasks') : true,
      });

      // 4. Local holidays
      loadedSources.push({
        id: 'holidays:gibraltar',
        name: 'Gibraltar Holidays',
        type: 'holidays',
        color: 'var(--color-error)',
        enabled: enabledIds ? enabledIds.includes('holidays:gibraltar') : true,
      });

      setSources(loadedSources);
    } catch (e) {
      // 'Failed to load calendar sources:', e;
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

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    onClose();
  };

  // Handle inner click with keyboard support
  const handleInnerClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if ('key' in e && e.key !== 'Enter') return;
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 modal-backdrop-enter" 
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropClick}
      role="button"
      tabIndex={0}
      aria-label="Close calendar filter"
    >
      <div
        className="bg-mission-control-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col modal-content-enter border border-mission-control-border"
        onClick={handleInnerClick}
        onKeyDown={handleInnerClick}
        role="presentation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-info/10 rounded-lg">
              <Calendar size={20} className="text-info" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Calendar Sources</h3>
              <p className="text-xs text-mission-control-text-dim">
                {sources.filter(s => s.enabled).length} of {sources.length} enabled
              </p>
            </div>
          </div>
          <Flex align="center" gap="2">
            <button
              type="button"
              onClick={loadSources}
              disabled={refreshing}
              title="Refresh sources"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <X size={16} />
            </button>
          </Flex>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-3 border-b border-mission-control-border flex items-center gap-2">
          <Button variant="ghost" size="2" onClick={selectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="2" onClick={deselectAll}>
            Deselect All
          </Button>
        </div>

        {/* Sources List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center py-8 text-mission-control-text-dim">
              <RefreshCw size={32} className="mx-auto mb-4 animate-spin" />
              <p>Loading calendar sources...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSources).map(([type, typeSources]) => (
                <div key={type}>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2 flex items-center gap-2">
                    {typeIcons[type]}
                    {typeLabels[type]}
                  </h4>
                  <div className="space-y-2">
                    {typeSources.map((source) => (
                      <button
                        type="button"
                        key={source.id}
                        onClick={() => toggleSource(source.id)}
                        className="inline-flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                        style={{ opacity: source.enabled ? 1 : 0.5 }}
                      >
                        {/* Toggle Indicator */}
                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          source.enabled
                            ? 'bg-mission-control-accent border-mission-control-accent'
                            : 'border-mission-control-border'
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
                            <div className="text-xs text-mission-control-text-dim">{source.account}</div>
                          )}
                        </div>

                        {/* Status Icon */}
                        {source.enabled ? (
                          <Eye size={16} className="text-mission-control-accent flex-shrink-0" />
                        ) : (
                          <EyeOff size={16} className="text-mission-control-text-dim flex-shrink-0" />
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
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button variant="ghost" size="2" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            size="2"
            variant="solid"
          >
            <Calendar size={16} />
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}
