import { useState } from 'react';
import { Twitter, PieChart, X } from 'lucide-react';
import ThreePaneLayout from './XThreePaneLayout';
import XTabBar from './XTabBar';
import XAgentChatPane from './XAgentChatPane';
import XContentEditorPane from './XContentEditorPane';
import XApprovalQueuePane from './XApprovalQueuePane';
import { XContentMixTracker } from './XContentMixTracker';

export type XTab = 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'automations';

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('research');
  const [showContentMix, setShowContentMix] = useState(false);

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
        <button
          onClick={() => setShowContentMix(!showContentMix)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
            showContentMix
              ? 'bg-info text-white'
              : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
          }`}
          title="Toggle Content Mix Tracker"
        >
          <PieChart size={16} />
          <span className="text-sm">Content Mix</span>
        </button>
      </div>

      {/* Tab Bar */}
      <XTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Three-Pane Layout */}
      <div className="flex-1 overflow-hidden relative">
        <ThreePaneLayout>
          <XAgentChatPane tab={activeTab} />
          <XContentEditorPane tab={activeTab} />
          <XApprovalQueuePane tab={activeTab} />
        </ThreePaneLayout>

        {/* Content Mix Tracker Overlay */}
        {showContentMix && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
            <div className="bg-clawd-surface rounded-xl border border-clawd-border w-full max-w-lg max-h-full overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-clawd-border">
                <div className="flex items-center gap-2">
                  <PieChart size={20} className="text-info" />
                  <h2 className="text-lg font-semibold">Content Mix Tracker</h2>
                </div>
                <button
                  onClick={() => setShowContentMix(false)}
                  className="p-1 hover:bg-clawd-border rounded transition-colors"
                >
                  <X size={20} className="text-clawd-text-dim" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[70vh]">
                <XContentMixTracker />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
