/**
 * ScreenSourcePicker - Modal to select a screen or window for sharing
 * Uses Electron's desktopCapturer via preload API
 */

import { useState, useEffect } from 'react';
import { Monitor, AppWindow, X, RefreshCw, Loader2 } from 'lucide-react';

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
    try {
      const api = (window as any).clawdbot?.screenCapture;
      if (!api?.getSources) {
        // Fallback: use getDisplayMedia (browser will show its own picker)
        setError('no-electron');
        setLoading(false);
        return;
      }
      const result = await api.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      });
      setSources(result || []);
    } catch (e: any) {
      setError(e.message || 'Failed to get sources');
    }
    setLoading(false);
  };

  useEffect(() => { fetchSources(); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  // If no Electron API, fall back to browser picker
  if (error === 'no-electron') {
    onSelect({ id: '__browser_picker__', name: 'Browser Picker', thumbnail: '', display_id: '', appIcon: null });
    return null;
  }

  const screens = sources.filter(s => s.id.startsWith('screen:'));
  const windows = sources.filter(s => s.id.startsWith('window:'));
  const filtered = filter === 'screen' ? screens : filter === 'window' ? windows : sources;

  const handleConfirm = () => {
    const source = sources.find(s => s.id === selected);
    if (source) onSelect(source);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel} role="button" tabIndex={-1} aria-label="Cancel screen share">
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl shadow-2xl w-[640px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-clawd-border">
          <h2 className="text-lg font-semibold text-clawd-text">Share Your Screen</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={fetchSources} className="p-2 rounded-lg hover:bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors" title="Refresh">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-clawd-border text-clawd-text-dim hover:text-clawd-text transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {(['all', 'screen', 'window'] as const).map(f => (
            <button type="button" key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filter === f ? 'bg-clawd-accent text-white' : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
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
            <div className="flex flex-col items-center justify-center py-12 text-clawd-text-dim">
              <Loader2 size={32} className="animate-spin mb-3" />
              <p className="text-sm">Loading available sources…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-error">
              <p className="text-sm">⚠️ {error}</p>
              <button type="button" onClick={fetchSources} className="mt-3 px-4 py-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text text-sm">
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-clawd-text-dim">
              <p className="text-sm">No sources found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(source => (
                <button type="button" key={source.id} onClick={() => setSelected(source.id)} onDoubleClick={() => onSelect(source)}
                  className={`group flex flex-col rounded-xl border-2 overflow-hidden transition-all hover:scale-[1.02] ${
                    selected === source.id
                      ? 'border-clawd-accent shadow-lg shadow-clawd-accent/20 bg-clawd-accent/5'
                      : 'border-clawd-border hover:border-clawd-text-dim bg-clawd-bg'
                  }`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-black">
                    {source.thumbnail ? (
                      <img src={source.thumbnail} alt={source.name} className="w-full h-full object-contain" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-clawd-text-dim">
                        {source.id.startsWith('screen:') ? <Monitor size={32} /> : <AppWindow size={32} />}
                      </div>
                    )}
                    {selected === source.id && (
                      <div className="absolute inset-0 bg-clawd-accent/10 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-clawd-accent flex items-center justify-center">
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
                      <Monitor size={12} className="text-clawd-text-dim flex-shrink-0" />
                    ) : (
                      <AppWindow size={12} className="text-clawd-text-dim flex-shrink-0" />
                    )}
                    <span className="text-xs text-clawd-text truncate">{source.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-clawd-border">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-clawd-border text-clawd-text-dim hover:text-clawd-text text-sm transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={!selected}
            className="px-4 py-2 rounded-lg bg-clawd-accent text-white text-sm font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
