import { useState, useEffect } from 'react';
import { Search, TrendingUp, Clock, CheckCircle, BookOpen, ChevronDown, ChevronRight, User } from 'lucide-react';
import EmptyState from './EmptyState';
import { libraryApi } from '../lib/api';

interface Skill {
  agent_id: string;
  skill_name: string;
  proficiency: number; // 1-10 integer
  success_count: number;
  failure_count: number;
  last_used: string | null;
  notes: string | null;
  agent_name: string | null;
  agent_emoji: string | null;
}

const getProficiencyLabel = (proficiency: number) => {
  if (proficiency >= 8) return 'Expert';
  if (proficiency >= 6) return 'Advanced';
  if (proficiency >= 4) return 'Intermediate';
  if (proficiency >= 2) return 'Beginner';
  return 'Learning';
};

const getProficiencyColor = (proficiency: number) => {
  if (proficiency >= 8) return 'bg-green-500';
  if (proficiency >= 6) return 'bg-blue-500';
  if (proficiency >= 4) return 'bg-yellow-500';
  if (proficiency >= 2) return 'bg-orange-500';
  return 'bg-clawd-bg0';
};

const getProficiencyTextColor = (proficiency: number) => {
  if (proficiency >= 8) return 'text-green-500';
  if (proficiency >= 6) return 'text-blue-500';
  if (proficiency >= 4) return 'text-yellow-500';
  if (proficiency >= 2) return 'text-orange-500';
  return 'text-clawd-text-dim';
};

const formatRelativeDate = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Unknown';
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export default function LibrarySkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedAgents, setCollapsedAgents] = useState<Set<string>>(new Set());

  const loadSkills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/library?action=skills');
      if (res.ok) {
        const result = await res.json();
        setSkills(result?.skills || []);
      }
    } catch (_error) {
      // '[Skills] Load error:', error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const filteredSkills = skills.filter(s =>
    s.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.agent_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by agent_id
  const agentGroups = new Map<string, { skills: Skill[]; agent_name: string | null; agent_emoji: string | null }>();
  for (const skill of filteredSkills) {
    if (!agentGroups.has(skill.agent_id)) {
      agentGroups.set(skill.agent_id, {
        skills: [],
        agent_name: skill.agent_name,
        agent_emoji: skill.agent_emoji,
      });
    }
    agentGroups.get(skill.agent_id)!.skills.push(skill);
  }

  // Sort skills within each group by proficiency desc
  for (const group of agentGroups.values()) {
    group.skills.sort((a, b) => b.proficiency - a.proficiency);
  }

  const toggleAgent = (agentId: string) => {
    setCollapsedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills or agent..."
              className="w-full pl-9 pr-4 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
            />
          </div>
          <button
            onClick={loadSkills}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            <Search size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && skills.length === 0 ? (
          <div className="text-center py-12 text-clawd-text-dim">Loading skills...</div>
        ) : agentGroups.size === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No skills tracked"
            description="Skills are auto-tracked as agents complete tasks"
          />
        ) : (
          <div className="space-y-4">
            {Array.from(agentGroups.entries()).map(([agentId, group]) => {
              const isCollapsed = collapsedAgents.has(agentId);
              const displayName = group.agent_name || agentId;
              const emoji = group.agent_emoji || '';

              return (
                <div key={agentId} className="border border-clawd-border rounded-xl overflow-hidden">
                  {/* Agent header */}
                  <button
                    onClick={() => toggleAgent(agentId)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-clawd-surface hover:bg-clawd-border/30 transition-colors text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight size={16} className="text-clawd-text-dim flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-clawd-text-dim flex-shrink-0" />
                    )}
                    <div className="w-7 h-7 rounded-full bg-clawd-accent/20 flex items-center justify-center flex-shrink-0">
                      {emoji ? (
                        <span className="text-sm">{emoji}</span>
                      ) : (
                        <User size={14} className="text-clawd-accent" />
                      )}
                    </div>
                    <span className="font-semibold capitalize">{displayName}</span>
                    <span className="ml-auto text-sm text-clawd-text-dim">
                      {group.skills.length} skill{group.skills.length !== 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Skills in this agent group */}
                  {!isCollapsed && (
                    <div className="divide-y divide-clawd-border">
                      {group.skills.map((skill) => (
                        <div
                          key={`${agentId}-${skill.skill_name}`}
                          className="p-4 bg-clawd-bg/30 hover:bg-clawd-border/10 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-medium">{skill.skill_name}</h3>
                              {skill.notes && (
                                <p className="text-xs text-clawd-text-dim mt-0.5">{skill.notes}</p>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 text-xs rounded-lg font-medium ${getProficiencyTextColor(skill.proficiency)}`}>
                              {getProficiencyLabel(skill.proficiency)}
                            </span>
                          </div>

                          {/* Proficiency bar */}
                          <div className="mb-2">
                            <div className="h-1.5 bg-clawd-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getProficiencyColor(skill.proficiency)}`}
                                style={{ width: `${(skill.proficiency / 10) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-clawd-text-dim">
                            <div className="flex items-center gap-1">
                              <TrendingUp size={12} />
                              <span>{skill.proficiency}/10</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CheckCircle size={12} />
                              <span>
                                {skill.success_count} success{skill.success_count !== 1 ? 'es' : ''}
                                {skill.failure_count > 0 ? ` / ${skill.failure_count} failure${skill.failure_count !== 1 ? 's' : ''}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>Last: {formatRelativeDate(skill.last_used)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
