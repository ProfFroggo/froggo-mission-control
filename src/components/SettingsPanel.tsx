import { useState, useEffect, useRef } from 'react';
import { Settings, Bell, Moon, Sun, Palette, Save, Check, RefreshCw, Shield, Link as LinkIcon, Download, Upload, Type, Keyboard, Monitor, Database, Key, Activity, Map, Package, AlertCircle, ArrowUpCircle, Terminal, Loader2, ChevronDown, ChevronRight, Clock, DollarSign } from 'lucide-react';
import { Button, Flex, Select, TextField } from '@radix-ui/themes';
import PanelHeader from './PanelHeader';
import TabNav from './TabNav';
import { useUserSettings } from '../store/userSettings';
import { settingsApi, updateApi } from '../lib/api';
import { useSettings } from '../hooks/useSettings';
import { showToast } from './Toast';
import SecuritySettings from './SecuritySettings';
import ConnectedAccountsPanel from './ConnectedAccountsPanel';
import ExportBackupTab from './ExportBackupTab';
import GlobalNotificationSettings from './GlobalNotificationSettings';
import AccessibilitySettings from './AccessibilitySettings';
import { Toggle } from './Toggle';
import BudgetDashboard from './BudgetDashboard';

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

type Tab = 'general' | 'appearance' | 'accessibility' | 'notifications' | 'shortcuts' | 'security' | 'automation' | 'accounts' | 'exportBackup' | 'platform' | 'budgets';

interface SystemHealth { cli: boolean; claudeFound: boolean; claudeAuthenticated: boolean; claudePath: string; database: boolean; backend: string; }

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <Flex align="center" justify="between" className="py-1">
      <span className="text-mission-control-text-dim">{label}</span>
      <span className={`font-mono text-xs ${ok === false ? 'text-error' : ok === true ? 'text-success' : 'text-mission-control-text-dim'}`}>
        {value}
      </span>
    </Flex>
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
        <Flex align="center" justify="between" className="mb-4">
          <h2 className="text-base font-semibold text-mission-control-text flex items-center gap-2">
            <Package size={16} />
            Platform Updates
          </h2>
          <Button
            onClick={checkVersion}
            disabled={checking}
            variant="ghost"
            color="gray"
            size="1"
          >
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking...' : 'Check now'}
          </Button>
        </Flex>

        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-3">
          {/* Current version */}
          <Flex align="center" justify="between" className="text-sm">
            <span className="text-mission-control-text-dim">Installed version</span>
            <span className="font-mono text-mission-control-text">
              {versionInfo ? `v${versionInfo.current}` : '—'}
            </span>
          </Flex>

          {/* Latest version */}
          <Flex align="center" justify="between" className="text-sm">
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
          </Flex>

          {/* Status banner */}
          {versionInfo && !checking && (
            <Flex align="center" gap="2" className={`px-3 py-2 rounded-lg text-sm mt-1 ${
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
            </Flex>
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
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-4 max-h-48 overflow-y-auto">
            <pre className="text-xs text-mission-control-text-dim whitespace-pre-wrap font-sans leading-5">
              {versionInfo.releaseNotes}
            </pre>
          </div>
        </section>
      )}

      {/* Update button */}
      {versionInfo?.updateAvailable && !updateDone?.success && (
        <Button
          onClick={handleUpdate}
          disabled={updating}
          variant="solid"
          color="grass"
          size="3"
          className="w-full"
        >
          {updating ? (
            <><Loader2 size={16} className="animate-spin" /> Updating...</>
          ) : (
            <><ArrowUpCircle size={16} /> Update to v{versionInfo.latest}</>
          )}
        </Button>
      )}

      {/* Live log */}
      {(updating || log.length > 0) && (
        <section>
          <Flex align="center" gap="2" className="mb-2">
            <Terminal size={14} className="text-mission-control-text-dim" />
            <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">Install log</span>
          </Flex>
          <div
            ref={logRef}
            className="bg-mission-control-bg rounded-lg border border-mission-control-border p-3 h-48 overflow-y-auto font-mono text-xs text-success space-y-0.5"
          >
            {log.map((line, i) => (
              <div key={i} className="leading-5">{line || '\u00a0'}</div>
            ))}
            {updating && (
              <Flex align="center" gap="1" className="text-mission-control-text-dim">
                <Loader2 size={10} className="animate-spin" />
                <span>running...</span>
              </Flex>
            )}
          </div>
        </section>
      )}

      {/* Result banner */}
      {updateDone && (
        <Flex align="start" gap="3" className={`px-4 py-3 rounded-lg border text-sm ${
          updateDone.success
            ? 'bg-success-subtle border-success/20 text-success'
            : 'bg-error-subtle border-error/20 text-error'
        }`}>
          {updateDone.success
            ? <Check size={16} className="mt-0.5 shrink-0" />
            : <AlertCircle size={16} className="mt-0.5 shrink-0" />
          }
          <span>{updateDone.message}</span>
        </Flex>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Settings Audit Log (collapsible)
// ─────────────────────────────────────────────
interface AuditEntry {
  id: number;
  key: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  timestamp: number;
}

function SettingsAuditLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/settings/audit')
      .then((r) => r.json())
      .then((data: AuditEntry[]) => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <section>
      <Button
        onClick={() => setOpen((v) => !v)}
        variant="ghost"
        color="gray"
        size="2"
        className="mb-2"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Clock size={14} />
        Recent Changes
      </Button>

      {open && (
        <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-3 space-y-1">
          {loading && (
            <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim py-2">
              <Loader2 size={12} className="animate-spin" /> Loading audit log...
            </Flex>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-xs text-mission-control-text-dim py-2">No changes recorded yet.</p>
          )}
          {!loading && entries.map((e) => (
            <Flex key={e.id} align="start" justify="between" gap="3" className="py-1.5 border-b border-mission-control-border last:border-0">
              <div className="min-w-0 flex-1">
                <span className="font-mono text-xs text-mission-control-text truncate block">{e.key}</span>
                <span className="text-xs text-mission-control-text-dim">
                  {e.oldValue != null ? (
                    <><span className="line-through opacity-60">{e.oldValue}</span>{' → '}</>
                  ) : null}
                  <span className="text-mission-control-accent">{e.newValue}</span>
                </span>
              </div>
              <span className="text-xs text-mission-control-text-dim whitespace-nowrap shrink-0">
                {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </Flex>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);

  // ── Persisted settings via useSettings hook ──────────────────────────────
  const [notificationsSound, setNotificationsSound] = useSettings<boolean>('notifications.sound', true);
  const [sidebarExpanded, setSidebarExpanded] = useSettings<boolean>('sidebar.expanded', true);
  const [approvalsAutoAssign, setApprovalsAutoAssign] = useSettings<boolean>('approvals.autoAssign', false);

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


  const settingsTabs = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'accessibility', label: 'Accessibility', icon: Type },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'accounts', label: 'Google Workspace', icon: LinkIcon },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'automation', label: 'Automation' },
    { id: 'exportBackup', label: 'Export & Backup', icon: Database },
    { id: 'platform', label: 'Platform', icon: Package },
    { id: 'budgets', label: 'Budgets', icon: DollarSign },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="w-full">
        {/* Header + Tabs */}
        <div className="border-b border-mission-control-border bg-mission-control-surface">
          <PanelHeader
            icon={Settings}
            title="Settings"
            subtitle="Configure Mission Control dashboard preferences"
            border={false}
          />
          <TabNav
            tabs={settingsTabs}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as Tab)}
            paddingX="px-6"
          />
        </div>

        <div className="p-4">

        {/* Tab Content */}
        {activeTab === 'accounts' && <ConnectedAccountsPanel />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'accessibility' && <AccessibilitySettings />}
        {activeTab === 'exportBackup' && <ExportBackupTab />}
        {activeTab === 'platform' && <PlatformUpdateTab />}
        {activeTab === 'budgets' && <BudgetDashboard />}
        
        {/* GENERAL TAB */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {/* Live System Status */}
            <section>
              <Flex align="center" justify="between" className="mb-4">
                <h2 className="text-heading-3 flex items-center gap-2">
                  <Activity size={16} /> System Status
                </h2>
                <Button
                  onClick={() => {
                    setHealth(null);
                    setAgentCount(null);
                    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {});
                    fetch('/api/agents').then(r => r.json()).then(d => { if (Array.isArray(d)) setAgentCount(d.length); }).catch(() => {});
                  }}
                  variant="ghost"
                  color="gray"
                  size="1"
                >
                  <RefreshCw size={12} /> Refresh
                </Button>
              </Flex>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-2 text-sm">
                <StatusRow
                  label="Claude CLI"
                  value={health ? (
                    !health.claudeFound ? 'Not found — run: npm install -g @anthropic-ai/claude-code' :
                    !health.claudeAuthenticated ? 'Not authenticated — run: claude' :
                    'Ready'
                  ) : '…'}
                  ok={health ? (health.claudeFound && health.claudeAuthenticated) : undefined}
                />
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="default-panel" className="block text-sm text-mission-control-text-dim mb-2">Default Panel on Startup</label>
                  <Select.Root
                    value={settings.defaultPanel}
                    onValueChange={(val) => setSettings(s => ({ ...s, defaultPanel: val }))}
                  >
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="dashboard">Dashboard</Select.Item>
                      <Select.Item value="inbox">Inbox</Select.Item>
                      <Select.Item value="comms">Communications</Select.Item>
                      <Select.Item value="analytics">Analytics</Select.Item>
                      <Select.Item value="kanban">Tasks (Kanban)</Select.Item>
                      <Select.Item value="agents">Agents</Select.Item>
                      <Select.Item value="twitter">Social Media</Select.Item>
                      <Select.Item value="voice">Voice</Select.Item>
                      <Select.Item value="chat">Chat</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <p className="text-xs text-mission-control-text-dim mt-1">This panel will open when you launch the app</p>
                </div>
              </div>
            </section>

            {/* Navigation */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Monitor size={16} /> Navigation
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <Flex align="center" justify="between">
                  <div>
                    <div className="font-medium">Collapsed Sidebar</div>
                    <div className="text-sm text-mission-control-text-dim">Show sidebar as icon only</div>
                  </div>
                  <Toggle
                    checked={!sidebarExpanded}
                    onChange={(checked) => {
                      const expanded = !checked;
                      setSidebarExpanded(expanded);
                      localStorage.setItem('sidebarExpanded', String(expanded));
                      window.dispatchEvent(new Event('sidebarStateChange'));
                    }}
                    colorScheme="green"
                  />
                </Flex>
              </div>
            </section>

            {/* API Keys */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Key size={16} /> API Keys
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="gemini-api-key" className="block text-sm font-medium mb-1">
                    Google Gemini API Key
                  </label>
                  <p className="text-xs text-mission-control-text-dim mb-2">Required for voice chat, meeting transcription, and PDF extraction</p>
                  <TextField.Root
                    id="gemini-api-key"
                    type="password"
                    size="2"
                    value={settings.geminiApiKey}
                    onChange={(e) => setSettings(s => ({ ...s, geminiApiKey: e.target.value }))}
                    placeholder="AIza..."
                  />
                </div>
              </div>
            </section>

            {/* Export/Import */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Download size={16} /> Backup & Restore
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <Flex gap="3">
                  <Button
                    onClick={handleExport}
                    variant="soft"
                    color="gray"
                    size="2"
                    className="flex-1"
                  >
                    <Download size={16} />
                    Export Settings
                  </Button>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="soft"
                    color="gray"
                    size="2"
                    className="flex-1"
                  >
                    <Upload size={16} />
                    Import Settings
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </Flex>
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-3">
                <p className="text-sm text-mission-control-text-dim">
                  Re-launch the 8-stop guided tour to explore Dashboard, Tasks, Agents, Inbox, Memory, Library, Analytics, and Settings.
                </p>
                <Button
                  onClick={() => window.dispatchEvent(new Event('restart-platform-tour'))}
                  variant="solid"
                  color="grass"
                  size="2"
                >
                  <Map size={14} />
                  Restart Tour
                </Button>
              </div>
            </section>

            {/* Onboarding */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <RefreshCw size={16} /> Onboarding
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-3">
                <p className="text-sm text-mission-control-text-dim">
                  Re-run the setup wizard — platform name, agent selection, first task, and launch.
                </p>
                <Button
                  onClick={() => window.dispatchEvent(new Event('restart-onboarding'))}
                  variant="soft"
                  color="gray"
                  size="2"
                >
                  <RefreshCw size={14} />
                  Re-run setup wizard
                </Button>
              </div>
            </section>

            {/* Approvals */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Shield size={16} /> Approvals
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
                <Flex align="center" justify="between">
                  <div>
                    <div className="font-medium">Auto-Assign Approvals</div>
                    <div className="text-sm text-mission-control-text-dim">
                      Automatically assign new approval requests to the reviewing agent
                    </div>
                  </div>
                  <Toggle
                    checked={approvalsAutoAssign}
                    onChange={setApprovalsAutoAssign}
                    colorScheme="green"
                  />
                </Flex>
              </div>
            </section>

            {/* Notification Sound */}
            <section>
              <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                <Bell size={16} /> Notification Sound
              </h2>
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4">
                <Flex align="center" justify="between">
                  <div>
                    <div className="font-medium">Sound Alerts</div>
                    <div className="text-sm text-mission-control-text-dim">
                      Play a sound when new notifications arrive
                    </div>
                  </div>
                  <Toggle
                    checked={notificationsSound}
                    onChange={setNotificationsSound}
                    colorScheme="green"
                  />
                </Flex>
              </div>
            </section>

            {/* Recent Changes audit log */}
            <SettingsAuditLog />
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="color-mode" className="block text-sm text-mission-control-text-dim mb-2">Color Mode</label>
                  <Flex gap="2">
                    {(['dark', 'light', 'system'] as const).map((t) => (
                      <Button
                        key={t}
                        onClick={() => setSettings(s => ({ ...s, theme: t }))}
                        variant={settings.theme === t ? 'solid' : 'soft'}
                        color={settings.theme === t ? 'grass' : 'gray'}
                        size="2"
                        className="flex-1"
                      >
                        {t === 'dark' && <Moon size={16} />}
                        {t === 'light' && <Sun size={16} />}
                        {t === 'system' && <Monitor size={16} />}
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Button>
                    ))}
                  </Flex>
                </div>
                <div>
                  <label htmlFor="accent-color" className="block text-sm text-mission-control-text-dim mb-2">Accent Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'].map((color) => (
                      <button
                        type="button"
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                <div>
                  <label htmlFor="font-family-select" className="block text-sm text-mission-control-text-dim mb-2">Font Family</label>
                  <Select.Root
                    value={settings.fontFamily}
                    onValueChange={(val) => setSettings(s => ({ ...s, fontFamily: val }))}
                  >
                    <Select.Trigger id="font-family-select" className="w-full" />
                    <Select.Content>
                      <Select.Item value="system">System Default</Select.Item>
                      <Select.Item value="inter">Inter</Select.Item>
                      <Select.Item value="roboto-mono">Roboto Mono (Monospace)</Select.Item>
                      <Select.Item value="sf-pro">SF Pro Display</Select.Item>
                    </Select.Content>
                  </Select.Root>
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
                  <Flex justify="between" className="text-xs text-mission-control-text-dim mt-1">
                    <span>Small (12px)</span>
                    <span>Medium (14px)</span>
                    <span>Large (18px)</span>
                  </Flex>
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-1">
                {defaultKeyboardShortcuts.map((shortcut) => (
                  <Flex key={shortcut.id} align="center" justify="between" className="py-2.5 border-b border-mission-control-border last:border-0">
                    <div>
                      <div className="font-medium text-sm">{shortcut.name}</div>
                      <div className="text-xs text-mission-control-text-dim">{shortcut.description}</div>
                    </div>
                    <kbd className="px-3 py-1 bg-mission-control-bg border border-mission-control-border rounded text-sm font-mono text-mission-control-text-dim">
                      {shortcut.modifiers.map(m => m === 'cmd' ? '⌘' : m === 'shift' ? '⇧' : m === 'alt' ? '⌥' : '⌃').join('')}
                      {shortcut.currentKey.toUpperCase()}
                    </kbd>
                  </Flex>
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
              <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-4">
                {/* External Actions kill switch */}
                <Flex align="center" justify="between">
                  <div>
                    <Flex align="center" gap="2" className="font-medium">
                      External Actions
                      {settings.externalActionsEnabled ? (
                        <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded">LIVE</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded">BLOCKED</span>
                      )}
                    </Flex>
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
                </Flex>

                {/* Info */}
                <div className="p-4 bg-info-subtle border border-info-border rounded-lg text-sm text-info space-y-2">
                  <Flex align="center" gap="2" className="font-medium">
                    <Shield size={14} /> Approval Gate
                  </Flex>
                  <p>Agents call <code className="text-xs bg-black/20 px-1 rounded">approval_create</code> before any external action. The Approvals panel lets you review and approve or reject each one before it executes.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Actions (shown for most tabs except special ones) */}
        {!['security', 'accounts', 'config', 'logs', 'exportBackup', 'platform', 'budgets'].includes(activeTab) && (
          <Flex gap="3" className="mt-8">
            <Button
              onClick={handleSave}
              variant="solid"
              color="grass"
              size="3"
              className="flex-1"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </Button>
            <Button
              onClick={handleReset}
              variant="soft"
              color="gray"
              size="3"
            >
              Reset
            </Button>
          </Flex>
        )}
        </div>
      </div>
    </div>
  );
}
