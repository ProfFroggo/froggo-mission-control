import { useState, useEffect, useRef } from 'react';
import { X, Award } from 'lucide-react';
import { IconButton, Select, Flex, Box } from '@radix-ui/themes';
import { libraryApi } from '../lib/api';

interface AgentSkill {
  agent_id: string;
  skill_name: string;
  proficiency: number;
  success_count: number;
  failure_count: number;
  last_trained: number | null;
  last_used: number | null;
}

// Proficiency color coding
function profColor(p: number): string {
  if (p >= 8) return 'text-success bg-success-subtle border-success-border';
  if (p >= 6) return 'text-info bg-info-subtle border-info-border';
  if (p >= 4) return 'text-warning bg-warning-subtle border-warning-border';
  return 'text-error bg-error-subtle border-error-border';
}

function profLabel(p: number): string {
  if (p >= 9) return 'Expert';
  if (p >= 7) return 'Proficient';
  if (p >= 5) return 'Competent';
  if (p >= 3) return 'Learning';
  return 'Beginner';
}

const AGENT_EMOJIS: Record<string, string> = {
  'mission-control': '🐸', coder: '💻', researcher: '🔬', writer: '✍️', chief: '👔', hr: '🎓',
};

export default function AgentSkillsModal({ onClose }: { onClose: () => void }) {
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  useEffect(() => { loadSkills(); }, []);

  const loadSkills = async () => {
    try {
      const res = await libraryApi.getSkills();
      setSkills(Array.isArray(res) ? res as AgentSkill[] : []);
    } catch (e) {
      // 'Failed to load skills:', e;
    } finally {
      setLoading(false);
    }
  };

  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    closeTimeoutRef.current = setTimeout(onClose, 200);
  };

  const agents = [...new Set(skills.map(s => s.agent_id))];
  const filtered = selectedAgent === 'all' ? skills : skills.filter(s => s.agent_id === selectedAgent);

  // Group by agent
  const grouped = filtered.reduce((acc, skill) => {
    if (!acc[skill.agent_id]) acc[skill.agent_id] = [];
    acc[skill.agent_id].push(skill);
    return acc;
  }, {} as Record<string, AgentSkill[]>);

  // Handle backdrop click with keyboard support
  const handleBackdropClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if ('key' in e && e.key !== 'Enter' && e.key !== 'Escape') return;
    handleClose();
  };

  return (
    <Flex align="center" justify="center" p="4" className={`fixed inset-0 z-50 ${isClosing ? 'animate-fadeOut' : 'animate-fadeIn'}`}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleBackdropClick}
        onKeyDown={handleBackdropClick}
        role="button"
        tabIndex={0}
        aria-label="Close agent skills"
      />
      <Flex direction="column" className={`relative w-full max-w-2xl bg-mission-control-bg border border-mission-control-border rounded-xl shadow-2xl max-h-[85vh] ${isClosing ? 'animate-scaleOut' : 'animate-scaleIn'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Award size={20} className="text-mission-control-accent" />
          <h2 className="text-base font-semibold text-mission-control-text flex-1">Agent Skills & Proficiency</h2>
          <Select.Root value={selectedAgent} onValueChange={setSelectedAgent} size="1">
            <Select.Trigger />
            <Select.Content>
              <Select.Item value="all">All Agents</Select.Item>
              {agents.map(a => <Select.Item key={a} value={a}>{a}</Select.Item>)}
            </Select.Content>
          </Select.Root>
          <IconButton onClick={handleClose} variant="ghost" color="gray" size="2">
            <X size={18} />
          </IconButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="text-center text-mission-control-text-dim py-8">Loading...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12">
              <Award size={32} className="mx-auto text-mission-control-text-dim mb-3 opacity-40" />
              <p className="text-mission-control-text-dim text-sm">No skills tracked yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([agentId, agentSkills]) => (
                <div key={agentId}>
                  <Flex align="center" gap="2" className="mb-3">
                    <span className="text-lg">{AGENT_EMOJIS[agentId] || '🤖'}</span>
                    <span className="font-semibold text-mission-control-text capitalize">{agentId}</span>
                    <span className="text-xs text-mission-control-text-dim">
                      · Avg: {(agentSkills.reduce((sum, s) => sum + s.proficiency, 0) / agentSkills.length).toFixed(1)}
                    </span>
                  </Flex>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {agentSkills.map(skill => (
                      <div key={`${agentId}-${skill.skill_name}`} className={`rounded-lg border p-2.5 ${profColor(skill.proficiency)}`}>
                        <Flex align="center" justify="between" className="mb-1.5">
                          <span className="text-sm font-medium">{skill.skill_name}</span>
                          <span className="text-xs font-bold">{skill.proficiency}/10</span>
                        </Flex>
                        {/* Proficiency bar */}
                        <div className="h-1.5 bg-black/20 rounded-full overflow-hidden mb-1">
                          <div
                            className="h-full rounded-full bg-current transition-all duration-500"
                            style={{ width: `${skill.proficiency * 10}%` }}
                          />
                        </div>
                        <Flex align="center" justify="between" className="text-[10px] opacity-70">
                          <span>{profLabel(skill.proficiency)}</span>
                          {(skill.success_count > 0 || skill.failure_count > 0) && (
                            <span>{skill.success_count}✓ {skill.failure_count}✗</span>
                          )}
                        </Flex>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Flex>
    </Flex>
  );
}
