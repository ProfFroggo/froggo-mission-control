// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  Bell,
  Moon,
  Sun,
  Palette,
  Save,
  Check,
  RefreshCw,
  Shield,
  Link as LinkIcon,
  Download,
  Upload,
  Type,
  Keyboard,
  Monitor,
  Database,
  Key,
  Activity,
  Map,
  Package,
  AlertCircle,
  ArrowUpCircle,
  Terminal,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Search,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Info,
  Globe,
  SlidersHorizontal,
  HardDrive,
} from 'lucide-react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface LocalSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  accentPreset: string;
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  sidebarWidth: 'compact' | 'default' | 'wide';
  defaultPanel: string;
  notifications: NotificationPreferences;
  externalActionsEnabled: boolean;
  geminiApiKey: string;
}

type SectionId =
  | 'general'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'data'
  | 'about'
  | 'accessibility'
  | 'shortcuts'
  | 'automation'
  | 'accounts'
  | 'exportBackup'
  | 'platform'
  | 'budgets';

interface NavSection {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT_PRESETS: { id: string; label: string; color: string }[] = [
  { id: 'green',  label: 'Green',  color: '#22c55e' },
  { id: 'blue',   label: 'Blue',   color: '#3b82f6' },
  { id: 'purple', label: 'Purple', color: '#8b5cf6' },
  { id: 'red',    label: 'Red',    color: '#ef4444' },
  { id: 'amber',  label: 'Amber',  color: '#f59e0b' },
  { id: 'pink',   label: 'Pink',   color: '#ec4899' },
];

const FONT_SIZE_MAP: Record<'small' | 'medium' | 'large', string> = {
  small:  '12px',
  medium: '14px',
  large:  '18px',
};

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const NAV_SECTIONS: NavSection[] = [
  { id: 'general',       label: 'General',       icon: <Settings size={16} />,        keywords: ['platform', 'name', 'language', 'date', 'timezone', 'startup', 'panel'] },
  { id: 'appearance',    label: 'Appearance',     icon: <Palette size={16} />,         keywords: ['theme', 'dark', 'light', 'color', 'accent', 'font', 'size', 'sidebar', 'width'] },
  { id: 'notifications', label: 'Notifications',  icon: <Bell size={16} />,            keywords: ['notification', 'alert', 'sound', 'task', 'approval', 'agent'] },
  { id: 'security',      label: 'Security',       icon: <Shield size={16} />,          keywords: ['api', 'token', 'session', 'timeout', 'key', 'secret'] },
  { id: 'data',          label: 'Data',           icon: <Database size={16} />,        keywords: ['export', 'import', 'backup', 'storage', 'clear', 'tasks'] },
  { id: 'about',         label: 'About',          icon: <Info size={16} />,            keywords: ['version', 'build', 'docs', 'github', 'support', 'license'] },
  { id: 'accessibility', label: 'Accessibility',  icon: <Type size={16} />,            keywords: ['accessibility', 'contrast', 'motion', 'screen reader'] },
  { id: 'shortcuts',     label: 'Shortcuts',      icon: <Keyboard size={16} />,        keywords: ['keyboard', 'shortcut', 'hotkey', 'keybinding'] },
  { id: 'automation',    label: 'Automation',     icon: <Activity size={16} />,        keywords: ['automation', 'external', 'actions', 'approval'] },
  { id: 'accounts',      label: 'Google Workspace', icon: <LinkIcon size={16} />,     keywords: ['google', 'workspace', 'gmail', 'calendar', 'oauth'] },
  { id: 'exportBackup',  label: 'Export & Backup', icon: <HardDrive size={16} />,     keywords: ['export', 'backup', 'restore', 'database'] },
  { id: 'platform',      label: 'Platform',       icon: <Package size={16} />,         keywords: ['update', 'version', 'upgrade', 'release'] },
  { id: 'budgets',       label: 'Budgets',        icon: <DollarSign size={16} />,      keywords: ['budget', 'cost', 'token', 'spend', 'limit'] },
];

const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'inbox',         name: 'Inbox',          description: 'Navigate to Inbox',          defaultKey: '1', currentKey: '1', modifiers: ['cmd'] },
  { id: 'dashboard',     name: 'Dashboard',      description: 'Navigate to Dashboard',      defaultKey: '2', currentKey: '2', modifiers: ['cmd'] },
  { id: 'analytics',     name: 'Analytics',      description: 'Navigate to Analytics',      defaultKey: '3', currentKey: '3', modifiers: ['cmd'] },
  { id: 'kanban',        name: 'Tasks',          description: 'Navigate to Tasks',          defaultKey: '4', currentKey: '4', modifiers: ['cmd'] },
  { id: 'agents',        name: 'Agents',         description: 'Navigate to Agents',         defaultKey: '5', currentKey: '5', modifiers: ['cmd'] },
  { id: 'twitter',       name: 'Social Media',   description: 'Navigate to Social Media',   defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
  { id: 'meetings',      name: 'Meetings',       description: 'Navigate to Meetings',       defaultKey: '7', currentKey: '7', modifiers: ['cmd'] },
  { id: 'voicechat',     name: 'Voice Chat',     description: 'Navigate to Voice Chat',     defaultKey: '8', currentKey: '8', modifiers: ['cmd'] },
  { id: 'accounts',      name: 'Accounts',       description: 'Navigate to Accounts',       defaultKey: '9', currentKey: '9', modifiers: ['cmd'] },
  { id: 'approvals',     name: 'Approvals',      description: 'Navigate to Approvals',      defaultKey: '0', currentKey: '0', modifiers: ['cmd'] },
  { id: 'settings',      name: 'Settings',       description: 'Open Settings',              defaultKey: ',', currentKey: ',', modifiers: ['cmd'] },
  { id: 'commandPalette',name: 'Command Palette',description: 'Open command palette',       defaultKey: 'k', currentKey: 'k', modifiers: ['cmd'] },
  { id: 'search',        name: 'Search',         description: 'Global search',              defaultKey: '/', currentKey: '/', modifiers: ['cmd'] },
  { id: 'quickMessage',  name: 'Quick Message',  description: 'Send quick message',         defaultKey: 'm', currentKey: 'm', modifiers: ['cmd', 'shift'] },
];

const defaultSettings: LocalSettings = {
  theme: 'dark',
  accentColor: '#22c55e',
  accentPreset: 'green',
  fontFamily: 'system',
  fontSize: 'medium',
  sidebarWidth: 'default',
  defaultPanel: 'dashboard',
  notifications: { enabled: true },
  externalActionsEnabled: false,
  geminiApiKey: '',
};

// ─── Theme application ────────────────────────────────────────────────────────

function applyTheme(settings: LocalSettings) {
  const root = document.documentElement;

  let actualTheme = settings.theme;
  if (settings.theme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  root.classList.remove('dark', 'light');
  root.classList.add(actualTheme);

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

  // Apply accent — preset via data-accent attr if one of the 6 presets, else raw CSS var
  const preset = ACCENT_PRESETS.find((p) => p.id === settings.accentPreset);
  if (preset) {
    root.setAttribute('data-accent', settings.accentPreset);
    // Also set directly so the var is in effect even if CSS wasn't reloaded
    root.style.setProperty('--mission-control-accent', preset.color);
  } else {
    root.removeAttribute('data-accent');
    root.style.setProperty('--mission-control-accent', settings.accentColor);
  }

  // Generate accent-dim
  const hex = (preset?.color ?? settings.accentColor).replace('#', '');
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 30);
  root.style.setProperty('--mission-control-accent-dim', `rgb(${r}, ${g}, ${b})`);

  const fontMap: Record<string, string> = {
    system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    inter: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    'roboto-mono': '"Roboto Mono", Consolas, Monaco, "Courier New", monospace',
    'sf-pro': '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
  };
  root.style.setProperty('--mission-control-font', fontMap[settings.fontFamily] ?? fontMap.system);
  root.style.setProperty('--mission-control-font-size', FONT_SIZE_MAP[settings.fontSize]);
}

// ─── Helper components ────────────────────────────────────────────────────────

interface SystemHealth {
  cli: boolean;
  claudeFound: boolean;
  claudeAuthenticated: boolean;
  claudePath: string;
  database: boolean;
  backend: string;
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-mission-control-text-dim">{label}</span>
      <span
        className={`font-mono text-xs ${
          ok === false
            ? 'text-error'
            : ok === true
            ? 'text-success'
            : 'text-mission-control-text-dim'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

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
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-mission-control-text-dim hover:text-mission-control-text transition-colors mb-2"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Clock size={14} />
        Recent Changes
      </button>

      {open && (
        <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-3 space-y-1">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-mission-control-text-dim py-2">
              <Loader2 size={12} className="animate-spin" /> Loading audit log...
            </div>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-xs text-mission-control-text-dim py-2">No changes recorded yet.</p>
          )}
          {!loading &&
            entries.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-3 py-1.5 border-b border-mission-control-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-mission-control-text truncate block">
                    {e.key}
                  </span>
                  <span className="text-xs text-mission-control-text-dim">
                    {e.oldValue != null ? (
                      <>
                        <span className="line-through opacity-60">{e.oldValue}</span>
                        {' → '}
                      </>
                    ) : null}
                    <span className="text-mission-control-accent">{e.newValue}</span>
                  </span>
                </div>
                <span className="text-xs text-mission-control-text-dim whitespace-nowrap shrink-0">
                  {new Date(e.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

// ─── Platform Update tab ──────────────────────────────────────────────────────

function PlatformUpdateTab() {
  const [versionInfo, setVersionInfo] = useState<{
    current: string;
    latest: string | null;
    updateAvailable: boolean;
    releaseNotes: string | null;
    error?: string;
  } | null>(null);
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
      setVersionInfo({
        current: 'unknown',
        latest: null,
        updateAvailable: false,
        releaseNotes: null,
        error: 'Could not reach npm registry',
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkVersion();
  }, []);

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
              if (evt.success && evt.message.includes('reload')) {
                setTimeout(() => window.location.reload(), 3000);
              }
              if (evt.success) checkVersion();
            } else if (evt.line !== undefined) {
              setLog((prev) => [...prev, evt.line]);
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err: unknown) {
      setUpdateDone({ success: false, message: (err as Error).message });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
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
          <div className="flex items-center justify-between text-sm">
            <span className="text-mission-control-text-dim">Installed version</span>
            <span className="font-mono text-mission-control-text">
              {versionInfo ? `v${versionInfo.current}` : '—'}
            </span>
          </div>
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

          {versionInfo && !checking && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mt-1 ${
                versionInfo.error
                  ? 'bg-warning-subtle text-warning border border-warning/20'
                  : versionInfo.updateAvailable
                  ? 'bg-info-subtle text-info border border-info/20'
                  : 'bg-success-subtle text-success border border-success/20'
              }`}
            >
              {versionInfo.error ? (
                <>
                  <AlertCircle size={14} /> Registry unavailable — {versionInfo.error}
                </>
              ) : versionInfo.updateAvailable ? (
                <>
                  <ArrowUpCircle size={14} /> v{versionInfo.latest} is available
                </>
              ) : (
                <>
                  <Check size={14} /> Up to date
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {versionInfo?.updateAvailable && versionInfo.releaseNotes && (
        <section>
          <h3 className="text-sm font-medium text-mission-control-text mb-2 flex items-center gap-2">
            <ArrowUpCircle size={14} className="text-info" />
            What&apos;s in v{versionInfo.latest}
          </h3>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 max-h-48 overflow-y-auto">
            <pre className="text-xs text-mission-control-text-dim whitespace-pre-wrap font-sans leading-5">
              {versionInfo.releaseNotes}
            </pre>
          </div>
        </section>
      )}

      {versionInfo?.updateAvailable && !updateDone?.success && (
        <button
          onClick={handleUpdate}
          disabled={updating}
          className="w-full flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium"
        >
          {updating ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Updating...
            </>
          ) : (
            <>
              <ArrowUpCircle size={16} /> Update to v{versionInfo.latest}
            </>
          )}
        </button>
      )}

      {(updating || log.length > 0) && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-mission-control-text-dim" />
            <span className="text-xs text-mission-control-text-dim font-medium uppercase tracking-wide">
              Install log
            </span>
          </div>
          <div
            ref={logRef}
            className="bg-black rounded-xl border border-mission-control-border p-3 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-0.5"
          >
            {log.map((line, i) => (
              <div key={i} className="leading-5">
                {line || '\u00a0'}
              </div>
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

      {updateDone && (
        <div
          className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            updateDone.success
              ? 'bg-success-subtle border-success/20 text-success'
              : 'bg-error-subtle border-error/20 text-error'
          }`}
        >
          {updateDone.success ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{updateDone.message}</span>
        </div>
      )}
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="font-semibold text-mission-control-text mb-2">{title}</h3>
        <p className="text-sm text-mission-control-text-dim mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 bg-error text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-mission-control-border text-mission-control-text rounded-lg hover:opacity-80 transition-opacity text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main SettingsPanel ───────────────────────────────────────────────────────

export default function SettingsPanel() {
  const [activeSection, setActiveSection] = useState<SectionId>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [agentCount, setAgentCount] = useState<number | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ dbSize?: string } | null>(null);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // ── Persisted settings (server DB) ──────────────────────────────────────
  const [notificationsSound, setNotificationsSound] = useSettings<boolean>(
    'notifications.sound',
    true
  );
  const [notificationsInApp, setNotificationsInApp] = useSettings<boolean>(
    'notifications.inApp',
    true
  );
  const [sidebarExpanded, setSidebarExpanded] = useSettings<boolean>('sidebar.expanded', true);
  const [approvalsAutoAssign, setApprovalsAutoAssign] = useSettings<boolean>(
    'approvals.autoAssign',
    false
  );
  const [platformName, setPlatformName] = useSettings<string>('platform.name', 'Mission Control');
  const [platformLanguage, setPlatformLanguage] = useSettings<string>('platform.language', 'en');
  const [platformDateFormat, setPlatformDateFormat] = useSettings<string>(
    'platform.dateFormat',
    'MM/DD/YYYY'
  );
  const [platformTimezone, setPlatformTimezone] = useSettings<string>('platform.timezone', 'UTC');

  // Notification type checkboxes
  const [notifTaskAssigned, setNotifTaskAssigned] = useSettings<boolean>(
    'notifications.types.task_assigned',
    true
  );
  const [notifTaskCompleted, setNotifTaskCompleted] = useSettings<boolean>(
    'notifications.types.task_completed',
    true
  );
  const [notifApprovalNeeded, setNotifApprovalNeeded] = useSettings<boolean>(
    'notifications.types.approval_needed',
    true
  );
  const [notifAgentAlert, setNotifAgentAlert] = useSettings<boolean>(
    'notifications.types.agent_alert',
    true
  );

  // Security settings
  const [sessionTimeout, setSessionTimeout] = useSettings<string>(
    'security.sessionTimeout',
    '30min'
  );
  const [apiToken, , apiTokenLoading] = useSettings<string>('security.apiToken', '');
  const [apiTokenRevealed, setApiTokenRevealed] = useState(false);

  // ── Local settings (localStorage) ───────────────────────────────────────
  const [settings, setSettings] = useState<LocalSettings>(() => {
    try {
      const saved = localStorage.getItem('mission-control-settings');
      const parsed = saved ? (JSON.parse(saved) as Partial<LocalSettings>) : {};
      const { geminiApiKey: _ignored, ...rest } = parsed;
      void _ignored;
      return { ...defaultSettings, ...rest };
    } catch {
      return defaultSettings;
    }
  });
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Apply theme on mount + change ────────────────────────────────────────
  useEffect(() => {
    applyTheme(settings);
  }, [settings.theme, settings.accentColor, settings.accentPreset, settings.fontFamily, settings.fontSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── System health ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: SystemHealth) => setHealth(data))
      .catch(() => {});
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setAgentCount(data.length);
      })
      .catch(() => {});
    fetch('/api/health/metrics')
      .then((r) => r.json())
      .then((data: { database?: { size?: string } }) => {
        setStorageInfo({ dbSize: data?.database?.size });
      })
      .catch(() => {});
  }, []);

  // ── Load Gemini key from DB ──────────────────────────────────────────────
  useEffect(() => {
    settingsApi
      .get('gemini_api_key')
      .then((result: { value?: string } | null) => {
        if (result?.value) setSettings((s) => ({ ...s, geminiApiKey: result.value! }));
      })
      .catch(() => {});
  }, []);

  // ── System theme listener ────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (settings.theme === 'system') applyTheme(settings);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const { geminiApiKey, ...settingsWithoutKey } = settings;
    localStorage.setItem('mission-control-settings', JSON.stringify(settingsWithoutKey));

    if (geminiApiKey) {
      try {
        await settingsApi.set('gemini_api_key', geminiApiKey);
      } catch {
        /* non-critical */
      }
    }

    try {
      await settingsApi.set('automation', {
        externalActionsEnabled: settings.externalActionsEnabled,
      });
    } catch {
      /* non-critical */
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

  const handleLocalExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mission-control-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Settings exported', 'Download started');
  };

  const handleServerExport = () => {
    window.open('/api/settings/export', '_blank');
    showToast('success', 'Export started', 'All platform data downloading');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as Partial<LocalSettings>;
        setSettings({ ...defaultSettings, ...imported });
        showToast('success', 'Settings imported', 'Your preferences have been restored');
      } catch {
        showToast('error', 'Import failed', 'Invalid settings file');
      }
    };
    reader.readAsText(file);
  };

  const handleClearCompletedTasks = async () => {
    try {
      const res = await fetch('/api/tasks/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      if (res.ok) {
        showToast('success', 'Tasks cleared', 'All completed tasks have been removed');
      } else {
        showToast('error', 'Clear failed', 'Could not remove completed tasks');
      }
    } catch {
      showToast('error', 'Clear failed', 'Network error');
    }
    setShowConfirmClear(false);
  };

  // ── Search matching ───────────────────────────────────────────────────────

  const matchedSections = useCallback((): SectionId[] => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return NAV_SECTIONS.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.keywords.some((k) => k.includes(q))
    ).map((s) => s.id);
  }, [searchQuery]);

  const isHighlighted = (sectionId: SectionId) => matchedSections().includes(sectionId);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {showConfirmClear && (
        <ConfirmModal
          title="Clear completed tasks?"
          message="This will permanently delete all tasks with status 'done'. This action cannot be undone."
          onConfirm={handleClearCompletedTasks}
          onCancel={() => setShowConfirmClear(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-mission-control-border shrink-0">
        <Settings size={20} className="text-mission-control-accent" />
        <h1 className="text-lg font-semibold text-mission-control-text">Settings</h1>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Left sidebar nav ── */}
        <nav className="w-52 shrink-0 border-r border-mission-control-border flex flex-col py-4 overflow-y-auto">
          {/* Search */}
          <div className="px-3 mb-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
              />
            </div>
          </div>

          {NAV_SECTIONS.map((section) => {
            const highlighted = isHighlighted(section.id);
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setSearchQuery('');
                }}
                className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm text-left transition-colors ${
                  active
                    ? 'bg-mission-control-accent/15 text-mission-control-accent font-medium'
                    : highlighted
                    ? 'bg-yellow-500/15 text-mission-control-text font-medium'
                    : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface'
                }`}
              >
                <span className={active ? 'text-mission-control-accent' : highlighted ? 'text-yellow-400' : 'text-mission-control-text-dim'}>
                  {section.icon}
                </span>
                <span className={highlighted && !active ? 'bg-yellow-400/30 px-0.5 rounded' : ''}>
                  {section.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-2xl space-y-8">

            {/* ════════════════════════════════════════
                GENERAL
               ════════════════════════════════════════ */}
            {activeSection === 'general' && (
              <>
                {/* Platform */}
                <section ref={(el) => { sectionRefs.current['general-platform'] = el; }}>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Globe size={16} /> Platform
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div>
                      <label htmlFor="platform-name" className="block text-sm text-mission-control-text-dim mb-1">
                        Platform Name
                      </label>
                      <input
                        id="platform-name"
                        type="text"
                        value={platformName ?? ''}
                        onChange={(e) => setPlatformName(e.target.value)}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="platform-language" className="block text-sm text-mission-control-text-dim mb-1">
                        Language
                      </label>
                      <select
                        id="platform-language"
                        value={platformLanguage ?? 'en'}
                        onChange={(e) => setPlatformLanguage(e.target.value)}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="date-format" className="block text-sm text-mission-control-text-dim mb-1">
                        Date Format
                      </label>
                      <select
                        id="date-format"
                        value={platformDateFormat ?? 'MM/DD/YYYY'}
                        onChange={(e) => setPlatformDateFormat(e.target.value)}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                      >
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="timezone" className="block text-sm text-mission-control-text-dim mb-1">
                        Timezone
                      </label>
                      <select
                        id="timezone"
                        value={platformTimezone ?? 'UTC'}
                        onChange={(e) => setPlatformTimezone(e.target.value)}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                      >
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                {/* Startup */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Monitor size={16} /> Startup
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div>
                      <label htmlFor="default-panel" className="block text-sm text-mission-control-text-dim mb-2">
                        Default Panel on Startup
                      </label>
                      <select
                        id="default-panel"
                        value={settings.defaultPanel}
                        onChange={(e) => setSettings((s) => ({ ...s, defaultPanel: e.target.value }))}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
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
                    </div>
                  </div>
                </section>

                {/* Navigation */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <SlidersHorizontal size={16} /> Navigation
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">Collapsed Sidebar</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">Show sidebar as icon only</div>
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
                      <p className="text-xs text-mission-control-text-dim mb-2">
                        Required for voice chat, meeting transcription, and PDF extraction
                      </p>
                      <input
                        id="gemini-api-key"
                        type="password"
                        value={settings.geminiApiKey}
                        onChange={(e) => setSettings((s) => ({ ...s, geminiApiKey: e.target.value }))}
                        placeholder="AIza..."
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent font-mono text-sm"
                      />
                    </div>
                  </div>
                </section>

                {/* Approvals */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Shield size={16} /> Approvals
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">Auto-Assign Approvals</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">
                          Automatically assign new approval requests to the reviewing agent
                        </div>
                      </div>
                      <Toggle
                        checked={approvalsAutoAssign}
                        onChange={setApprovalsAutoAssign}
                        colorScheme="green"
                      />
                    </div>
                  </div>
                </section>

                {/* Platform Tour */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Map size={16} /> Platform Tour
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                    <p className="text-sm text-mission-control-text-dim">
                      Re-launch the guided tour to explore Dashboard, Tasks, Agents, Inbox, Memory, Library, Analytics, and Settings.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => window.dispatchEvent(new Event('restart-platform-tour'))}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                      >
                        <Map size={14} />
                        Restart Tour
                      </button>
                      <button
                        onClick={() => window.dispatchEvent(new Event('restart-onboarding'))}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-surface border border-mission-control-border text-mission-control-text rounded-lg hover:border-mission-control-accent/60 hover:text-mission-control-accent transition-colors"
                      >
                        <RefreshCw size={14} />
                        Restart Onboarding
                      </button>
                    </div>
                  </div>
                </section>

                {/* Status */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-heading-3 flex items-center gap-2">
                      <Activity size={16} /> System Status
                    </h2>
                    <button
                      onClick={() => {
                        setHealth(null);
                        setAgentCount(null);
                        fetch('/api/health')
                          .then((r) => r.json())
                          .then((data: SystemHealth) => setHealth(data))
                          .catch(() => {});
                        fetch('/api/agents')
                          .then((r) => r.json())
                          .then((d: unknown) => {
                            if (Array.isArray(d)) setAgentCount(d.length);
                          })
                          .catch(() => {});
                      }}
                      className="text-xs text-mission-control-text-dim hover:text-mission-control-accent flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw size={12} /> Refresh
                    </button>
                  </div>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-2 text-sm">
                    <StatusRow
                      label="Claude CLI"
                      value={
                        health
                          ? !health.claudeFound
                            ? 'Not found — run: npm install -g @anthropic-ai/claude-code'
                            : !health.claudeAuthenticated
                            ? 'Not authenticated — run: claude'
                            : 'Ready'
                          : '…'
                      }
                      ok={health ? health.claudeFound && health.claudeAuthenticated : undefined}
                    />
                    <StatusRow
                      label="Database"
                      value={health ? (health.database ? 'Connected' : 'Missing') : '…'}
                      ok={health?.database}
                    />
                    <StatusRow label="MCP Servers" value="mission-control-db · memory" ok={true} />
                    <StatusRow
                      label="Agents"
                      value={agentCount !== null ? `${agentCount} registered` : '…'}
                      ok={agentCount !== null && agentCount > 0}
                    />
                    <StatusRow
                      label="Hooks"
                      value="approval · review-gate · session-sync · precompact"
                      ok={true}
                    />
                    <StatusRow label="Vault" value="~/mission-control/memory/" ok={true} />
                    <StatusRow label="Library" value="~/mission-control/library/" ok={true} />
                  </div>
                </section>

                <SettingsAuditLog />

                {/* Save */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium"
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
              </>
            )}

            {/* ════════════════════════════════════════
                APPEARANCE
               ════════════════════════════════════════ */}
            {activeSection === 'appearance' && (
              <>
                {/* Theme */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Moon size={16} /> Theme
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <div className="flex gap-2">
                      {(['dark', 'light', 'system'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setSettings((s) => ({ ...s, theme: t }))}
                          className={`flex-1 py-2.5 px-4 rounded-lg border transition-colors text-sm flex items-center justify-center gap-2 ${
                            settings.theme === t
                              ? 'border-mission-control-accent bg-mission-control-accent/20 text-mission-control-accent'
                              : 'border-mission-control-border hover:border-mission-control-accent/50'
                          }`}
                        >
                          {t === 'dark' && <Moon size={14} />}
                          {t === 'light' && <Sun size={14} />}
                          {t === 'system' && <Monitor size={14} />}
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Accent Color */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Palette size={16} /> Accent Color
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div>
                      <p className="text-sm text-mission-control-text-dim mb-3">Choose a preset</p>
                      <div className="flex gap-3 flex-wrap">
                        {ACCENT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setSettings((s) => ({
                                ...s,
                                accentPreset: preset.id,
                                accentColor: preset.color,
                              }));
                            }}
                            title={preset.label}
                            className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                              settings.accentPreset === preset.id
                                ? 'border-white scale-110 ring-2 ring-offset-2 ring-offset-mission-control-surface'
                                : 'border-transparent'
                            }`}
                            style={{
                              backgroundColor: preset.color,
                            }}
                            aria-label={`Accent: ${preset.label}`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="accent-custom" className="block text-sm text-mission-control-text-dim mb-1">
                        Custom color
                      </label>
                      <input
                        id="accent-custom"
                        type="color"
                        value={settings.accentColor}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            accentColor: e.target.value,
                            accentPreset: '',
                          }))
                        }
                        className="w-full h-10 rounded-lg border border-mission-control-border cursor-pointer"
                      />
                    </div>
                  </div>
                </section>

                {/* Font Size */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Type size={16} /> Font Size
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setSettings((s) => ({ ...s, fontSize: size }))}
                          className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                            settings.fontSize === size
                              ? 'border-mission-control-accent bg-mission-control-accent/20 text-mission-control-accent'
                              : 'border-mission-control-border hover:border-mission-control-accent/50'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                          <span className="block text-xs opacity-60">{FONT_SIZE_MAP[size]}</span>
                        </button>
                      ))}
                    </div>

                    <div>
                      <label htmlFor="font-family-select" className="block text-sm text-mission-control-text-dim mb-2">
                        Font Family
                      </label>
                      <select
                        id="font-family-select"
                        value={settings.fontFamily}
                        onChange={(e) => setSettings((s) => ({ ...s, fontFamily: e.target.value }))}
                        className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                      >
                        <option value="system">System Default</option>
                        <option value="inter">Inter</option>
                        <option value="roboto-mono">Roboto Mono (Monospace)</option>
                        <option value="sf-pro">SF Pro Display</option>
                      </select>
                    </div>

                    <div className="p-4 bg-mission-control-bg rounded-lg border border-mission-control-border">
                      <p
                        style={{ fontSize: FONT_SIZE_MAP[settings.fontSize] }}
                        className="mb-1"
                      >
                        The quick brown fox jumps over the lazy dog
                      </p>
                      <p className="text-xs text-mission-control-text-dim">Preview of current font settings</p>
                    </div>
                  </div>
                </section>

                {/* Sidebar Width */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <SlidersHorizontal size={16} /> Sidebar Width
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <div className="flex gap-2">
                      {(['compact', 'default', 'wide'] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => setSettings((s) => ({ ...s, sidebarWidth: w }))}
                          className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                            settings.sidebarWidth === w
                              ? 'border-mission-control-accent bg-mission-control-accent/20 text-mission-control-accent'
                              : 'border-mission-control-border hover:border-mission-control-accent/50'
                          }`}
                        >
                          {w.charAt(0).toUpperCase() + w.slice(1)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-mission-control-text-dim mt-2">
                      Controls the width of the main navigation sidebar
                    </p>
                  </div>
                </section>

                {/* Save */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium"
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
              </>
            )}

            {/* ════════════════════════════════════════
                NOTIFICATIONS
               ════════════════════════════════════════ */}
            {activeSection === 'notifications' && (
              <>
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Bell size={16} /> Notification Preferences
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">In-App Notifications</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">Show notification badges and banners in the app</div>
                      </div>
                      <Toggle checked={notificationsInApp} onChange={setNotificationsInApp} colorScheme="green" />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">Sound Alerts</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">Play a sound when new notifications arrive</div>
                      </div>
                      <Toggle checked={notificationsSound} onChange={setNotificationsSound} colorScheme="green" />
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Bell size={16} /> Notification Types
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                    {[
                      { key: 'task_assigned',    label: 'Task Assigned',     desc: 'When a new task is assigned to an agent',      value: notifTaskAssigned,    setter: setNotifTaskAssigned },
                      { key: 'task_completed',   label: 'Task Completed',    desc: 'When a task moves to done status',             value: notifTaskCompleted,   setter: setNotifTaskCompleted },
                      { key: 'approval_needed',  label: 'Approval Needed',   desc: 'When an agent action requires your approval',  value: notifApprovalNeeded,  setter: setNotifApprovalNeeded },
                      { key: 'agent_alert',      label: 'Agent Alert',       desc: 'When an agent encounters an error or blocker', value: notifAgentAlert,      setter: setNotifAgentAlert },
                    ].map(({ key, label, desc, value, setter }) => (
                      <label key={key} className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!value}
                          onChange={(e) => setter(e.target.checked)}
                          className="mt-0.5 w-4 h-4 rounded border-mission-control-border text-mission-control-accent focus:ring-mission-control-accent"
                        />
                        <div>
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs text-mission-control-text-dim">{desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Bell size={16} /> Advanced Notification Settings
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <GlobalNotificationSettings />
                  </div>
                </section>
              </>
            )}

            {/* ════════════════════════════════════════
                SECURITY
               ════════════════════════════════════════ */}
            {activeSection === 'security' && (
              <>
                {/* API Token */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Key size={16} /> API Token
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                    <p className="text-sm text-mission-control-text-dim">
                      Your platform API token for programmatic access. Keep this secret.
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type={apiTokenRevealed ? 'text' : 'password'}
                        value={apiTokenLoading ? 'Loading...' : (apiToken ?? '(not configured)')}
                        readOnly
                        className="flex-1 bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 font-mono text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => setApiTokenRevealed((v) => !v)}
                        title={apiTokenRevealed ? 'Hide token' : 'Reveal token'}
                        className="p-2 rounded-lg border border-mission-control-border hover:border-mission-control-accent text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                      >
                        {apiTokenRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        onClick={() => {
                          if (apiToken) {
                            navigator.clipboard.writeText(apiToken);
                            showToast('success', 'Copied', 'API token copied to clipboard');
                          }
                        }}
                        title="Copy token"
                        className="p-2 rounded-lg border border-mission-control-border hover:border-mission-control-accent text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-mission-control-text-dim">
                      Set via settings key <code className="bg-mission-control-bg px-1 py-0.5 rounded text-xs">security.apiToken</code>
                    </p>
                  </div>
                </section>

                {/* Session Timeout */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Clock size={16} /> Session Timeout
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <label htmlFor="session-timeout" className="block text-sm text-mission-control-text-dim mb-2">
                      Auto-logout after inactivity
                    </label>
                    <select
                      id="session-timeout"
                      value={sessionTimeout ?? '30min'}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent text-sm"
                    >
                      <option value="15min">15 minutes</option>
                      <option value="30min">30 minutes</option>
                      <option value="1h">1 hour</option>
                      <option value="4h">4 hours</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                </section>

                {/* Security audit component */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Shield size={16} /> Security Audit
                  </h2>
                  <SecuritySettings />
                </section>
              </>
            )}

            {/* ════════════════════════════════════════
                DATA
               ════════════════════════════════════════ */}
            {activeSection === 'data' && (
              <>
                {/* Export */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Download size={16} /> Export
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                    <p className="text-sm text-mission-control-text-dim">
                      Download a full export of all your platform data as JSON.
                    </p>
                    <button
                      onClick={handleServerExport}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
                    >
                      <Download size={14} />
                      Export All Data
                    </button>
                  </div>
                </section>

                {/* Clear completed tasks */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Trash2 size={16} /> Maintenance
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-sm">Clear Completed Tasks</div>
                        <div className="text-xs text-mission-control-text-dim mt-0.5">
                          Permanently delete all tasks with status &ldquo;done&rdquo;. This cannot be undone.
                        </div>
                      </div>
                      <button
                        onClick={() => setShowConfirmClear(true)}
                        className="shrink-0 flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-error/40 text-error hover:bg-error/10 transition-colors"
                      >
                        <Trash2 size={14} />
                        Clear
                      </button>
                    </div>
                  </div>
                </section>

                {/* Settings backup */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Upload size={16} /> Settings Backup
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleLocalExport}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
                      >
                        <Download size={14} />
                        Export Settings
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
                      >
                        <Upload size={14} />
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
                  </div>
                </section>

                {/* Storage */}
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <HardDrive size={16} /> Storage
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mission-control-text-dim">Database size</span>
                      <span className="font-mono text-mission-control-text">
                        {storageInfo?.dbSize ?? '—'}
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ════════════════════════════════════════
                ABOUT
               ════════════════════════════════════════ */}
            {activeSection === 'about' && (
              <>
                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <Info size={16} /> About Mission Control
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mission-control-text-dim">Platform version</span>
                      <span className="font-mono text-mission-control-text">v1.8.28</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mission-control-text-dim">License</span>
                      <span className="font-mono text-mission-control-text">Apache 2.0</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-mission-control-text-dim">Built with</span>
                      <span className="text-mission-control-text-dim">Next.js · TypeScript · SQLite</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                    <LinkIcon size={16} /> Links
                  </h2>
                  <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-1">
                    {[
                      { label: 'Documentation', href: 'https://docs.froggo.pro' },
                      { label: 'GitHub', href: 'https://github.com/froggopro' },
                      { label: 'Support', href: 'https://support.froggo.pro' },
                    ].map(({ label, href }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between py-2 text-sm text-mission-control-text hover:text-mission-control-accent transition-colors border-b border-mission-control-border last:border-0"
                      >
                        {label}
                        <ChevronRight size={14} className="text-mission-control-text-dim" />
                      </a>
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ════════════════════════════════════════
                PASS-THROUGH SECTIONS
               ════════════════════════════════════════ */}
            {activeSection === 'accessibility' && <AccessibilitySettings />}

            {activeSection === 'shortcuts' && (
              <section>
                <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                  <Keyboard size={16} /> Keyboard Shortcuts
                </h2>
                <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-1">
                  {defaultKeyboardShortcuts.map((shortcut) => (
                    <div
                      key={shortcut.id}
                      className="flex items-center justify-between py-2.5 border-b border-mission-control-border last:border-0"
                    >
                      <div>
                        <div className="font-medium text-sm">{shortcut.name}</div>
                        <div className="text-xs text-mission-control-text-dim">{shortcut.description}</div>
                      </div>
                      <kbd className="px-3 py-1 bg-mission-control-bg border border-mission-control-border rounded text-sm font-mono text-mission-control-text-dim">
                        {shortcut.modifiers
                          .map((m) =>
                            m === 'cmd' ? '⌘' : m === 'shift' ? '⇧' : m === 'alt' ? '⌥' : '⌃'
                          )
                          .join('')}
                        {shortcut.currentKey.toUpperCase()}
                      </kbd>
                    </div>
                  ))}
                  <p className="pt-3 text-xs text-mission-control-text-dim">
                    ⌘ = Command &nbsp;·&nbsp; ⇧ = Shift &nbsp;·&nbsp; ⌥ = Option &nbsp;·&nbsp; ⌃ = Control
                  </p>
                </div>
              </section>
            )}

            {activeSection === 'automation' && (
              <section>
                <h2 className="text-heading-3 mb-4 flex items-center gap-2">
                  <Activity size={16} /> Automation
                </h2>
                <div className="bg-mission-control-surface rounded-xl border border-mission-control-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        External Actions
                        {settings.externalActionsEnabled ? (
                          <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded">
                            LIVE
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-mission-control-text-dim mt-0.5">
                        {settings.externalActionsEnabled
                          ? 'Approved agent actions (emails, posts) will execute'
                          : 'All external actions blocked — agents can plan but not execute'}
                      </div>
                    </div>
                    <Toggle
                      checked={settings.externalActionsEnabled}
                      onChange={(checked) =>
                        setSettings((s) => ({ ...s, externalActionsEnabled: checked }))
                      }
                      colorScheme="green"
                    />
                  </div>

                  <div className="p-4 bg-info-subtle border border-info-border rounded-lg text-sm text-info space-y-2">
                    <div className="font-medium flex items-center gap-2">
                      <Shield size={14} /> Approval Gate
                    </div>
                    <p>
                      Agents call{' '}
                      <code className="text-xs bg-black/20 px-1 rounded">approval_create</code>{' '}
                      before any external action. The Approvals panel lets you review and approve or
                      reject each one before it executes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium"
                  >
                    {saved ? <Check size={16} /> : <Save size={16} />}
                    {saved ? 'Saved!' : 'Save Settings'}
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'accounts' && <ConnectedAccountsPanel />}
            {activeSection === 'exportBackup' && <ExportBackupTab />}
            {activeSection === 'platform' && <PlatformUpdateTab />}
            {activeSection === 'budgets' && <BudgetDashboard />}
          </div>
        </div>
      </div>
    </div>
  );
}
