/**
 * ScreenSourcePicker - Modal to select a screen or window for sharing
 * Uses Electron's desktopCapturer via preload API
 */

import { useState, useEffect } from 'react';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm cursor-default"
      onClick={onCancel}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div role="dialog" aria-modal="true" aria-label="Screen source picker" className="bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border">
          <h2 className="text-lg font-semibold text-mission-control-text">Share Your Screen</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={fetchSources} className="p-2 rounded-lg hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {(['all', 'screen', 'window'] as const).map(f => (
            <button type="button" key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === f ? 'bg-mission-control-accent text-white' : 'bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}>
              {f === 'screen' && <Monitor size={12} />}
              {f === 'window' && <AppWindow size={12} />}
              {f === 'all' ? 'All' : f === 'screen' ? `Screens (${screens.length})` : `Windows (${windows.length})`}
            </button>
          ))}
        </div>

        {/* Sources grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-mission-control-text-dim">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Loading available sources…</p>
            </div>
          ) : error === 'no-permission' ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
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
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Not available in web mode — user must open System Settings manually
                  }}
                  className="px-4 py-2 rounded-lg bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50"
                >
                  Open System Settings
                </button>
                <button type="button" onClick={fetchSources} className="px-4 py-2 rounded-xl bg-mission-control-accent text-white text-sm font-medium hover:bg-mission-control-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
                  Check Again
                </button>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-error">
              <p className="text-sm flex items-center gap-1"><AlertTriangle size={14} className="inline" /> {error}</p>
              <button type="button" onClick={fetchSources} className="mt-3 px-4 py-2 rounded-lg bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-mission-control-text-dim">
              <p className="text-sm">No sources found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(source => (
                <button type="button" key={source.id} onClick={() => setSelected(source.id)} onDoubleClick={() => onSelect(source)}
                  className={`group flex flex-col rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02] ${
                    selected === source.id
                      ? 'border-mission-control-accent shadow-lg shadow-mission-control-accent/20 bg-mission-control-accent/5'
                      : 'border-mission-control-border hover:border-mission-control-text-dim bg-mission-control-bg'
                  }`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-mission-control-bg">
                    {source.thumbnail ? (
                      <img src={source.thumbnail} alt={source.name} className="w-full h-full object-contain" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-mission-control-text-dim">
                        {source.id.startsWith('screen:') ? <Monitor size={32} /> : <AppWindow size={32} />}
                      </div>
                    )}
                    {selected === source.id && (
                      <div className="absolute inset-0 bg-mission-control-accent/10 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-mission-control-accent flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Label */}
                  <div className="px-2 py-2 flex items-center gap-1.5">
                    {source.appIcon ? (
                      <img src={source.appIcon} alt={`${source.name} icon`} className="w-4 h-4 flex-shrink-0" />
                    ) : source.id.startsWith('screen:') ? (
                      <Monitor size={12} className="text-mission-control-text-dim flex-shrink-0" />
                    ) : (
                      <AppWindow size={12} className="text-mission-control-text-dim flex-shrink-0" />
                    )}
                    <span className="text-xs text-mission-control-text truncate">{source.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-mission-control-border">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-mission-control-border text-mission-control-text-dim hover:text-mission-control-text text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!selected}
            className="px-4 py-2 rounded-xl bg-mission-control-accent text-white text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
