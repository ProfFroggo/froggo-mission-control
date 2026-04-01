'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Search,
  Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, Brain, Sparkles, CheckCircle,
  Shield, Route, MessageCircle, AtSign, FileText, Database,
  HardDrive, Table2, File, StickyNote, Variable, Hand,
  ArrowRight, ChevronDown, ChevronRight, Github,
} from 'lucide-react';
import { BLOCK_PALETTE, BLOCK_CATEGORIES, type BlockDefinition } from './store';

const ICON_MAP: Record<string, React.ElementType> = {
  Zap, Bot, Code, Globe, GitBranch, MessageSquare, Mail,
  Webhook, Clock, Send, Circle, Brain, Sparkles, CheckCircle,
  Shield, Route, MessageCircle, AtSign, FileText, Database,
  HardDrive, Table2, File, StickyNote, Variable, Hand,
  ArrowRight, Github,
};

interface BlockPaletteProps {
  onAddBlock: (def: BlockDefinition) => void;
}

export default function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search.trim()) return BLOCK_PALETTE;
    const q = search.toLowerCase();
    return BLOCK_PALETTE.filter(
      (b) => b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map: Record<string, BlockDefinition[]> = {};
    for (const cat of BLOCK_CATEGORIES) map[cat.id] = [];
    for (const b of filtered) {
      if (map[b.category]) map[b.category].push(b);
    }
    return map;
  }, [filtered]);

  const toggleCategory = useCallback((id: string) => {
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-mission-control-border shrink-0">
        <span className="text-xs font-medium text-mission-control-text">Add Block</span>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-mission-control-border shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full text-xs rounded-lg pl-7 pr-3 py-1.5"
            style={{
              background: 'var(--mission-control-bg)',
              border: '1px solid var(--mission-control-border)',
              color: 'var(--mission-control-text)',
            }}
          />
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto p-2">
        {BLOCK_CATEGORIES.map((cat) => {
          const items = grouped[cat.id];
          if (!items || items.length === 0) return null;
          const isCollapsed = collapsed[cat.id];

          return (
            <div key={cat.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left"
              >
                {isCollapsed ? <ChevronRight size={12} className="text-mission-control-text-dim" /> : <ChevronDown size={12} className="text-mission-control-text-dim" />}
                <span className="text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim">{cat.label}</span>
                <span className="text-[10px] text-mission-control-text-dim ml-auto">{items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5">
                  {items.map((def) => {
                    const Icon = ICON_MAP[def.icon] ?? Circle;
                    return (
                      <button
                        key={def.type}
                        type="button"
                        onClick={() => onAddBlock(def)}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors hover:bg-mission-control-bg"
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${def.color}22` }}>
                          <Icon size={14} style={{ color: def.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-mission-control-text truncate">{def.name}</div>
                          <div className="text-[10px] text-mission-control-text-dim truncate">{def.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-mission-control-text-dim text-center py-4">No blocks match &quot;{search}&quot;</p>
        )}
      </div>
    </div>
  );
}
