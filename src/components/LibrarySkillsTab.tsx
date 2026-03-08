import { useState, useEffect } from 'react';
import { Search, BookOpen, RefreshCw, ChevronRight } from 'lucide-react';
import EmptyState from './EmptyState';
import { libraryApi } from '../lib/api';

interface PlatformSkill {
  id: string;
  name: string;
  slug: string;
  path: string;
  description: string;
}

export default function LibrarySkillsTab() {
  const [skills, setSkills] = useState<PlatformSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSkills = async () => {
    setLoading(true);
    try {
      const result = await libraryApi.getSkills();
      setSkills(result?.skills || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const filtered = skills.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Search */}
      <div className="p-6 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-9 pr-4 py-2 bg-mission-control-bg border border-mission-control-border rounded-xl focus:outline-none focus:border-mission-control-accent"
            />
          </div>
          <button
            onClick={loadSkills}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && skills.length === 0 ? (
          <div className="text-center py-12 text-mission-control-text-dim">Loading skills...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No skills found"
            description="Platform skills are loaded from .claude/skills/"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map(skill => (
              <div
                key={skill.id}
                className="p-4 rounded-xl border border-mission-control-border bg-mission-control-surface hover:border-mission-control-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-mission-control-accent/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={14} className="text-mission-control-accent" />
                    </div>
                    <span className="font-medium text-sm">{skill.name}</span>
                  </div>
                  <ChevronRight size={14} className="text-mission-control-text-dim mt-0.5" />
                </div>
                {skill.description && (
                  <p className="text-xs text-mission-control-text-dim leading-relaxed line-clamp-2">
                    {skill.description}
                  </p>
                )}
                <p className="text-xs text-mission-control-text-dim/50 mt-2 font-mono truncate">
                  {skill.path}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
