import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { getAgentTheme } from '../utils/agentThemes';
import { useStore } from '../store/store';

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

/**
 * Fetch agent list from store (already loaded from CLI via fetchAgents)
 * Maps store Agent[] to ChatAgent interface with generated sessionKeys
 */
export function fetchAgentList(): ChatAgent[] {
  const storeAgents = useStore.getState().agents;
  if (storeAgents.length === 0) {
    return [];
  }

  const agents: ChatAgent[] = storeAgents.map(a => ({
    id: a.id,
    name: a.name,
    role: a.description || a.name,
    sessionKey: `agent:${a.id}:dashboard`,
    dbSessionKey: `chat:${a.id}`,
    color: undefined,
    trustTier: a.trust_tier,
    status: a.status,
  }));

  return agents;
}

/**
 * React hook to load agent list dynamically from store
 */
export function useAgentList() {
  const storeAgents = useStore(s => s.agents);
  const [agents, setAgents] = useState<ChatAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chatAgents = storeAgents.map(a => ({
      id: a.id,
      name: a.name,
      role: a.description || a.name,
      sessionKey: `agent:${a.id}:dashboard`,
      dbSessionKey: `chat:${a.id}`,
      color: undefined,
      trustTier: a.trust_tier,
      status: a.status,
    }));
    setAgents(chatAgents);
    setLoading(storeAgents.length === 0);
  }, [storeAgents]);

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
        className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-mission-control-bg/50 transition-all ${open ? 'bg-mission-control-bg/50' : ''}`}
      >
        <AgentAvatar agentId={selectedAgent.id} size="lg" ring />
        <div className="text-left">
          <div className="font-semibold flex items-center gap-2">
            {selectedAgent.name}
            <ChevronDown size={14} className={`text-mission-control-text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
          <div className="text-xs text-mission-control-text-dim">{selectedAgent.role}</div>
        </div>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 text-xs font-medium text-mission-control-text-dim border-b border-mission-control-border">
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-mission-control-bg/60 transition-colors ${
                    isSelected ? 'bg-mission-control-bg/40' : ''
                  }`}
                >
                  <AgentAvatar agentId={agent.id} size="md" ring={isSelected} />
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-mission-control-text-dim truncate">{agent.role}</div>
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
