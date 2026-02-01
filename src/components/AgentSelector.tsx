import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { getAgentTheme } from '../utils/agentThemes';

export interface ChatAgent {
  id: string;
  name: string;
  role: string;
  sessionKey: string;
  dbSessionKey: string; // for local DB storage
}

export const CHAT_AGENTS: ChatAgent[] = [
  { id: 'froggo',   name: 'Froggo',       role: 'Main Assistant',        sessionKey: 'chat-agent',               dbSessionKey: 'chat:main' },
  { id: 'coder',    name: 'Coder',         role: 'Software Engineer',     sessionKey: 'agent:chat-agent:coder',   dbSessionKey: 'chat:coder' },
  { id: 'researcher', name: 'Researcher',  role: 'Research Analyst',      sessionKey: 'agent:chat-agent:researcher', dbSessionKey: 'chat:researcher' },
  { id: 'writer',   name: 'Writer',        role: 'Content Writer',        sessionKey: 'agent:chat-agent:writer',  dbSessionKey: 'chat:writer' },
  { id: 'chief',    name: 'Chief',         role: 'Project Manager',       sessionKey: 'agent:chat-agent:chief',   dbSessionKey: 'chat:chief' },
  { id: 'hr',       name: 'HR',            role: 'Human Resources',       sessionKey: 'agent:chat-agent:hr',      dbSessionKey: 'chat:hr' },
  { id: 'clara',    name: 'Clara',         role: 'Personal Assistant',    sessionKey: 'agent:chat-agent:clara',   dbSessionKey: 'chat:clara' },
  { id: 'social_media_manager', name: 'Social Media', role: 'Social Media Manager', sessionKey: 'agent:chat-agent:social_media_manager', dbSessionKey: 'chat:social_media_manager' },
];

interface AgentSelectorProps {
  selectedAgent: ChatAgent;
  onSelect: (agent: ChatAgent) => void;
}

export default function AgentSelector({ selectedAgent, onSelect }: AgentSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
            Switch Agent
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {CHAT_AGENTS.map((agent) => {
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
