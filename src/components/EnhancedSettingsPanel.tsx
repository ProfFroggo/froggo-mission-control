import { useState, useEffect, useRef } from 'react';
import { 
  Settings, Wifi, Volume2, Bell, Moon, Sun, Palette, Save, RotateCcw, Check, Trash2, RefreshCw, AlertTriangle, Shield, 
  Link as LinkIcon, Download, Upload, Type, Keyboard, Monitor, Search,
  ChevronDown, ChevronRight, Info, Zap, Code, Eye, HardDrive, Cpu, Play, Archive
} from 'lucide-react';
import { useStore } from '../store/store';
import { useUserSettings } from '../store/userSettings';
import { reconnectGateway } from '../lib/gateway';
import { showToast } from './Toast';
import { safeStorage } from '../utils/safeStorage';
import SecuritySettings from './SecuritySettings';
import ConnectedAccountsPanel from './ConnectedAccountsPanel';
import ConfigTab from './ConfigTab';
import LogsTab from './LogsTab';
import GlobalNotificationSettings from './GlobalNotificationSettings';
import { Toggle } from './Toggle';

interface NotificationPreferences {
  taskUpdates: boolean;
  agentMessages: boolean;
  approvalRequests: boolean;
  systemAlerts: boolean;
  emailNotifications: boolean;
  discordNotifications: boolean;
  telegramNotifications: boolean;
  soundEnabled: boolean;
}

interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  defaultKey: string;
  currentKey: string;
  modifiers: ('cmd' | 'ctrl' | 'shift' | 'alt')[];
}

interface PerformanceSettings {
  enableCache: boolean;
  cacheSize: number; // MB
  maxConcurrentRequests: number;
  enableLazyLoading: boolean;
  animationsEnabled: boolean;
  enableVirtualization: boolean;
}

interface DataSettings {
  retentionDays: number;
  autoCleanup: boolean;
  maxLogSize: number; // MB
  enableAnalytics: boolean;
}

interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
  keyboardNavigationHints: boolean;
}

interface DeveloperSettings {
  devMode: boolean;
  showDebugInfo: boolean;
  enableExperimentalFeatures: boolean;
  verboseLogging: boolean;
  showPerformanceMetrics: boolean;
}

interface WindowSettings {
  launchOnStartup: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  alwaysOnTop: boolean;
  rememberWindowPosition: boolean;
  startMinimized: boolean;
}

interface Settings {
  gatewayUrl: string;
  gatewayToken: string;
  voiceEnabled: boolean;
  voiceSpeed: number;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  autoRefresh: boolean;
  refreshInterval: number;
  defaultPanel: string;
  notifications: NotificationPreferences;
  keyboardShortcuts: KeyboardShortcut[];
  externalActionsEnabled: boolean;
  rateLimitTweets: number;
  rateLimitEmails: number;
  defaultEmailAccount: string;
  defaultCalendarAccount: string;
  performance: PerformanceSettings;
  data: DataSettings;
  accessibility: AccessibilitySettings;
  developer: DeveloperSettings;
  window: WindowSettings;
}

const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'dashboard', name: 'Dashboard', description: 'Navigate to Dashboard', defaultKey: '1', currentKey: '1', modifiers: ['cmd'] },
  { id: 'inbox', name: 'Inbox', description: 'Navigate to Inbox', defaultKey: '2', currentKey: '2', modifiers: ['cmd'] },
  { id: 'comms', name: 'Communications', description: 'Navigate to Comms', defaultKey: '3', currentKey: '3', modifiers: ['cmd'] },
  { id: 'analytics', name: 'Analytics', description: 'Navigate to Analytics', defaultKey: '4', currentKey: '4', modifiers: ['cmd'] },
  { id: 'kanban', name: 'Tasks', description: 'Navigate to Kanban', defaultKey: '5', currentKey: '5', modifiers: ['cmd'] },
  { id: 'agents', name: 'Agents', description: 'Navigate to Agents', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
  { id: 'twitter', name: 'Twitter', description: 'Navigate to Twitter', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
  { id: 'meetings', name: 'Meetings', description: 'Navigate to Meetings', defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
  { id: 'voicechat', name: 'Voice Chat', description: 'Navigate to Voice Chat', defaultKey: '8', currentKey: '8', modifiers: ['cmd'] },
  { id: 'chat', name: 'Chat', description: 'Navigate to Chat', defaultKey: '9', currentKey: '9', modifiers: ['cmd'] },
  { id: 'settings', name: 'Settings', description: 'Open Settings', defaultKey: ',', currentKey: ',', modifiers: ['cmd'] },
  { id: 'commandPalette', name: 'Command Palette', description: 'Open command palette', defaultKey: 'k', currentKey: 'k', modifiers: ['cmd'] },
  { id: 'search', name: 'Search', description: 'Global search', defaultKey: '/', currentKey: '/', modifiers: ['cmd'] },
  { id: 'quickMessage', name: 'Quick Message', description: 'Send quick message', defaultKey: 'm', currentKey: 'm', modifiers: ['cmd', 'shift'] },
  { id: 'starred', name: 'Starred Messages', description: 'View starred messages', defaultKey: 's', currentKey: 's', modifiers: ['cmd', 'shift'] },
];

const defaultSettings: Settings = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayToken: '',
  voiceEnabled: true,
  voiceSpeed: 1.0,
  notificationsEnabled: true,
  theme: 'dark',
  accentColor: '#22c55e',
  fontFamily: 'system',
  fontSize: 14,
  autoRefresh: true,
  refreshInterval: 30,
  defaultPanel: 'dashboard',
  notifications: {
    taskUpdates: true,
    agentMessages: true,
    approvalRequests: true,
    systemAlerts: true,
    emailNotifications: false,
    discordNotifications: false,
    telegramNotifications: false,
    soundEnabled: true,
  },
  keyboardShortcuts: defaultKeyboardShortcuts,
  externalActionsEnabled: false,
  rateLimitTweets: 10,
  rateLimitEmails: 20,
  defaultEmailAccount: useUserSettings.getState().email,
  defaultCalendarAccount: useUserSettings.getState().emailAccounts[0]?.email || '',
  performance: {
    enableCache: true,
    cacheSize: 100,
    maxConcurrentRequests: 10,
    enableLazyLoading: true,
    animationsEnabled: true,
    enableVirtualization: true,
  },
  data: {
    retentionDays: 90,
    autoCleanup: true,
    maxLogSize: 50,
    enableAnalytics: true,
  },
  accessibility: {
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    screenReaderOptimized: false,
    keyboardNavigationHints: true,
  },
  developer: {
    devMode: false,
    showDebugInfo: false,
    enableExperimentalFeatures: false,
    verboseLogging: false,
    showPerformanceMetrics: false,
  },
  window: {
    launchOnStartup: false,
    minimizeToTray: true,
    closeToTray: false,
    alwaysOnTop: false,
    rememberWindowPosition: true,
    startMinimized: false,
  },
};

// Apply theme and accent color to document
function applyTheme(theme: 'dark' | 'light' | 'system', accentColor: string, fontFamily: string, fontSize: number) {
  const root = document.documentElement;
  
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  root.classList.remove('dark', 'light');
  root.classList.add(actualTheme);
  
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
  
  root.style.setProperty('--clawd-accent', accentColor);
  
  const hex = accentColor.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
  root.style.setProperty('--clawd-accent-dim', `rgb(${r}, ${g}, ${b})`);

  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    'roboto-mono': '"Roboto Mono", Consolas, Monaco, "Courier New", monospace',
    'sf-pro': '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  };
  root.style.setProperty('--clawd-font', fontMap[fontFamily] || fontMap.system);
  root.style.setProperty('--clawd-font-size', `${fontSize}px`);
}

type Tab = 'general' | 'appearance' | 'notifications' | 'shortcuts' | 'security' | 'automation' | 'accounts' | 'config' | 'logs' | 'performance' | 'data' | 'accessibility' | 'developer' | 'window';

// Collapsible section component
interface SectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  description?: string;
}

function CollapsibleSection({ title, icon, children, defaultOpen = true, description }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between mb-3 group"
      >
        <h2 className="text-lg font-medium flex items-center gap-2 group-hover:text-clawd-accent transition-colors">
          {icon}
          {title}
        </h2>
        {isOpen ? <ChevronDown size={16} className="text-clawd-text-dim" /> : <ChevronRight size={16} className="text-clawd-text-dim" />}
      </button>
      {description && (
        <p className="text-sm text-clawd-text-dim mb-3">{description}</p>
      )}
      {isOpen && (
        <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
          {children}
        </div>
      )}
    </section>
  );
}

// Tooltip component
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-clawd-text-dim hover:text-clawd-accent transition-colors"
      >
        <Info size={14} />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-clawd-bg border border-clawd-border rounded-lg shadow-lg text-xs whitespace-nowrap">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-clawd-border" />
        </div>
      )}
    </div>
  );
}

export default function EnhancedSettingsPanel() {
  const { connected } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = safeStorage.getItem('froggo-settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (_e) {
        // Ignore malformed saved settings, fall back to defaults
      }
    }
    return defaultSettings;
  });
  const [saved, setSaved] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor, settings.fontFamily, settings.fontSize);
  }, [settings.theme, settings.accentColor, settings.fontFamily, settings.fontSize]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (settings.theme === 'system') {
        applyTheme('system', settings.accentColor, settings.fontFamily, settings.fontSize);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme, settings.accentColor, settings.fontFamily, settings.fontSize]);

  const handleSave = async () => {
    safeStorage.setItem('froggo-settings', JSON.stringify(settings));

    try {
      await window.clawdbot?.settings?.save({
        externalActionsEnabled: settings.externalActionsEnabled,
        rateLimitTweets: settings.rateLimitTweets,
        rateLimitEmails: settings.rateLimitEmails,
        defaultEmailAccount: settings.defaultEmailAccount,
        defaultCalendarAccount: settings.defaultCalendarAccount,
      });
    } catch (e) {
      // '[Settings] Failed to save automation settings:', e;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2002);
    showToast('success', 'Settings saved', 'Your preferences have been updated');

    reconnectGateway();
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings(defaultSettings);
      safeStorage.removeItem('froggo-settings');
      showToast('info', 'Settings reset', 'All settings restored to defaults');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `froggo-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Settings exported', 'Download started');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setSettings({ ...defaultSettings, ...imported });
        showToast('success', 'Settings imported', 'Your preferences have been restored');
      } catch (_error) {
        showToast('error', 'Import failed', 'Invalid settings file');
      }
    };
    reader.readAsText(file);
  };

  const handleShortcutEdit = (id: string, key: string) => {
    setSettings(s => ({
      ...s,
      keyboardShortcuts: s.keyboardShortcuts.map(sc =>
        sc.id === id ? { ...sc, currentKey: key } : sc
      )
    }));
    setEditingShortcut(null);
  };

  const resetShortcuts = () => {
    setSettings(s => ({
      ...s,
      keyboardShortcuts: defaultKeyboardShortcuts
    }));
    showToast('info', 'Shortcuts reset', 'All keyboard shortcuts restored to defaults');
  };

  const applyPreset = (preset: 'minimal' | 'default' | 'poweruser') => {
    const presets = {
      minimal: {
        ...settings,
        performance: {
          enableCache: false,
          cacheSize: 50,
          maxConcurrentRequests: 5,
          enableLazyLoading: false,
          animationsEnabled: false,
          enableVirtualization: false,
        },
        autoRefresh: false,
        notifications: { ...settings.notifications, soundEnabled: false },
      },
      default: defaultSettings,
      poweruser: {
        ...settings,
        performance: {
          enableCache: true,
          cacheSize: 200,
          maxConcurrentRequests: 20,
          enableLazyLoading: true,
          animationsEnabled: true,
          enableVirtualization: true,
        },
        autoRefresh: true,
        refreshInterval: 10,
        developer: {
          devMode: true,
          showDebugInfo: true,
          enableExperimentalFeatures: true,
          verboseLogging: false,
          showPerformanceMetrics: true,
        },
      },
    };

    setSettings(presets[preset]);
    showToast('success', `${preset.charAt(0).toUpperCase() + preset.slice(1)} preset applied`, 'Settings updated');
  };

  // Filter settings based on search
  const settingsMatch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const clearCache = async () => {
    if (confirm('Clear all cached data? This may slow down the app temporarily.')) {
      try {
        // Clear localStorage cache entries
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('cache-')) {
            safeStorage.removeItem(key);
          }
        });
        showToast('success', 'Cache cleared', 'Cached data has been removed');
      } catch (_e) {
        showToast('error', 'Failed to clear cache', 'An error occurred');
      }
    }
  };

  const cleanupOldData = async () => {
    if (confirm(`Remove data older than ${settings.data.retentionDays} days?`)) {
      try {
        // This would call backend cleanup
        showToast('info', 'Cleanup started', 'Old data is being removed...');
      } catch (_e) {
        showToast('error', 'Cleanup failed', 'An error occurred');
      }
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-8xl mx-auto">
        {/* Header with Search */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
                <Settings size={24} /> Settings
              </h1>
              <p className="text-clawd-text-dim">Configure Froggo dashboard preferences</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  saved 
                    ? 'bg-success-subtle text-success' 
                    : 'bg-clawd-accent text-white hover:bg-clawd-accent-dim'
                }`}
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
            <input
              type="text"
              placeholder="Search settings..."
              aria-label="Search settings input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-clawd-surface border border-clawd-border rounded-lg focus:outline-none focus:border-clawd-accent"
            />
          </div>

          {/* Setting Presets */}
          {!searchQuery && (
            <div className="mt-4 flex gap-2">
              <span className="text-sm text-clawd-text-dim self-center">Quick presets:</span>
              <button
                onClick={() => applyPreset('minimal')}
                className="px-3 py-1 text-sm bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
              >
                Minimal
              </button>
              <button
                onClick={() => applyPreset('default')}
                className="px-3 py-1 text-sm bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
              >
                Default
              </button>
              <button
                onClick={() => applyPreset('poweruser')}
                className="px-3 py-1 text-sm bg-clawd-surface border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
              >
                Power User
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {!searchQuery && (
          <div className="flex gap-2 mb-6 border-b border-clawd-border overflow-x-auto pb-0">
            {[
              { id: 'general', label: 'General', icon: null },
              { id: 'appearance', label: 'Appearance', icon: <Palette size={14} /> },
              { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
              { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
              { id: 'performance', label: 'Performance', icon: <Cpu size={14} /> },
              { id: 'data', label: 'Data', icon: <HardDrive size={14} /> },
              { id: 'accessibility', label: 'Accessibility', icon: <Eye size={14} /> },
              { id: 'window', label: 'Window', icon: <Monitor size={14} /> },
              { id: 'developer', label: 'Developer', icon: <Code size={14} /> },
              { id: 'automation', label: 'Automation', icon: <Zap size={14} /> },
              { id: 'accounts', label: 'Accounts', icon: <LinkIcon size={14} /> },
              { id: 'security', label: 'Security', icon: <Shield size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'border-clawd-accent text-clawd-accent'
                    : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'accounts' && !searchQuery && <ConnectedAccountsPanel />}
        {activeTab === 'security' && !searchQuery && <SecuritySettings />}
        {activeTab === 'config' && !searchQuery && <ConfigTab />}
        {activeTab === 'logs' && !searchQuery && <LogsTab />}
        
        {/* GENERAL TAB */}
        {(activeTab === 'general' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('connection gateway url token') && (
              <CollapsibleSection 
                title="Connection" 
                icon={<Wifi size={16} />}
                description="Configure connection to Clawdbot gateway"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label htmlFor="gateway-url" className="block text-sm text-clawd-text-dim">Gateway URL</label>
                      <Tooltip text="WebSocket endpoint for Clawdbot gateway" />
                    </div>
                    <input
                      id="gateway-url"
                      type="text"
                      aria-label="Gateway URL input"
                      value={settings.gatewayUrl}
                      onChange={(e) => setSettings(s => ({ ...s, gatewayUrl: e.target.value }))}
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label htmlFor="gateway-token" className="block text-sm text-clawd-text-dim">Authentication Token</label>
                      <Tooltip text="Optional token for secured connections" />
                    </div>
                    <input
                      id="gateway-token"
                      type="password"
                      aria-label="Authentication token input"
                      value={settings.gatewayToken}
                      onChange={(e) => setSettings(s => ({ ...s, gatewayToken: e.target.value }))}
                      placeholder="Leave empty to use default"
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-clawd-bg rounded-lg border border-clawd-border">
                    <span className={`w-3 h-3 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
                    <span className="text-sm font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
                    {connected && <span className="text-xs text-clawd-text-dim ml-auto">Active</span>}
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {settingsMatch('startup default panel') && (
              <CollapsibleSection 
                title="Startup" 
                icon={<Play size={16} />}
                description="Configure app behavior on launch"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="default-panel" className="block text-sm text-clawd-text-dim">Default Panel on Startup</label>
                      <Tooltip text="This panel will open when you launch the app" />
                    </div>
                    <select
                      id="default-panel"
                      aria-label="Default panel on startup select"
                      value={settings.defaultPanel}
                      onChange={(e) => setSettings(s => ({ ...s, defaultPanel: e.target.value }))}
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    >
                      <option value="dashboard">🎯 Dashboard</option>
                      <option value="inbox">📥 Inbox</option>
                      <option value="comms">💬 Communications</option>
                      <option value="analytics">📊 Analytics</option>
                      <option value="kanban">✅ Tasks (Kanban)</option>
                      <option value="agents">🤖 Agents</option>
                      <option value="twitter">🐦 Twitter</option>
                      <option value="voice">🎙️ Voice</option>
                      <option value="chat">💭 Chat</option>
                    </select>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {settingsMatch('voice speech speed audio') && (
              <CollapsibleSection 
                title="Voice" 
                icon={<Volume2 size={16} />}
                description="Text-to-speech and audio settings"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Voice Responses</div>
                      <div className="text-sm text-clawd-text-dim">Read responses aloud</div>
                    </div>
                    <Toggle 
                      checked={settings.voiceEnabled}
                      onChange={(checked) => setSettings(s => ({ ...s, voiceEnabled: checked }))}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="speech-speed" className="block text-sm text-clawd-text-dim">
                        Speech Speed: {settings.voiceSpeed.toFixed(1)}x
                      </label>
                      <Tooltip text="Adjust voice playback speed" />
                    </div>
                    <input
                      id="speech-speed"
                      type="range"
                      aria-label="Speech speed slider"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={settings.voiceSpeed}
                      onChange={(e) => setSettings(s => ({ ...s, voiceSpeed: parseFloat(e.target.value) }))}
                      className="w-full"
                      disabled={!settings.voiceEnabled}
                    />
                    <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                      <span>0.5x (Slow)</span>
                      <span>1.0x (Normal)</span>
                      <span>2.0x (Fast)</span>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {settingsMatch('refresh auto update interval data') && (
              <CollapsibleSection 
                title="Data Refresh" 
                icon={<RefreshCw size={16} />}
                description="Automatic data refresh settings"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto Refresh</div>
                      <div className="text-sm text-clawd-text-dim">Automatically refresh sessions list</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, autoRefresh: !s.autoRefresh }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.autoRefresh ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.autoRefresh ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  {settings.autoRefresh && (
                    <div>
                      <label className="block text-sm text-clawd-text-dim mb-2">
                        Refresh Interval: {settings.refreshInterval}s
                      </label>
                      <input
                        type="range"
                        aria-label="Refresh interval slider"
                        min="10"
                        max="120"
                        step="10"
                        value={settings.refreshInterval}
                        onChange={(e) => setSettings(s => ({ ...s, refreshInterval: parseInt(e.target.value) }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                        <span>10s (Fast)</span>
                        <span>30s (Balanced)</span>
                        <span>120s (Slow)</span>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {settingsMatch('export import backup restore settings') && (
              <CollapsibleSection 
                title="Backup & Restore" 
                icon={<Download size={16} />}
                description="Export or import your settings"
              >
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <button
                      onClick={handleExport}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
                    >
                      <Download size={16} />
                      Export Settings
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-bg border border-clawd-border rounded-lg hover:border-clawd-accent transition-colors"
                    >
                      <Upload size={16} />
                      Import Settings
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-clawd-text-dim">
                    Export your settings to backup or transfer to another device
                  </p>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* APPEARANCE TAB */}
        {(activeTab === 'appearance' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('theme dark light color mode') && (
              <CollapsibleSection 
                title="Theme" 
                icon={<Moon size={16} />}
                description="Customize app appearance and colors"
              >
                <div className="space-y-4">
                  <div>
                    <label htmlFor="color-mode-select" className="block text-sm text-clawd-text-dim mb-2">Color Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['dark', 'light', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setSettings(s => {
                              const newSettings = { ...s, theme: t };
                              // Apply theme immediately
                              applyTheme(t, s.accentColor, s.fontFamily, s.fontSize);
                              // Save to localStorage immediately
                              safeStorage.setItem('froggo-settings', JSON.stringify(newSettings));
                              return newSettings;
                            });
                          }}
                          className={`py-3 px-4 rounded-lg border transition-colors ${
                            settings.theme === t 
                              ? 'border-clawd-accent bg-clawd-accent/20 text-clawd-accent' 
                              : 'border-clawd-border hover:border-clawd-accent/50'
                          }`}
                        >
                          {t === 'dark' && <Moon size={16} className="inline mr-2" />}
                          {t === 'light' && <Sun size={16} className="inline mr-2" />}
                          {t === 'system' && <Monitor size={16} className="inline mr-2" />}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="accent-color-picker" className="block text-sm text-clawd-text-dim mb-2">Accent Color</label>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                          className={`w-12 h-12 rounded-full border-2 transition-transform hover:scale-110 ${
                            settings.accentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Accent color ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="custom-accent-color" className="text-sm text-clawd-text-dim">Custom:</label>
                      <input
                        id="custom-accent-color"
                        type="color"
                        aria-label="Custom accent color picker"
                        value={settings.accentColor}
                        onChange={(e) => setSettings(s => ({ ...s, accentColor: e.target.value }))}
                        className="h-10 w-20 rounded-lg border border-clawd-border cursor-pointer"
                      />
                      <span className="text-sm font-mono text-clawd-text-dim">{settings.accentColor}</span>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {settingsMatch('typography font family size text') && (
              <CollapsibleSection 
                title="Typography" 
                icon={<Type size={16} />}
                description="Font settings and text size"
              >
                <div className="space-y-4">
                  <div>
                    <label htmlFor="font-family" className="block text-sm text-clawd-text-dim mb-2">Font Family</label>
                    <select
                      id="font-family"
                      aria-label="Font family select"
                      value={settings.fontFamily}
                      onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                      className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                    >
                      <option value="system">System Default</option>
                      <option value="inter">Inter</option>
                      <option value="roboto-mono">Roboto Mono (Monospace)</option>
                      <option value="sf-pro">SF Pro Display</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-clawd-text-dim mb-2">
                      Font Size: {settings.fontSize}px
                    </label>
                    <input
                      type="range"
                      aria-label="Font size slider"
                      min="12"
                      max="18"
                      step="1"
                      value={settings.fontSize}
                      onChange={(e) => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                      <span>Small (12px)</span>
                      <span>Medium (14px)</span>
                      <span>Large (18px)</span>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-clawd-bg rounded-lg border border-clawd-border">
                    <p className="mb-2" style={{ fontSize: `${settings.fontSize}px` }}>
                      The quick brown fox jumps over the lazy dog
                    </p>
                    <p className="text-xs text-clawd-text-dim">Preview of current font settings</p>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {(activeTab === 'notifications' || searchQuery) && !searchQuery && (
          <div className="space-y-6">
            <GlobalNotificationSettings />
          </div>
        )}

        {/* KEYBOARD SHORTCUTS TAB */}
        {(activeTab === 'shortcuts' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('keyboard shortcuts hotkeys') && (
              <CollapsibleSection 
                title="Keyboard Shortcuts" 
                icon={<Keyboard size={16} />}
                description="Customize keyboard shortcuts for quick navigation"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-clawd-text-dim">Click any shortcut to edit</span>
                    <button
                      onClick={resetShortcuts}
                      className="text-sm text-clawd-text-dim hover:text-clawd-accent transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={14} />
                      Reset to Defaults
                    </button>
                  </div>
                  {settings.keyboardShortcuts.map((shortcut) => (
                    <div key={shortcut.id} className="flex items-center justify-between py-3 border-b border-clawd-border last:border-0">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{shortcut.name}</div>
                        <div className="text-xs text-clawd-text-dim">{shortcut.description}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingShortcut === shortcut.id ? (
                          <input
                            type="text"
                            aria-label={`Edit keyboard shortcut for ${shortcut.name}`}
                            value={shortcut.currentKey}
                            onChange={(e) => handleShortcutEdit(shortcut.id, e.target.value)}
                            onBlur={() => setEditingShortcut(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingShortcut(null);
                              else if (e.key === 'Escape') {
                                handleShortcutEdit(shortcut.id, shortcut.defaultKey);
                                setEditingShortcut(null);
                              }
                            }}
                            className="w-24 px-2 py-1 text-center bg-clawd-bg border border-clawd-accent rounded text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingShortcut(shortcut.id)}
                            className="px-3 py-1.5 bg-clawd-bg border border-clawd-border rounded text-sm font-mono hover:border-clawd-accent transition-colors"
                          >
                            {shortcut.modifiers.map(m => m === 'cmd' ? '⌘' : m === 'shift' ? '⇧' : m === 'alt' ? '⌥' : '⌃').join('')}
                            {shortcut.currentKey.toUpperCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 text-xs text-clawd-text-dim space-y-1">
                    <p>• Press Enter to save or Escape to cancel</p>
                    <p>• ⌘ = Command • ⇧ = Shift • ⌥ = Option • ⌃ = Control</p>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* PERFORMANCE TAB */}
        {(activeTab === 'performance' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('performance cache speed optimization') && (
              <CollapsibleSection 
                title="Performance & Optimization" 
                icon={<Cpu size={16} />}
                description="Adjust performance settings for better speed"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Enable Caching</div>
                      <div className="text-sm text-clawd-text-dim">Cache responses for faster loading</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, performance: { ...s.performance, enableCache: !s.performance.enableCache } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.performance.enableCache ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.performance.enableCache ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {settings.performance.enableCache && (
                    <div>
                      <label className="block text-sm text-clawd-text-dim mb-2">
                        Cache Size: {settings.performance.cacheSize} MB
                      </label>
                      <input
                        type="range"
                        aria-label="Cache size slider"
                        min="50"
                        max="500"
                        step="50"
                        value={settings.performance.cacheSize}
                        onChange={(e) => setSettings(s => ({ ...s, performance: { ...s.performance, cacheSize: parseInt(e.target.value) } }))}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                        <span>50 MB</span>
                        <span>500 MB</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-clawd-text-dim mb-2">
                      Max Concurrent Requests: {settings.performance.maxConcurrentRequests}
                    </label>
                    <input
                      type="range"
                      aria-label="Max concurrent requests slider"
                      min="5"
                      max="30"
                      step="5"
                      value={settings.performance.maxConcurrentRequests}
                      onChange={(e) => setSettings(s => ({ ...s, performance: { ...s.performance, maxConcurrentRequests: parseInt(e.target.value) } }))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Lazy Loading</div>
                      <div className="text-sm text-clawd-text-dim">Load content as needed</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, performance: { ...s.performance, enableLazyLoading: !s.performance.enableLazyLoading } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.performance.enableLazyLoading ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.performance.enableLazyLoading ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Animations</div>
                      <div className="text-sm text-clawd-text-dim">Enable UI animations</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, performance: { ...s.performance, animationsEnabled: !s.performance.animationsEnabled } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.performance.animationsEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.performance.animationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">List Virtualization</div>
                      <div className="text-sm text-clawd-text-dim">Render only visible items in long lists</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, performance: { ...s.performance, enableVirtualization: !s.performance.enableVirtualization } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.performance.enableVirtualization ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.performance.enableVirtualization ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <button
                    onClick={clearCache}
                    className="w-full py-2 bg-warning-subtle text-warning rounded-lg hover:bg-warning-subtle transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Clear Cache Now
                  </button>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* DATA TAB */}
        {(activeTab === 'data' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('data retention cleanup storage logs') && (
              <CollapsibleSection 
                title="Data Management" 
                icon={<HardDrive size={16} />}
                description="Control data retention and storage"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="block text-sm text-clawd-text-dim">
                        Data Retention: {settings.data.retentionDays} days
                      </label>
                      <Tooltip text="Data older than this will be automatically deleted" />
                    </div>
                    <input
                      type="range"
                      aria-label="Data retention days slider"
                      min="30"
                      max="365"
                      step="30"
                      value={settings.data.retentionDays}
                      onChange={(e) => setSettings(s => ({ ...s, data: { ...s.data, retentionDays: parseInt(e.target.value) } }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-clawd-text-dim mt-1">
                      <span>30 days</span>
                      <span>180 days</span>
                      <span>1 year</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto Cleanup</div>
                      <div className="text-sm text-clawd-text-dim">Automatically delete old data</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, data: { ...s.data, autoCleanup: !s.data.autoCleanup } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.data.autoCleanup ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.data.autoCleanup ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm text-clawd-text-dim mb-2">
                      Max Log File Size: {settings.data.maxLogSize} MB
                    </label>
                    <input
                      type="range"
                      aria-label="Max log file size slider"
                      min="10"
                      max="500"
                      step="10"
                      value={settings.data.maxLogSize}
                      onChange={(e) => setSettings(s => ({ ...s, data: { ...s.data, maxLogSize: parseInt(e.target.value) } }))}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Usage Analytics</div>
                      <div className="text-sm text-clawd-text-dim">Collect anonymous usage data</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, data: { ...s.data, enableAnalytics: !s.data.enableAnalytics } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.data.enableAnalytics ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.data.enableAnalytics ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <button
                    onClick={cleanupOldData}
                    className="w-full py-2 bg-warning-subtle text-warning rounded-lg hover:bg-warning-subtle transition-colors flex items-center justify-center gap-2"
                  >
                    <Archive size={16} />
                    Cleanup Old Data Now
                  </button>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* ACCESSIBILITY TAB */}
        {(activeTab === 'accessibility' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('accessibility motion contrast text screen reader') && (
              <CollapsibleSection 
                title="Accessibility" 
                icon={<Eye size={16} />}
                description="Make the app more accessible"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Reduce Motion</div>
                      <div className="text-sm text-clawd-text-dim">Minimize animations and transitions</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, reduceMotion: !s.accessibility.reduceMotion } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.accessibility.reduceMotion ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.accessibility.reduceMotion ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">High Contrast</div>
                      <div className="text-sm text-clawd-text-dim">Increase color contrast</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, highContrast: !s.accessibility.highContrast } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.accessibility.highContrast ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.accessibility.highContrast ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Large Text</div>
                      <div className="text-sm text-clawd-text-dim">Use larger text sizes throughout</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, largeText: !s.accessibility.largeText } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.accessibility.largeText ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.accessibility.largeText ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Screen Reader Optimized</div>
                      <div className="text-sm text-clawd-text-dim">Optimize for screen readers</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, screenReaderOptimized: !s.accessibility.screenReaderOptimized } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.accessibility.screenReaderOptimized ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.accessibility.screenReaderOptimized ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Keyboard Navigation Hints</div>
                      <div className="text-sm text-clawd-text-dim">Show keyboard shortcuts in UI</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, keyboardNavigationHints: !s.accessibility.keyboardNavigationHints } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.accessibility.keyboardNavigationHints ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.accessibility.keyboardNavigationHints ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* WINDOW TAB */}
        {(activeTab === 'window' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('window startup tray minimize close') && (
              <CollapsibleSection 
                title="Window Behavior" 
                icon={<Monitor size={16} />}
                description="Configure window and startup behavior"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Launch on Startup</div>
                      <div className="text-sm text-clawd-text-dim">Start app when you log in</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, launchOnStartup: !s.window.launchOnStartup } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.launchOnStartup ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.launchOnStartup ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Start Minimized</div>
                      <div className="text-sm text-clawd-text-dim">Launch app minimized to tray</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, startMinimized: !s.window.startMinimized } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.startMinimized ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.startMinimized ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Minimize to Tray</div>
                      <div className="text-sm text-clawd-text-dim">Minimize to system tray instead of taskbar</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, minimizeToTray: !s.window.minimizeToTray } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.minimizeToTray ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.minimizeToTray ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Close to Tray</div>
                      <div className="text-sm text-clawd-text-dim">Keep app running in background when closed</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, closeToTray: !s.window.closeToTray } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.closeToTray ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.closeToTray ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Always on Top</div>
                      <div className="text-sm text-clawd-text-dim">Keep window above other windows</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, alwaysOnTop: !s.window.alwaysOnTop } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.alwaysOnTop ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.alwaysOnTop ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Remember Window Position</div>
                      <div className="text-sm text-clawd-text-dim">Restore window position on launch</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, window: { ...s.window, rememberWindowPosition: !s.window.rememberWindowPosition } }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.window.rememberWindowPosition ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.window.rememberWindowPosition ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* DEVELOPER TAB */}
        {(activeTab === 'developer' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('developer debug experimental features logging') && (
              <CollapsibleSection 
                title="Developer Options" 
                icon={<Code size={16} />}
                description="Advanced settings for developers"
              >
                <div className="space-y-4">
                  <div className="p-3 bg-warning-subtle border border-warning-border rounded-lg flex items-start gap-2">
                    <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-warning">
                      These settings are for advanced users. Changing them may affect app stability.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Developer Mode</div>
                      <div className="text-sm text-clawd-text-dim">Enable developer features</div>
                    </div>
                    <Toggle
                      checked={settings.developer.devMode}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, devMode: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Show Debug Info</div>
                      <div className="text-sm text-clawd-text-dim">Display debug information in UI</div>
                    </div>
                    <Toggle
                      checked={settings.developer.showDebugInfo}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, showDebugInfo: checked } }))}
                      disabled={!settings.developer.devMode}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Experimental Features</div>
                      <div className="text-sm text-clawd-text-dim">Enable features in development</div>
                    </div>
                    <Toggle
                      checked={settings.developer.enableExperimentalFeatures}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, enableExperimentalFeatures: checked } }))}
                      disabled={!settings.developer.devMode}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Verbose Logging</div>
                      <div className="text-sm text-clawd-text-dim">Enable detailed console logs</div>
                    </div>
                    <Toggle
                      checked={settings.developer.verboseLogging}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, verboseLogging: checked } }))}
                      disabled={!settings.developer.devMode}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Performance Metrics</div>
                      <div className="text-sm text-clawd-text-dim">Show render times and stats</div>
                    </div>
                    <Toggle
                      checked={settings.developer.showPerformanceMetrics}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, showPerformanceMetrics: checked } }))}
                      disabled={!settings.developer.devMode}
                    />
                  </div>
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* AUTOMATION TAB */}
        {(activeTab === 'automation' || searchQuery) && (
          <div className="space-y-6">
            {settingsMatch('automation external actions tweets emails rate limit') && (
              <CollapsibleSection 
                title="Automation & External Actions" 
                icon={<Zap size={16} />}
                description="Control automated external actions"
              >
                <div className="space-y-4">
                  <div className="p-3 bg-error-subtle border border-error-border rounded-lg flex items-start gap-2">
                    <AlertTriangle size={16} className="text-error flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-error">
                      These settings control real external actions (tweets, emails, etc.). Use with caution.
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-clawd-bg rounded-lg border-2 border-clawd-border">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Kill Switch
                        {settings.externalActionsEnabled ? (
                          <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded font-bold">LIVE</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded font-bold">BLOCKED</span>
                        )}
                      </div>
                      <div className="text-sm text-clawd-text-dim">
                        {settings.externalActionsEnabled 
                          ? 'External actions will be executed when approved' 
                          : 'All external actions blocked (safe mode)'}
                      </div>
                    </div>
                    <Toggle 
                      checked={settings.externalActionsEnabled}
                      onChange={(checked) => setSettings(s => ({ ...s, externalActionsEnabled: checked }))}
                      size="lg"
                      colorScheme="red"
                    />
                  </div>

                  {settings.externalActionsEnabled && (
                    <>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="block text-sm text-clawd-text-dim">
                            Tweet Rate Limit: {settings.rateLimitTweets}/hour
                          </label>
                          <Tooltip text="Maximum tweets per hour to prevent spam" />
                        </div>
                        <input
                          type="range"
                          aria-label="Tweet rate limit slider"
                          min="1"
                          max="30"
                          step="1"
                          value={settings.rateLimitTweets}
                          onChange={(e) => setSettings(s => ({ ...s, rateLimitTweets: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="block text-sm text-clawd-text-dim">
                            Email Rate Limit: {settings.rateLimitEmails}/hour
                          </label>
                          <Tooltip text="Maximum emails per hour to prevent spam" />
                        </div>
                        <input
                          type="range"
                          aria-label="Email rate limit slider"
                          min="1"
                          max="50"
                          step="1"
                          value={settings.rateLimitEmails}
                          onChange={(e) => setSettings(s => ({ ...s, rateLimitEmails: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">🤖</span>
                          <div className="flex-1">
                            <div className="font-medium text-info mb-2">Smart Account Selection</div>
                            <div className="text-sm text-info space-y-2">
                              <p>Froggo intelligently chooses accounts based on context:</p>
                              <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                                <li>Reply-to matching for email threads</li>
                                <li>Calendar selection based on invite</li>
                                <li>No manual account configuration needed</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleSection>
            )}
          </div>
        )}

        {/* Actions */}
        {!['security', 'accounts', 'config', 'logs', 'exportBackup'].includes(activeTab) && (
          <div className="flex gap-3 mt-8 sticky bottom-0 bg-clawd-bg/95 backdrop-blur-sm pt-4 pb-2 border-t border-clawd-border">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Reset All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
