import { useState, useEffect, useCallback, useRef } from 'react';
import { initApprovalQueue } from './lib/approvalQueue';
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Kanban from './components/Kanban';
import AgentPanel from './components/AgentPanel';
import SettingsPanel from './components/SettingsPanel';
import NotificationsPanel from './components/NotificationsPanel';
import InboxPanel from './components/InboxPanel';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import GlobalSearch from './components/GlobalSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import QuickActions, { QuickActionsRef } from './components/QuickActions';

// Ox Lite - Same Froggo design, fewer views
type View = 'dashboard' | 'kanban' | 'agents' | 'settings' | 'notifications' | 'inbox' | 'analytics';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const quickActionsRef = useRef<QuickActionsRef>(null);
  const { toggleMuted, setMeetingActive, loadApprovals } = useStore();

  // Initialize approval queue and load approvals
  useEffect(() => {
    const cleanup = initApprovalQueue();
    loadApprovals();
    return cleanup;
  }, [loadApprovals]);

  // Apply Ox Lite theme (amber accent instead of green)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    
    // Ox Lite accent color (amber)
    root.style.setProperty('--clawd-accent', '#f59e0b');
    root.style.setProperty('--clawd-bg', '#0a0a0a');
    root.style.setProperty('--clawd-surface', '#141414');
    root.style.setProperty('--clawd-border', '#262626');
    root.style.setProperty('--clawd-text', '#fafafa');
    root.style.setProperty('--clawd-text-dim', '#a1a1aa');
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }
    
    // Search
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault();
      setSearchOpen(true);
      return;
    }
    
    // Keyboard shortcuts help
    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
      const active = document.activeElement;
      if (active?.tagName !== 'INPUT' && active?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    }
    
    // Navigation shortcuts
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
          setCurrentView('kanban');
          break;
        case '4':
          e.preventDefault();
          setCurrentView('agents');
          break;
        case '5':
          e.preventDefault();
          setCurrentView('analytics');
          break;
        case ',':
          e.preventDefault();
          setCurrentView('settings');
          break;
      }
    }
    
    // Mute toggle
    if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
      e.preventDefault();
      toggleMuted();
    }
    
    // Meeting mode
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      setMeetingActive(true);
    }
  }, [toggleMuted, setMeetingActive]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'kanban':
        return <Kanban />;
      case 'agents':
        return <AgentPanel />;
      case 'inbox':
        return <InboxPanel />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'settings':
        return <SettingsPanel />;
      case 'notifications':
        return <NotificationsPanel />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-clawd-bg text-clawd-text overflow-hidden">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        
        <main className="flex-1 overflow-hidden">
          {renderView()}
        </main>
      </div>
      
      {/* Modals */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setCurrentView}
      />
      <GlobalSearch 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />
      <KeyboardShortcuts 
        isOpen={shortcutsOpen} 
        onClose={() => setShortcutsOpen(false)} 
      />
      <QuickActions ref={quickActionsRef} />
      <ToastContainer />
    </div>
  );
}

export default App;
