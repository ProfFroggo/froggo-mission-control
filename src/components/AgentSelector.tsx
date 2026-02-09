import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { getAgentTheme } from '../utils/agentThemes';

export interface ChatAgent {
  id: string;
  name: string;
  role: string;
  sessionKey: string; // Persistent session spawned by dashboard
  dbSessionKey: string; // for local DB storage
  color?: string;
  trustTier?: string;
  status?: string;
}

// Fallback agents for when DB query fails
const FALLBACK_AGENTS: ChatAgent[] = [
  { id: 'froggo',          name: 'Froggo',          role: 'Main Assistant',          sessionKey: 'agent:froggo:dashboard',          dbSessionKey: 'chat:main' },
  { id: 'coder',           name: 'Coder',           role: 'Software Engineer',       sessionKey: 'agent:coder:dashboard',           dbSessionKey: 'chat:coder' },
  { id: 'researcher',      name: 'Researcher',      role: 'Research Analyst',        sessionKey: 'agent:researcher:dashboard',      dbSessionKey: 'chat:researcher' },
  { id: 'writer',          name: 'Writer',           role: 'Content Writer',          sessionKey: 'agent:writer:dashboard',          dbSessionKey: 'chat:writer' },
  { id: 'chief',           name: 'Chief',            role: 'Project Manager',         sessionKey: 'agent:chief:dashboard',           dbSessionKey: 'chat:chief' },
  { id: 'hr',              name: 'HR',               role: 'Agent Management',        sessionKey: 'agent:hr:dashboard',              dbSessionKey: 'chat:hr' },
  { id: 'clara',           name: 'Clara',            role: 'Quality Auditor',         sessionKey: 'agent:clara:dashboard',           dbSessionKey: 'chat:clara' },
  { id: 'designer',        name: 'Designer',         role: 'UI/Graphic Designer',     sessionKey: 'agent:designer:dashboard',        dbSessionKey: 'chat:designer' },
  { id: 'jess',            name: 'Jess',             role: 'Psychology & Therapy',    sessionKey: 'agent:jess:dashboard',            dbSessionKey: 'chat:jess' },
  { id: 'growth-director', name: 'Growth Director',  role: 'Growth & Marketing',      sessionKey: 'agent:growth-director:dashboard', dbSessionKey: 'chat:growth-director' },
  { id: 'social-manager',  name: 'Social Manager',   role: 'Social Media Manager',    sessionKey: 'agent:social-manager:dashboard',  dbSessionKey: 'chat:social-manager' },
  { id: 'voice',           name: 'Voice',            role: 'Voice & Call Handler',     sessionKey: 'agent:voice:dashboard',           dbSessionKey: 'chat:voice' },
  { id: 'degen-frog',      name: 'Degen Frog',       role: 'Crypto Trading',          sessionKey: 'agent:degen-frog:dashboard',      dbSessionKey: 'chat:degen-frog' },
];

// Legacy export for backward compatibility
export const CHAT_AGENTS = FALLBACK_AGENTS;

/**
 * Fetch agent list from agent_registry via IPC
 * Maps DB rows to ChatAgent interface with generated sessionKeys
 */
export async function fetchAgentList(): Promise<ChatAgent[]> {
  try {
    if (!window.clawdbot?.getAgentRegistry) {
      console.warn('[AgentSelector] IPC not available, using fallback agents');
      return FALLBACK_AGENTS;
    }

    const dbAgents = await window.clawdbot.getAgentRegistry();

    if (!dbAgents || dbAgents.length === 0) {
      console.warn('[AgentSelector] No agents in DB, using fallback');
      return FALLBACK_AGENTS;
    }

    const agents: ChatAgent[] = dbAgents.map((agent: any) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role || agent.description || 'Assistant',
      sessionKey: `agent:${agent.id}:dashboard`,
      dbSessionKey: `chat:${agent.id}`,
      color: agent.color,
      trustTier: agent.trust_tier,
      status: agent.status,
    }));

    console.log(`[AgentSelector] Loaded ${agents.length} agents from DB`);
    return agents;
  } catch (err) {
    console.error('[AgentSelector] Failed to load agents:', err);
    return FALLBACK_AGENTS;
  }
}

/**
 * React hook to load agent list dynamically
 */
export function useAgentList() {
  const [agents, setAgents] = useState<ChatAgent[]>(FALLBACK_AGENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchAgentList().then((fetchedAgents) => {
      if (mounted) {
        setAgents(fetchedAgents);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return { agents, loading };
}

interface AgentSelectorProps {
  selectedAgent: ChatAgent;
  onSelect: (agent: ChatAgent) => void;
}

export default function AgentSelector({ selectedAgent, onSelect }: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { agents, loading } = useAgentList();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-clawd-bg/50 transition-all ${open ? 'bg-clawd-bg/50' : ''}`}
      >
        <AgentAvatar agentId={selectedAgent.id} size="lg" ring />
        <div className="text-left">
          <div className="font-semibold flex items-center gap-2">
            {selectedAgent.name}
            <ChevronDown size={14} className={`text-clawd-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
          <div className="text-xs text-clawd-text-dim">{selectedAgent.role}</div>
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-clawd-surface border border-clawd-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 text-xs font-medium text-clawd-text-dim border-b border-clawd-border">
            Switch Agent {loading && '(loading...)'}
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {agents.map((agent) => {
              const isSelected = agent.id === selectedAgent.id;
              const agentTheme = getAgentTheme(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => { onSelect(agent); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-clawd-bg/60 transition-colors ${
                    isSelected ? 'bg-clawd-bg/40' : ''
                  }`}
                >
                  <AgentAvatar agentId={agent.id} size="md" ring={isSelected} />
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-clawd-text-dim truncate">{agent.role}</div>
                  </div>
                  {isSelected && (
                    <div className={`w-2 h-2 rounded-full ${agentTheme.dot}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
