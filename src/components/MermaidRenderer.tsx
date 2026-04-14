// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface MermaidRendererProps {
  code: string;
  className?: string;
  label?: string;
}

let lastConfigHash = '';

async function getMermaid() {
  const m = await import('mermaid');
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');
  const theme = isDark ? 'dark' : 'default';
  const hash = `mc-v3-${theme}-strict`;
  if (lastConfigHash !== hash) {
    m.default.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'strict',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
    lastConfigHash = hash;
  }
  return m.default;
}

let renderCounter = 0;

export default function MermaidRenderer({ code, className, label }: MermaidRendererProps) {
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState('');

  useEffect(() => {
    if (!code.trim()) {
      setLoading(false);
      setError('Empty diagram');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSvgHtml(null);
    setDebug('');

    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `mc-mermaid-${++renderCounter}`;
        const result = await mermaid.render(id, code.trim());
        if (cancelled) return;

        const svg = result?.svg;
        if (process.env.NODE_ENV === 'development') {
          setDebug(`type=${typeof svg} len=${svg?.length ?? 0} starts=${JSON.stringify(svg?.slice(0, 80))}`);
        }

        if (!svg || svg.length < 10) {
          setError(`Empty diagram output (got ${svg?.length ?? 0} chars)`);
          return;
        }

        setSvgHtml(svg);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className={`flex items-center justify-center py-12 text-sm gap-2 ${className ?? ''}`} style={{ color: 'var(--mission-control-text-dim)' }}>
        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
        <span>Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" aria-live="assertive" className={`flex flex-col items-center justify-center py-8 gap-2 text-center ${className ?? ''}`}>
        <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} aria-hidden="true" />
        <p className="text-sm font-medium" style={{ color: 'var(--mission-control-text)' }}>Diagram render failed</p>
        <p className="text-xs max-w-sm" style={{ color: 'var(--mission-control-text-dim)' }}>{error}</p>
        {process.env.NODE_ENV === 'development' && debug && <p className="text-[10px] font-mono mt-2 max-w-md break-all" style={{ color: 'var(--mission-control-text-dim)' }}>{debug}</p>}
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div className={`flex items-center justify-center py-8 text-sm ${className ?? ''}`} style={{ color: 'var(--mission-control-text-dim)' }}>
        No diagram to display
      </div>
    );
  }

  return (
    <div className={className}>
      {process.env.NODE_ENV === 'development' && debug && <p className="text-[10px] font-mono px-2 py-1 opacity-50 break-all" style={{ color: 'var(--mission-control-text-dim)' }}>{debug}</p>}
      <div
        role="img"
        aria-label={label || 'Diagram'}
        tabIndex={0}
        dangerouslySetInnerHTML={{ __html: svgHtml }}
        style={{ minHeight: 100 }}
        className="overflow-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      />
    </div>
  );
}
