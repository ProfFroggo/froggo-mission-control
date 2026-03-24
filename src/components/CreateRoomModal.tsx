import { useState } from 'react';
import { X, Users, MessageSquarePlus } from 'lucide-react';
import { Button, IconButton, TextField } from '@radix-ui/themes';
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
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/10 rounded-lg">
              <Users size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Chat Room</h2>
              <p className="text-xs text-mission-control-text-dim">Multi-agent discussion space</p>
            </div>
          </div>
          <IconButton
            onClick={onClose}
            aria-label="Close"
            variant="ghost"
            color="gray"
            size="2"
            radius="medium"
          >
            <X size={18} />
          </IconButton>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Room Name */}
          <div>
            <label htmlFor="room-name" className="block text-sm font-medium mb-2">Room Name (optional)</label>
            <TextField.Root
              id="room-name"
              aria-label="Room name input"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              placeholder={defaultName || 'e.g., Architecture Discussion'}
              size="2"
              className="w-full"
            />
          </div>

          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Invite Agents <span className="text-mission-control-text-dim">({selectedAgents.size} selected)</span>
            </label>
            <div className="space-y-2">
              {agents.map(agent => {
                const theme = getAgentTheme(agent.id);
                const selected = selectedAgents.has(agent.id);
                return (
                  <Button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    variant={selected ? 'soft' : 'ghost'}
                    color="gray"
                    size="3"
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      selected
                        ? `${theme.border} ${theme.bg} ring-1 ${theme.ring}`
                        : 'border-mission-control-border'
                    }`}
                  >
                    <AgentAvatar agentId={agent.id} size="md" ring={selected} />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-mission-control-text-dim">{agent.description}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selected ? 'bg-mission-control-accent border-mission-control-accent' : 'border-mission-control-border'
                    }`}>
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-mission-control-border flex items-center justify-between">
          <span className="text-xs text-mission-control-text-dim">
            You + {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              onClick={onClose}
              variant="ghost"
              color="gray"
              size="2"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedAgents.size < 1}
              variant="solid"
              size="2"
            >
              <MessageSquarePlus size={16} />
              Create Room
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
