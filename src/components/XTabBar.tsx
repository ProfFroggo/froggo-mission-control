import { FileText, Edit3, Calendar as CalendarIcon, AtSign, Zap, PieChart, Settings, BarChart2, MessageCircle, Send, Rocket, Columns, Bot, Target, Hash } from 'lucide-react';
import type { XTab } from './XTwitterPage';

interface XTabBarProps {
  activeTab: XTab;
  onTabChange: (tab: XTab) => void;
}

const tabs: Array<{ id: XTab; label: string; icon: React.ReactNode }> = [
  { id: 'pipeline', label: 'Pipeline', icon: <Columns size={16} /> },
  { id: 'research', label: 'Research', icon: <Zap size={16} /> },
  { id: 'plan', label: 'Content Plan', icon: <FileText size={16} /> },
  { id: 'drafts', label: 'Drafts', icon: <Edit3 size={16} /> },
  { id: 'publish', label: 'Publish', icon: <Send size={16} /> },
  { id: 'campaigns', label: 'Campaigns', icon: <Rocket size={16} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={16} /> },
  { id: 'mentions', label: 'Mentions', icon: <AtSign size={16} /> },
  { id: 'reply-guy', label: 'Reply Guy', icon: <Zap size={16} /> },
  { id: 'content-mix', label: 'Content Mix', icon: <PieChart size={16} /> },
  { id: 'automations', label: 'Automations', icon: <Settings size={16} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
  { id: 'reddit', label: 'Reddit', icon: <MessageCircle size={16} /> },
  { id: 'agent-mode', label: 'Agent Mode', icon: <Bot size={16} /> },
  { id: 'competitors', label: 'Competitors', icon: <Target size={16} /> },
  { id: 'hashtags', label: 'Hashtags', icon: <Hash size={16} /> },
];

export default function XTabBar({ activeTab, onTabChange }: XTabBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-mission-control-border bg-mission-control-surface overflow-x-auto scrollbar-hide scroll-smooth">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
            activeTab === tab.id
              ? 'bg-info-subtle text-info font-medium'
              : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
          }`}
        >
          {tab.icon}
          <span className="text-sm">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
