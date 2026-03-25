import { useState } from 'react';
import { Search, Target, Zap } from 'lucide-react';
import { Flex, Box } from '@radix-ui/themes';
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
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Sub-tab bar + AI actions */}
      <Flex align="center" justify="between" px="4" py="2" className="border-b border-mission-control-border bg-mission-control-surface">
        <Flex align="center" gap="1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSubTab === tab.id ? 'border-mission-control-accent text-mission-control-accent' : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </Flex>
        <Flex align="center" gap="1">
          {AI_ACTIONS[activeSubTab]?.map((action, i) => (
            <button
              key={i}
              onClick={() => dispatchToAgent(action.prompt)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Zap size={10} />
              {action.label}
            </button>
          ))}
        </Flex>
      </Flex>

      {/* Sub-tab content */}
      <Box className="flex-1 overflow-hidden">
        {activeSubTab === 'search' && <XResearchView />}
        {activeSubTab === 'competitors' && <XCompetitorTracker />}
      </Box>
    </Flex>
  );
}
