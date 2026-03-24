import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Theme, Flex } from '@radix-ui/themes';
import { useStore } from './store/store';
import Sidebar from './components/Sidebar';
import LoadingPanel from './components/LoadingPanel';
import { PanelSkeleton } from './components/PanelSkeleton';
import { AsyncBoundary } from './components/AsyncBoundary';
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
import ToastContainer from './components/Toast';
import QuickActions, { QuickActionsRef } from './components/QuickActions';
import { usePanelConfigStore } from './store/panelConfig';
import TourGuide, { useTour } from './components/TourGuide';
import { useFirstTimeUser } from './hooks/useFirstTimeUser';
import OnboardingFlow, { QuickTips, useOnboardingFlow } from './components/OnboardingFlow';
import NetworkStatus from './components/NetworkStatus';
import { DependencyGate } from './components/DependencyGate';
import { useKeyboardShortcuts, useChordShortcuts } from './lib/useKeyboardShortcuts';

// ─── Lazy-loaded overlays — only downloaded when first rendered ───────────────
// Splitting these into separate async chunks reduces initial JS parse cost and
// lowers Lighthouse "unused JS" bytes on first page load.
const CommandPalette    = dynamic(() => import('./components/CommandPalette'),    { ssr: false });
const GlobalSearch      = dynamic(() => import('./components/GlobalSearch'),      { ssr: false });
const KeyboardShortcuts = dynamic(() => import('./components/KeyboardShortcuts'), { ssr: false });
const ShortcutsModal    = dynamic(() => import('./components/ShortcutsModal'),    { ssr: false });
const HelpPanel         = dynamic(() => import('./components/HelpPanel'),         { ssr: false });
const MorningBrief      = dynamic(() => import('./components/MorningBrief'),      { ssr: false });
const ContactModal      = dynamic(() => import('./components/ContactModal'),      { ssr: false });
const SkillModal        = dynamic(() => import('./components/SkillModal'),        { ssr: false });
const EditPanelsModal   = dynamic(() => import('./components/EditPanelsModal'),   { ssr: false });

// OnboardingWizard is shown to every first-time user immediately on mount.
// Preloading the chunk at module-eval time means it's already downloading when
// useFirstTimeUser fires setShowOnboardingWizard(true), eliminating the sequential
// chunk-download → render waterfall that was gating LCP on first load.
const _onboardingWizardPreload = import('./components/OnboardingWizard');
const OnboardingWizard = dynamic(() => _onboardingWizardPreload, { ssr: false });

// View IDs are dynamic — any registered view ID is valid
type View = string;

function App() {
  // Radix Theme appearance — syncs with the existing theme toggle system
  const [radixAppearance, setRadixAppearance] = useState<'dark' | 'light'>('dark');
  // Radix Theme scaling — user-configurable in settings
  const [radixScaling, setRadixScaling] = useState<'90%' | '95%' | '100%' | '105%' | '110%'>('95%');

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
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [, setSidebarWidth] = useState(208); // Track sidebar width for sidebar positioning
  const quickActionsRef = useRef<QuickActionsRef>(null);
  const { activeTour, completeTour, skipTour, startTour, startPlatformTour, hasCompletedTour } = useTour();
  const { showOnboardingWizard, completeOnboarding, skipOnboarding } = useFirstTimeUser(startTour, hasCompletedTour);
  const { showFlow: showOnboardingFlow, showTips, completeFlow, completeTips, restartOnboarding } = useOnboardingFlow();
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

  // Apply saved theme on startup — surface/text colors are handled by the
  // .radix-themes CSS bridge, so we only need to sync the Radix appearance prop.
  useEffect(() => {
    const saved = safeStorage.getItem('mission-control-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        const theme = settings.theme || 'dark';
        // Load UI scaling preference
        if (settings.uiScaling && ['90%','95%','100%','105%','110%'].includes(settings.uiScaling)) {
          setRadixScaling(settings.uiScaling as '90%' | '95%' | '100%' | '105%' | '110%');
        }

        const actualTheme: 'dark' | 'light' = theme === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : theme;

        const root = document.documentElement;
        // Clear any stale inline vars from old sessions, let .radix-themes bridge take over
        const bridgeVars = [
          '--mission-control-bg', '--mission-control-surface', '--mission-control-border',
          '--mission-control-text', '--mission-control-text-dim',
          '--mission-control-accent', '--mission-control-accent-dim',
          '--mission-control-bg-alt', '--mission-control-bg0', '--mission-control-card',
        ];
        bridgeVars.forEach(v => root.style.removeProperty(v));

        root.classList.remove('dark', 'light');
        root.classList.add(actualTheme);
        setRadixAppearance(actualTheme === 'light' ? 'light' : 'dark');
      } catch (_e) {
        // '[App] Failed to apply saved theme'
      }
    }
  }, []);

  // Listen for theme change events from settings panel / themeToggle utility
  useEffect(() => {
    const handler = (e: Event) => {
      const { theme } = (e as CustomEvent).detail ?? {};
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.classList.remove('dark', 'light');
        document.documentElement.classList.add(theme);
        setRadixAppearance(theme);
      }
    };
    window.addEventListener('themeChange', handler);
    return () => window.removeEventListener('themeChange', handler);
  }, []);

  // Listen for scaling change events from settings panel
  useEffect(() => {
    const handler = (e: Event) => {
      const { scaling } = (e as CustomEvent).detail ?? {};
      if (scaling && ['90%','95%','100%','105%','110%'].includes(scaling)) {
        setRadixScaling(scaling);
      }
    };
    window.addEventListener('radixScalingChange', handler);
    return () => window.removeEventListener('radixScalingChange', handler);
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

  // Listen for restart-onboarding event dispatched from SettingsPanel
  useEffect(() => {
    const handleRestartOnboarding = () => {
      restartOnboarding();
    };
    window.addEventListener('restart-onboarding', handleRestartOnboarding);
    return () => window.removeEventListener('restart-onboarding', handleRestartOnboarding);
  }, [restartOnboarding]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Theme toggle - ⌘⇧D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const newTheme = toggleTheme(); // dispatches themeChange event → handled above
        showToast('success', 'Theme Changed', `Switched to ${getThemeDisplayName(newTheme)}`);
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

      // Bare-key shortcuts — only when not in a text input
      const inInput = (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.contentEditable === 'true');
      if (!inInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // ? → keyboard shortcuts modal
        if (e.key === '?') {
          e.preventDefault();
          setShortcutsOpen(prev => !prev);
          return;
        }
        // N → new task (navigate to kanban + dispatch a create-task event)
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setCurrentView('kanban');
          setTimeout(() => window.dispatchEvent(new CustomEvent('kanban:new-task')), 100);
          return;
        }
      }

      // Escape to close any open overlay
      if (e.key === 'Escape') {
        if (commandPaletteOpen) { setCommandPaletteOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (shortcutsModalOpen) { setShortcutsModalOpen(false); return; }
        if (helpPanelOpen) { setHelpPanelOpen(false); return; }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, searchOpen, shortcutsOpen, shortcutsModalOpen, helpPanelOpen, toggleMuted]);

  // ---------------------------------------------------------------------------
  // Map-based global shortcuts via useKeyboardShortcuts
  // useCallback keeps references stable so the effect dependency is stable.
  // ---------------------------------------------------------------------------
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const openNewTask = useCallback(() => {
    setCurrentView('kanban');
    setTimeout(() => window.dispatchEvent(new CustomEvent('kanban:new-task')), 100);
  }, []);
  const openShortcutsModal = useCallback(() => setShortcutsModalOpen(prev => !prev), []);

  useKeyboardShortcuts({
    // Global search — slash (bare key) mirrors ⌘K
    '/': openSearch,
    // New task via ⌘N
    'cmd+n': openNewTask,
    // Shortcuts help modal via ? (bare key only — the existing handler covers ⌘?)
    '?': openShortcutsModal,
  });

  // g-chord navigation shortcuts
  const navDashboard  = useCallback(() => setCurrentView('dashboard'), []);
  const navKanban     = useCallback(() => setCurrentView('kanban'), []);
  const navProjects   = useCallback(() => setCurrentView('projects'), []);
  const navAgents     = useCallback(() => setCurrentView('agents'), []);
  const navChat       = useCallback(() => setCurrentView('chat'), []);

  useChordShortcuts({
    d: navDashboard,
    t: navKanban,
    p: navProjects,
    a: navAgents,
    c: navChat,
  });

  return (
    <Theme
      appearance={radixAppearance}
      accentColor="violet"
      grayColor="mauve"
      radius="full"
      scaling={radixScaling}
      panelBackground="translucent"
    >
    <DependencyGate>
    <ErrorBoundary panelName="Application Root">
      {/* Global background — Radix accent gradient, fixed behind all content */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
        <svg width="100%" height="100%" viewBox="0 0 2560 1920" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3 }}>
          <g filter="url(#bg-blur)">
            <path d="M-119.809 -1055.99L859.027 -684.98C915.435 -663.6 955.626 -624.994 968.519 -579.807L1129.49 -15.6245L1860.47 -241.727C1919.02 -259.836 1985.68 -257.939 2042.09 -236.559L3020.93 134.453C3124.79 173.822 3164.97 266.777 3110.66 342.073L2850.06 703.385C2827.36 734.857 2790.34 759.666 2745.28 773.604L1467.45 1168.86L1748.58 2154.16C1758.67 2189.52 1751.28 2226.32 1727.72 2258.12L1361.75 2752.01L203.258 2312.91C146.85 2291.53 106.659 2252.92 93.7664 2207.73L-67.2076 1643.55L-798.184 1869.65C-856.73 1887.76 -923.398 1885.87 -979.806 1864.48L-2138.3 1425.38L-1787.63 925.687C-1765.05 893.507 -1727.57 868.111 -1681.77 853.942L-405.167 459.07L-686.568 -527.183C-696.491 -561.961 -689.511 -598.157 -666.811 -629.629L-406.21 -990.941C-351.902 -1066.24 -223.676 -1095.36 -119.809 -1055.99Z" fill="url(#bg-grad-0)"/>
            <path d="M885.9 -99.2158L1864.74 271.796C1921.14 293.177 1961.34 331.783 1974.23 376.97L2135.2 941.152L2866.18 715.049C2924.72 696.94 2991.39 698.837 3047.8 720.218L4026.64 1091.23C4130.5 1130.6 4170.68 1223.55 4116.37 1298.85L3855.77 1660.16C3833.07 1691.63 3796.05 1716.44 3750.99 1730.38L2473.16 2125.63L2754.29 3110.94C2764.38 3146.29 2756.99 3183.09 2733.43 3214.9L2367.46 3708.79L1208.97 3269.68C1152.56 3248.3 1112.37 3209.7 1099.48 3164.51C816.824 2173.87 747.087 1929.46 319.141 429.593C309.218 394.815 316.198 358.619 338.898 327.147L599.499 -34.1647C653.807 -109.461 782.033 -138.585 885.9 -99.2158Z" fill="url(#bg-grad-1)"/>
            <path d="M1597.13 169.784L2575.97 540.796C2632.38 562.177 2672.57 600.783 2685.46 645.97L2846.44 1210.15L3577.41 984.049C3635.96 965.94 3702.63 967.837 3759.03 989.218L4737.87 1360.23C4841.74 1399.6 4881.91 1492.55 4827.61 1567.85L4567 1929.16C4544.3 1960.63 4507.28 1985.44 4462.22 1999.38L3184.4 2394.63L3465.53 3379.94C3475.61 3415.29 3468.23 3452.09 3444.66 3483.9L3078.69 3977.79L1920.2 3538.68C1863.79 3517.3 1823.6 3478.7 1810.71 3433.51L1649.74 2869.33L918.759 3095.43C860.213 3113.54 793.545 3111.64 737.138 3090.26L-421.356 2651.15L-70.6875 2151.46C-48.1049 2119.28 -10.63 2093.89 35.1782 2079.72L1311.78 1684.85L1030.38 698.593C1020.45 663.815 1027.43 627.619 1050.13 596.147L1310.73 234.835C1365.04 159.539 1493.27 130.415 1597.13 169.784Z" fill="url(#bg-grad-2)"/>
            <path d="M2395.71 -658.308L3374.55 -287.296C3430.96 -265.915 3471.15 -227.309 3484.04 -182.122L3645.01 382.06L4375.99 155.958C4434.54 137.848 4501.2 139.745 4557.61 161.126L5536.45 532.138C5640.32 571.507 5680.49 664.461 5626.18 739.757L5365.58 1101.07C5342.88 1132.54 5305.86 1157.35 5260.8 1171.29L3982.97 1566.54L4264.1 2551.84C4274.19 2587.2 4266.81 2624 4243.24 2655.81L3877.27 3149.7L2718.78 2710.59C2662.37 2689.21 2622.18 2650.6 2609.29 2605.42L2448.31 2041.24L1717.34 2267.34C1658.79 2285.45 1592.12 2283.55 1535.72 2262.17L377.222 1823.06L727.891 1323.37C750.473 1291.19 787.948 1265.8 833.756 1251.63L2110.35 856.754L1828.95 -129.498C1819.03 -164.277 1826.01 -200.472 1848.71 -231.944L2109.31 -593.257C2163.62 -668.552 2291.85 -697.677 2395.71 -658.308Z" fill="url(#bg-grad-3)"/>
            <path d="M3059.26 767.932L3310.25 1618.16C3324.72 1667.15 3315.74 1727.88 3285.79 1783.6L2911.89 2479.3L3514.51 2558.36C3562.77 2564.69 3599.15 2596.78 3613.62 2645.77L3864.61 3496C3891.25 3586.22 3837.41 3706.98 3744.37 3765.74L3297.91 4047.66C3259.03 4072.22 3217.48 4082.97 3180.34 4078.1L2126.89 3939.89L1473.9 5154.88C1450.47 5198.48 1415.9 5235.81 1376.24 5260.35L760.412 5641.34L463.348 4635.06C448.884 4586.06 457.863 4525.33 487.81 4469.61L861.713 3773.92L259.094 3694.86C210.828 3688.53 174.448 3656.44 159.984 3607.44L-137.08 2601.17L474.823 2206.89C514.228 2181.5 556.514 2170.3 594.278 2175.25L1646.71 2313.32L2300.33 1097.17C2323.38 1054.28 2357.22 1017.43 2396.11 992.876L2842.57 710.953C2935.61 652.202 3032.62 677.712 3059.26 767.932Z" fill="url(#bg-grad-4)"/>
          </g>
          <defs>
            <filter id="bg-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="90"/>
            </filter>
            <radialGradient id="bg-grad-0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(-804.109 -2036.8) rotate(64.9401) scale(6436.87 6304.81)">
              <stop stopColor="var(--color-background)"/><stop offset="0.0833333" stopColor="var(--accent-9)"/><stop offset="0.364583" stopColor="var(--accent-8)"/><stop offset="0.658041" stopColor="var(--color-background)"/><stop offset="0.798521" stopColor="var(--accent-10)"/><stop offset="0.942708" stopColor="var(--color-background)"/><stop offset="1" stopColor="var(--color-background)"/>
            </radialGradient>
            <radialGradient id="bg-grad-1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(201.6 -1080.02) rotate(64.9401) scale(6436.87 6304.81)">
              <stop stopColor="var(--color-background)"/><stop offset="0.0833333" stopColor="var(--accent-7)"/><stop offset="0.333803" stopColor="var(--accent-9)"/><stop offset="0.658041" stopColor="var(--color-background)"/><stop offset="0.798521" stopColor="var(--accent-8)"/><stop offset="0.942708" stopColor="var(--color-background)"/><stop offset="1" stopColor="var(--color-background)"/>
            </radialGradient>
            <radialGradient id="bg-grad-2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(912.834 -811.021) rotate(64.9401) scale(6436.87 6304.81)">
              <stop stopColor="var(--color-background)"/><stop offset="0.140625" stopColor="var(--accent-8)"/><stop offset="0.333803" stopColor="var(--accent-10)"/><stop offset="0.658041" stopColor="var(--color-background)"/><stop offset="0.798521" stopColor="var(--accent-9)"/><stop offset="0.942708" stopColor="var(--color-background)"/><stop offset="1" stopColor="var(--color-background)"/>
            </radialGradient>
            <radialGradient id="bg-grad-3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1711.41 -1639.11) rotate(64.9401) scale(6436.87 6304.81)">
              <stop stopColor="var(--color-background)"/><stop offset="0.0833333" stopColor="var(--accent-9)"/><stop offset="0.333803" stopColor="var(--accent-7)"/><stop offset="0.658041" stopColor="var(--color-background)"/><stop offset="0.798521" stopColor="var(--accent-10)"/><stop offset="0.942708" stopColor="var(--color-background)"/><stop offset="1" stopColor="var(--color-background)"/>
            </radialGradient>
            <radialGradient id="bg-grad-4" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(3479.06 -623.459) rotate(113.028) scale(8332.26 4870.62)">
              <stop stopColor="var(--color-background)"/><stop offset="0.0833333" stopColor="var(--accent-8)"/><stop offset="0.333803" stopColor="var(--accent-9)"/><stop offset="0.658041" stopColor="var(--color-background)"/><stop offset="0.798521" stopColor="var(--accent-10)"/><stop offset="0.942708" stopColor="var(--color-background)"/><stop offset="1" stopColor="var(--color-background)"/>
            </radialGradient>
          </defs>
        </svg>
      </div>

      {/* Network Status Indicator */}
      <NetworkStatus />

      {/* Skip navigation link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-mission-control-accent focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-mission-control-accent focus:ring-offset-2"
      >
        Skip to main content
      </a>

      <Flex height="100vh">
        {/* TopBar removed */}

        {/* Sidebar */}
        <ErrorBoundary panelName="Sidebar">
          <Sidebar
            currentView={currentView}
            onNavigate={setCurrentView}
            onOpenHelp={() => setHelpPanelOpen(true)}
            onWidthChange={setSidebarWidth}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenShortcuts={() => setShortcutsModalOpen(true)}
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
            <AsyncBoundary componentName={currentView} key={currentView}>
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
            </AsyncBoundary>
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

        {/* Keyboard Shortcuts Help (full reference — ⌘?) */}
        <ErrorBoundary panelName="Keyboard Shortcuts">
          <KeyboardShortcuts isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </ErrorBoundary>

        {/* Shortcuts Modal — compact quick-reference (? bare key or sidebar keyboard button) */}
        <ErrorBoundary panelName="Shortcuts Modal">
          <ShortcutsModal isOpen={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />
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

        {/* OnboardingFlow disabled — OnboardingWizard is the real setup wizard */}

        {/* Quick Tips (post-onboarding tooltip sequence) */}
        {showTips && (
          <ErrorBoundary panelName="Quick Tips">
            <QuickTips onDone={completeTips} />
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
      </Flex>
    </ErrorBoundary>
    </DependencyGate>
    </Theme>
  );
}

export default App;
