import { Lightbulb, FileText, Edit3, Calendar as CalendarIcon, AtSign, Zap, Settings } from 'lucide-react';
import type { XTab } from './XTwitterPage';

interface XTabBarProps {
  activeTab: XTab;
  onTabChange: (tab: XTab) => void;
}

const tabs: Array<{ id: XTab; label: string; icon: React.ReactNode }> = [
  { id: 'research', label: 'Research', icon: <Lightbulb size={16} /> },
  { id: 'plan', label: 'Plan', icon: <FileText size={16} /> },
  { id: 'drafts', label: 'Drafts', icon: <Edit3 size={16} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon size={16} /> },
  { id: 'mentions', label: 'Mentions', icon: <AtSign size={16} /> },
  { id: 'reply-guy', label: 'Reply Guy', icon: <Zap size={16} /> },
  { id: 'automations', label: 'Automations', icon: <Settings size={16} /> },
];

export default function XTabBar({ activeTab, onTabChange }: XTabBarProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-clawd-border bg-clawd-surface">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeTab === tab.id
              ? 'bg-blue-500/20 text-blue-400 font-medium'
              : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
          }`}
        >
          {tab.icon}
          <span className="text-sm">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
