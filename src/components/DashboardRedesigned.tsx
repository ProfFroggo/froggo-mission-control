// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useCallback } from 'react';
import DashCommandBar from './dash/DashCommandBar';
import DashSnapshot from './dash/DashSnapshot';
import { CalendarModal, EmailModal, MentionsModal, MessagesModal } from './QuickModals';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions' | 'library' | 'schedule' | 'codeagent' | 'calendar' | 'templates' | 'analytics' | 'comms' | 'accounts' | 'starred' | 'approvals';

interface DashboardProps {
  onNavigate?: (view: View) => void;
  onShowBrief?: () => void;
}

export default function DashboardRedesigned({ onNavigate, onShowBrief }: DashboardProps) {
  const [activeModal, setActiveModal] = useState<'calendar' | 'email' | 'mentions' | 'messages' | null>(null);

  const handleQuickAction = useCallback((action: 'calendar' | 'email') => {
    setActiveModal(action);
  }, []);

  const handleNavigate = onNavigate as ((view: string) => void) | undefined;

  return (
    <div className="h-full overflow-auto bg-mission-control-bg flex flex-col">

      {/* Command Bar - sticky */}
      <div className="sticky top-0 z-10">
        <DashCommandBar onShowBrief={onShowBrief} onQuickAction={handleQuickAction} />
      </div>

      {/* Snapshot content */}
      <DashSnapshot onNavigate={handleNavigate} />

      {/* Modals */}
      <CalendarModal isOpen={activeModal === 'calendar'} onClose={() => setActiveModal(null)} />
      <EmailModal isOpen={activeModal === 'email'} onClose={() => setActiveModal(null)} />
      <MentionsModal isOpen={activeModal === 'mentions'} onClose={() => setActiveModal(null)} />
      <MessagesModal isOpen={activeModal === 'messages'} onClose={() => setActiveModal(null)} />

    </div>
  );
}
