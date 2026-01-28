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
import XPanel from './components/XPanel';
import InboxPanel from './components/InboxPanel';
import CommsInbox from './components/CommsInbox';
import SessionsPanel from './components/SessionsPanel';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import GlobalSearch from './components/GlobalSearch';
import LibraryPanel from './components/LibraryPanel';
import CalendarPanel from './components/CalendarPanel';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import MorningBrief from './components/MorningBrief';
import CodeAgentDashboard from './components/CodeAgentDashboard';
import ContextControlBoard from './components/ContextControlBoard';
import ContentCalendar from './components/ContentCalendar';
import SchedulePanel from './components/SchedulePanel';
import TemplatesPanel from './components/TemplatesPanel';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import QuickActions, { QuickActionsRef } from './components/QuickActions';
import { useRef } from 'react';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'sessions' | 'library' | 'schedule' | 'codeagent' | 'context' | 'calendar' | 'templates' | 'analytics' | 'comms';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const quickActionsRef = useRef<QuickActionsRef>(null);
  const [showMorningBrief, setShowMorningBrief] = useState(() => {
    // Show brief once per day
    const lastShown = localStorage.getItem('morningBriefLastShown');
    const today = new Date().toDateString();
    return lastShown !== today;
  });
  const { toggleMuted, setMeetingActive, loadApprovals } = useStore();

  // Initialize approval queue file watcher and load approvals from DB
  useEffect(() => {
    const cleanup = initApprovalQueue();
    // Load real approvals from inbox database
    loadApprovals();
    return cleanup;
  }, [loadApprovals]);

  // Apply saved theme and accent color on startup
  useEffect(() => {
    const saved = localStorage.getItem('froggo-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        const theme = settings.theme || 'dark';
        const accentColor = settings.accentColor || '#22c55e';
        
        // Determine actual theme
        let actualTheme = theme;
        if (theme === 'system') {
          actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        const root = document.documentElement;
        root.classList.remove('dark', 'light');
        root.classList.add(actualTheme);
        
        // Apply theme colors
        if (actualTheme === 'dark') {
          root.style.setProperty('--clawd-bg', '#0a0a0a');
          root.style.setProperty('--clawd-surface', '#141414');
          root.style.setProperty('--clawd-border', '#262626');
          root.style.setProperty('--clawd-text', '#fafafa');
          root.style.setProperty('--clawd-text-dim', '#a1a1aa');
        } else {
          root.style.setProperty('--clawd-bg', '#fafafa');
          root.style.setProperty('--clawd-surface', '#ffffff');
          root.style.setProperty('--clawd-border', '#e4e4e7');
          root.style.setProperty('--clawd-text', '#18181b');
          root.style.setProperty('--clawd-text-dim', '#71717a');
        }
        
        // Apply accent color
        root.style.setProperty('--clawd-accent', accentColor);
        const hex = accentColor.replace('#', '');
        const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
        const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
        const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
        root.style.setProperty('--clawd-accent-dim', `rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        console.error('[App] Failed to apply saved theme:', e);
      }
    }
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

      // Global search - ⌘/
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
        return;
      }

      // Keyboard shortcuts help - ⌘?
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
        return;
      }

      // Quick message - ⌘⇧M
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        quickActionsRef.current?.openQuickMessage();
        return;
      }

      // Mute toggle - ⌘M
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        toggleMuted();
        return;
      }

      // Navigation shortcuts (⌘1-9)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setCurrentView('dashboard');
            break;
          case '2':
            e.preventDefault();
            setCurrentView('inbox');
            break;
          case '3':
            e.preventDefault();
            setCurrentView('comms');
            break;
          case '4':
            e.preventDefault();
            setCurrentView('chat');
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
          case '9':
            e.preventDefault();
            setCurrentView('sessions');
            break;
          case '0':
            e.preventDefault();
            setCurrentView('analytics');
            break;
          case ',':
            e.preventDefault();
            setCurrentView('settings');
            break;
        }

        // Cmd+Shift shortcuts
        if (e.shiftKey) {
          switch (e.key.toUpperCase()) {
            case 'C':
              e.preventDefault();
              setCurrentView('context');
              break;
            case 'D':
              e.preventDefault();
              setCurrentView('codeagent');
              break;
            case 'L':
              e.preventDefault();
              setCurrentView('library');
              break;
            case 'S':
              e.preventDefault();
              setCurrentView('schedule');
              break;
            case 'A':
              e.preventDefault();
              setCurrentView('calendar');
              break;
          }
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
        {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} />}
        {currentView === 'kanban' && <Kanban />}
        {currentView === 'agents' && <AgentPanel />}
        {currentView === 'chat' && <ChatPanel />}
        {currentView === 'voice' && <VoicePanel />}
        {currentView === 'settings' && <SettingsPanel />}
        {currentView === 'notifications' && <NotificationsPanel />}
        {currentView === 'twitter' && <XPanel />}
        {currentView === 'inbox' && <InboxPanel />}
        {currentView === 'comms' && <CommsInbox />}
        {currentView === 'sessions' && <SessionsPanel />}
        {currentView === 'library' && <LibraryPanel />}
        {currentView === 'schedule' && <SchedulePanel />}
        {currentView === 'codeagent' && <CodeAgentDashboard />}
        {currentView === 'context' && <ContextControlBoard />}
        {currentView === 'calendar' && <ContentCalendar />}
        {currentView === 'templates' && <TemplatesPanel />}
        {currentView === 'analytics' && <AnalyticsDashboard />}
      </main>

      {/* Command Palette */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(view) => setCurrentView(view as View)}
      />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Global Search */}
      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* Morning Brief */}
      {showMorningBrief && (
        <MorningBrief
          onDismiss={() => {
            setShowMorningBrief(false);
            localStorage.setItem('morningBriefLastShown', new Date().toDateString());
          }}
          onNavigate={(view) => setCurrentView(view as any)}
        />
      )}

      {/* Quick Actions */}
      <QuickActions
        ref={quickActionsRef} 
        onSearch={() => setSearchOpen(true)}
        onNewTask={() => setCurrentView('kanban')}
        onApproveAll={async () => {
          try {
            const result = await (window as any).clawdbot?.inbox?.approveAll();
            if (result?.success) {
              const { showToast } = await import('./components/Toast');
              showToast('success', 'Approved all', `${result.count} items approved`);
            }
          } catch (e) {
            console.error('Approve all failed:', e);
          }
        }}
      />
    </div>
  );
}

export default App;
