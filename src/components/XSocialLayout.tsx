import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Share2, Plus, MessageSquare, X, Settings, Bell } from 'lucide-react';
import type { XTab } from './XTwitterPage';
import XAgentChatPane from './XAgentChatPane';

interface XSocialLayoutProps {
  activeTab: XTab;
  onTabChange: (tab: XTab) => void;
  onComposeOpen: () => void;
  onSettingsReset: () => void;
  approvalBadge?: ReactNode;
  children: ReactNode;
}

const TABS: Array<{ id: XTab; label: string; icon: string }> = [
  { id: 'pipeline', label: 'Pipeline', icon: 'columns' },
  { id: 'engage', label: 'Engage', icon: 'at-sign' },
  { id: 'intelligence', label: 'Intelligence', icon: 'search' },
  { id: 'measure', label: 'Measure', icon: 'bar-chart' },
  { id: 'configure', label: 'Configure', icon: 'settings' },
];

// Lucide icons inline to avoid import bloat
function TabIcon({ name, size = 16 }: { name: string; size?: number }) {
  const s = size;
  switch (name) {
    case 'columns':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="12" x2="12" y1="3" y2="21"/></svg>;
    case 'at-sign':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>;
    case 'search':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'bar-chart':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>;
    case 'settings':
      return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>;
    default:
      return null;
  }
}

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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-mission-control-border bg-mission-control-surface">
        {/* Left: branding + tabs */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 mr-4">
            <Share2 size={18} className="text-info" />
            <h1 className="text-sm font-semibold">Social</h1>
          </div>

          {/* Tab bar inline in header */}
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-info-subtle text-info font-medium'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
              }`}
            >
              <TabIcon name={tab.icon} size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: approval badge + chat toggle + settings + compose */}
        <div className="flex items-center gap-2">
          {approvalBadge}

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              chatOpen
                ? 'bg-info-subtle text-info font-medium'
                : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg-alt'
            }`}
            title="Toggle agent chat (Cmd+.)"
          >
            <MessageSquare size={15} />
            Agent
          </button>

          <button
            onClick={onSettingsReset}
            className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text rounded-lg hover:bg-mission-control-bg-alt transition-colors"
            title="Reconfigure credentials"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={onComposeOpen}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-info hover:bg-info/80 text-white text-sm font-medium rounded-lg transition-colors"
            title="New post (Cmd+N)"
          >
            <Plus size={15} />
            Compose
          </button>
        </div>
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
