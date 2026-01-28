import { useState } from 'react';
import { BarChart2, Activity, TrendingUp, Zap } from 'lucide-react';
import AnalyticsOverview from './AnalyticsOverview';
import SessionsFilter from './SessionsFilter';

type Tab = 'overview' | 'sessions' | 'usage' | 'performance';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'sessions', label: 'Sessions', icon: Activity },
  { id: 'usage', label: 'Usage Stats', icon: TrendingUp },
  { id: 'performance', label: 'Performance', icon: Zap },
];

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <BarChart2 size={24} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Analytics</h1>
              <p className="text-sm text-clawd-text-dim">
                Activity, sessions, and usage insights
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-clawd-accent text-white'
                    : 'text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <AnalyticsOverview />}
        {activeTab === 'sessions' && <SessionsFilter />}
        {activeTab === 'usage' && (
          <div className="h-full flex items-center justify-center text-clawd-text-dim">
            <div className="text-center">
              <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Usage Stats</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )}
        {activeTab === 'performance' && (
          <div className="h-full flex items-center justify-center text-clawd-text-dim">
            <div className="text-center">
              <Zap size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Performance Metrics</p>
              <p className="text-sm">Coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
