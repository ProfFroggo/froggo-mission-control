import { useState, useEffect } from 'react';
import { Search, BookOpen, RefreshCw, ChevronRight } from 'lucide-react';
import { Flex, TextField } from '@radix-ui/themes';
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
      <div className="px-4 py-3 border-b border-mission-control-border bg-mission-control-surface">
        <Flex gap="3">
          <div className="flex-1">
            <TextField.Root
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills..."
              className="w-full"
            >
              <TextField.Slot>
                <Search size={16} />
              </TextField.Slot>
            </TextField.Root>
          </div>
          <button
            type="button"
            onClick={loadSkills}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </Flex>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto p-4">
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
                className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 hover:border-mission-control-accent/30 transition-colors cursor-pointer"
              >
                <Flex align="start" justify="between" className="mb-2">
                  <Flex align="center" gap="2">
                    <div className="w-7 h-7 rounded-lg bg-mission-control-accent/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={14} className="text-mission-control-accent" />
                    </div>
                    <span className="text-sm font-semibold text-mission-control-text truncate">{skill.name}</span>
                  </Flex>
                  <ChevronRight size={14} className="text-mission-control-text-dim mt-0.5" />
                </Flex>
                {skill.description && (
                  <p className="text-xs text-mission-control-text-dim leading-relaxed line-clamp-2">
                    {skill.description}
                  </p>
                )}
                <p className="text-xs text-mission-control-text-dim/70 mt-2 font-mono truncate">
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
