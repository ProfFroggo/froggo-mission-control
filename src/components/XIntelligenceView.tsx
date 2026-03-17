import { useState } from 'react';
import { Search, Target, Zap } from 'lucide-react';
import XResearchView from './XResearchView';
import XCompetitorTracker from './XCompetitorTracker';

type IntelSubTab = 'search' | 'competitors';

const SUB_TABS: Array<{ id: IntelSubTab; label: string; icon: React.ReactNode }> = [
  { id: 'search', label: 'Search', icon: <Search size={14} /> },
  { id: 'competitors', label: 'Competitors', icon: <Target size={14} /> },
];

function dispatchToAgent(message: string) {
  window.dispatchEvent(new CustomEvent('x-agent-chat-inject', { detail: { message } }));
}

const AI_ACTIONS: Record<IntelSubTab, Array<{ label: string; prompt: string }>> = {
  search: [
    { label: 'Trending topics', prompt: 'Search X for trending topics in my niche right now. Show the top 5 with engagement metrics.' },
    { label: 'Content gaps', prompt: 'Analyze recent tweets in my space and identify content gaps I could fill. What topics are underserved?' },
  ],
  competitors: [
    { label: 'Run competitor analysis', prompt: 'Run a full competitor analysis. Search for my top competitors, compare engagement rates, posting frequency, and content strategies. Present as a markdown table.' },
    { label: 'What are they doing well?', prompt: 'Analyze what my competitors are doing well that I should learn from. Focus on content format, tone, and engagement tactics.' },
    { label: 'Counter-strategy', prompt: 'Based on competitor weaknesses, suggest a counter-strategy. What can I do differently to stand out?' },
  ],
};

export default function XIntelligenceView() {
  const [activeSubTab, setActiveSubTab] = useState<IntelSubTab>('search');

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Sub-tab bar + AI actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface">
        <div className="flex items-center gap-1">
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
        <div className="flex items-center gap-1">
          {AI_ACTIONS[activeSubTab]?.map((action, i) => (
            <button
              key={i}
              onClick={() => dispatchToAgent(action.prompt)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-info hover:bg-info-subtle/50 rounded-lg transition-colors"
            >
              <Zap size={10} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'search' && <XResearchView />}
        {activeSubTab === 'competitors' && <XCompetitorTracker />}
      </div>
    </div>
  );
}
