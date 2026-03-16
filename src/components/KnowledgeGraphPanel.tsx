// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Network } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface Node {
  id: string;
  title: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  source: string;
  target: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  brand: '#f59e0b',
  guidelines: '#3b82f6',
  tone: '#8b5cf6',
  reference: '#10b981',
  onboarding: '#06b6d4',
  technical: '#ef4444',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#6b7280';
}

function parseWikilinks(content: string): string[] {
  const matches = [...content.matchAll(/\[\[([^\]]+)\]\]/g)];
  return matches.map(m => m[1].toLowerCase());
}

interface Props {
  articles: Article[];
  onNavigate: (article: Article) => void;
  onClose: () => void;
}

export default function KnowledgeGraphPanel({ articles, onNavigate, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const animRef = useRef<number>(0);
  const nodesRef = useRef<Node[]>([]);
  const [, forceRender] = useState(0);

  // Keep container size in sync
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ w: width, h: height });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build graph
  useEffect(() => {
    const w = containerRef.current?.clientWidth ?? svgRef.current?.parentElement?.clientWidth ?? 600;
    const h = containerRef.current?.clientHeight ?? svgRef.current?.parentElement?.clientHeight ?? 400;
    setSize({ w, h });

    const initialNodes: Node[] = articles.map((a, i) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      x: w / 2 + (Math.cos((i / articles.length) * 2 * Math.PI) * w * 0.3),
      y: h / 2 + (Math.sin((i / articles.length) * 2 * Math.PI) * h * 0.3),
      vx: 0,
      vy: 0,
    }));

    const titleToId: Record<string, string> = {};
    for (const a of articles) titleToId[a.title.toLowerCase()] = a.id;

    const edgeSet = new Set<string>();
    const newEdges: Edge[] = [];
    for (const a of articles) {
      const links = parseWikilinks(a.content);
      for (const link of links) {
        const targetId = titleToId[link];
        if (targetId && targetId !== a.id) {
          const key = [a.id, targetId].sort().join('|');
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            newEdges.push({ source: a.id, target: targetId });
          }
        }
      }
    }

    setEdges(newEdges);
    setNodes(initialNodes);
    nodesRef.current = initialNodes;
  }, [articles]);

  // Force simulation
  const tick = useCallback(() => {
    const ns = nodesRef.current;
    if (ns.length === 0) return;

    const REPEL = 4000;
    const ATTRACT = 0.03;
    const DAMPING = 0.85;
    const MIN_DIST = 120;

    const next = ns.map(n => ({ ...n }));

    // Repulsion
    for (let i = 0; i < next.length; i++) {
      for (let j = i + 1; j < next.length; j++) {
        const dx = next[i].x - next[j].x;
        const dy = next[i].y - next[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < MIN_DIST) {
          const force = REPEL / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          next[i].vx += fx;
          next[i].vy += fy;
          next[j].vx -= fx;
          next[j].vy -= fy;
        }
      }
    }

    // Attraction along edges
    const nodeIdx: Record<string, number> = {};
    for (let i = 0; i < next.length; i++) nodeIdx[next[i].id] = i;
    for (const edge of edges) {
      const si = nodeIdx[edge.source];
      const ti = nodeIdx[edge.target];
      if (si === undefined || ti === undefined) continue;
      const dx = next[ti].x - next[si].x;
      const dy = next[ti].y - next[si].y;
      next[si].vx += dx * ATTRACT;
      next[si].vy += dy * ATTRACT;
      next[ti].vx -= dx * ATTRACT;
      next[ti].vy -= dy * ATTRACT;
    }

    // Center gravity
    const cx = size.w / 2;
    const cy = size.h / 2;
    for (const n of next) {
      n.vx += (cx - n.x) * 0.004;
      n.vy += (cy - n.y) * 0.004;
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.x += n.vx;
      n.y += n.vy;
      // Clamp to bounds
      n.x = Math.max(60, Math.min(size.w - 60, n.x));
      n.y = Math.max(40, Math.min(size.h - 40, n.y));
    }

    nodesRef.current = next;
    forceRender(c => c + 1);
    animRef.current = requestAnimationFrame(tick);
  }, [edges, size]);

  useEffect(() => {
    if (nodes.length === 0) return;
    nodesRef.current = nodes;
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes, tick]);

  const displayNodes = nodesRef.current;
  const nodeMap: Record<string, Node> = {};
  for (const n of displayNodes) nodeMap[n.id] = n;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl mx-4 rounded-lg bg-mission-control-surface border border-mission-control-border shadow-2xl flex flex-col"
        style={{ height: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-mission-control-border shrink-0">
          <Network size={16} className="text-mission-control-text-dim" />
          <span className="font-semibold text-mission-control-text flex-1 text-sm">Knowledge Graph</span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mr-4">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <span key={cat} className="flex items-center gap-1 text-xs text-mission-control-text-dim">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                {cat}
              </span>
            ))}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-mission-control-border text-mission-control-text-dim" aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Graph */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden min-h-0">
          {articles.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[300px]">
              <div className="text-center">
                <Network size={32} className="mx-auto mb-2 text-mission-control-text-dim" />
                <p className="text-sm font-medium text-mission-control-text mb-1">No articles to display</p>
                <p className="text-xs text-mission-control-text-dim">Add articles to see the knowledge graph</p>
              </div>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full h-full" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="xMidYMid meet" style={{ cursor: 'default' }}>
              {/* Edges */}
              {edges.map((e, i) => {
                const s = nodeMap[e.source];
                const t = nodeMap[e.target];
                if (!s || !t) return null;
                return (
                  <line
                    key={i}
                    x1={s.x} y1={s.y}
                    x2={t.x} y2={t.y}
                    stroke="var(--color-border, #333)"
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                  />
                );
              })}
              {/* Nodes */}
              {displayNodes.map(n => {
                const color = getCategoryColor(n.category);
                const label = n.title.length > 16 ? n.title.slice(0, 14) + '…' : n.title;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x},${n.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      const article = articles.find(a => a.id === n.id);
                      if (article) { onNavigate(article); onClose(); }
                    }}
                  >
                    <circle r={20} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={1.5} />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fill={color}
                      fontWeight="500"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="px-4 py-2 border-t border-mission-control-border shrink-0">
          <p className="text-xs text-mission-control-text-dim">
            {articles.length} articles · {edges.length} connections via {`[[wikilinks]]`} · click a node to open
          </p>
        </div>
      </div>
    </div>
  );
}
