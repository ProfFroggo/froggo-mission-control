import { useState, useEffect, useRef, Suspense } from 'react';
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import LoadingPanel from './components/LoadingPanel';
import PerformanceProfiler from './components/PerformanceProfiler';
import { toggleTheme, getThemeDisplayName } from './utils/themeToggle';
import { showToast } from './components/Toast';
import { safeStorage } from './utils/safeStorage';
import { ErrorBoundary } from './components/ProtectedPanels';
// Register all core views (side-effect import — must come before first render)
import './core/CoreViews.tsx';
// Register all modules (side-effect import — modules self-register with ModuleLoader)
import './modules';
import { ViewRegistry } from './core/ViewRegistry';
import { ModuleLoader } from './core/ModuleLoader';
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
import { usePanelConfigStore } from './store/panelConfig';
import TourGuide, { useTour } from './components/TourGuide';
import { useFirstTimeUser } from './hooks/useFirstTimeUser';
import OnboardingWizard from './components/OnboardingWizard';
import NetworkStatus from './components/NetworkStatus';
import { DependencyGate } from './components/DependencyGate';

// View IDs are dynamic — any registered view ID is valid
type View = string;

function App() {
  const [currentView, setCurrentViewState] = useState<View>(() => {
    // Restore from URL hash first (survives refresh), then localStorage default
    const hash = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
    if (hash) return hash;
    const saved = safeStorage.getItem('mission-control-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        return (settings.defaultPanel as View) || 'dashboard';
      } catch {
        return 'dashboard';
      }
    }
    return 'dashboard';
  });

  const setCurrentView = (view: View) => {
    setCurrentViewState(view);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${view}`);
    }
  };
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [, setSidebarWidth] = useState(208); // Track sidebar width for sidebar positioning
  const quickActionsRef = useRef<QuickActionsRef>(null);
  const { activeTour, completeTour, skipTour, startTour, startPlatformTour, hasCompletedTour } = useTour();
  const { showOnboardingWizard, completeOnboarding, skipOnboarding } = useFirstTimeUser(startTour, hasCompletedTour);
  // DISABLED: Morning brief no longer auto-shows on startup (slow, mostly useless info)
  // Can be manually triggered from Dashboard if needed
  const [showMorningBrief, setShowMorningBrief] = useState(false);
  const toggleMuted = useStore(s => s.toggleMuted);
  const loadApprovals = useStore(s => s.loadApprovals);
  const fetchAgents = useStore(s => s.fetchAgents);
  const loadTasksFromDB = useStore(s => s.loadTasksFromDB);
  const toolbarVisible = usePanelConfigStore(s => s.panels.find(p => p.id === 'toolbar')?.visible ?? true);

  // Load core data on app launch so all views (Dashboard, etc.) have real stats
  useEffect(() => {
    loadApprovals();
    fetchAgents();
    loadTasksFromDB();
  }, [loadApprovals, fetchAgents, loadTasksFromDB]);

  // Phase 79: Root-level visibility handler — pauses polling when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      (window as any).__appVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);
    (window as any).__appVisible = true;
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Sync currentView with URL hash (browser back/forward support)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) setCurrentViewState(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Handle Google OAuth callback — ?code= lands on the root page after redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    // Clear URL params immediately
    window.history.replaceState({}, document.title, window.location.pathname);

    // Exchange code for tokens
    fetch('/api/google/auth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          showToast('success', 'Gmail Connected', data.email ? `Connected as ${data.email}` : 'Google account connected');
          // Switch to inbox view
          setCurrentView('inbox');
        } else {
          showToast('error', 'Google Auth Failed', data.error ?? 'Failed to connect Google account');
        }
      })
      .catch(() => {
        showToast('error', 'Google Auth Failed', 'Could not complete authentication');
      });
  }, []);

  // Initialize all registered modules, then sync sidebar with optional module views.
  // No cleanup — modules are registered at module-level and live for the app lifetime.
  // disposeAll() in cleanup wipes ViewRegistry in React Strict Mode double-invoke,
  // causing the nav to show only 1–3 items on reload.
  const syncPanels = usePanelConfigStore(s => s.syncWithViewRegistry);
  useEffect(() => {
    // Sync immediately — core modules already registered synchronously at import time
    syncPanels();
    // Then init optional modules and sync again to pick up any new views
    ModuleLoader.initAll()
      .then(() => syncPanels())
      .catch(err => {
        console.error('[App] Module initialization failed:', err);
      });
  }, [syncPanels]);

  // Apply saved theme and accent color on startup
  useEffect(() => {
    const saved = safeStorage.getItem('mission-control-settings');
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
          root.style.setProperty('--mission-control-bg', '#0a0a0a');
          root.style.setProperty('--mission-control-surface', '#141414');
          root.style.setProperty('--mission-control-border', '#262626');
          root.style.setProperty('--mission-control-text', '#fafafa');
          root.style.setProperty('--mission-control-text-dim', '#a1a1aa');
        } else {
          root.style.setProperty('--mission-control-bg', '#fafafa');
          root.style.setProperty('--mission-control-surface', '#ffffff');
          root.style.setProperty('--mission-control-border', '#e4e4e7');
          root.style.setProperty('--mission-control-text', '#18181b');
          root.style.setProperty('--mission-control-text-dim', '#71717a');
        }

        // Apply accent color
        root.style.setProperty('--mission-control-accent', accentColor);
        const hex = accentColor.replace('#', '');
        const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
        const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
        const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
        root.style.setProperty('--mission-control-accent-dim', `rgb(${r}, ${g}, ${b})`);
      } catch (e) {
        // '[App] Failed to apply saved theme:', e;
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

  // Listen for tour navigation events — tour steps dispatch these to switch panels
  useEffect(() => {
    const handleTourNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<{ view: string }>;
      if (customEvent.detail?.view) {
        setCurrentView(customEvent.detail.view);
      }
    };
    window.addEventListener('tour-navigate', handleTourNavigate);
    return () => window.removeEventListener('tour-navigate', handleTourNavigate);
  }, []);

  // Listen for restart-tour event dispatched from SettingsPanel
  useEffect(() => {
    const handleRestartTour = () => {
      startPlatformTour();
    };
    window.addEventListener('restart-platform-tour', handleRestartTour);
    return () => window.removeEventListener('restart-platform-tour', handleRestartTour);
  }, [startPlatformTour]);

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
    <DependencyGate>
    <ErrorBoundary panelName="Application Root">
      {/* Network Status Indicator */}
      <NetworkStatus />

      {/* Skip navigation link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-mission-control-accent focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-mission-control-accent focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <div className="flex h-screen bg-mission-control-bg">
        {/* TopBar removed */}

        {/* Sidebar */}
        <ErrorBoundary panelName="Sidebar">
          <Sidebar
            currentView={currentView}
            onNavigate={setCurrentView}
            onOpenHelp={() => setHelpPanelOpen(true)}
            onWidthChange={setSidebarWidth}
            onOpenSearch={() => setSearchOpen(true)}
          />
        </ErrorBoundary>
        
        {/* Main content - each panel already wrapped via ProtectedPanels */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-hidden relative z-0"
          role="main"
          aria-label={`${currentView.charAt(0).toUpperCase() + currentView.slice(1)} panel`}
        >
          <PerformanceProfiler id={`${currentView}-panel`}>
            <ErrorBoundary panelName={currentView} key={currentView}>
              <Suspense fallback={<LoadingPanel />}>
                {/* Dynamic view rendering — driven by ViewRegistry */}
                {currentView === 'contacts'
                  ? <ContactModal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
                  : (() => {
                      const reg = ViewRegistry.get(currentView);
                      if (!reg) return null;
                      const Comp = reg.component;
                      if (currentView === 'dashboard') {
                        return <Comp onNavigate={setCurrentView} onShowBrief={() => setShowMorningBrief(true)} />;
                      }
                      return <Comp />;
                    })()
                }
              </Suspense>
            </ErrorBoundary>
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
            onNavigate={(view, _id) => {
              setCurrentView(view as View);
              // Deep linking with id: not yet implemented
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

        {/* Onboarding Wizard (first-run only) */}
        {showOnboardingWizard && (
          <ErrorBoundary panelName="Onboarding Wizard">
            <OnboardingWizard
              onComplete={(startTour) => completeOnboarding(startTour)}
              onSkip={() => skipOnboarding()}
            />
          </ErrorBoundary>
        )}

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
                safeStorage.setItem('morningBriefLastShown', new Date().toDateString());
              }}
              onNavigate={(view) => setCurrentView(view as any)}
            />
          </ErrorBoundary>
        )}

        {/* Quick Actions (Floating Toolbar) */}
        {toolbarVisible && (
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
                  const res = await fetch('/api/inbox/approve-all', { method: 'POST' });
                  if (res.ok) {
                    const result = await res.json();
                    showToast('success', 'Approved all', `${result.count ?? 0} items approved`);
                  }
                } catch {
                  // Silent fail - error handled by UI state
                }
              }}
            />
          </ErrorBoundary>
        )}

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
    </DependencyGate>
  );
}

export default App;
