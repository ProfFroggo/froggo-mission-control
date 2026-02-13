import { useState } from 'react';
import { Twitter } from 'lucide-react';
import ThreePaneLayout from './XThreePaneLayout';
import XTabBar from './XTabBar';
import XAgentChatPane from './XAgentChatPane';
import XContentEditorPane from './XContentEditorPane';
import XApprovalQueuePane from './XApprovalQueuePane';

export type XTab = 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'automations';

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('research');

  return (
    <div className="h-full flex flex-col bg-clawd-bg text-clawd-text">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <Twitter size={24} className="text-info" />
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
        <ThreePaneLayout>
          <XAgentChatPane tab={activeTab} />
          <XContentEditorPane tab={activeTab} />
          <XApprovalQueuePane tab={activeTab} />
        </ThreePaneLayout>
      </div>
    </div>
  );
}
