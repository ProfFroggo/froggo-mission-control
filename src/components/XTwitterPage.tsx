import { useState, useEffect } from 'react';
import { Share2, Plus, Clock, FileText } from 'lucide-react';
import ThreePaneLayout from './XThreePaneLayout';
import XTabBar from './XTabBar';
import XAgentChatPane from './XAgentChatPane';
import XContentEditorPane from './XContentEditorPane';
import XApprovalQueuePane from './XApprovalQueuePane';
import XSetupWizard from './XSetupWizard';
import { scheduleApi, approvalApi, settingsApi } from '../lib/api';

export type XTab = 'pipeline' | 'publish' | 'research' | 'plan' | 'drafts' | 'calendar' | 'mentions' | 'reply-guy' | 'content-mix' | 'automations' | 'analytics' | 'reddit' | 'campaigns' | 'agent-mode' | 'competitors' | 'hashtags';

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('publish');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Check if X API is configured on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/settings/twitter_api_key').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/settings/twitter_bearer_token').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([apiKey, bearer]) => {
      const hasKey = !!(apiKey?.value || bearer?.value);
      console.log('[XTwitterPage] Setup check:', { hasApiKey: !!apiKey?.value, hasBearer: !!bearer?.value, setupComplete: hasKey });
      setSetupComplete(hasKey);
    }).catch(() => setSetupComplete(false));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail as XTab;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener('x-tab-change', handler);
    return () => window.removeEventListener('x-tab-change', handler);
  }, []);

  // Load context bar counts
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [scheduleItems, approvalItems] = await Promise.all([
          scheduleApi.getAll(),
          approvalApi.getAll('pending'),
        ]);
        const scheduled = (Array.isArray(scheduleItems) ? scheduleItems : [])
          .filter((item: any) => item.platform === 'twitter' && item.scheduledFor && item.status !== 'posted');
        setScheduledCount(scheduled.length);
        const pending = (Array.isArray(approvalItems) ? approvalItems : [])
          .filter((item: any) => item.type === 'tweet');
        setPendingCount(pending.length);
      } catch {
        // non-fatal — counts just stay at 0
      }
    };
    loadCounts();
  }, [activeTab]); // refresh when tab changes so counts stay current

  // Show setup wizard if not configured (after all hooks)
  if (setupComplete === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-mission-control-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-mission-control-text-dim">Loading Social Media module...</p>
        </div>
      </div>
    );
  }
  if (!setupComplete) {
    return <XSetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  const TABS_WITH_APPROVAL: XTab[] = ['pipeline', 'publish', 'plan', 'drafts', 'research', 'reddit', 'campaigns', 'mentions', 'reply-guy'];
  const showApprovalPane = TABS_WITH_APPROVAL.includes(activeTab);

  return (
    <div className="h-full flex flex-col bg-mission-control-bg text-mission-control-text">
      {/* Header with context bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mission-control-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Share2 size={20} className="text-info" />
            <h1 className="text-lg font-semibold">Social Media</h1>
            <span className="px-2 py-0.5 text-xs bg-info-subtle text-info rounded-full">
              Multi-Agent
            </span>
          </div>

          {/* Context bar stats */}
          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-mission-control-border">
            <button
              onClick={() => setActiveTab('calendar')}
              className="flex items-center gap-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              title="View scheduled posts"
            >
              <Clock size={14} className="text-info" />
              <span className="font-medium text-mission-control-text">{scheduledCount}</span>
              <span>scheduled</span>
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className="flex items-center gap-1.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              title="View pending approvals"
            >
              <FileText size={14} className={pendingCount > 0 ? 'text-warning' : 'text-mission-control-text-dim'} />
              <span className={`font-medium ${pendingCount > 0 ? 'text-warning' : 'text-mission-control-text'}`}>{pendingCount}</span>
              <span>pending</span>
            </button>
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={() => setActiveTab('publish')}
          className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent hover:bg-mission-control-accent/80 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Create
        </button>
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
