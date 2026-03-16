import { useState } from 'react';
import { Search, Target, Hash } from 'lucide-react';
import XResearchView from './XResearchView';
import XCompetitorTracker from './XCompetitorTracker';
import XHashtagIntelligence from './XHashtagIntelligence';

type IntelSubTab = 'search' | 'competitors' | 'hashtags';

const SUB_TABS: Array<{ id: IntelSubTab; label: string; icon: React.ReactNode }> = [
  { id: 'search', label: 'Search', icon: <Search size={14} /> },
  { id: 'competitors', label: 'Competitors', icon: <Target size={14} /> },
  { id: 'hashtags', label: 'Hashtags', icon: <Hash size={14} /> },
];

export default function XIntelligenceView() {
  const [activeSubTab, setActiveSubTab] = useState<IntelSubTab>('search');

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeSubTab === tab.id
                ? 'bg-info-subtle text-info font-medium'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'search' && <XResearchView />}
        {activeSubTab === 'competitors' && <XCompetitorTracker />}
        {activeSubTab === 'hashtags' && <XHashtagIntelligence />}
      </div>
    </div>
  );
}
