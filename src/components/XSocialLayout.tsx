import { useState, useEffect, type ReactNode } from 'react';
import { Share2, Plus, MessageSquare, Settings, Columns3, AtSign, Search, BarChart2, SlidersHorizontal } from 'lucide-react';
import { Button, IconButton } from '@radix-ui/themes';
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
    <div className="h-full flex flex-col bg-mission-control-bg text-mission-control-text">
      {/* Header */}
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 py-2.5">
          {/* Left: branding */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg">
              <Share2 size={18} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text leading-tight">Social</h1>
              <p className="text-sm text-mission-control-text-dim leading-tight">X / Twitter management</p>
            </div>
          </div>

          {/* Right: approval badge + chat toggle + settings + compose */}
          <div className="flex items-center gap-2">
            {approvalBadge}

            <Button
              onClick={() => setChatOpen(!chatOpen)}
              variant={chatOpen ? 'soft' : 'ghost'}
              color={chatOpen ? 'violet' : 'gray'}
              size="1"
              title="Toggle agent chat (Cmd+.)"
            >
              <MessageSquare size={15} />
              Agent
            </Button>

            <IconButton
              onClick={onSettingsReset}
              variant="ghost"
              color="gray"
              size="1"
              title="Reconfigure credentials"
            >
              <Settings size={15} />
            </IconButton>

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
          </div>
        </div>

        {/* Tab bar */}
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => onTabChange(id as XTab)}
          paddingX="px-4"
        />
      </div>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Agent chat slide-in panel */}
        <div
          className={`flex-shrink-0 border-l border-mission-control-border bg-mission-control-surface transition-all duration-200 ease-in-out overflow-hidden ${
            chatOpen ? 'w-[380px]' : 'w-0 border-l-0'
          }`}
        >
          {chatOpen && (
            <div className="w-[380px] h-full">
              <XAgentChatPane tab={activeTab} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
