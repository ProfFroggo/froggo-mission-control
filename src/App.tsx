import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { initApprovalQueue } from './lib/approvalQueue';
// PERFORMANCE: voiceService no longer preloads - loads on-demand when Voice panel opens
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LoadingPanel from './components/LoadingPanel';
import PerformanceProfiler from './components/PerformanceProfiler';
// Import protected panels with error boundaries
import {
  Dashboard,
  Kanban,
  AgentPanel,
  ChatPanel,
  VoicePanel,
  SettingsPanel,
  NotificationsPanel,
  XPanel,
  InboxPanel,
  ThreePaneInbox,
  CommsInbox,
  UnifiedCommsInbox,
  CommsInbox3Pane,
  LibraryPanel,
  CalendarPanel,
  SchedulePanel,
  CodeAgentDashboard,
  ContextControlBoard,
  AnalyticsDashboard,
  ConnectedAccountsPanel,
  StarredMessagesPanel,
  ErrorBoundary
} from './components/ProtectedPanels';
import VoskBrowserTest from './components/VoskBrowserTest';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import GlobalSearch from './components/GlobalSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import MorningBrief from './components/MorningBrief';
import ContentCalendar from './components/ContentCalendar';
import QuickActions, { QuickActionsRef } from './components/QuickActions';
import ContactModal from './components/ContactModal';
import SkillModal from './components/SkillModal';
import ErrorBoundaryTest from './components/ErrorBoundaryTest';
import HelpPanel from './components/HelpPanel';
import TourGuide, { useTour } from './components/TourGuide';
import NetworkStatus from './components/NetworkStatus';
import { AccessibilityProvider } from './contexts/AccessibilityContext';

type View = 'dashboard' | 'kanban' | 'agents' | 'chat' | 'voice' | 'settings' | 'notifications' | 'twitter' | 'inbox' | 'approvals' | 'library' | 'schedule' | 'codeagent' | 'context' | 'analytics' | 'comms' | 'contacts' | 'accounts' | 'starred' | 'error-test';

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
  const { activeTour, completeTour, skipTour, hasCompletedTour } = useTour();
  // DISABLED: Morning brief no longer auto-shows on startup (slow, mostly useless info)
  // Can be manually triggered from Dashboard if needed
  const [showMorningBrief, setShowMorningBrief] = useState(false);
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

      // Starred messages - ⌘⇧S
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setCurrentView('starred');
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
            setCurrentView('voice');
            break;
          case '8':
            e.preventDefault();
            setCurrentView('chat');
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
      
      {/* Skip Navigation Link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ARIA live region for announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="aria-announcements"
      />

      <div className="flex h-screen bg-clawd-bg">
        {/* Top bar with call button */}
        <ErrorBoundary panelName="Top Bar">
          <TopBar 
            onCallClick={handleCallClick} 
            onNavigate={setCurrentView} 
            sidebarWidth={sidebarWidth}
          />
        </ErrorBoundary>
        
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
          className="flex-1 overflow-hidden pt-12"
          role="main"
          aria-label={`${currentView.charAt(0).toUpperCase() + currentView.slice(1)} panel`}
        >
          <PerformanceProfiler id={`${currentView}-panel`}>
            <Suspense fallback={<LoadingPanel />}>
              {currentView === 'dashboard' && <Dashboard onNavigate={setCurrentView} onShowBrief={() => setShowMorningBrief(true)} />}
              {currentView === 'kanban' && <Kanban />}
              {currentView === 'agents' && <AgentPanel />}
              {currentView === 'chat' && <ChatPanel />}
              {currentView === 'voice' && <VoicePanel />}
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
              {currentView === 'starred' && <StarredMessagesPanel />}
              {currentView === 'error-test' && import.meta.env.DEV && <ErrorBoundaryTest />}
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
