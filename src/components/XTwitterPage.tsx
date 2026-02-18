import { useState, useEffect } from 'react';
import ThreePaneLayout from './XThreePaneLayout';
import XTabBar from './XTabBar';
import XAgentChatPane from './XAgentChatPane';
import XContentEditorPane from './XContentEditorPane';
import XApprovalQueuePane from './XApprovalQueuePane';

export type XTab = 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'content-mix' | 'automations' | 'analytics';

const XLogo = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('plan');

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as XTab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('x-tab-change', handler);
    return () => window.removeEventListener('x-tab-change', handler);
  }, []);

  const TABS_WITH_APPROVAL: XTab[] = ['plan', 'drafts', 'research'];
  const showApprovalPane = TABS_WITH_APPROVAL.includes(activeTab);

  return (
    <div className="h-full flex flex-col bg-clawd-bg text-clawd-text">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <XLogo size={24} />
          <h1 className="text-xl font-semibold">X / Twitter</h1>
          <span className="px-2 py-0.5 text-xs bg-info-subtle text-info rounded-full">
            Multi-Agent Pipeline
          </span>
        </div>
      </div>

      {/* Tab Bar */}
      <XTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Three-Pane Layout */}
      <div className="flex-1 overflow-hidden">
        <ThreePaneLayout hideRightPane={!showApprovalPane}>
          <XAgentChatPane tab={activeTab} />
          <XContentEditorPane tab={activeTab} />
          <XApprovalQueuePane tab={activeTab} />
        </ThreePaneLayout>
      </div>
    </div>
  );
}
