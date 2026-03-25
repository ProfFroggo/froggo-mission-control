import { useState, useEffect } from 'react';
import { Bot, Zap, KeyRound } from 'lucide-react';
import { Badge, Spinner, Flex } from '@radix-ui/themes';
import TabNav, { type TabNavItem } from './TabNav';
import XAgentContentQueue from './XAgentContentQueue';
import XAutomationsTab from './XAutomationsTab';

type ConfigSubTab = 'agent-mode' | 'automations' | 'credentials';

const SUB_TABS: TabNavItem[] = [
  { id: 'agent-mode', label: 'Agent Mode', icon: Bot },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'credentials', label: 'Credentials', icon: KeyRound },
];

function CredentialsPanel() {
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Check which credentials are configured
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const checkKeys = async () => {
      const keyNames = ['twitter_api_key', 'twitter_api_secret', 'twitter_bearer_token', 'twitter_access_token', 'twitter_access_token_secret', 'twitter_oauth_client_id'];
      const results: Record<string, boolean> = {};
      for (const key of keyNames) {
        try {
          const res = await fetch(`/api/settings/${key}`);
          if (res.ok) {
            const data = await res.json();
            results[key] = !!data?.value;
          }
        } catch {
          results[key] = false;
        }
      }
      setKeys(results);
      setLoading(false);
    };
    checkKeys();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="3" />
      </div>
    );
  }

  const keyLabels: Record<string, string> = {
    twitter_api_key: 'API Key',
    twitter_api_secret: 'API Secret',
    twitter_bearer_token: 'Bearer Token',
    twitter_access_token: 'Access Token',
    twitter_access_token_secret: 'Access Token Secret',
    twitter_oauth_client_id: 'OAuth Client ID',
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h3 className="text-sm font-semibold text-mission-control-text mb-4">X/Twitter Credentials</h3>
      <div className="space-y-2">
        {Object.entries(keyLabels).map(([key, label]) => (
          <Flex key={key} align="center" justify="between" className="px-4 py-3 rounded-xl border border-mission-control-border bg-mission-control-surface">
            <span className="text-sm text-mission-control-text">{label}</span>
            <Badge
              color={keys[key] ? 'grass' : 'red'}
              variant="soft"
              radius="full"
            >
              {keys[key] ? 'Configured' : 'Missing'}
            </Badge>
          </Flex>
        ))}
      </div>
      <p className="text-xs text-mission-control-text-dim mt-4">
        Use the Settings gear icon in the header to reconfigure credentials.
      </p>
    </div>
  );
}

export default function XConfigureView() {
  const [activeSubTab, setActiveSubTab] = useState<ConfigSubTab>('agent-mode');

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Sub-tab bar */}
      <div className="bg-mission-control-surface">
        <TabNav
          tabs={SUB_TABS}
          activeTab={activeSubTab}
          onTabChange={(id) => setActiveSubTab(id as ConfigSubTab)}
          paddingX="px-4"
        />
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {activeSubTab === 'agent-mode' && <XAgentContentQueue />}
        {activeSubTab === 'automations' && <XAutomationsTab />}
        {activeSubTab === 'credentials' && <CredentialsPanel />}
      </div>
    </Flex>
  );
}
