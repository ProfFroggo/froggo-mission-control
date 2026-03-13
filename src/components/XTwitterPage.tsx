import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import ThreePaneLayout from './XThreePaneLayout';
import XTabBar from './XTabBar';
import XAgentChatPane from './XAgentChatPane';
import XContentEditorPane from './XContentEditorPane';
import XApprovalQueuePane from './XApprovalQueuePane';

export type XTab = 'pipeline' | 'publish' | 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'content-mix' | 'automations' | 'analytics' | 'reddit' | 'campaigns';

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('publish');

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as XTab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('x-tab-change', handler);
    return () => window.removeEventListener('x-tab-change', handler);
  }, []);

  const TABS_WITH_APPROVAL: XTab[] = ['pipeline', 'publish', 'plan', 'drafts', 'research', 'reddit', 'campaigns', 'mentions', 'reply-guy'];
  const showApprovalPane = TABS_WITH_APPROVAL.includes(activeTab);

  return (
    <div className="h-full flex flex-col bg-mission-control-bg text-mission-control-text">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <Share2 size={24} className="text-info" />
          <h1 className="text-xl font-semibold">Social Media</h1>
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
