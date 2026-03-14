// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { Spinner } from './LoadingStates';

interface Agent {
  id: string;
  name: string;
  role?: string;
  capabilities?: string[];
  status?: string;
}

const CAPABILITY_CATEGORIES = [
  { id: 'research',      label: 'Research',  keywords: ['research', 'search', 'web', 'browse', 'scrape', 'crawl', 'gather'] },
  { id: 'writing',       label: 'Writing',   keywords: ['write', 'content', 'copy', 'draft', 'blog', 'email', 'social', 'post'] },
  { id: 'code',          label: 'Code',      keywords: ['code', 'dev', 'develop', 'engineer', 'script', 'debug', 'program', 'software'] },
  { id: 'analysis',      label: 'Analysis',  keywords: ['analyt', 'data', 'report', 'insight', 'chart', 'metric', 'stat', 'measure'] },
  { id: 'communication', label: 'Comms',     keywords: ['inbox', 'email', 'slack', 'notify', 'message', 'alert', 'chat', 'respond'] },
  { id: 'social',        label: 'Social',    keywords: ['social', 'twitter', 'x.com', 'instagram', 'linkedin', 'post', 'campaign', 'media'] },
] as const;

type CategoryId = typeof CAPABILITY_CATEGORIES[number]['id'];

function scoreAgentForCategory(agent: Agent, category: typeof CAPABILITY_CATEGORIES[number]): number {
  const haystack = [
    agent.role ?? '',
    ...(agent.capabilities ?? []),
  ].join(' ').toLowerCase();

  const matches = category.keywords.filter(kw => haystack.includes(kw)).length;
  if (matches === 0) return 0;
  if (matches === 1) return 1;
  if (matches === 2) return 2;
  return 3;
}

function CapabilityDots({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i <= score
              ? 'bg-mission-control-accent'
              : 'bg-mission-control-border'
          }`}
        />
      ))}
    </div>
  );
}

const EXCLUDED_STATUSES = ['archived', 'disabled', 'draft'];

export default function AgentCapabilityMatrix() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<CategoryId | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/agents');
        if (!res.ok) throw new Error('Failed to load agents');
        const data: Agent[] = await res.json();
        if (!cancelled) {
          setAgents(data.filter(a => !EXCLUDED_STATUSES.includes(a.status ?? '')));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-error text-sm">{error}</div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-4 text-center text-mission-control-text-dim text-sm">No agents found.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-medium text-mission-control-text-dim bg-mission-control-surface border-b border-mission-control-border sticky left-0 z-10 min-w-[140px]">
              Agent
            </th>
            {CAPABILITY_CATEGORIES.map(cat => (
              <th
                key={cat.id}
                className={`py-2 px-3 font-medium text-center border-b border-mission-control-border transition-colors cursor-default ${
                  hoveredCategory === cat.id
                    ? 'text-mission-control-accent bg-mission-control-accent/5'
                    : 'text-mission-control-text-dim bg-mission-control-surface'
                }`}
                onMouseEnter={() => setHoveredCategory(cat.id)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                {cat.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, idx) => (
            <tr
              key={agent.id}
              className={`transition-colors ${
                hoveredAgent === agent.id
                  ? 'bg-mission-control-accent/5'
                  : idx % 2 === 0
                  ? 'bg-transparent'
                  : 'bg-mission-control-surface/40'
              }`}
              onMouseEnter={() => setHoveredAgent(agent.id)}
              onMouseLeave={() => setHoveredAgent(null)}
            >
              <td className="py-2 px-3 sticky left-0 z-10 bg-inherit border-b border-mission-control-border/40">
                <div className="font-medium text-mission-control-text truncate max-w-[130px]" title={agent.name}>
                  {agent.name}
                </div>
                {agent.role && (
                  <div className="text-[10px] text-mission-control-text-dim truncate max-w-[130px]" title={agent.role}>
                    {agent.role}
                  </div>
                )}
              </td>
              {CAPABILITY_CATEGORIES.map(cat => {
                const score = scoreAgentForCategory(agent, cat);
                return (
                  <td
                    key={cat.id}
                    className={`py-2 px-3 text-center border-b border-mission-control-border/40 transition-colors ${
                      hoveredCategory === cat.id ? 'bg-mission-control-accent/5' : ''
                    }`}
                  >
                    <CapabilityDots score={score} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[10px] text-mission-control-text-dim px-1">
        Scores derived from agent role and capability keywords. 3 dots = strong match, 0 = not applicable.
      </p>
    </div>
  );
}
