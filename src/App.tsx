import { useState, useEffect, useCallback } from 'react';
import { initApprovalQueue } from './lib/approvalQueue';
import './lib/voiceService'; // Preload voice model in background
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Kanban from './components/Kanban';
import AgentPanel from './components/AgentPanel';
import ChatPanel from './components/ChatPanel';
import VoicePanel from './components/VoicePanel';
import VoskBrowserTest from './components/VoskBrowserTest';
import SettingsPanel from './components/SettingsPanel';
import NotificationsPanel from './components/NotificationsPanel';
import TwitterPanel from './components/TwitterPanel';
import InboxPanel from './components/InboxPanel';
import SessionsPanel from './components/SessionsPanel';
import CommandPalette from './components/CommandPalette';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { toggleMuted, setMeetingActive } = useStore();

  // Initialize approval queue file watcher
  useEffect(() => {
    const cleanup = initApprovalQueue();
    return cleanup;
  }, []);

  // Handle call button click - navigate to voice and start meeting
  const handleCallClick = useCallback(() => {
    setCurrentView('voice');
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }

      // Mute toggle - ⌘M
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        toggleMuted();
        return;
      }

      // Navigation shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setCurrentView('inbox');
            break;
          case '2':
            e.preventDefault();
            setCurrentView('dashboard');
            break;
          case '3':
            e.preventDefault();
            setCurrentView('chat');
            break;
          case '4':
            e.preventDefault();
            setCurrentView('sessions');
            break;
          case '5':
            e.preventDefault();
            setCurrentView('kanban');
            break;
          case '6':
            e.preventDefault();
            setCurrentView('agents');
            break;
          case '7':
            e.preventDefault();
            setCurrentView('twitter');
            break;
          case '8':
            e.preventDefault();
            setCurrentView('voice');
            break;
          case ',':
            e.preventDefault();
            setCurrentView('settings');
            break;
        }
      }

      // Escape to close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, toggleMuted]);

  return (
    <div className="flex h-screen bg-clawd-bg">
      {/* Top bar with call button */}
      <TopBar onCallClick={handleCallClick} />
      
      {/* Sidebar */}
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      {/* Main content */}
      <main className="flex-1 overflow-hidden pt-12">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'kanban' && <Kanban />}
        {currentView === 'agents' && <AgentPanel />}
        {currentView === 'chat' && <ChatPanel />}
        {currentView === 'voice' && <VoicePanel />}
        {currentView === 'settings' && <SettingsPanel />}
        {currentView === 'notifications' && <NotificationsPanel />}
        {currentView === 'twitter' && <TwitterPanel />}
        {currentView === 'inbox' && <InboxPanel />}
        {currentView === 'sessions' && <SessionsPanel />}
      </main>

      {/* Command Palette */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(view) => setCurrentView(view as View)}
      />
    </div>
  );
}

export default App;
