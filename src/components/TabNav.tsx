/**
 * TabNav.tsx
 *
 * Canonical tab navigation component — the shared implementation of the
 * Library panel's border-b-2 underline tab pattern.
 *
 * Usage:
 *   const tabs = [
 *     { id: 'overview', label: 'Overview', icon: BarChart2 },
 *     { id: 'realtime', label: 'Real-Time', icon: Activity },
 *   ];
 *   <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
 *
 * When used with PanelHeader in a shared border-b container, pass border={false}
 * to avoid a double border line:
 *   <div className="border-b border-mission-control-border bg-mission-control-surface">
 *     <PanelHeader ... border={false} />
 *     <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} border={false} />
 *   </div>
 *
 * When used standalone (no PanelHeader wrapper), the default border={true} renders
 * the TabNav with its own border-b.
 */

import { LucideIcon } from 'lucide-react';

export interface TabNavItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number | string;
}

interface TabNavProps {
  tabs: TabNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** px-* class for horizontal padding. Defaults to px-6 to match Library panel. */
  paddingX?: string;
  /**
   * Whether to render the container's border-b. Default true.
   * Pass false when a parent container already provides the border-b.
   */
  border?: boolean;
}

export default function TabNav({ tabs, activeTab, onTabChange, paddingX = 'px-6', border = true }: TabNavProps) {
  return (
    <div
      className={`flex items-center gap-1 flex-shrink-0 ${border ? 'border-b border-mission-control-border' : ''} ${paddingX}`}
      role="tablist"
      aria-label="Panel navigation"
    >
      {tabs.map(({ id, label, icon: Icon, badge }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            id={`tab-${id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${id}`}
            onClick={() => onTabChange(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-control-accent/50 focus-visible:ring-inset ${
              isActive
                ? 'border-mission-control-accent text-mission-control-text'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-border'
            }`}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            <span>{label}</span>
            {badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs font-mono tabular-nums ${
                  isActive
                    ? 'bg-mission-control-accent/20 text-mission-control-accent'
                    : 'bg-mission-control-border text-mission-control-text-dim'
                }`}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
