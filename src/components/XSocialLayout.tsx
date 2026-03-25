import { useState, useEffect, type ReactNode } from 'react';
import { Share2, Plus, MessageSquare, Settings, Columns3, AtSign, Search, BarChart2, SlidersHorizontal } from 'lucide-react';
import { Button, Flex, Box } from '@radix-ui/themes';
import type { XTab } from './XTwitterPage';
import XAgentChatPane from './XAgentChatPane';
import TabNav, { type TabNavItem } from './TabNav';

interface XSocialLayoutProps {
  activeTab: XTab;
  onTabChange: (tab: XTab) => void;
  onComposeOpen: () => void;
  onSettingsReset: () => void;
  approvalBadge?: ReactNode;
  children: ReactNode;
}

const TABS: TabNavItem[] = [
  { id: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { id: 'engage', label: 'Engage', icon: AtSign },
  { id: 'intelligence', label: 'Intelligence', icon: Search },
  { id: 'measure', label: 'Measure', icon: BarChart2 },
  { id: 'configure', label: 'Configure', icon: SlidersHorizontal },
];

export default function XSocialLayout({
  activeTab,
  onTabChange,
  onComposeOpen,
  onSettingsReset,
  approvalBadge,
  children,
}: XSocialLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);

  // Keyboard shortcut: Cmd+. to toggle chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setChatOpen(prev => !prev);
      }
      // Cmd+N to open compose
      if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
        e.preventDefault();
        onComposeOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onComposeOpen]);

  // Auto-open chat when agent message is injected
  useEffect(() => {
    const handler = () => setChatOpen(true);
    window.addEventListener('x-agent-chat-inject', handler);
    return () => window.removeEventListener('x-agent-chat-inject', handler);
  }, []);

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg text-mission-control-text">
      {/* Header */}
      <Box className="border-b border-mission-control-border bg-mission-control-surface">
        {/* Title row */}
        <Flex align="center" justify="between" px="4" py="2">
          {/* Left: branding */}
          <Flex align="center" gap="3">
            <Box p="2" className="bg-mission-control-accent/20 rounded-lg">
              <Share2 size={18} className="text-mission-control-accent" />
            </Box>
            <Box>
              <h1 className="text-xl font-semibold text-mission-control-text leading-tight">Social</h1>
              <p className="text-sm text-mission-control-text-dim leading-tight">X / Twitter management</p>
            </Box>
          </Flex>

          {/* Right: approval badge + chat toggle + settings + compose */}
          <Flex align="center" gap="2">
            {approvalBadge}

            <button
              onClick={() => setChatOpen(!chatOpen)}
              title="Toggle agent chat (Cmd+.)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium border transition-colors ${
                chatOpen
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text hover:border-mission-control-accent/20'
              }`}
            >
              <MessageSquare size={15} />
              Agent
            </button>

            <button
              onClick={onSettingsReset}
              title="Reconfigure credentials"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <Settings size={15} />
            </button>

            <Button
              onClick={onComposeOpen}
              variant="solid"
              color="violet"
              size="1"
              title="New post (Cmd+N)"
            >
              <Plus size={15} />
              Compose
            </Button>
          </Flex>
        </Flex>

        {/* Tab bar — border={false} because parent Box already provides border-b */}
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => onTabChange(id as XTab)}
          paddingX="px-4"
          border={false}
        />
      </Box>

      {/* Content area */}
      <Flex height="100%" className="flex-1 overflow-hidden">
        {/* Main content */}
        <Box className="flex-1 overflow-hidden">
          {children}
        </Box>

        {/* Agent chat slide-in panel */}
        <Box
          className={`flex-shrink-0 border-l border-mission-control-border bg-mission-control-surface transition-colors duration-200 ease-in-out overflow-hidden ${
            chatOpen ? 'w-[380px]' : 'w-0 border-l-0'
          }`}
        >
          {chatOpen && (
            <Box className="w-[380px] h-full">
              <XAgentChatPane tab={activeTab} />
            </Box>
          )}
        </Box>
      </Flex>
    </Flex>
  );
}
