import { useState, useEffect, useRef } from 'react';
import { X, Award, Bot } from 'lucide-react';
import { Select, Flex, Box } from '@radix-ui/themes';
import { libraryApi } from '../lib/api';
import BaseModal, { BaseModalHeader, BaseModalBody } from './BaseModal';

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
  if (p >= 8) return 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30';
  if (p >= 6) return 'text-[var(--color-info)] bg-[var(--color-info)]/10 border-[var(--color-info)]/30';
  if (p >= 4) return 'text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30';
  return 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/30';
}

function profLabel(p: number): string {
  if (p >= 9) return 'Expert';
  if (p >= 7) return 'Proficient';
  if (p >= 5) return 'Competent';
  if (p >= 3) return 'Learning';
  return 'Beginner';
}

// Map well-known agent IDs to display names; fallback to a Bot icon
const AGENT_DISPLAY: Record<string, string> = {
  'mission-control': 'Mission Control', coder: 'Coder', researcher: 'Researcher',
  writer: 'Writer', chief: 'Chief', hr: 'HR',
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
    <BaseModal
      isOpen={!isClosing}
      onClose={handleClose}
      size="lg"
      ariaLabel="Agent Skills and Proficiency"
      isClosing={isClosing}
    >
      <BaseModalHeader
        title="Skills & Proficiency"
        onClose={handleClose}
        icon={<Award size={18} className="text-mission-control-accent" />}
      />

      {/* Agent filter */}
      <div className="px-6 py-3 border-b border-mission-control-border flex-shrink-0">
        <Select.Root value={selectedAgent} onValueChange={setSelectedAgent} size="1">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">All Agents</Select.Item>
            {agents.map(a => (
              <Select.Item key={a} value={a}>{AGENT_DISPLAY[a] ?? a}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </div>

      <BaseModalBody maxHeight="70vh">
        {loading ? (
          <div className="text-center text-mission-control-text-dim/70 py-8 text-sm">Loading...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12">
            <Award size={32} className="mx-auto text-mission-control-text-dim mb-3 opacity-40" />
            <p className="text-mission-control-text-dim/70 text-sm">No skills tracked yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([agentId, agentSkills]) => (
              <div key={agentId}>
                <Flex align="center" gap="2" className="mb-3">
                  <div className="w-6 h-6 rounded-md bg-mission-control-border/40 flex items-center justify-center flex-shrink-0">
                    <Bot size={12} className="text-mission-control-text-dim" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
                    {AGENT_DISPLAY[agentId] ?? agentId}
                  </span>
                  <span className="text-[10px] text-mission-control-text-dim/70 tabular-nums">
                    Avg {(agentSkills.reduce((sum, s) => sum + s.proficiency, 0) / agentSkills.length).toFixed(1)}/10
                  </span>
                </Flex>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {agentSkills.map(skill => (
                    <div key={`${agentId}-${skill.skill_name}`} className={`rounded-lg border p-2.5 bg-mission-control-surface ${profColor(skill.proficiency)}`}>
                      <Flex align="center" justify="between" className="mb-1.5">
                        <span className="text-sm font-medium">{skill.skill_name}</span>
                        <span className="text-xs font-bold tabular-nums">{skill.proficiency}/10</span>
                      </Flex>
                      {/* Proficiency bar */}
                      <div className="h-1.5 bg-black/20 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full bg-current transition-[width] duration-500"
                          style={{ width: `${skill.proficiency * 10}%` }}
                        />
                      </div>
                      <Flex align="center" justify="between" className="text-[10px] opacity-70 tabular-nums">
                        <span>{profLabel(skill.proficiency)}</span>
                        {(skill.success_count > 0 || skill.failure_count > 0) && (
                          <span className="flex items-center gap-2">
                            <span className="text-[var(--color-success)]">{skill.success_count} ok</span>
                            <span className="text-[var(--color-error)]">{skill.failure_count} fail</span>
                          </span>
                        )}
                      </Flex>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </BaseModalBody>
    </BaseModal>
  );
}
