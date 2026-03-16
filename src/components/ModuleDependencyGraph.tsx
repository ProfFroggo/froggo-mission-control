// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useRef, useCallback, useMemo } from 'react';
import type { CatalogModule } from '../types/catalog';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  status: 'installed' | 'missing' | 'optional';
}

interface EdgeData {
  from: string;
  to: string;
  optional: boolean;
}

interface ModuleDependencyGraphProps {
  modules: CatalogModule[];
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 44;
const H_GAP  = 60;
const V_GAP  = 70;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildGraph(modules: CatalogModule[]): { nodes: NodeData[]; edges: EdgeData[] } {
  const installedSet = new Set(modules.filter(m => m.installed).map(m => m.id));
  const allIds       = new Set(modules.map(m => m.id));

  // Collect all referenced nodes (including missing ones)
  const nodeIds = new Set<string>(modules.filter(m => m.installed).map(m => m.id));
  const edges: EdgeData[] = [];

  for (const mod of modules) {
    if (!mod.installed) continue;
    for (const dep of mod.requiredAgents) {
      nodeIds.add(dep);
      edges.push({ from: mod.id, to: dep, optional: false });
    }
  }

  // Simple layered layout — installed modules form a circle-ish grid
  const nodeArr = Array.from(nodeIds);
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodeArr.length)));

  const nodes: NodeData[] = nodeArr.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const mod = modules.find(m => m.id === id);

    let status: NodeData['status'];
    if (installedSet.has(id)) {
      status = 'installed';
    } else if (allIds.has(id)) {
      status = 'optional';
    } else {
      status = 'missing';
    }

    return {
      id,
      label: mod?.name ?? id,
      x: col * (NODE_W + H_GAP) + 20,
      y: row * (NODE_H + V_GAP) + 20,
      status,
    };
  });

  return { nodes, edges };
}

function nodeColor(status: NodeData['status']): string {
  if (status === 'installed') return 'var(--color-success)';
  if (status === 'missing')   return 'var(--color-error, #f87171)';
  return 'var(--mission-control-text-dim, #6b7280)';
}

function nodeBg(status: NodeData['status']): string {
  if (status === 'installed') return 'var(--color-success-subtle, rgba(34,197,94,0.08))';
  if (status === 'missing')   return 'var(--color-error-subtle, rgba(248,113,113,0.08))';
  return 'var(--mission-control-surface, #1e2023)';
}

function nodeBorder(status: NodeData['status']): string {
  if (status === 'installed') return 'var(--color-success-border, rgba(34,197,94,0.4))';
  if (status === 'missing')   return 'var(--color-error-border, rgba(248,113,113,0.4))';
  return 'var(--mission-control-border, rgba(255,255,255,0.08))';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleDependencyGraph({ modules }: ModuleDependencyGraphProps) {
  const { nodes, edges } = useMemo(() => buildGraph(modules), [modules]);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const svgWidth  = Math.max(600, nodes.reduce((acc, n) => Math.max(acc, n.x + NODE_W + H_GAP), 0));
  const svgHeight = Math.max(300, nodes.reduce((acc, n) => Math.max(acc, n.y + NODE_H + V_GAP), 0));

  const onMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  }, []);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-mission-control-text-dim border border-mission-control-border rounded-lg">
        No installed modules with dependencies to display.
      </div>
    );
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div
      className="rounded-lg border border-mission-control-border overflow-hidden"
      style={{ background: 'var(--mission-control-bg, #0f1012)' }}
    >
      {/* Legend */}
      <div className="flex items-center gap-5 px-4 py-2.5 border-b border-mission-control-border text-xs text-mission-control-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-success-subtle, rgba(34,197,94,0.15))', border: '1px solid var(--color-success-border, rgba(34,197,94,0.4))' }} />
          Installed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-error-subtle, rgba(248,113,113,0.08))', border: '1px solid var(--color-error-border, rgba(248,113,113,0.4))' }} />
          Required — not installed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--mission-control-surface, #1e2023)', border: '1px solid var(--mission-control-border, rgba(255,255,255,0.08))' }} />
          Optional
        </span>
        <span className="ml-auto opacity-60">Drag to pan</span>
      </div>

      <div style={{ overflow: 'hidden', maxHeight: 360, cursor: 'grab' }}>
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`${-pan.x} ${-pan.y} ${svgWidth} ${svgHeight}`}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ display: 'block', userSelect: 'none' }}
        >
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = nodeMap.get(edge.from);
            const to   = nodeMap.get(edge.to);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W / 2;
            const y1 = from.y + NODE_H;
            const x2 = to.x + NODE_W / 2;
            const y2 = to.y;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={i}
                d={`M${x1},${y1} C${x1},${mx} ${x2},${mx} ${x2},${y2}`}
                fill="none"
                stroke={edge.optional ? 'var(--mission-control-border, rgba(255,255,255,0.12))' : 'var(--color-success, #22c55e)'}
                strokeWidth={edge.optional ? 1 : 1.5}
                strokeDasharray={edge.optional ? '4 3' : undefined}
                opacity={0.6}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id} transform={`translate(${node.x},${node.y})`}>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={8}
                ry={8}
                fill={nodeBg(node.status)}
                stroke={nodeBorder(node.status)}
                strokeWidth={1.5}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 5}
                textAnchor="middle"
                fill={nodeColor(node.status)}
                fontSize={11}
                fontWeight={500}
                style={{ fontFamily: 'inherit' }}
              >
                {node.label.length > 16 ? node.label.slice(0, 15) + '\u2026' : node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
