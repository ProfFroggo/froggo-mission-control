// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect } from 'react';
import { RefreshCw, Circle } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  role?: string;
  capabilities?: string[];
  successRate?: number;
  status?: string;
}

type CapabilityCategory = 'Research' | 'Writing' | 'Code' | 'Analysis' | 'Communication' | 'Social';

const CATEGORIES: CapabilityCategory[] = ['Research', 'Writing', 'Code', 'Analysis', 'Communication', 'Social'];

const CATEGORY_KEYWORDS: Record<CapabilityCategory, string[]> = {
  Research:      ['research', 'search', 'web', 'data', 'fact', 'investigate', 'scrape', 'crawl'],
  Writing:       ['write', 'writing', 'content', 'copy', 'blog', 'email', 'draft', 'creative', 'article', 'document'],
  Code:          ['code', 'coding', 'engineer', 'dev', 'developer', 'script', 'program', 'build', 'debug', 'test'],
  Analysis:      ['analyt', 'analy', 'report', 'insight', 'metrics', 'data', 'dashboard', 'finance', 'budget'],
  Communication: ['comm', 'chat', 'message', 'inbox', 'slack', 'notif', 'reply', 'outreach', 'crm'],
  Social:        ['social', 'twitter', 'x ', 'linkedin', 'instagram', 'post', 'campaign', 'market', 'brand'],
};

function scoreAgentForCategory(agent: Agent, category: CapabilityCategory): number {
  const keywords = CATEGORY_KEYWORDS[category];
  const searchText = [
    agent.role ?? '',
    ...(agent.capabilities ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const matchCount = keywords.filter(kw => searchText.includes(kw)).length;
  let score = Math.min(2, matchCount);
  if (agent.successRate && agent.successRate > 0.8 && matchCount > 0) {
    score = Math.min(3, score + 1);
  }
  return score;
}

function CapabilityDots({ score }: { score: number }) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3].map(level => (
        <Circle
          key={level}
          size={6}
          className={
            level <= score
              ? 'fill-mission-control-accent text-mission-control-accent'
              : 'fill-mission-control-border text-mission-control-border'
          }
        />
      ))}
    </div>
  );
}

export default function AgentCapabilityMatrix() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) throw new Error(`Failed to load agents: ${res.status}`);
      const data = await res.json();
      const list: Agent[] = Array.isArray(data) ? data : (data.agents ?? []);
      const visible = list.filter(a =>
        !['archived', 'disabled', 'draft'].includes(a.status ?? '')
      );
      setAgents(visible);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-mission-control-text-dim">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Loading matrix...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-error text-sm mb-3">{error}</p>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 text-xs border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="py-8 text-center text-mission-control-text-dim text-sm">
        No agents to display
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-3 py-2 text-mission-control-text-dim font-medium border-b border-mission-control-border sticky left-0 bg-mission-control-surface z-10 min-w-[140px]">
              Agent
            </th>
            {CATEGORIES.map(cat => (
              <th
                key={cat}
                className="px-3 py-2 text-mission-control-text-dim font-medium border-b border-mission-control-border text-center whitespace-nowrap"
              >
                {cat}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, rowIdx) => (
            <tr
              key={agent.id}
              className={`transition-colors hover:bg-mission-control-surface ${
                rowIdx % 2 === 0 ? '' : 'bg-mission-control-bg/40'
              }`}
            >
              <td className="px-3 py-2.5 border-b border-mission-control-border sticky left-0 bg-inherit z-10">
                <div className="font-medium text-mission-control-text truncate max-w-[130px]">{agent.name}</div>
                {agent.role && (
                  <div className="text-[10px] text-mission-control-text-dim truncate max-w-[130px]">{agent.role}</div>
                )}
              </td>
              {CATEGORIES.map(cat => {
                const score = scoreAgentForCategory(agent, cat);
                return (
                  <td key={cat} className="px-3 py-2.5 border-b border-mission-control-border text-center">
                    <CapabilityDots score={score} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-4 px-3 pt-3 pb-1 text-[11px] text-mission-control-text-dim">
        <span className="font-medium">Legend:</span>
        {[
          { score: 0, label: 'None' },
          { score: 1, label: 'Basic' },
          { score: 2, label: 'Capable' },
          { score: 3, label: 'Expert' },
        ].map(({ score, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <CapabilityDots score={score} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
