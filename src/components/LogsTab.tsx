import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Download, Pause, Play, ArrowDown } from 'lucide-react';
import { gateway } from '../lib/gateway';

export default function LogsTab() {
  const [lines, setLines] = useState<string[]>([]);
  const [cursor, setCursor] = useState<number>(0);
  const [fileInfo, setFileInfo] = useState<{ file: string; size: number } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [polling, setPolling] = useState(true);
  const [loading, setLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  const loadLogs = useCallback(async (append = false) => {
    try {
      const result = await gateway.tailLogs(append && cursor ? { cursor, limit: 100 } : { limit: 200 });
      if (result?.lines) {
        if (append && cursor) {
          setLines(prev => [...prev, ...result.lines].slice(-2000));
        } else {
          setLines(result.lines);
        }
        setCursor(result.cursor);
        setFileInfo({ file: result.file, size: result.size });
      }
    } catch (e) {
      console.error('Failed to load logs:', e);
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => loadLogs(true), 3000);
    return () => clearInterval(interval);
  }, [polling, cursor]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleDownload = () => {
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clawdbot-logs-${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setPolling(!polling)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            polling ? 'bg-success-subtle text-success' : 'bg-clawd-border text-clawd-text-dim'
          }`}>
          {polling ? <Pause size={14} /> : <Play size={14} />}
          {polling ? 'Live' : 'Paused'}
        </button>
        <button type="button" onClick={() => setAutoScroll(!autoScroll)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            autoScroll ? 'bg-clawd-accent/20 text-clawd-accent' : 'bg-clawd-border text-clawd-text-dim'
          }`}>
          <ArrowDown size={14} /> Auto-scroll
        </button>
        <button type="button" onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:bg-clawd-border/80">
          <Download size={14} /> Download
        </button>
        <button type="button" onClick={() => setLines([])}
          className="flex items-center gap-2 px-3 py-2 bg-clawd-border text-clawd-text-dim rounded-lg text-sm hover:bg-clawd-border/80">
          Clear
        </button>
        <div className="flex-1" />
        {fileInfo && (
          <span className="text-xs text-clawd-text-dim">
            {fileInfo.file.split('/').pop()} • {formatSize(fileInfo.size)} • {lines.length} lines
          </span>
        )}
      </div>

      {/* Log Viewer */}
      <div
        ref={logRef}
        className="h-[500px] overflow-y-auto bg-clawd-bg border border-clawd-border rounded-xl p-3 font-mono text-xs"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim">
            <RefreshCw size={20} className="animate-spin mr-2" /> Loading logs...
          </div>
        ) : lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-clawd-text-dim">No log output</div>
        ) : lines.map((line, i) => {
          const isError = /\berror\b/i.test(line);
          const isWarn = /\bwarn/i.test(line);
          const isDebug = /\bdebug\b/i.test(line);
          return (
            <div key={i} className={`py-0.5 leading-relaxed whitespace-pre-wrap break-all ${
              isError ? 'text-error' : isWarn ? 'text-warning' : isDebug ? 'text-info/60' : 'text-clawd-text-dim'
            }`}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}
