import { useState } from 'react';
import { X, Users, MessageSquarePlus } from 'lucide-react';
import AgentAvatar from './AgentAvatar';
import { getAgentTheme } from '../utils/agentThemes';
import { useStore } from '../store/store';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, agents: string[]) => void;
}

export default function CreateRoomModal({ isOpen, onClose, onCreate }: CreateRoomModalProps) {
  const agents = useStore(s => s.agents);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [roomName, setRoomName] = useState('');

  if (!isOpen) return null;

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const agentName = (id: string) => agents.find(a => a.id === id)?.name || id;
  const defaultName = selectedAgents.size > 0
    ? `Room with ${[...selectedAgents].map(id => agentName(id)).join(', ')}`
    : '';

  const handleCreate = () => {
    if (selectedAgents.size < 1) return;
    const name = roomName.trim() || defaultName;
    onCreate(name, [...selectedAgents]);
    setSelectedAgents(new Set());
    setRoomName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-clawd-surface border border-clawd-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-clawd-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-clawd-accent/10 rounded-xl">
              <Users size={20} className="text-clawd-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Chat Room</h2>
              <p className="text-xs text-clawd-text-dim">Multi-agent discussion space</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-clawd-border transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Room Name */}
          <div>
            <label htmlFor="room-name" className="block text-sm font-medium mb-2">Room Name (optional)</label>
            <input
              id="room-name"
              type="text"
              aria-label="Room name input"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder={defaultName || 'e.g., Architecture Discussion'}
              className="w-full bg-clawd-bg border border-clawd-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-clawd-accent"
            />
          </div>

          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Invite Agents <span className="text-clawd-text-dim">({selectedAgents.size} selected)</span>
            </label>
            <div className="space-y-2">
              {agents.map(agent => {
                const theme = getAgentTheme(agent.id);
                const selected = selectedAgents.has(agent.id);
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      selected
                        ? `${theme.border} ${theme.bg} ring-1 ${theme.ring}`
                        : 'border-clawd-border hover:border-clawd-accent/30 hover:bg-clawd-bg'
                    }`}
                  >
                    <AgentAvatar agentId={agent.id} size="md" ring={selected} />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-clawd-text-dim">{agent.description}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selected ? 'bg-clawd-accent border-clawd-accent' : 'border-clawd-border'
                    }`}>
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-clawd-border flex items-center justify-between">
          <span className="text-xs text-clawd-text-dim">
            You + {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-clawd-border hover:bg-clawd-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={selectedAgents.size < 1}
              className="px-4 py-2 text-sm rounded-xl bg-clawd-accent text-white hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2"
            >
              <MessageSquarePlus size={16} />
              Create Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
