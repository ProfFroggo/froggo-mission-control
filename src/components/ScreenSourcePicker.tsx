/**
 * ScreenSourcePicker - Modal to select a screen or window for sharing
 * Uses Electron's desktopCapturer via preload API
 */

import { useState, useEffect } from 'react';
import { Button, Box, Flex } from '@radix-ui/themes';
import { Monitor, AppWindow, X, RefreshCw, Loader2, AlertTriangle, Lock } from 'lucide-react';

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string; // data URL
  display_id: string;
  appIcon: string | null;
}

interface ScreenSourcePickerProps {
  onSelect: (source: ScreenSource) => void;
  onCancel: () => void;
}

export default function ScreenSourcePicker({ onSelect, onCancel }: ScreenSourcePickerProps) {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'screen' | 'window'>('all');
  const [selected, setSelected] = useState<string | null>(null);

  const fetchSources = async () => {
    setLoading(true);
    setError(null);
    // Web mode: always use browser's getDisplayMedia picker
    setError('no-electron');
    setLoading(false);
  };

  useEffect(() => { fetchSources(); }, []);

  // In web mode (no Electron), immediately delegate to browser's getDisplayMedia picker
  useEffect(() => {
    if (error === 'no-electron') {
      onSelect({ id: '__browser_picker__', name: 'Browser Picker', thumbnail: '', display_id: '', appIcon: null });
    }
  }, [error, onSelect]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  if (error === 'no-electron') return null;

  const screens = sources.filter(s => s.id.startsWith('screen:'));
  const windows = sources.filter(s => s.id.startsWith('window:'));
  const filtered = filter === 'screen' ? screens : filter === 'window' ? windows : sources;

  const handleConfirm = () => {
    const source = sources.find(s => s.id === selected);
    if (source) onSelect(source);
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-default"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div role="dialog" aria-modal="true" aria-label="Screen source picker" className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <h2 className="text-base font-semibold text-mission-control-text">Share Your Screen</h2>
          <Flex align="center" gap="2">
            <button
              onClick={fetchSources}
              title="Refresh"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onCancel} aria-label="Close" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors">
              <X size={16} />
            </button>
          </Flex>
        </div>

        {/* Filter tabs */}
        <Flex gap="1" px="5" pt="3">
          <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
            {(['all', 'screen', 'window'] as const).map(f => (
              <button key={f} type="button" onClick={() => setFilter(f)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filter === f ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                }`}>
                {f === 'screen' && <Monitor size={12} />}
                {f === 'window' && <AppWindow size={12} />}
                {f === 'all' ? 'All' : f === 'screen' ? `Screens (${screens.length})` : `Windows (${windows.length})`}
              </button>
            ))}
          </div>
        </Flex>

        {/* Sources grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <Flex direction="column" align="center" justify="center" py="9" className="text-mission-control-text-dim">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Loading available sources…</p>
            </Flex>
          ) : error === 'no-permission' ? (
            <Flex direction="column" align="center" justify="center" py="9" px="6" className="text-center">
              <div className="mb-4"><Lock size={40} className="mx-auto text-mission-control-text-dim" /></div>
              <h3 className="text-lg font-semibold text-mission-control-text mb-2">Screen Recording Permission Required</h3>
              <p className="text-sm text-mission-control-text-dim mb-4 max-w-md">
                Mission Control needs permission to access your screen. Please grant <strong>Screen Recording</strong> permission in System Settings.
              </p>
              <div className="bg-mission-control-border rounded-lg p-4 text-left text-xs text-mission-control-text-dim space-y-2 mb-4 max-w-md">
                <p><strong>macOS:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Open <strong>System Settings</strong></li>
                  <li>Go to <strong>Privacy & Security</strong> → <strong>Screen Recording</strong></li>
                  <li>Enable <strong>Mission Control</strong></li>
                  <li>Restart Mission Control</li>
                </ol>
              </div>
              <Flex gap="3">
                <button
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                  onClick={() => {
                    // Not available in web mode — user must open System Settings manually
                  }}
                >
                  Open System Settings
                </button>
                <Button variant="solid" size="2" onClick={fetchSources}>
                  Check Again
                </Button>
              </Flex>
            </Flex>
          ) : error ? (
            <Flex direction="column" align="center" justify="center" py="9" className="text-[var(--color-error)]">
              <p className="text-sm flex items-center gap-1"><AlertTriangle size={14} className="inline" /> {error}</p>
              <button
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
                onClick={fetchSources}
              >
                Retry
              </button>
            </Flex>
          ) : filtered.length === 0 ? (
            <Flex direction="column" align="center" justify="center" py="9" className="text-mission-control-text-dim">
              <p className="text-sm">No sources found</p>
            </Flex>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(source => (
                <button type="button" key={source.id} onClick={() => setSelected(source.id)} onDoubleClick={() => onSelect(source)}
                  className={`group flex flex-col rounded-lg border-2 overflow-hidden transition-[colors,transform] hover:scale-[1.02] ${
                    selected === source.id
                      ? 'border-mission-control-accent shadow-lg shadow-mission-control-accent/20 bg-mission-control-accent/5'
                      : 'border-mission-control-border hover:border-mission-control-text-dim bg-mission-control-bg'
                  }`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-mission-control-bg">
                    {source.thumbnail ? (
                      <img src={source.thumbnail} alt={source.name} className="w-full h-full object-contain" draggable={false} />
                    ) : (
                      <Flex align="center" justify="center" className="w-full h-full text-mission-control-text-dim">
                        {source.id.startsWith('screen:') ? <Monitor size={32} /> : <AppWindow size={32} />}
                      </Flex>
                    )}
                    {selected === source.id && (
                      <Flex align="center" justify="center" className="absolute inset-0 bg-mission-control-accent/10">
                        <Flex align="center" justify="center" className="w-6 h-6 rounded-full bg-mission-control-accent">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </Flex>
                      </Flex>
                    )}
                  </div>
                  {/* Label */}
                  <Flex align="center" gap="1" px="2" py="2">
                    {source.appIcon ? (
                      <img src={source.appIcon} alt={`${source.name} icon`} className="w-4 h-4 flex-shrink-0" />
                    ) : source.id.startsWith('screen:') ? (
                      <Monitor size={12} className="text-mission-control-text-dim flex-shrink-0" />
                    ) : (
                      <AppWindow size={12} className="text-mission-control-text-dim flex-shrink-0" />
                    )}
                    <span className="text-xs text-mission-control-text truncate">{source.name}</span>
                  </Flex>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <Button variant="ghost" size="2" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="solid" size="2" onClick={handleConfirm} disabled={!selected}>
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
