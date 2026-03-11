import { useState, useEffect, useRef } from 'react';
import { Settings, Bell, Moon, Sun, Palette, Save, Check, RefreshCw, Shield, Link as LinkIcon, Download, Upload, Type, Keyboard, Monitor, Database, Key, Activity, Map, Package, AlertCircle, ArrowUpCircle, Terminal, Loader2 } from 'lucide-react';
import { useUserSettings } from '../store/userSettings';
import { settingsApi, updateApi } from '../lib/api';
import { showToast } from './Toast';
import SecuritySettings from './SecuritySettings';
import ConnectedAccountsPanel from './ConnectedAccountsPanel';
import ExportBackupTab from './ExportBackupTab';
import GlobalNotificationSettings from './GlobalNotificationSettings';
import AccessibilitySettings from './AccessibilitySettings';
import { Toggle } from './Toggle';

interface NotificationPreferences {
  enabled: boolean;
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
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  fontFamily: string;
  fontSize: number;
  defaultPanel: string;
  notifications: NotificationPreferences;
  // Automation settings
  externalActionsEnabled: boolean;
  // API Keys
  geminiApiKey: string;
}

const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'inbox', name: 'Inbox', description: 'Navigate to Inbox', defaultKey: '1', currentKey: '1', modifiers: ['cmd'] },
  { id: 'dashboard', name: 'Dashboard', description: 'Navigate to Dashboard', defaultKey: '2', currentKey: '2', modifiers: ['cmd'] },
  { id: 'analytics', name: 'Analytics', description: 'Navigate to Analytics', defaultKey: '3', currentKey: '3', modifiers: ['cmd'] },
  { id: 'kanban', name: 'Tasks', description: 'Navigate to Tasks', defaultKey: '4', currentKey: '4', modifiers: ['cmd'] },
  { id: 'agents', name: 'Agents', description: 'Navigate to Agents', defaultKey: '5', currentKey: '5', modifiers: ['cmd'] },
  { id: 'twitter', name: 'Social Media', description: 'Navigate to Social Media', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
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
  theme: 'dark',
  accentColor: '#22c55e',
  fontFamily: 'system',
  fontSize: 14,
  defaultPanel: 'dashboard',
  notifications: { enabled: true },
  externalActionsEnabled: false,
  geminiApiKey: '',
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
  
  // Generate accent-dim (slightly darker)
  const hex = accentColor.replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
  root.style.setProperty('--mission-control-accent-dim', `rgb(${r}, ${g}, ${b})`);

  // Apply font family
  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    'roboto-mono': '"Roboto Mono", Consolas, Monaco, "Courier New", monospace',
    'sf-pro': '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  };
  root.style.setProperty('--mission-control-font', fontMap[fontFamily] || fontMap.system);
  root.style.setProperty('--mission-control-font-size', `${fontSize}px`);
}

type Tab = 'general' | 'appearance' | 'accessibility' | 'notifications' | 'shortcuts' | 'security' | 'automation' | 'accounts' | 'exportBackup' | 'platform';

interface SystemHealth { cli: boolean; database: boolean; backend: string; }

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-mission-control-text-dim">{label}</span>
      <span className={`font-mono text-xs ${ok === false ? 'text-error' : ok === true ? 'text-success' : 'text-mission-control-text-dim'}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Platform Update Tab
// ─────────────────────────────────────────────
function PlatformUpdateTab() {
  const [versionInfo, setVersionInfo] = useState<{ current: string; latest: string | null; updateAvailable: boolean; releaseNotes: string | null; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [updateDone, setUpdateDone] = useState<{ success: boolean; message: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const checkVersion = async () => {
    setChecking(true);
    try {
      const data = await updateApi.check();
      setVersionInfo(data);
    } catch {
      setVersionInfo({ current: 'unknown', latest: null, updateAvailable: false, releaseNotes: null, error: 'Could not reach npm registry' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { checkVersion(); }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const handleUpdate = async () => {
    setUpdating(true);
    setLog([]);
    setUpdateDone(null);

    try {
      const res = await fetch('/api/update', { method: 'POST' });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.done) {
              setUpdateDone({ success: evt.success, message: evt.message });
              if (evt.success) {
                // Reload after 3 seconds if PM2 restarted
                if (evt.message.includes('reload')) {
                  setTimeout(() => window.location.reload(), 3000);
                }
                checkVersion();
              }
            } else if (evt.line !== undefined) {
              setLog(prev => [...prev, evt.line]);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err: any) {
      setUpdateDone({ success: false, message: err.message });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Version Card */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-mission-control-text flex items-center gap-2">
            <Package size={16} />
            Platform Updates
          </h2>
          <button
            onClick={checkVersion}
            disabled={checking}
            className="text-xs text-mission-control-text-dim hover:text-mission-control-accent flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking...' : 'Check now'}
          </button>
        </div>

        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
          {/* Current version */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-mission-control-text-dim">Installed version</span>
            <span className="font-mono text-mission-control-text">
              {versionInfo ? `v${versionInfo.current}` : '—'}
            </span>
          </div>

          {/* Latest version */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-mission-control-text-dim">Latest version</span>
            <span className="font-mono text-mission-control-text">
              {checking ? (
                <span className="text-mission-control-text-dim">checking...</span>
              ) : versionInfo?.latest ? (
                `v${versionInfo.latest}`
              ) : (
                <span className="text-mission-control-text-dim">unavailable</span>
              )}
            </span>
          </div>

          {/* Status banner */}
          {versionInfo && !checking && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mt-1 ${
              versionInfo.error
                ? 'bg-warning-subtle text-warning border border-warning/20'
                : versionInfo.updateAvailable
                  ? 'bg-info-subtle text-info border border-info/20'
                  : 'bg-success-subtle text-success border border-success/20'
            }`}>
              {versionInfo.error ? (
                <><AlertCircle size={14} /> Registry unavailable — {versionInfo.error}</>
              ) : versionInfo.updateAvailable ? (
                <><ArrowUpCircle size={14} /> v{versionInfo.latest} is available</>
              ) : (
                <><Check size={14} /> Up to date</>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Release notes */}
      {versionInfo?.updateAvailable && versionInfo.releaseNotes && (
        <section>
          <h3 className="text-sm font-medium text-mission-control-text mb-2 flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-info" />
            What's in v{versionInfo.latest}
          </h3>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 max-h-48 overflow-y-auto">
            <pre className="text-xs text-mission-control-text-dim whitespace-pre-wrap font-sans leading-5">
              {versionInfo.releaseNotes}
            </pre>
          </div>
        </section>
      )}

      {/* Update button */}
      {versionInfo?.updateAvailable && !updateDone?.success && (
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="w-full flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium"
        >
          {updating ? (
            <><Loader2 size={16} className="animate-spin" /> Updating...</>
          ) : (
            <><ArrowUpCircle size={16} /> Update to v{versionInfo.latest}</>
          )}
        </button>
      )}

      {/* Live log */}
      {(updating || log.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-mission-control-text-dim" />
            <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">Install log</span>
          </div>
          <div
            ref={logRef}
            className="bg-black rounded-xl border border-mission-control-border p-3 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5"
          >
            {log.map((line, i) => (
              <div key={i} className="leading-5">{line || '\u00a0'}</div>
            ))}
            {updating && (
              <div className="flex items-center gap-1 text-mission-control-text-dim">
                <Loader2 size={10} className="animate-spin" />
                <span>running...</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Result banner */}
      {updateDone && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
          updateDone.success
            ? 'bg-success-subtle border-success/20 text-success'
            : 'bg-error-subtle border-error/20 text-error'
        }`}>
          {updateDone.success
            ? <Check size={16} className="mt-0.5 shrink-0" />
            : <AlertCircle size={16} className="mt-0.5 shrink-0" />
          }
          <span>{updateDone.message}</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem('mission-control-settings');
    const parsed = saved ? JSON.parse(saved) : {};
    // Exclude geminiApiKey from localStorage — it lives in DB only
    const { geminiApiKey: _ignored, ...rest } = parsed;
    return { ...defaultSettings, ...rest };
  });
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme on mount and when settings change
  useEffect(() => {
    applyTheme(settings.theme, settings.accentColor, settings.fontFamily, settings.fontSize);
  }, [settings.theme, settings.accentColor, settings.fontFamily, settings.fontSize]);

  // Load live system health
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(data => setHealth(data)).catch(() => {});
    fetch('/api/agents').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAgentCount(data.length);
    }).catch(() => {});
  }, []);

  // Load Gemini key from DB on mount (never from localStorage)
  useEffect(() => {
    settingsApi.get('gemini_api_key').then(result => {
      if (result?.value) setSettings(s => ({ ...s, geminiApiKey: result.value }));
    }).catch(() => { /* non-critical */ });
  }, []);

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
    // Exclude geminiApiKey from localStorage — save it to DB only
    const { geminiApiKey, ...settingsWithoutKey } = settings;
    localStorage.setItem('mission-control-settings', JSON.stringify(settingsWithoutKey));

    // Save Gemini key to DB (server-side only, never in localStorage)
    if (geminiApiKey) {
      try { await settingsApi.set('gemini_api_key', geminiApiKey); } catch { /* non-critical */ }
    }

    // Save automation settings via API
    try {
      await settingsApi.set('automation', {
        externalActionsEnabled: settings.externalActionsEnabled,
      });
    } catch (e) {
      // Settings API save failed — localStorage save above still applies
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    showToast('success', 'Settings saved', 'Your preferences have been updated');
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('mission-control-settings');
    showToast('info', 'Settings reset', 'All settings restored to defaults');
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mission-control-settings-${new Date().toISOString().split('T')[0]}.json`;
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


  return (
    <div className="h-full overflow-auto p-4">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-heading-2 mb-2 flex items-center gap-2">
            <Settings size={24} /> Settings
          </h1>
          <p className="text-secondary">Configure Mission Control dashboard preferences</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-mission-control-border overflow-x-auto">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'appearance'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Palette size={16} />
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('accessibility')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'accessibility'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Type size={16} />
            Accessibility
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Bell size={16} />
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'shortcuts'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Keyboard size={16} />
            Shortcuts
          </button>
          <button
            onClick={() => setActiveTab('accounts')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'accounts'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <LinkIcon size={16} />
            Google Workspace
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'security'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Shield size={16} />
            Security
          </button>
          <button
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'automation'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            Automation
          </button>
          <button
            onClick={() => setActiveTab('exportBackup')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'exportBackup'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Database size={16} />
            Export & Backup
          </button>
          <button
            onClick={() => setActiveTab('platform')}
            className={`px-4 py-2 border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'platform'
                ? 'border-mission-control-accent text-mission-control-accent'
                : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Package size={16} />
            Platform
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'accounts' && <ConnectedAccountsPanel />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'accessibility' && <AccessibilitySettings />}
        {activeTab === 'exportBackup' && <ExportBackupTab />}
        {activeTab === 'platform' && <PlatformUpdateTab />}
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Live System Status */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-heading-3 flex items-center gap-2">
                  <Activity size={16} /> System Status
                </h2>
                <button
                  onClick={() => {
                    setHealth(null);
                    setAgentCount(null);
                    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {});
                    fetch('/api/agents').then(r => r.json()).then(d => { if (Array.isArray(d)) setAgentCount(d.length); }).catch(() => {});
                  }}
                  className="text-xs text-mission-control-text-dim hover:text-mission-control-accent flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-2 text-sm">
                <StatusRow label="Claude CLI" value={health ? (health.cli ? 'Ready' : 'Not found') : '…'} ok={health?.cli} />
                <StatusRow label="Database" value={health ? (health.database ? 'Connected' : 'Missing') : '…'} ok={health?.database} />
                <StatusRow label="MCP Servers" value="mission-control-db · memory" ok={true} />
                <StatusRow label="Agents" value={agentCount !== null ? `${agentCount} registered` : '…'} ok={agentCount !== null && agentCount > 0} />
                <StatusRow label="Hooks" value="approval · review-gate · session-sync · precompact" ok={true} />
                <StatusRow label="Vault" value="~/mission-control/memory/" ok={true} />
                <StatusRow label="Library" value="~/mission-control/library/" ok={true} />
              </div>
            </section>

            {/* Default Panel */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Monitor size={16} /> Startup
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="default-panel" className="block text-sm text-mission-control-text-dim mb-2">Default Panel on Startup</label>
                  <select
                    id="default-panel"
                    value={settings.defaultPanel}
                    onChange={(e) => setSettings(s => ({ ...s, defaultPanel: e.target.value }))}
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent"
                  >
                    <option value="dashboard">Dashboard</option>
                    <option value="inbox">Inbox</option>
                    <option value="comms">Communications</option>
                    <option value="analytics">Analytics</option>
                    <option value="kanban">Tasks (Kanban)</option>
                    <option value="agents">Agents</option>
                    <option value="twitter">Social Media</option>
                    <option value="voice">Voice</option>
                    <option value="chat">Chat</option>
                  </select>
                  <p className="text-xs text-mission-control-text-dim mt-1">This panel will open when you launch the app</p>
                </div>
              </div>
            </section>

            {/* Navigation */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Monitor size={16} /> Navigation
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Collapsed Sidebar</div>
                    <div className="text-sm text-mission-control-text-dim">Show sidebar as icon only</div>
                  </div>
                  <Toggle
                    checked={localStorage.getItem('sidebarExpanded') === 'false'}
                    onChange={(checked) => {
                      localStorage.setItem('sidebarExpanded', String(!checked));
                      window.dispatchEvent(new Event('sidebarStateChange'));
                    }}
                    colorScheme="green"
                  />
                </div>
              </div>
            </section>

            {/* API Keys */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Key size={16} /> API Keys
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="gemini-api-key" className="block text-sm font-medium mb-1">
                    Google Gemini API Key
                  </label>
                  <p className="text-xs text-mission-control-text-dim mb-2">Required for voice chat, meeting transcription, and PDF extraction</p>
                  <input
                    id="gemini-api-key"
                    type="password"
                    value={settings.geminiApiKey}
                    onChange={(e) => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))}
                    placeholder="AIza..."
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent font-mono text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Export/Import */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Download size={16} /> Backup & Restore
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div className="flex gap-3">
                  <button
                    onClick={handleExport}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
                  >
                    <Download size={16} />
                    Export Settings
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
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
                <p className="text-xs text-mission-control-text-dim">
                  Export your settings to backup or transfer to another device
                </p>
              </div>
            </section>

            {/* Platform Tour */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Map size={16} /> Platform Tour
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                <p className="text-sm text-mission-control-text-dim">
                  Re-launch the 8-stop guided tour to explore Dashboard, Tasks, Agents, Inbox, Memory, Library, Analytics, and Settings.
                </p>
                <button
                  onClick={() => window.dispatchEvent(new Event('restart-platform-tour'))}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                >
                  <Map size={14} />
                  Restart Tour
                </button>
              </div>
            </section>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            {/* Theme */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Moon size={16} /> Theme
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="color-mode" className="block text-sm text-mission-control-text-dim mb-2">Color Mode</label>
                  <div className="flex gap-2">
                    {(['dark', 'light', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSettings(s => ({ ...s, theme: t }))}
                        className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                          settings.theme === t 
                            ? 'border-mission-control-accent bg-mission-control-accent/20 text-mission-control-accent' 
                            : 'border-mission-control-border hover:border-mission-control-accent/50'
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
                  <label htmlFor="accent-color" className="block text-sm text-mission-control-text-dim mb-2">Accent Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'].map((color) => (
                      <button
                        key={color}
                        onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                          settings.accentColor === color ? 'border-white dark:border-white/80 scale-110' : 'border-transparent'
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
                    className="mt-3 w-full h-10 rounded-lg border border-mission-control-border cursor-pointer"
                  />
                </div>
              </div>
            </section>

            {/* Typography */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Type size={16} /> Typography
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="font-family-select" className="block text-sm text-mission-control-text-dim mb-2">Font Family</label>
                  <select
                    id="font-family-select"
                    value={settings.fontFamily}
                    onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                    className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent"
                  >
                    <option value="system">System Default</option>
                    <option value="inter">Inter</option>
                    <option value="roboto-mono">Roboto Mono (Monospace)</option>
                    <option value="sf-pro">SF Pro Display</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="font-size" className="block text-sm text-mission-control-text-dim mb-2">
                    Font Size: {settings.fontSize}px
                  </label>
                  <input
                    id="font-size"
                    type="range"
                    min="12"
                    max="18"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
                    <span>Small (12px)</span>
                    <span>Medium (14px)</span>
                    <span>Large (18px)</span>
                  </div>
                </div>
                <div className="mt-4 p-4 bg-mission-control-bg rounded-lg border border-mission-control-border">
                  <p className="mb-2" style={{ fontSize: `${settings.fontSize}px` }}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                  <p className="text-xs text-mission-control-text-dim">Preview of current font settings</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <GlobalNotificationSettings />
          </div>
        )}

        {/* KEYBOARD SHORTCUTS TAB */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Keyboard size={16} /> Keyboard Shortcuts
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-1">
                {defaultKeyboardShortcuts.map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between py-2.5 border-b border-mission-control-border last:border-0">
                    <div>
                      <div className="font-medium text-sm">{shortcut.name}</div>
                      <div className="text-xs text-mission-control-text-dim">{shortcut.description}</div>
                    </div>
                    <kbd className="px-3 py-1 bg-mission-control-bg border border-mission-control-border rounded text-sm font-mono text-mission-control-text-dim">
                      {shortcut.modifiers.map(m => m === 'cmd' ? '⌘' : m === 'shift' ? '⇧' : m === 'alt' ? '⌥' : '⌃').join('')}
                      {shortcut.currentKey.toUpperCase()}
                    </kbd>
                  </div>
                ))}
                <p className="pt-3 text-xs text-mission-control-text-dim">⌘ = Command &nbsp;·&nbsp; ⇧ = Shift &nbsp;·&nbsp; ⌥ = Option &nbsp;·&nbsp; ⌃ = Control</p>
              </div>
            </section>
          </div>
        )}

        {/* AUTOMATION TAB */}
        {activeTab === 'automation' && (
          <div className="space-y-6">
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Settings size={16} /> Automation
              </h2>
              <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                {/* External Actions kill switch */}
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
                    <div className="text-sm text-mission-control-text-dim">
                      {settings.externalActionsEnabled
                        ? 'Approved agent actions (emails, posts) will execute'
                        : 'All external actions blocked — agents can plan but not execute'}
                    </div>
                  </div>
                  <Toggle
                    checked={settings.externalActionsEnabled}
                    onChange={(checked) => setSettings(s => ({ ...s, externalActionsEnabled: checked }))}
                    colorScheme="green"
                  />
                </div>

                {/* Info */}
                <div className="p-4 bg-info-subtle border border-info-border rounded-lg text-sm text-info space-y-2">
                  <div className="font-medium flex items-center gap-2">
                    <Shield size={14} /> Approval Gate
                  </div>
                  <p>Agents call <code className="text-xs bg-black/20 px-1 rounded">approval_create</code> before any external action. The Approvals panel lets you review and approve or reject each one before it executes.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Actions (shown for most tabs except special ones) */}
        {!['security', 'accounts', 'config', 'logs', 'exportBackup', 'platform'].includes(activeTab) && (
          <div className="flex gap-3 mt-8">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-mission-control-border text-mission-control-text-dim rounded-xl hover:bg-mission-control-border/80 transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
