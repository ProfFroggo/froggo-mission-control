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
    <div className="flex items-center gap-0.5 p-1 rounded-lg bg-mission-control-bg border border-mission-control-border">
      {AGENTS.map(({ id, name, Icon }) => {
        const isActive = selected === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? 'bg-mission-control-surface text-mission-control-accent shadow-sm'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface/50'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{name}</span>
          </button>
        );
      })}
    </div>
  );
}
