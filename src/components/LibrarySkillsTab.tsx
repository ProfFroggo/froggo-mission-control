import { useState, useEffect } from 'react';
import { Plus, Search, TrendingUp, Clock, CheckCircle, BookOpen } from 'lucide-react';
import EmptyState from './EmptyState';

interface Skill {
  id: string;
  name: string;
  description: string;
  proficiency: number; // 0-1
  lastUsed?: number;
  usageCount: number;
  category?: string;
}

export default function LibrarySkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSkills = async () => {
    setLoading(true);
    try {
      // Load from froggo-db skill_evolution table
      const result = await (window as any).clawdbot?.skills?.list();
      if (result?.success) {
        setSkills(result.skills || []);
      }
    } catch (error) {
      console.error('[Skills] Load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const filteredSkills = skills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedSkills = [...filteredSkills].sort((a, b) => {
    // Sort by proficiency desc, then usage count
    if (b.proficiency !== a.proficiency) return b.proficiency - a.proficiency;
    return b.usageCount - a.usageCount;
  });

  const getProficiencyLabel = (proficiency: number) => {
    if (proficiency >= 0.8) return 'Expert';
    if (proficiency >= 0.6) return 'Advanced';
    if (proficiency >= 0.4) return 'Intermediate';
    if (proficiency >= 0.2) return 'Beginner';
    return 'Learning';
  };

  const getProficiencyColor = (proficiency: number) => {
    if (proficiency >= 0.8) return 'bg-green-500';
    if (proficiency >= 0.6) return 'bg-blue-500';
    if (proficiency >= 0.4) return 'bg-yellow-500';
    if (proficiency >= 0.2) return 'bg-orange-500';
    return 'bg-clawd-bg0';
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
              placeholder="Search skills..."
              className="w-full pl-9 pr-4 py-2 bg-clawd-bg border border-clawd-border rounded-xl focus:outline-none focus:border-clawd-accent"
            />
          </div>
          <button
            onClick={loadSkills}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent/90"
          >
            <Plus size={16} />
            Add Skill
          </button>
        </div>
      </div>

      {/* Skills List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && skills.length === 0 ? (
          <div className="text-center py-12 text-clawd-text-dim">Loading skills...</div>
        ) : sortedSkills.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No skills tracked"
            description="Start tracking your skills and proficiency levels"
          />
        ) : (
          <div className="grid gap-4">
            {sortedSkills.map((skill) => (
              <div
                key={skill.id}
                className="p-4 bg-clawd-surface border border-clawd-border rounded-xl hover:border-clawd-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{skill.name}</h3>
                    {skill.description && (
                      <p className="text-sm text-clawd-text-dim">{skill.description}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-lg text-white ${getProficiencyColor(skill.proficiency)}`}>
                    {getProficiencyLabel(skill.proficiency)}
                  </span>
                </div>

                {/* Proficiency bar */}
                <div className="mb-3">
                  <div className="h-2 bg-clawd-border rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getProficiencyColor(skill.proficiency)}`}
                      style={{ width: `${skill.proficiency * 100}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-clawd-text-dim">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} />
                    <span>{Math.round(skill.proficiency * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle size={14} />
                    <span>Used {skill.usageCount}x</span>
                  </div>
                  {skill.lastUsed && (
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>
                        Last: {new Date(skill.lastUsed).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
