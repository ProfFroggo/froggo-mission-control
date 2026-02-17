import { useState, useEffect, useRef } from 'react';
import { Settings, Wifi, Volume2, Bell, Moon, Sun, Palette, Save, RotateCcw, Check, RefreshCw, Shield, Link as LinkIcon, Download, Upload, Type, Keyboard, Monitor, Database } from 'lucide-react';
import { useStore } from '../store/store';
import { useUserSettings } from '../store/userSettings';
import { reconnectGateway } from '../lib/gateway';
import { showToast } from './Toast';
import SecuritySettings from './SecuritySettings';
import ConnectedAccountsPanel from './ConnectedAccountsPanel';
import ConfigTab from './ConfigTab';
import LogsTab from './LogsTab';
import ExportBackupTab from './ExportBackupTab';
import GlobalNotificationSettings from './GlobalNotificationSettings';
import AccessibilitySettings from './AccessibilitySettings';

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
  // Automation settings
  externalActionsEnabled: boolean;
  rateLimitTweets: number;
  rateLimitEmails: number;
  defaultEmailAccount: string;
  defaultCalendarAccount: string;
}

const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'inbox', name: 'Inbox', description: 'Navigate to Inbox', defaultKey: '1', currentKey: '1', modifiers: ['cmd'] },
  { id: 'dashboard', name: 'Dashboard', description: 'Navigate to Dashboard', defaultKey: '2', currentKey: '2', modifiers: ['cmd'] },
  { id: 'analytics', name: 'Analytics', description: 'Navigate to Analytics', defaultKey: '3', currentKey: '3', modifiers: ['cmd'] },
  { id: 'kanban', name: 'Tasks', description: 'Navigate to Tasks', defaultKey: '4', currentKey: '4', modifiers: ['cmd'] },
  { id: 'agents', name: 'Agents', description: 'Navigate to Agents', defaultKey: '5', currentKey: '5', modifiers: ['cmd'] },
  { id: 'twitter', name: 'X / Twitter', description: 'Navigate to X / Twitter', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
  { id: 'meetings', name: 'Meetings', description: 'Navigate to Meetings', defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
  { id: 'voicechat', name: 'Voice Chat', description: 'Navigate to Voice Chat', defaultKey: '8', currentKey: '8', modifiers: ['cmd'] },
  { id: 'accounts', name: 'Accounts', description: 'Navigate to Accounts', defaultKey: '9', currentKey: '9', modifiers: ['cmd'] },
  { id: 'approvals', name: 'Approvals', description: 'Navigate to Approvals', defaultKey: '0', currentKey: '0', modifiers: ['cmd'] },
  { id: 'settings', name: 'Settings', description: 'Open Settings', defaultKey: ',', currentKey: ',', modifiers: ['cmd'] },
  { id: 'commandPalette', name: 'Command Palette', description: 'Open command palette', defaultKey: 'k', currentKey: 'k', modifiers: ['cmd'] },
  { id: 'search', name: 'Search', description: 'Global search', defaultKey: '/', currentKey: '/', modifiers: ['cmd'] },
  { id: 'quickMessage', name: 'Quick Message', description: 'Send quick message', defaultKey: 'm', currentKey: 'm', modifiers: ['cmd', 'shift'] },
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
  // Automation defaults
  externalActionsEnabled: false,
  rateLimitTweets: 10,
  rateLimitEmails: 20,
  defaultEmailAccount: useUserSettings.getState().email,
  defaultCalendarAccount: useUserSettings.getState().emailAccounts[0]?.email || '',
};

// Apply theme and accent color to document
function applyTheme(theme: 'dark' | 'light' | 'system', accentColor: string, fontFamily: string, fontSize: number) {
  const root = document.documentElement;
  
  // Determine actual theme
  let actualTheme = theme;
  if (theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  // Apply theme class
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
  
  // Generate accent-dim (slightly darker)
  const hex = accentColor.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
  root.style.setProperty('--clawd-accent-dim', `rgb(${r}, ${g}, ${b})`);

  // Apply font family
  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    'roboto-mono': '"Roboto Mono", Consolas, Monaco, "Courier New", monospace',
    'sf-pro': '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  };
  root.style.setProperty('--clawd-font', fontMap[fontFamily] || fontMap.system);
  root.style.setProperty('--clawd-font-size', `${fontSize}px`);
}

type Tab = 'general' | 'appearance' | 'accessibility' | 'notifications' | 'shortcuts' | 'security' | 'automation' | 'accounts' | 'config' | 'logs' | 'exportBackup';

export default function SettingsPanel() {
  const { connected } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('froggo-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
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
    localStorage.setItem('froggo-settings', JSON.stringify(settings));
    
    // Save automation settings to config file (for task-helpers.sh)
    try {
      await (window as any).clawdbot?.settings?.save({
        externalActionsEnabled: settings.externalActionsEnabled,
        rateLimitTweets: settings.rateLimitTweets,
        rateLimitEmails: settings.rateLimitEmails,
        defaultEmailAccount: settings.defaultEmailAccount,
        defaultCalendarAccount: settings.defaultCalendarAccount,
      });
    } catch (e) {
      console.error('[Settings] Failed to save automation settings:', e);
    }
    
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    showToast('success', 'Settings saved', 'Your preferences have been updated');
    
    // Reconnect gateway with new settings
    reconnectGateway();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('froggo-settings');
    showToast('info', 'Settings reset', 'All settings restored to defaults');
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

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <Settings size={24} /> Settings
          </h1>
          <p className="text-clawd-text-dim">Configure Froggo dashboard preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-clawd-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'appearance'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Palette size={16} />
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'accessibility'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Type size={16} />
            Accessibility
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Bell size={16} />
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'shortcuts'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Keyboard size={16} />
            Shortcuts
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <LinkIcon size={16} />
            Accounts
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Shield size={16} />
            Security
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'automation'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Automation
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Config
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'logs'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('exportBackup')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'exportBackup'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            <Database size={16} />
            Export & Backup
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'accounts' && <ConnectedAccountsPanel />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'accessibility' && <AccessibilitySettings />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'exportBackup' && <ExportBackupTab />}
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-8">
            {/* Connection */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Wifi size={16} /> Connection
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                <div>
                  <label htmlFor="gateway-url" className="block text-sm text-clawd-text-dim mb-1">Gateway URL</label>
                  <input
                    id="gateway-url"
                    type="text"
                    value={settings.gatewayUrl}
                    onChange={(e) => setSettings(s => ({ ...s, gatewayUrl: e.target.value }))}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div>
                  <label htmlFor="gateway-token" className="block text-sm text-clawd-text-dim mb-1">Token (optional)</label>
                  <input
                    id="gateway-token"
                    type="password"
                    value={settings.gatewayToken}
                    onChange={(e) => setSettings(s => ({ ...s, gatewayToken: e.target.value }))}
                    placeholder="Leave empty to use default"
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-error'}`} />
                  <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
            </section>

            {/* Default Panel */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Monitor size={16} /> Startup
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                <div>
                  <label htmlFor="default-panel" className="block text-sm text-clawd-text-dim mb-2">Default Panel on Startup</label>
                  <select
                    id="default-panel"
                    value={settings.defaultPanel}
                    onChange={(e) => setSettings(s => ({ ...s, defaultPanel: e.target.value }))}
                    className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="inbox">Inbox</option>
                    <option value="comms">Communications</option>
                    <option value="analytics">Analytics</option>
                    <option value="kanban">Tasks (Kanban)</option>
                    <option value="agents">Agents</option>
                    <option value="twitter">Twitter</option>
                    <option value="voice">Voice</option>
                    <option value="chat">Chat</option>
                  </select>
                  <p className="text-xs text-clawd-text-dim mt-1">This panel will open when you launch the app</p>
                </div>
              </div>
            </section>

            {/* Voice */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Volume2 size={16} /> Voice
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Voice Responses</div>
                    <div className="text-sm text-clawd-text-dim">Read responses aloud</div>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, voiceEnabled: !s.voiceEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.voiceEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.voiceEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-2">
                    Speech Speed: {settings.voiceSpeed.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={settings.voiceSpeed}
                    onChange={(e) => setSettings(s => ({ ...s, voiceSpeed: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            </section>

            {/* Data */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <RefreshCw size={16} /> Data Refresh
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
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
                      min="10"
                      max="120"
                      step="10"
                      value={settings.refreshInterval}
                      onChange={(e) => setSettings(s => ({ ...s, refreshInterval: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Export/Import */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Download size={16} /> Backup & Restore
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
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
            </section>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === 'appearance' && (
          <div className="space-y-8">
            {/* Theme */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Moon size={16} /> Theme
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                <div>
                  <label htmlFor="color-mode" className="block text-sm text-clawd-text-dim mb-2">Color Mode</label>
                  <div className="flex gap-2">
                    {(['dark', 'light', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSettings(s => ({ ...s, theme: t }))}
                        className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
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
                  <label htmlFor="accent-color" className="block text-sm text-clawd-text-dim mb-2">Accent Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                          settings.accentColor === color ? 'border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Accent color ${color}`}
                      />
                    ))}
                  </div>
                  <input
                    id="accent-color"
                    type="color"
                    value={settings.accentColor}
                    onChange={(e) => setSettings(s => ({ ...s, accentColor: e.target.value }))}
                    className="mt-3 w-full h-10 rounded-lg border border-clawd-border cursor-pointer"
                  />
                </div>
              </div>
            </section>

            {/* Typography */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Type size={16} /> Typography
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-2">Font Family</label>
                  <select
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
            </section>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-8">
            {/* Global Notification Settings */}
            <section>
              <GlobalNotificationSettings />
            </section>

            {/* Dashboard-specific Notification Preferences */}
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Bell size={16} /> Dashboard Notification Preferences
              </h2>
              <p className="text-sm text-clawd-text-dim mb-4">
                Configure which types of events trigger in-app notifications
              </p>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                {/* Master Toggle */}
                <div className="flex items-center justify-between pb-4 border-b border-clawd-border">
                  <div>
                    <div className="font-medium">Enable Notifications</div>
                    <div className="text-sm text-clawd-text-dim">Master switch for all notifications</div>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, notificationsEnabled: !s.notificationsEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.notificationsEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Notification Types */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-clawd-text-dim">Notification Types</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Task Updates</div>
                      <div className="text-xs text-clawd-text-dim">Status changes, completions, assignments</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, taskUpdates: !s.notifications.taskUpdates }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.taskUpdates ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.taskUpdates ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Agent Messages</div>
                      <div className="text-xs text-clawd-text-dim">Messages from Coder, Writer, Researcher agents</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, agentMessages: !s.notifications.agentMessages }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.agentMessages ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.agentMessages ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Approval Requests</div>
                      <div className="text-xs text-clawd-text-dim">Tweets, emails, calendar events pending approval</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, approvalRequests: !s.notifications.approvalRequests }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.approvalRequests ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.approvalRequests ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">System Alerts</div>
                      <div className="text-xs text-clawd-text-dim">Errors, warnings, important system events</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, systemAlerts: !s.notifications.systemAlerts }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.systemAlerts ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.systemAlerts ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Notification Channels */}
                <div className="space-y-3 pt-4 border-t border-clawd-border">
                  <h3 className="font-medium text-sm text-clawd-text-dim">Notification Channels</h3>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Email Notifications</div>
                      <div className="text-xs text-clawd-text-dim">Send notifications to email (coming soon)</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, emailNotifications: !s.notifications.emailNotifications }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.emailNotifications ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.emailNotifications ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Discord Notifications</div>
                      <div className="text-xs text-clawd-text-dim">Send notifications to Discord (coming soon)</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, discordNotifications: !s.notifications.discordNotifications }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.discordNotifications ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.discordNotifications ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Telegram Notifications</div>
                      <div className="text-xs text-clawd-text-dim">Send notifications to Telegram (coming soon)</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, telegramNotifications: !s.notifications.telegramNotifications }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.telegramNotifications ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.telegramNotifications ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">Notification Sound</div>
                      <div className="text-xs text-clawd-text-dim">Play sound with notifications</div>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ 
                        ...s, 
                        notifications: { ...s.notifications, soundEnabled: !s.notifications.soundEnabled }
                      }))}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        settings.notifications.soundEnabled ? 'bg-clawd-accent' : 'bg-clawd-border'
                      }`}
                      disabled={!settings.notificationsEnabled}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        settings.notifications.soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* KEYBOARD SHORTCUTS TAB */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-8">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <Keyboard size={16} /> Keyboard Shortcuts
                </h2>
                <button
                  onClick={resetShortcuts}
                  className="text-sm text-clawd-text-dim hover:text-clawd-accent transition-colors flex items-center gap-1"
                >
                  <RotateCcw size={14} />
                  Reset to Defaults
                </button>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-2">
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
                          value={shortcut.currentKey}
                          onChange={(e) => handleShortcutEdit(shortcut.id, e.target.value)}
                          onBlur={() => setEditingShortcut(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingShortcut(null);
                            } else if (e.key === 'Escape') {
                              handleShortcutEdit(shortcut.id, shortcut.defaultKey);
                              setEditingShortcut(null);
                            }
                          }}
                          className="w-20 px-2 py-1 text-center bg-clawd-bg border border-clawd-accent rounded text-sm"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingShortcut(shortcut.id)}
                          className="px-3 py-1 bg-clawd-bg border border-clawd-border rounded text-sm font-mono hover:border-clawd-accent transition-colors"
                        >
                          {shortcut.modifiers.map(m => m === 'cmd' ? '⌘' : m === 'shift' ? '⇧' : m === 'alt' ? '⌥' : '⌃').join('')}
                          {shortcut.currentKey.toUpperCase()}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-4 text-xs text-clawd-text-dim">
                  <p>Click on any shortcut to edit it. Press Enter to save or Escape to cancel.</p>
                  <p className="mt-1">⌘ = Command • ⇧ = Shift • ⌥ = Option • ⌃ = Control</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* AUTOMATION TAB */}
        {activeTab === 'automation' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                ⚡ Automation
              </h2>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
                {/* Kill Switch */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      External Actions
                      {settings.externalActionsEnabled ? (
                        <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded">LIVE</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded">BLOCKED</span>
                      )}
                    </div>
                    <div className="text-sm text-clawd-text-dim">
                      {settings.externalActionsEnabled 
                        ? 'Tweets and emails will be sent when approved' 
                        : 'All external actions blocked (safe mode)'}
                    </div>
                  </div>
                  <button
                    onClick={() => setSettings(s => ({ ...s, externalActionsEnabled: !s.externalActionsEnabled }))}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.externalActionsEnabled ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.externalActionsEnabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Rate Limits */}
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-2">
                    Tweet Rate Limit: {settings.rateLimitTweets}/hour
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={settings.rateLimitTweets}
                    onChange={(e) => setSettings(s => ({ ...s, rateLimitTweets: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-clawd-text-dim mb-2">
                    Email Rate Limit: {settings.rateLimitEmails}/hour
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={settings.rateLimitEmails}
                    onChange={(e) => setSettings(s => ({ ...s, rateLimitEmails: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                {/* Smart Account Selection Info */}
                <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">🤖</span>
                    <div className="flex-1">
                      <div className="font-medium text-info mb-2">Smart Account Selection</div>
                      <div className="text-sm text-info space-y-2">
                        <p>No default accounts! Froggo intelligently chooses which account to use based on context:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Email to your address → Reply from that same address</li>
                          <li>Email to work address → Reply from work address</li>
                          <li>Calendar invite on iCloud → Use iCloud calendar</li>
                          <li>Reply-to address matching for email threads</li>
                        </ul>
                        <p className="mt-3 text-xs">
                          View selection rules in Connected Accounts (⌘0)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Actions (shown for most tabs except special ones) */}
        {!['security', 'accounts', 'config', 'logs', 'exportBackup'].includes(activeTab) && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-clawd-border text-clawd-text-dim rounded-xl hover:bg-clawd-border/80 transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
