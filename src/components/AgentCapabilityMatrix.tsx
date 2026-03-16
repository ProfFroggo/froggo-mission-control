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

// Keyword patterns that map capabilities/roles to categories
const CATEGORY_KEYWORDS: Record<CapabilityCategory, string[]> = {
  Research:      ['research', 'search', 'web', 'data', 'fact', 'investigate', 'scrape', 'crawl', 'discover', 'insight', 'knowledge', 'learning', 'training'],
  Writing:       ['write', 'writing', 'content', 'copy', 'blog', 'email', 'draft', 'creative', 'article', 'document', 'documentation', 'editing', 'copywriting'],
  Code:          ['code', 'coding', 'engineer', 'dev', 'developer', 'script', 'program', 'build', 'debug', 'test', 'qa', 'quality', 'security', 'audit', 'compliance'],
  Analysis:      ['analyt', 'analy', 'report', 'insight', 'metrics', 'data', 'dashboard', 'finance', 'budget', 'planning', 'strategy', 'review', 'assess'],
  Communication: ['comm', 'chat', 'message', 'inbox', 'slack', 'notif', 'reply', 'outreach', 'crm', 'triage', 'routing', 'delegation', 'coordination', 'task-management'],
  Social:        ['social', 'twitter', 'x ', 'linkedin', 'instagram', 'post', 'campaign', 'market', 'brand', 'growth', 'design', 'ui', 'ux', 'visual'],
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

  // Base score from keyword matches (0-2)
  let score = Math.min(2, matchCount);

  // Boost by success rate if available
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
      // Only show agents that are active/busy/idle (not archived/disabled/draft)
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
    <div className="rounded-2xl border border-mission-control-border bg-mission-control-surface overflow-hidden">
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-mission-control-surface">
            <tr>
              <th className="text-left px-4 py-3 text-mission-control-text-dim font-medium border-b border-mission-control-border sticky left-0 bg-mission-control-surface z-30 min-w-[160px] w-[200px]">
                Agent
              </th>
              {CATEGORIES.map(cat => (
                <th
                  key={cat}
                  className="px-4 py-3 text-mission-control-text-dim font-medium border-b border-mission-control-border text-center whitespace-nowrap min-w-[90px]"
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
                <td className="px-4 py-2.5 border-b border-mission-control-border sticky left-0 bg-inherit z-10">
                  <div className="font-medium text-mission-control-text truncate max-w-[180px]">{agent.name}</div>
                  {agent.role && (
                    <div className="text-[10px] text-mission-control-text-dim truncate max-w-[180px]">{agent.role}</div>
                  )}
                </td>
                {CATEGORIES.map(cat => {
                  const score = scoreAgentForCategory(agent, cat);
                  return (
                    <td key={cat} className="px-4 py-2.5 border-b border-mission-control-border text-center">
                      <CapabilityDots score={score} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 text-[11px] text-mission-control-text-dim border-t border-mission-control-border">
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
