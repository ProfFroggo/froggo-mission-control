import { Loader2, Users, Clock, CheckCircle } from 'lucide-react';
import { useMemoryStore } from '../../store/memoryStore';
import CharacterList from './CharacterList';
import TimelineList from './TimelineList';
import FactList from './FactList';

const tabs = [
  { key: 'characters' as const, label: 'Characters', icon: Users },
  { key: 'timeline' as const, label: 'Timeline', icon: Clock },
  { key: 'facts' as const, label: 'Facts', icon: CheckCircle },
];

export default function ContextPanel() {
  const { activeTab, setActiveTab, loading } = useMemoryStore();

  return (
    <div className="w-72 h-full flex flex-col bg-clawd-surface border-l border-clawd-border flex-shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-clawd-border flex-shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-[10px] font-medium transition-colors ${
              activeTab === key
                ? 'bg-clawd-accent/20 text-clawd-accent border-b-2 border-clawd-accent'
                : 'text-clawd-text-dim hover:bg-clawd-border/30 hover:text-clawd-text'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-clawd-text-dim" />
          </div>
        ) : (
          <>
            {activeTab === 'characters' && <CharacterList />}
            {activeTab === 'timeline' && <TimelineList />}
            {activeTab === 'facts' && <FactList />}
          </>
        )}
      </div>
    </div>
  );
}
