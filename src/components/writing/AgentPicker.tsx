import { Pen, Search, Heart } from 'lucide-react';

const AGENTS = [
  { id: 'writer', name: 'Writer', Icon: Pen, description: 'Style, pacing, narrative' },
  { id: 'researcher', name: 'Researcher', Icon: Search, description: 'Facts, accuracy' },
  { id: 'jess', name: 'Jess', Icon: Heart, description: 'Emotional guidance' },
] as const;

interface AgentPickerProps {
  selected: string;
  onSelect: (agentId: string) => void;
  disabled?: boolean;
}

export default function AgentPicker({ selected, onSelect, disabled }: AgentPickerProps) {
  return (
    <div className="flex gap-1">
      {AGENTS.map(({ id, name, Icon }) => {
        const isActive = selected === id;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            disabled={disabled}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
              isActive
                ? 'bg-clawd-accent/20 text-clawd-accent'
                : 'text-clawd-text-dim hover:text-clawd-text'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className="w-3 h-3" />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
