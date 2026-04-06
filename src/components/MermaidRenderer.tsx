// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useId } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface MermaidRendererProps {
  code: string;
  className?: string;
}

let mermaidInitialized = false;

async function getMermaid() {
  const m = await import('mermaid');
  if (!mermaidInitialized) {
    m.default.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
    mermaidInitialized = true;
  }
  return m.default;
}

export default function MermaidRenderer({ code, className }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const uniqueId = useId().replace(/:/g, '-');

  useEffect(() => {
    if (!code.trim()) {
      setLoading(false);
      setError('Empty diagram');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const mermaid = await getMermaid();
        const id = `mermaid${uniqueId}`;
        const { svg } = await mermaid.render(id, code.trim());
        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to render diagram');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [code, uniqueId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 text-sm gap-2 ${className ?? ''}`} style={{ color: '#64748b' }}>
        <RefreshCw size={14} className="animate-spin" />
        <span>Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 gap-2 text-center ${className ?? ''}`}>
        <AlertTriangle size={20} style={{ color: '#ef4444' }} />
        <p className="text-sm font-medium" style={{ color: '#1e293b' }}>Diagram render failed</p>
        <p className="text-xs max-w-sm" style={{ color: '#64748b' }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center overflow-auto ${className ?? ''}`}
    />
  );
}
