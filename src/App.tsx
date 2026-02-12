import { useState, useEffect, useRef, Suspense } from 'react';
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LoadingPanel from './components/LoadingPanel';
import PerformanceProfiler from './components/PerformanceProfiler';
import { toggleTheme, getThemeDisplayName } from './utils/themeToggle';
import { showToast } from './components/Toast';
// Import protected panels with error boundaries
import {
  Dashboard,
  Kanban,
  AgentPanel,
  ChatPanel,
  MeetingsPanel,
  VoiceChatPanel,
  SettingsPanel,
  NotificationsPanel,
  XPanel,
  InboxPanel,
  CommsInbox3Pane,
  LibraryPanel,
  SchedulePanel,
  CodeAgentDashboard,
  ContextControlBoard,
  AnalyticsDashboard,
  ConnectedAccountsPanel,
  DMFeed,
  FinancePanel,
  ErrorBoundary
} from './components/ProtectedPanels';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import GlobalSearch from './components/GlobalSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import MorningBrief from './components/MorningBrief';
import QuickActions, { QuickActionsRef } from './components/QuickActions';
import ContactModal from './components/ContactModal';
import SkillModal from './components/SkillModal';
import HelpPanel from './components/HelpPanel';
import EditPanelsModal from './components/EditPanelsModal';
import TourGuide, { useTour } from './components/TourGuide';
import NetworkStatus from './components/NetworkStatus';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'meetings' | 'voicechat' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'contacts' | 'accounts' | 'sessions' | 'calendar' | 'templates' | 'agentdms';

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    // Load default panel from settings
    const saved = localStorage.getItem('froggo-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        return (settings.defaultPanel as View) || 'dashboard';
      } catch (e) {
        return 'dashboard';
      }
    }
    return 'dashboard';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(208); // Track sidebar width for TopBar positioning
  const quickActionsRef = useRef<QuickActionsRef>(null);
  const { activeTour, completeTour, skipTour } = useTour();
  // DISABLED: Morning brief no longer auto-shows on startup (slow, mostly useless info)
  // Can be manually triggered from Dashboard if needed
  const [showMorningBrief, setShowMorningBrief] = useState(false);
  const { toggleMuted, loadApprovals } = useStore();

  // Load approvals from inbox database
  useEffect(() => {
    loadApprovals();
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

  // Listen for navigate-library event from HRSection
  useEffect(() => {
    const handleNavigateLibrary = (e: Event) => {
      const customEvent = e as CustomEvent;
      setCurrentView('library');
      // Store the path for LibraryPanel to consume
      if (customEvent.detail?.path) {
        sessionStorage.setItem('library-navigate-path', customEvent.detail.path);
      }
    };
    window.addEventListener('navigate-library', handleNavigateLibrary);
    return () => window.removeEventListener('navigate-library', handleNavigateLibrary);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Theme toggle - ⌘⇧D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const newTheme = toggleTheme();
        const themeName = getThemeDisplayName(newTheme);
        showToast('success', 'Theme Changed', `Switched to ${themeName}`);
        return;
      }

      // Scroll navigation - Option/Alt + Arrow keys
      if (e.altKey) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const scrollAmount = 100; // pixels
        const pageScrollAmount = mainContent.clientHeight * 0.8; // 80% of viewport

        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            mainContent.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
            return;
          case 'ArrowDown':
            e.preventDefault();
            mainContent.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            return;
          case 'PageUp':
            e.preventDefault();
            mainContent.scrollBy({ top: -pageScrollAmount, behavior: 'smooth' });
            return;
          case 'PageDown':
            e.preventDefault();
            mainContent.scrollBy({ top: pageScrollAmount, behavior: 'smooth' });
            return;
        }
      }

      // Global search - ⌘K or ⌘F (primary shortcuts)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'f')) {
        e.preventDefault();
        setSearchOpen(prev => !prev);
        return;
      }

      // Command palette - ⌘P (alternative to ⌘K)
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
        return;
      }

      // Global search - ⌘/ (alternative)
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

      // Help panel - ⌘H
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setHelpPanelOpen(prev => !prev);
        return;
      }

      // Quick message - ⌘⇧M
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        quickActionsRef.current?.openQuickMessage();
        return;
      }

      // Add contact - ⌘⇧N
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setContactModalOpen(true);
        return;
      }

      // Add skill - ⌘⇧K
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSkillModalOpen(true);
        return;
      }

      // Starred messages removed - keyboard shortcut disabled

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
            setCurrentView('inbox');
            break;
          case '2':
            e.preventDefault();
            setCurrentView('dashboard');
            break;
          case '3':
            e.preventDefault();
            setCurrentView('analytics');
            break;
          case '4':
            e.preventDefault();
            setCurrentView('kanban');
            break;
          case '5':
            e.preventDefault();
            setCurrentView('agents');
            break;
          case '6':
            e.preventDefault();
            setCurrentView('twitter');
            break;
          case '7':
            e.preventDefault();
            setCurrentView('meetings');
            break;
          case '8':
            e.preventDefault();
            setCurrentView('voicechat');
            break;
          case '9':
            e.preventDefault();
            setCurrentView('accounts');
            break;
          case '0':
            e.preventDefault();
            setCurrentView('approvals');
            break;
          case ',':
            e.preventDefault();
            setCurrentView('settings');
            break;
        }

        // Cmd+Shift shortcuts (navigation only - theme toggle handled above)
        if (e.shiftKey) {
          switch (e.key.toUpperCase()) {
            case 'C':
              e.preventDefault();
              setCurrentView('context');
              break;
            case 'L':
              e.preventDefault();
              setCurrentView('library');
              break;
            // Note: ⌘⇧D is now theme toggle
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
    <ErrorBoundary panelName="Application Root">
      {/* Network Status Indicator */}
      <NetworkStatus />

      <div className="flex h-screen bg-clawd-bg">
        {/* TopBar removed */}

        {/* Sidebar */}
        <ErrorBoundary panelName="Sidebar">
          <Sidebar 
            currentView={currentView} 
            onNavigate={setCurrentView}
            onOpenHelp={() => setHelpPanelOpen(true)}
            onWidthChange={setSidebarWidth}
          />
        </ErrorBoundary>
        
        {/* Main content - each panel already wrapped via ProtectedPanels */}
        <main 
          id="main-content"
          className="flex-1 overflow-hidden relative z-0"
          role="main"
          aria-label={`${currentView.charAt(0).toUpperCase() + currentView.slice(1)} panel`}
        >
          <PerformanceProfiler id={`${currentView}-panel`}>
            <Suspense fallback={<LoadingPanel />}>
              {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} onShowBrief={() => setShowMorningBrief(true)} />}
              {currentView === 'kanban' && <Kanban />}
              {currentView === 'agents' && <AgentPanel />}
              {currentView === 'finance' && <FinancePanel />}
              {currentView === 'chat' && <ChatPanel />}
              {currentView === 'agentdms' && <DMFeed />}
              {currentView === 'meetings' && <MeetingsPanel />}
              {currentView === 'voicechat' && <VoiceChatPanel />}
              {currentView === 'settings' && <SettingsPanel />}
              {currentView === 'notifications' && <NotificationsPanel />}
              {currentView === 'twitter' && <XPanel />}
              {currentView === 'inbox' && <CommsInbox3Pane />}
              {currentView === 'approvals' && <InboxPanel />}
              {currentView === 'comms' && <CommsInbox3Pane />}
              {currentView === 'library' && <LibraryPanel />}
              {currentView === 'schedule' && <SchedulePanel />}
              {currentView === 'codeagent' && <CodeAgentDashboard />}
              {currentView === 'context' && <ContextControlBoard />}
              {currentView === 'analytics' && <AnalyticsDashboard />}
              {currentView === 'accounts' && <ConnectedAccountsPanel />}
              {currentView === 'contacts' && <ContactModal isOpen={true} onClose={() => setCurrentView('dashboard')} />}
            </Suspense>
          </PerformanceProfiler>
        </main>

        {/* Command Palette */}
        <ErrorBoundary panelName="Command Palette">
          <CommandPalette 
            isOpen={commandPaletteOpen} 
            onClose={() => setCommandPaletteOpen(false)}
            onNavigate={(view) => setCurrentView(view as View)}
          />
        </ErrorBoundary>

        {/* Edit Panels Modal */}
        <EditPanelsModal />

        {/* Toast notifications */}
        <ErrorBoundary panelName="Toast System">
          <ToastContainer />
        </ErrorBoundary>

        {/* Global Search */}
        <ErrorBoundary panelName="Global Search">
          <GlobalSearch 
            isOpen={searchOpen} 
            onClose={() => setSearchOpen(false)}
            onNavigate={(view, id) => {
              console.log('[App] Navigate to:', view, id);
              setCurrentView(view as View);
              // TODO: Pass id to panel for deep linking
            }}
          />
        </ErrorBoundary>

        {/* Keyboard Shortcuts Help */}
        <ErrorBoundary panelName="Keyboard Shortcuts">
          <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </ErrorBoundary>

        {/* Help Panel */}
        <ErrorBoundary panelName="Help Panel">
          <HelpPanel 
            isOpen={helpPanelOpen} 
            onClose={() => setHelpPanelOpen(false)}
            currentPanel={currentView}
          />
        </ErrorBoundary>

        {/* Tour Guide */}
        <ErrorBoundary panelName="Tour Guide">
          <TourGuide 
            tour={activeTour}
            onComplete={completeTour}
            onSkip={skipTour}
          />
        </ErrorBoundary>

        {/* Morning Brief */}
        {showMorningBrief && (
          <ErrorBoundary panelName="Morning Brief">
            <MorningBrief
              onDismiss={() => {
                setShowMorningBrief(false);
                localStorage.setItem('morningBriefLastShown', new Date().toDateString());
              }}
              onNavigate={(view) => setCurrentView(view as any)}
            />
          </ErrorBoundary>
        )}

        {/* Quick Actions */}
        <ErrorBoundary panelName="Quick Actions">
          <QuickActions
            ref={quickActionsRef} 
            onSearch={() => setSearchOpen(true)}
            onNewTask={() => setCurrentView('kanban')}
            onAddContact={() => setContactModalOpen(true)}
            onAddSkill={() => setSkillModalOpen(true)}
            onNavigate={(view) => setCurrentView(view as any)}
            currentView={currentView}
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
        </ErrorBoundary>

        {/* Contact Modal */}
        <ErrorBoundary panelName="Contact Modal">
          <ContactModal 
            isOpen={contactModalOpen}
            onClose={() => setContactModalOpen(false)}
          />
        </ErrorBoundary>

        {/* Skill Modal */}
        <ErrorBoundary panelName="Skill Modal">
          <SkillModal isOpen={skillModalOpen} onClose={() => setSkillModalOpen(false)} />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

export default App;
