import { useState, useEffect } from 'react';
import { Settings, Wifi, Volume2, Bell, Moon, Sun, Palette, Save, RotateCcw, Check, Calendar, Plus, Trash2, RefreshCw, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { useStore } from '../store/store';
import { reconnectGateway } from '../lib/gateway';
import { showToast } from './Toast';
import SecuritySettings from './SecuritySettings';

interface Settings {
  gatewayUrl: string;
  gatewayToken: string;
  voiceEnabled: boolean;
  voiceSpeed: number;
  notificationsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  autoRefresh: boolean;
  refreshInterval: number;
  // Automation settings
  externalActionsEnabled: boolean;
  rateLimitTweets: number;
  rateLimitEmails: number;
  defaultEmailAccount: string;
  defaultCalendarAccount: string;
}

const defaultSettings: Settings = {
  gatewayUrl: 'ws://127.0.0.1:18789',
  gatewayToken: '',
  voiceEnabled: true,
  voiceSpeed: 1.0,
  notificationsEnabled: true,
  theme: 'dark',
  accentColor: '#22c55e',
  autoRefresh: true,
  refreshInterval: 30,
  // Automation defaults
  externalActionsEnabled: false,
  rateLimitTweets: 10,
  rateLimitEmails: 20,
  defaultEmailAccount: 'kevin@carbium.io',
  defaultCalendarAccount: 'kevin.macarthur@bitso.com',
};

// Apply theme and accent color to document
function applyTheme(theme: 'dark' | 'light' | 'system', accentColor: string) {
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
}

interface CalendarAccount {
  email: string;
  authenticated: boolean;
  calendarsCount?: number;
  status?: 'connected' | 'error' | 'checking';
}

type Tab = 'general' | 'security' | 'automation';

export default function SettingsPanel() {
  const { connected } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('froggo-settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });
  const [saved, setSaved] = useState(false);
  
  // Calendar accounts state
  const [calendarAccounts, setCalendarAccounts] = useState<CalendarAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [addingAccount, setAddingAccount] = useState(false);

  // Load calendar accounts on mount
  useEffect(() => {
    loadCalendarAccounts();
  }, []);

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor);
  }, [settings.theme, settings.accentColor]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (settings.theme === 'system') {
        applyTheme('system', settings.accentColor);
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme, settings.accentColor]);

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
    
    // Reconnect gateway with new settings
    reconnectGateway();
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('froggo-settings');
  };

  // Load calendar accounts from gog CLI
  const loadCalendarAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const result = await (window as any).clawdbot?.calendar?.listAccounts();
      if (result?.success && result.accounts) {
        setCalendarAccounts(result.accounts);
      } else {
        // Fallback: check known accounts
        const knownAccounts = [
          'kevin.macarthur@bitso.com',
          'kevin@carbium.io',
          'kmacarthur.gpt@gmail.com'
        ];
        
        const accountsStatus = await Promise.all(
          knownAccounts.map(async (email) => {
            try {
              const testResult = await (window as any).clawdbot?.calendar?.testConnection(email);
              return {
                email,
                authenticated: testResult?.success || false,
                calendarsCount: testResult?.calendarsCount,
                status: (testResult?.success ? 'connected' : 'error') as 'connected' | 'error',
              };
            } catch {
              return {
                email,
                authenticated: false,
                status: 'error' as const,
              };
            }
          })
        );
        
        setCalendarAccounts(accountsStatus);
      }
    } catch (e) {
      console.error('Failed to load calendar accounts:', e);
      showToast('error', 'Failed to load accounts', 'Could not fetch calendar accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Add new calendar account
  const handleAddAccount = async () => {
    setAddingAccount(true);
    try {
      const result = await (window as any).clawdbot?.calendar?.addAccount();
      if (result?.success) {
        showToast('success', 'Account added', 'Calendar account authenticated successfully');
        loadCalendarAccounts();
      } else {
        showToast('error', 'Authentication failed', result?.error || 'Could not authenticate account');
      }
    } catch (e: any) {
      showToast('error', 'Authentication failed', e.message || 'Could not authenticate account');
    } finally {
      setAddingAccount(false);
    }
  };

  // Remove calendar account
  const handleRemoveAccount = async (email: string) => {
    if (!confirm(`Remove calendar account ${email}?\n\nThis will revoke access and delete stored credentials.`)) {
      return;
    }

    try {
      const result = await (window as any).clawdbot?.calendar?.removeAccount(email);
      if (result?.success) {
        showToast('success', 'Account removed', `${email} has been removed`);
        loadCalendarAccounts();
      } else {
        showToast('error', 'Failed to remove', result?.error || 'Could not remove account');
      }
    } catch (e: any) {
      showToast('error', 'Failed to remove', e.message || 'Could not remove account');
    }
  };

  // Test account connection
  const handleTestConnection = async (email: string) => {
    setCalendarAccounts(prev =>
      prev.map(acc => acc.email === email ? { ...acc, status: 'checking' as const } : acc)
    );

    try {
      const result = await (window as any).clawdbot?.calendar?.testConnection(email);
      setCalendarAccounts(prev =>
        prev.map(acc =>
          acc.email === email
            ? {
                ...acc,
                status: (result?.success ? 'connected' : 'error') as 'connected' | 'error',
                calendarsCount: result?.calendarsCount,
              }
            : acc
        )
      );

      if (result?.success) {
        showToast('success', 'Connection OK', `${email} is connected (${result.calendarsCount} calendars)`);
      } else {
        showToast('error', 'Connection failed', result?.error || 'Could not connect to account');
      }
    } catch (e: any) {
      setCalendarAccounts(prev =>
        prev.map(acc => acc.email === email ? { ...acc, status: 'error' as const } : acc)
      );
      showToast('error', 'Connection failed', e.message || 'Could not test connection');
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
            <Settings size={24} /> Settings
          </h1>
          <p className="text-clawd-text-dim">Configure Froggo dashboard preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-clawd-border">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 border-b-2 transition-colors flex items-center gap-2 ${
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
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'automation'
                ? 'border-clawd-accent text-clawd-accent'
                : 'border-transparent text-clawd-text-dim hover:text-clawd-text'
            }`}
          >
            Automation
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'security' && <SecuritySettings />}
        
        {activeTab === 'general' && (
          <div className="space-y-8">{/* Existing general settings content */}

        {/* Connection */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Wifi size={18} /> Connection
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Gateway URL</label>
              <input
                type="text"
                value={settings.gatewayUrl}
                onChange={(e) => setSettings(s => ({ ...s, gatewayUrl: e.target.value }))}
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Token (optional)</label>
              <input
                type="password"
                value={settings.gatewayToken}
                onChange={(e) => setSettings(s => ({ ...s, gatewayToken: e.target.value }))}
                placeholder="Leave empty to use default"
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm">{connected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
        </section>

        {/* Voice */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Volume2 size={18} /> Voice
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

        {/* Notifications */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Bell size={18} /> Notifications
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Desktop Notifications</div>
                <div className="text-sm text-clawd-text-dim">Show alerts for important events</div>
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
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Palette size={18} /> Appearance
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">Theme</label>
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
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-2">Accent Color</label>
              <div className="flex gap-2">
                {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      settings.accentColor === color ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <RotateCcw size={18} /> Data
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

        {/* Calendar Accounts */}
        <section>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Calendar size={18} /> Calendar Accounts
          </h2>
          <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-clawd-text-dim">
                Manage Google Calendar account access
              </p>
              <button
                onClick={handleAddAccount}
                disabled={addingAccount}
                className="flex items-center gap-2 px-3 py-1.5 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
                Add Account
              </button>
            </div>

            {loadingAccounts ? (
              <div className="text-center py-8 text-clawd-text-dim">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading accounts...</p>
              </div>
            ) : calendarAccounts.length === 0 ? (
              <div className="text-center py-8 text-clawd-text-dim">
                <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No calendar accounts configured</p>
                <button
                  onClick={handleAddAccount}
                  className="mt-3 text-sm text-clawd-accent hover:underline"
                >
                  Add your first account
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {calendarAccounts.map((account) => (
                  <div
                    key={account.email}
                    className="flex items-center justify-between p-3 bg-clawd-bg rounded-lg border border-clawd-border"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Status Indicator */}
                      {account.status === 'checking' ? (
                        <RefreshCw size={18} className="text-clawd-text-dim animate-spin" />
                      ) : account.status === 'connected' ? (
                        <CheckCircle size={18} className="text-green-400" />
                      ) : (
                        <XCircle size={18} className="text-red-400" />
                      )}

                      {/* Account Info */}
                      <div className="flex-1">
                        <div className="font-medium">{account.email}</div>
                        <div className="text-xs text-clawd-text-dim">
                          {account.status === 'checking'
                            ? 'Testing connection...'
                            : account.status === 'connected'
                            ? `Connected • ${account.calendarsCount || 0} calendars`
                            : 'Not authenticated'}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTestConnection(account.email)}
                        disabled={account.status === 'checking'}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors disabled:opacity-50"
                        title="Test connection"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => handleRemoveAccount(account.email)}
                        className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        title="Remove account"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

          </div>
        )}

        {activeTab === 'automation' && (
          <div className="space-y-8">
        {/* Automation */}
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
                    <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">LIVE</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">BLOCKED</span>
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

            {/* Default Accounts */}
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Default Email Account</label>
              <select
                value={settings.defaultEmailAccount}
                onChange={(e) => setSettings(s => ({ ...s, defaultEmailAccount: e.target.value }))}
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              >
                <option value="kevin@carbium.io">kevin@carbium.io (Carbium)</option>
                <option value="kevin.macarthur@bitso.com">kevin.macarthur@bitso.com (Bitso)</option>
                <option value="kmacarthur.gpt@gmail.com">kmacarthur.gpt@gmail.com (Personal)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-clawd-text-dim mb-1">Default Calendar Account</label>
              <select
                value={settings.defaultCalendarAccount}
                onChange={(e) => setSettings(s => ({ ...s, defaultCalendarAccount: e.target.value }))}
                className="w-full bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 focus:outline-none focus:border-clawd-accent"
              >
                <option value="kevin.macarthur@bitso.com">kevin.macarthur@bitso.com (Bitso)</option>
                <option value="kevin@carbium.io">kevin@carbium.io (Carbium)</option>
              </select>
            </div>
          </div>
        </section>

          </div>
        )}

        {/* Actions (shown for general and automation tabs) */}
        {activeTab !== 'security' && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-clawd-accent text-white rounded-xl hover:bg-clawd-accent-dim transition-colors"
            >
              {saved ? <Check size={18} /> : <Save size={18} />}
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
