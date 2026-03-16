import { useState, useEffect, useCallback } from 'react';
import XSocialLayout from './XSocialLayout';
import XComposeModal from './XComposeModal';
import XApprovalBadge from './XApprovalBadge';
import XSetupWizard from './XSetupWizard';

// New consolidated tab type: 5 tabs instead of 15
export type XTab = 'pipeline' | 'engage' | 'intelligence' | 'measure' | 'configure';

// Content routing
import XPipelineView from './XPipelineView';
import { XEnhancedAnalyticsView } from './XEnhancedAnalyticsView';
import { XMentionsView } from './XMentionsView';
import { XEngageView } from './XEngageView';
import XIntelligenceView from './XIntelligenceView';
import XConfigureView from './XConfigureView';

function ContentRouter({ tab }: { tab: XTab }) {
  switch (tab) {
    case 'pipeline':
      return <XPipelineView />;
    case 'engage':
      return <XEngageView />;
    case 'intelligence':
      return <XIntelligenceView />;
    case 'measure':
      return <XEnhancedAnalyticsView />;
    case 'configure':
      return <XConfigureView />;
    default:
      return null;
  }
}

export default function XTwitterPage() {
  const [activeTab, setActiveTab] = useState<XTab>('pipeline');
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // Check if X API is configured
  useEffect(() => {
    (async () => {
      try {
        const flagRes = await fetch('/api/settings/twitter_setup_complete').then(r => r.ok ? r.json() : null).catch(() => null);
        if (flagRes?.value === 'true') {
          setSetupComplete(true);
          return;
        }
        const [apiKey, bearer, oauthId] = await Promise.all([
          fetch('/api/settings/twitter_api_key').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/settings/twitter_bearer_token').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/settings/twitter_oauth_client_id').then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        const hasKeys = !!(apiKey?.value || bearer?.value || oauthId?.value);
        setSetupComplete(hasKeys);
      } catch {
        setSetupComplete(false);
      }
    })();
  }, []);

  // Listen for tab change events (from agents, other components)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Handle legacy tab names by mapping to new tabs
      const legacyMap: Record<string, XTab> = {
        publish: 'pipeline',
        drafts: 'pipeline',
        plan: 'pipeline',
        calendar: 'pipeline',
        campaigns: 'pipeline',
        mentions: 'engage',
        'reply-guy': 'engage',
        research: 'intelligence',
        competitors: 'intelligence',
        hashtags: 'intelligence',
        analytics: 'measure',
        'content-mix': 'measure',
        automations: 'configure',
        'agent-mode': 'configure',
      };
      const tab = legacyMap[detail] || detail;
      if (tab) setActiveTab(tab as XTab);

      // If someone dispatches 'publish', open compose modal
      if (detail === 'publish') setComposeOpen(true);
    };
    window.addEventListener('x-tab-change', handler);
    return () => window.removeEventListener('x-tab-change', handler);
  }, []);

  const handleComposeOpen = useCallback(() => setComposeOpen(true), []);
  const handleComposeClose = useCallback(() => setComposeOpen(false), []);
  const handleSettingsReset = useCallback(async () => {
    await fetch('/api/settings/twitter_setup_complete', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '' }),
    }).catch(() => {});
    setSetupComplete(false);
  }, []);

  // Loading state
  if (setupComplete === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-mission-control-text-dim">Loading Social Media module...</p>
        </div>
      </div>
    );
  }

  // Setup wizard
  if (!setupComplete) {
    return <XSetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <>
      <XSocialLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onComposeOpen={handleComposeOpen}
        onSettingsReset={handleSettingsReset}
        approvalBadge={<XApprovalBadge />}
      >
        <ContentRouter tab={activeTab} />
      </XSocialLayout>

      <XComposeModal open={composeOpen} onClose={handleComposeClose} />
    </>
  );
}
