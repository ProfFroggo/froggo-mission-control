import { useState } from 'react';
import { X, Users, MessageSquarePlus } from 'lucide-react';
import { Button, TextField, Flex } from '@radix-ui/themes';
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
    <Flex align="center" justify="center" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/10 rounded-lg">
              <Users size={20} className="text-mission-control-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Create Chat Room</h2>
              <p className="text-xs text-mission-control-text-dim">Multi-agent discussion space</p>
            </div>
          </Flex>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
          {/* Room Name */}
          <div>
            <label htmlFor="room-name" className="text-xs font-medium text-mission-control-text-dim mb-1 block">Room Name (optional)</label>
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
            <label className="text-xs font-medium text-mission-control-text-dim mb-1 block">
              Invite Agents <span className="opacity-60">({selectedAgents.size} selected)</span>
            </label>
            <div className="space-y-2">
              {agents.map(agent => {
                const theme = getAgentTheme(agent.id);
                const selected = selectedAgents.has(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${
                      selected
                        ? `${theme.border} ${theme.bg} ring-1 ${theme.ring}`
                        : 'border-mission-control-border hover:border-mission-control-accent/30'
                    }`}
                  >
                    <AgentAvatar agentId={agent.id} size="md" ring={selected} />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-sm">{agent.name}</div>
                      <div className="text-xs text-mission-control-text-dim">{agent.description}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      selected ? 'bg-mission-control-accent border-mission-control-accent' : 'border-mission-control-border'
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-mission-control-border flex-shrink-0">
          <span className="text-xs text-mission-control-text-dim">
            You + {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}
          </span>
          <Flex gap="3">
            <Button
              type="button"
              variant="ghost"
              size="2"
              onClick={onClose}
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
          </Flex>
        </div>
      </div>
    </Flex>
  );
}
