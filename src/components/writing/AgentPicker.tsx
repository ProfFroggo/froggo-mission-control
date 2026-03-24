import { Pen, Search, Heart } from 'lucide-react';
import { Button } from '@radix-ui/themes';

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
          <Button
            key={id}
            onClick={() => onSelect(id)}
            disabled={disabled}
            size="1"
            variant={isActive ? 'soft' : 'ghost'}
          >
            <Icon className="w-3 h-3" />
            <span>{name}</span>
          </Button>
        );
      })}
    </div>
  );
}
