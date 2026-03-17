import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  Settings, Wifi, Volume2, Bell, Moon, Sun, Palette, Save, RotateCcw, Check, Trash2, RefreshCw, AlertTriangle, Shield,
  Link as LinkIcon, Download, Upload, Type, Keyboard, Monitor, Search,
  ChevronDown, ChevronRight, Info, Zap, Code, Eye, HardDrive, Cpu, Play, Archive, Bot, Package, Terminal, ExternalLink,
  Key, TestTube, EyeOff, AlertCircle, CircleOff, FileJson, Coins, CheckCircle, MessageSquare, Loader2,
} from 'lucide-react';
import { useStore } from '../store/store';
import { useUserSettings } from '../store/userSettings';
import { settingsApi } from '../lib/api';
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
  { id: 'twitter', name: 'Social Media', description: 'Navigate to Social Media', defaultKey: '6', currentKey: '6', modifiers: ['cmd'] },
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
  gatewayUrl: '',
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
  
  root.style.setProperty('--mission-control-accent', accentColor);
  
  const hex = accentColor.replace('#', '');
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
  root.style.setProperty('--mission-control-font', fontMap[fontFamily] || fontMap.system);
  root.style.setProperty('--mission-control-font-size', `${fontSize}px`);
}

type Tab = 'general' | 'appearance' | 'notifications' | 'shortcuts' | 'security' | 'automation' | 'accounts' | 'config' | 'logs' | 'performance' | 'data' | 'accessibility' | 'developer' | 'platform' | 'sessions';

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
        <h2 className="text-heading-3 flex items-center gap-2 group-hover:text-mission-control-accent transition-colors">
          {icon}
          {title}
        </h2>
        {isOpen ? <ChevronDown size={16} className="text-mission-control-text-dim" /> : <ChevronRight size={16} className="text-mission-control-text-dim" />}
      </button>
      {description && (
        <p className="text-sm text-mission-control-text-dim mb-3">{description}</p>
      )}
      {isOpen && (
        <div className="bg-mission-control-surface rounded-2xl border border-mission-control-border p-4">
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
        className="text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
      >
        <Info size={14} />
      </button>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-mission-control-bg border border-mission-control-border rounded-lg shadow-lg text-xs whitespace-nowrap">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-mission-control-border" />
        </div>
      )}
    </div>
  );
}

// ─── Platform Update Tab ──────────────────────────────────────────────────────

function PlatformUpdateTab() {
  const [versionInfo, setVersionInfo] = useState<{
    current: string; latest: string | null; updateAvailable: boolean;
    releaseNotes: string | null; error?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [updateResult, setUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { checkVersion(); }, []);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [updateLog]);
  useEffect(() => {
    if (reloadCountdown === null) return;
    if (reloadCountdown <= 0) { window.location.reload(); return; }
    const t = setTimeout(() => setReloadCountdown(c => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [reloadCountdown]);

  const checkVersion = async (force = false) => {
    setChecking(true);
    try {
      const res = await fetch(force ? '/api/update?force=1' : '/api/update');
      const data = await res.json();
      setVersionInfo(data);
    } catch { /* network error */ }
    setChecking(false);
  };

  const runUpdate = async () => {
    setUpdating(true);
    setUpdateLog([]);
    setUpdateResult(null);
    try {
      const res = await fetch('/api/update', { method: 'POST' });
      if (!res.body) throw new Error('No stream');
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
          if (!line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.line !== undefined) setUpdateLog(prev => [...prev, payload.line]);
            if (payload.done) {
              setUpdateResult({ success: payload.success, message: payload.message });
              if (payload.success) setReloadCountdown(10);
            }
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err) {
      setUpdateResult({ success: false, message: err instanceof Error ? err.message : 'Update failed' });
    }
    setUpdating(false);
  };

  return (
    <div className="space-y-6">
      {/* Version card */}
      <div className="p-5 bg-mission-control-surface rounded-lg border border-mission-control-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-mission-control-accent/10 flex items-center justify-center">
            <Package size={20} className="text-mission-control-accent" />
          </div>
          <div>
            <div className="font-semibold text-mission-control-text">Mission Control</div>
            <div className="text-xs text-mission-control-text-dim">froggo-mission-control</div>
          </div>
          <button onClick={() => checkVersion(true)} disabled={checking} className="ml-auto p-2 rounded-lg hover:bg-mission-control-border transition-colors text-mission-control-text-dim" title="Check for updates">
            <RefreshCw size={15} className={checking ? 'animate-spin' : ''} />
          </button>
        </div>

        {versionInfo ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-mission-control-text-dim">Installed</span>
              <span className="font-mono text-mission-control-text">v{versionInfo.current}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mission-control-text-dim">Latest</span>
              <span className={`font-mono ${versionInfo.latest ? 'text-mission-control-text' : 'text-mission-control-text-dim'}`}>
                {versionInfo.latest ? `v${versionInfo.latest}` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mission-control-text-dim">Status</span>
              {versionInfo.updateAvailable ? (
                <span className="px-2 py-0.5 bg-warning-subtle text-warning rounded-full text-xs font-medium">Update available</span>
              ) : (
                <span className="px-2 py-0.5 bg-success-subtle text-success rounded-full text-xs font-medium">Up to date</span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-mission-control-text-dim">{checking ? 'Checking...' : 'Click refresh to check version'}</div>
        )}
      </div>

      {/* Release notes */}
      {versionInfo?.releaseNotes && (
        <div className="p-4 bg-mission-control-surface rounded-lg border border-mission-control-border">
          <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-2">
            What&apos;s in v{versionInfo.latest}
          </div>
          <div className="text-sm text-mission-control-text whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {versionInfo.releaseNotes}
          </div>
        </div>
      )}

      {/* Update button */}
      {versionInfo?.updateAvailable && !updateResult && (
        <button
          onClick={runUpdate}
          disabled={updating}
          className="w-full py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors flex items-center justify-center gap-2 font-medium disabled:opacity-60"
        >
          {updating ? <><RefreshCw size={16} className="animate-spin" /> Installing...</> : <><Download size={16} /> Install v{versionInfo.latest}</>}
        </button>
      )}

      {/* Live install log */}
      {updateLog.length > 0 && (
        <div className="bg-black/60 rounded-lg border border-mission-control-border p-4 font-mono text-xs space-y-1 max-h-56 overflow-y-auto">
          <div className="flex items-center gap-2 text-mission-control-text-dim mb-2">
            <Terminal size={12} />
            <span>Install log</span>
          </div>
          {updateLog.filter(Boolean).map((line, i) => (
            <div key={i} className="text-success/90">{line}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {/* Result banner */}
      {updateResult && (
        <div className={`p-4 rounded-lg border ${updateResult.success ? 'bg-success-subtle border-success-border' : 'bg-error-subtle border-error-border'}`}>
          <div className={`font-medium text-sm ${updateResult.success ? 'text-success' : 'text-error'}`}>
            {updateResult.success ? 'Update complete' : 'Update failed'}
          </div>
          <div className="text-xs text-mission-control-text-dim mt-1">{updateResult.message}</div>
          {updateResult.success && reloadCountdown !== null && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-xs text-mission-control-text-dim">
                Reloading in {reloadCountdown}s...
              </span>
              <button
                onClick={() => window.location.reload()}
                className="text-xs px-3 py-1.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium"
              >
                Reload now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manual install hint */}
      <div className="p-4 bg-mission-control-surface/50 rounded-lg border border-mission-control-border">
        <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wider mb-2">Manual update</div>
        <div className="flex items-center gap-2 font-mono text-xs bg-black/40 rounded-lg px-3 py-2 text-mission-control-text-dim">
          <Terminal size={11} />
          npm install -g froggo-mission-control@latest
        </div>
        <a
          href="https://github.com/ProfFroggo/froggo-mission-control/releases"
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1 text-xs text-mission-control-accent hover:underline"
        >
          <ExternalLink size={11} /> View all releases on GitHub
        </a>
      </div>
    </div>
  );
}

// ─── Sessions Management Section ──────────────────────────────────────────────

interface SessionItem {
  key: string;
  agentId: string;
  agentName: string;
  surface: string;
  messageCount: number;
  lastActivity: number;
  createdAt: number;
  compacted: boolean;
}

interface SessionsSummary {
  totalSessions: number;
  totalMessages: number;
  oldestSession: number | null;
  mostActiveAgent: string | null;
}

function SessionsManagementSection() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [summary, setSummary] = useState<SessionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/stats');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setSummary(data.summary || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleDelete = async (key: string) => {
    if (!confirm('Delete this session and all its messages?')) return;
    setDeletingKey(key);
    try {
      const res = await fetch(`/api/sessions/stats?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.key !== key));
        showToast('Session deleted', 'success');
        fetchSessions(); // refresh summary
      }
    } catch {
      showToast('Failed to delete session', 'error');
    }
    setDeletingKey(null);
  };

  const handleExport = async (key: string) => {
    setExportingKey(key);
    try {
      const res = await fetch('/api/sessions/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'export', key }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.markdown) {
          const blob = new Blob([data.markdown], { type: 'text/markdown' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `session-${key.replace(/[:/]/g, '-')}.md`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('Session exported', 'success');
        }
      }
    } catch {
      showToast('Failed to export session', 'error');
    }
    setExportingKey(null);
  };

  const formatAge = (ms: number) => {
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Group sessions by surface
  const grouped: Record<string, SessionItem[]> = {};
  for (const s of sessions) {
    const group = s.surface || 'other';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(s);
  }

  const surfaceLabels: Record<string, string> = {
    chat: 'Chat',
    social: 'Social',
    task: 'Task',
    room: 'Room',
    cron: 'Cron',
    library: 'Library',
    other: 'Other',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-mission-control-text-dim">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading sessions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3">
            <div className="text-lg font-semibold text-mission-control-text">{summary.totalSessions}</div>
            <div className="text-xs text-mission-control-text-dim">Total sessions</div>
          </div>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3">
            <div className="text-lg font-semibold text-mission-control-text">{summary.totalMessages}</div>
            <div className="text-xs text-mission-control-text-dim">Total messages</div>
          </div>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3">
            <div className="text-lg font-semibold text-mission-control-text">
              {summary.oldestSession ? formatAge(summary.oldestSession) : '--'}
            </div>
            <div className="text-xs text-mission-control-text-dim">Oldest session</div>
          </div>
          <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-3">
            <div className="text-lg font-semibold text-mission-control-text truncate">
              {summary.mostActiveAgent || '--'}
            </div>
            <div className="text-xs text-mission-control-text-dim">Most active agent</div>
          </div>
        </div>
      )}

      {/* Sessions grouped by surface */}
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-mission-control-text-dim">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No sessions yet</p>
        </div>
      ) : (
        Object.entries(grouped).map(([surface, items]) => (
          <div key={surface}>
            <h3 className="text-sm font-semibold text-mission-control-text mb-2">
              {surfaceLabels[surface] || surface} ({items.length})
            </h3>
            <div className="space-y-1">
              {items.map(s => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2.5 bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-mission-control-text truncate">{s.agentName}</span>
                      {s.compacted && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-info-subtle text-info rounded">compacted</span>
                      )}
                    </div>
                    <div className="text-[11px] text-mission-control-text-dim truncate">
                      {s.key}
                    </div>
                    <div className="flex gap-3 text-[10px] text-mission-control-text-dim mt-0.5">
                      <span>{s.messageCount} msgs</span>
                      <span>Last: {formatAge(s.lastActivity)}</span>
                      <span>Created: {formatAge(s.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      onClick={() => handleExport(s.key)}
                      disabled={exportingKey === s.key}
                      title="Export as markdown"
                      className="p-1.5 text-mission-control-text-dim hover:text-mission-control-text rounded transition-colors disabled:opacity-50"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.key)}
                      disabled={deletingKey === s.key}
                      title="Delete session"
                      className="p-1.5 text-mission-control-text-dim hover:text-error rounded transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Platform Info Section ─────────────────────────────────────────────────────

function PlatformInfoSection() {
  const [info, setInfo] = useState<{
    gitBranch: string | null;
    gitCommit: string | null;
    agentsTotal: number;
    modulesTotal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setInfo({
            gitBranch: data.gitBranch ?? null,
            gitCommit: data.gitCommit ?? null,
            agentsTotal: data.agentsTotal ?? 0,
            modulesTotal: data.modulesTotal ?? 0,
          });
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, []);

  const rows: { label: string; value: ReactNode }[] = [
    {
      label: 'Branch',
      value: info?.gitBranch
        ? <span className="font-mono text-mission-control-text">{info.gitBranch}</span>
        : <span className="text-mission-control-text-dim">—</span>,
    },
    {
      label: 'Commit',
      value: info?.gitCommit
        ? <span className="font-mono text-mission-control-text">{info.gitCommit}</span>
        : <span className="text-mission-control-text-dim">—</span>,
    },
    {
      label: 'Registered agents',
      value: <span className="font-semibold text-mission-control-text">{info?.agentsTotal ?? '—'}</span>,
    },
    {
      label: 'Registered modules',
      value: <span className="font-semibold text-mission-control-text">{info?.modulesTotal ?? '—'}</span>,
    },
  ];

  return (
    <div className="p-5 bg-mission-control-surface rounded-lg border border-mission-control-border">
      <div className="flex items-center gap-2 mb-4">
        <Info size={16} className="text-mission-control-text-dim" />
        <span className="text-sm font-semibold text-mission-control-text">System Information</span>
      </div>
      {loading ? (
        <div className="text-sm text-mission-control-text-dim">Loading...</div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-mission-control-text-dim">{row.label}</span>
              {row.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agent Platform Section ────────────────────────────────────────────────────

function AgentPlatformSection() {
  const [modelDefaults, setModelDefaults] = useState<{ lead: string; worker: string; trivial: string }>({
    lead: '', worker: '', trivial: '',
  });
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [preReview, setPreReview] = useState(true);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [claraStrictness, setClaraStrictness] = useState<'lenient' | 'standard' | 'strict'>('standard');
  const [claraAutoDispatch, setClaraAutoDispatch] = useState(true);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setModelDefaults({
            lead:    data['agent.model.lead']    || 'claude-opus-4-5',
            worker:  data['agent.model.worker']  || 'claude-sonnet-4-5',
            trivial: data['agent.model.trivial'] || 'claude-haiku-3-5',
          });
          if (data['agent.autoDispatch'] !== undefined) setAutoDispatch(data['agent.autoDispatch'] !== 'false');
          if (data['agent.preReview'] !== undefined) setPreReview(data['agent.preReview'] !== 'false');
          if (data['agent.maxConcurrent']) setMaxConcurrent(parseInt(data['agent.maxConcurrent']) || 3);
          if (data['clara.reviewStrictness']) setClaraStrictness(data['clara.reviewStrictness'] as 'lenient' | 'standard' | 'strict');
          if (data['clara.autoDispatch'] !== undefined) setClaraAutoDispatch(data['clara.autoDispatch'] !== 'false');
        }
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, []);

  const savePlatform = async () => {
    setPlatformSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'agent.model.lead':    modelDefaults.lead,
          'agent.model.worker':  modelDefaults.worker,
          'agent.model.trivial': modelDefaults.trivial,
          'agent.autoDispatch':       String(autoDispatch),
          'agent.preReview':          String(preReview),
          'agent.maxConcurrent':      String(maxConcurrent),
          'clara.reviewStrictness':   claraStrictness,
          'clara.autoDispatch':       String(claraAutoDispatch),
        }),
      });
      showToast('success', 'Platform settings saved');
    } catch {
      showToast('error', 'Failed to save platform settings');
    }
    setPlatformSaving(false);
  };

  const MODEL_OPTIONS = [
    { value: 'claude-opus-4-5',   label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5' },
    { value: 'claude-opus-4-0',   label: 'Claude Opus 4.0' },
    { value: 'claude-sonnet-3-7', label: 'Claude Sonnet 3.7' },
  ];

  if (!loaded) return null;

  return (
    <CollapsibleSection title="Agent Platform" icon={<Bot size={16} />} description="Model defaults, dispatch, and concurrency">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide">Default models per agent tier</div>
          {(['lead', 'worker', 'trivial'] as const).map(tier => (
            <div key={tier} className="flex items-center gap-3">
              <label className="text-sm font-medium text-mission-control-text capitalize w-16 shrink-0">{tier}</label>
              <select
                value={modelDefaults[tier]}
                onChange={e => setModelDefaults(p => ({ ...p, [tier]: e.target.value }))}
                className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-mission-control-accent"
              >
                {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="border-t border-mission-control-border pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Auto-dispatch tasks</div>
              <div className="text-xs text-mission-control-text-dim">Automatically send tasks to agents when assigned</div>
            </div>
            <Toggle checked={autoDispatch} onChange={setAutoDispatch} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Pre-review gate (Clara)</div>
              <div className="text-xs text-mission-control-text-dim">Clara reviews tasks before dispatch to agents</div>
            </div>
            <Toggle checked={preReview} onChange={setPreReview} />
          </div>
          {preReview && (
            <>
              <div className="flex items-center gap-3 pl-4 border-l-2 border-mission-control-border">
                <label className="text-sm font-medium text-mission-control-text w-28 shrink-0">Review strictness</label>
                <select
                  value={claraStrictness}
                  onChange={e => setClaraStrictness(e.target.value as 'lenient' | 'standard' | 'strict')}
                  className="flex-1 bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-mission-control-accent"
                >
                  <option value="lenient">Lenient — approve if basic gates pass</option>
                  <option value="standard">Standard — balanced review (default)</option>
                  <option value="strict">Strict — require detailed planning notes</option>
                </select>
              </div>
              <div className="flex items-center justify-between pl-4 border-l-2 border-mission-control-border">
                <div>
                  <div className="font-medium text-sm">Auto-dispatch after pre-review approval</div>
                  <div className="text-xs text-mission-control-text-dim">Immediately dispatch agent when Clara approves</div>
                </div>
                <Toggle checked={claraAutoDispatch} onChange={setClaraAutoDispatch} />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-mission-control-text mb-2">
              Max concurrent tasks per agent: <span className="font-semibold text-mission-control-text">{maxConcurrent}</span>
            </label>
            <input
              type="range" min={1} max={10} step={1}
              value={maxConcurrent}
              onChange={e => setMaxConcurrent(parseInt(e.target.value))}
              className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
            />
            <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
              <span>1 (sequential)</span><span>5</span><span>10 (max parallel)</span>
            </div>
          </div>
        </div>
        <button
          onClick={savePlatform}
          disabled={platformSaving}
          className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60"
        >
          {platformSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          Save platform settings
        </button>
      </div>
    </CollapsibleSection>
  );
}

// ─── Token Budget Section ──────────────────────────────────────────────────────

function TokenBudgetSection() {
  const [budgetUsd, setBudgetUsd] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentCost, setCurrentCost] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, usageRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/token-usage?days=30'),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json() as Record<string, string>;
          if (data['token_budget_usd']) setBudgetUsd(data['token_budget_usd']);
        }
        if (usageRes.ok) {
          const usage = await usageRes.json() as { totalCost?: number };
          if (typeof usage.totalCost === 'number') setCurrentCost(usage.totalCost);
        }
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, []);

  const saveBudget = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_budget_usd: budgetUsd }),
      });
      if (res.ok) showToast('success', 'Token budget saved');
      else showToast('error', 'Failed to save budget');
    } catch {
      showToast('error', 'Failed to save budget');
    }
    setSaving(false);
  };

  const budget = parseFloat(budgetUsd) || 0;
  const pct = budget > 0 && currentCost !== null ? (currentCost / budget) * 100 : 0;
  const isOver = pct >= 100;
  const isWarn = pct >= 80 && !isOver;

  if (!loaded) return null;

  return (
    <CollapsibleSection
      title="Token Budget"
      icon={<Coins size={16} />}
      description="Set a monthly spend limit and track current usage"
      defaultOpen={false}
    >
      <div className="space-y-4">
        {currentCost !== null && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-mission-control-text-dim">This month (30d)</span>
              <span className={`tabular-nums ${isOver ? 'text-error font-semibold' : isWarn ? 'text-warning font-semibold' : 'text-mission-control-text'}`}>
                ${currentCost.toFixed(4)}{budget > 0 ? ` / $${budget.toFixed(2)}` : ''}
              </span>
            </div>
            {budget > 0 && (
              <div className="h-2 bg-mission-control-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: isOver ? 'var(--color-error, #ef4444)' : isWarn ? 'var(--color-warning, #f59e0b)' : 'var(--color-accent)',
                  }}
                />
              </div>
            )}
            {(isWarn || isOver) && (
              <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${isOver ? 'bg-error-subtle text-error border border-error-border' : 'bg-warning-subtle text-warning border border-warning-border'}`}>
                <AlertTriangle size={13} />
                {isOver
                  ? `Budget exceeded (${pct.toFixed(0)}% used)`
                  : `Approaching budget limit (${pct.toFixed(0)}% used)`}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <label htmlFor="token-budget-input" className="text-sm font-medium text-mission-control-text shrink-0 w-40">
            Monthly budget (USD)
          </label>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-mission-control-text-dim text-sm">$</span>
            <input
              id="token-budget-input"
              type="number"
              min="0"
              step="1"
              value={budgetUsd}
              onChange={e => setBudgetUsd(e.target.value)}
              placeholder="e.g. 50"
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-mission-control-border bg-mission-control-bg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            />
            <button
              type="button"
              onClick={saveBudget}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-mission-control-accent text-white hover:bg-mission-control-accent/80 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <p className="text-xs text-mission-control-text-dim">
          Set to 0 to disable. A warning appears at 80% and an alert at 100% of budget.
        </p>
      </div>
    </CollapsibleSection>
  );
}

// ─── API Keys Section ──────────────────────────────────────────────────────────

const API_KEY_PROVIDERS = [
  { id: 'anthropic_api_key',     label: 'Anthropic',           placeholder: 'sk-ant-...',   group: 'AI' },
  { id: 'gemini_api_key',        label: 'Google Gemini',       placeholder: 'AIzaSy...',    group: 'AI' },
  { id: 'twitter_api_key',       label: 'X / Twitter API Key', placeholder: 'API key',      group: 'Social' },
  { id: 'twitter_api_secret',    label: 'X / Twitter Secret',  placeholder: 'API secret',   group: 'Social' },
  { id: 'twitter_oauth_client_id',    label: 'X OAuth Client ID',   placeholder: 'Client ID',    group: 'Social' },
  { id: 'twitter_oauth_client_secret', label: 'X OAuth Client Secret', placeholder: 'Client secret', group: 'Social' },
  { id: 'twitter_bearer_token',  label: 'X / Twitter Bearer',  placeholder: 'AAAA...',      group: 'Social' },
  { id: 'github_token',          label: 'GitHub',              placeholder: 'ghp_...',      group: 'Dev' },
  { id: 'discord_bot_token',     label: 'Discord Bot',         placeholder: 'Bot token',    group: 'Social' },
  { id: 'slack_bot_token',       label: 'Slack Bot',           placeholder: 'xoxb-...',     group: 'Social' },
  { id: 'sendgrid_api_key',      label: 'SendGrid',            placeholder: 'SG...',        group: 'Email' },
  { id: 'elevenlabs_api_key',    label: 'ElevenLabs',          placeholder: 'API key',      group: 'AI' },
  { id: 'birdeye_api_key',       label: 'Birdeye',             placeholder: 'API key',      group: 'DeFi' },
  { id: 'helius_api_key',        label: 'Helius',              placeholder: 'API key',      group: 'DeFi' },
  { id: 'perplexity_api_key',    label: 'Perplexity',          placeholder: 'pplx-...',     group: 'AI' },
  { id: 'replicate_api_key',     label: 'Replicate',           placeholder: 'r8_...',       group: 'AI' },
] as const;

function ApiKeysSection() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const loaded: Record<string, string> = {};
      const results = await Promise.allSettled(
        API_KEY_PROVIDERS.map(p => fetch(`/api/settings/${p.id}`).then(r => r.json()))
      );
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value?.value) {
          loaded[API_KEY_PROVIDERS[i].id] = r.value.value;
        }
      });
      setValues(loaded);
    })();
  }, []);

  const doSave = async (id: string) => {
    setSaving(p => ({ ...p, [id]: true }));
    try {
      await fetch(`/api/settings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: values[id] }),
      });
      showToast('success', 'API key saved to keychain');
    } catch {
      showToast('error', 'Failed to save key');
    }
    setSaving(p => ({ ...p, [id]: false }));
  };

  const doDelete = async (id: string) => {
    try {
      await fetch(`/api/settings/${id}`, { method: 'DELETE' });
      setValues(p => { const n = { ...p }; delete n[id]; return n; });
      showToast('success', 'Key removed');
    } catch {
      showToast('error', 'Failed to remove key');
    }
  };

  // Group by category
  const groups = Array.from(new Set(API_KEY_PROVIDERS.map(p => p.group)));

  return (
    <CollapsibleSection title="API Keys" icon={<Key size={16} />} description="All keys stored in OS keychain" defaultOpen={false}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs text-mission-control-text-dim">{Object.keys(values).filter(k => values[k]).length} configured</span>
          <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-mission-control-text-dim hover:text-mission-control-text flex items-center gap-1">
            {showKeys ? <EyeOff size={12} /> : <Eye size={12} />} {showKeys ? 'Hide all' : 'Show all'}
          </button>
        </div>
        {groups.map(group => {
          const providers = API_KEY_PROVIDERS.filter(p => p.group === group);
          return (
            <div key={group}>
              <h4 className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wider mb-2">{group}</h4>
              <div className="space-y-2">
                {providers.map(p => {
                  const hasValue = !!values[p.id]?.trim();
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="w-28 flex-shrink-0">
                        <span className="text-sm text-mission-control-text">{p.label}</span>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type={showKeys ? 'text' : 'password'}
                          value={values[p.id] || ''}
                          onChange={e => setValues(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={p.placeholder}
                          className="w-full bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-mission-control-accent font-mono"
                        />
                        {hasValue && <CheckCircle size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-success" />}
                      </div>
                      <button
                        onClick={() => doSave(p.id)}
                        disabled={saving[p.id] || !values[p.id]?.trim()}
                        className="px-2.5 py-1.5 rounded-lg bg-mission-control-accent text-white text-xs font-medium hover:bg-mission-control-accent-dim disabled:opacity-40 transition-colors"
                      >
                        {saving[p.id] ? <RefreshCw size={12} className="animate-spin" /> : 'Save'}
                      </button>
                      {hasValue && (
                        <button
                          onClick={() => doDelete(p.id)}
                          className="px-2 py-1.5 rounded-lg text-xs text-mission-control-text-dim hover:text-error hover:bg-error-subtle transition-colors"
                          title="Remove key"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

// ─── Danger Zone Section ───────────────────────────────────────────────────────

function DangerZoneSection() {
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const clearCompleted = async () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 4000); return; }
    setClearConfirm(false);
    setClearing(true);
    try {
      const res = await fetch('/api/tasks?status=done');
      if (!res.ok) throw new Error('fetch failed');
      const tasks = await res.json() as { id: string }[];
      await Promise.allSettled(tasks.map(t => fetch(`/api/tasks/${t.id}`, { method: 'DELETE' })));
      showToast('success', `Cleared ${tasks.length} completed tasks`);
    } catch {
      showToast('error', 'Failed to clear tasks');
    }
    setClearing(false);
  };

  const resetCircuits = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/settings/reset-circuits', { method: 'POST' });
      const data = await res.json();
      showToast('success', data.message || 'Circuit breakers reset');
    } catch {
      showToast('error', 'Failed to reset circuits');
    }
    setResetting(false);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const [tasksRes, approvalsRes] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/approvals').then(r => r.json()),
      ]);
      const payload = { exportedAt: new Date().toISOString(), tasks: tasksRes, approvals: approvalsRes };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `mission-control-export-${new Date().toISOString().split('T')[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Data exported');
    } catch {
      showToast('error', 'Export failed');
    }
    setExporting(false);
  };

  return (
    <CollapsibleSection
      title="Danger Zone"
      icon={<AlertCircle size={16} />}
      description="Irreversible actions — proceed carefully"
      defaultOpen={false}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg border border-mission-control-border bg-mission-control-bg">
          <div>
            <div className="text-sm font-medium">Clear completed tasks</div>
            <div className="text-xs text-mission-control-text-dim">Permanently delete all tasks with status &quot;done&quot;</div>
          </div>
          <button
            onClick={clearCompleted}
            disabled={clearing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 ${
              clearConfirm
                ? 'bg-error text-white'
                : 'border border-error-border text-error hover:bg-error-subtle'
            }`}
          >
            {clearing ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {clearConfirm ? 'Confirm — clear all done tasks' : 'Clear completed'}
          </button>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-mission-control-border bg-mission-control-bg">
          <div>
            <div className="text-sm font-medium">Reset agent circuits</div>
            <div className="text-xs text-mission-control-text-dim">Clears circuit breaker locks — allows locked agents to accept tasks again</div>
          </div>
          <button
            onClick={resetCircuits}
            disabled={resetting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-warning-border text-warning text-xs font-semibold hover:bg-warning-subtle transition-colors disabled:opacity-60"
          >
            {resetting ? <RefreshCw size={12} className="animate-spin" /> : <CircleOff size={12} />}
            Reset circuits
          </button>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-mission-control-border bg-mission-control-bg">
          <div>
            <div className="text-sm font-medium">Export all data</div>
            <div className="text-xs text-mission-control-text-dim">Download tasks and approvals as a JSON archive</div>
          </div>
          <button
            onClick={exportData}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-mission-control-border text-mission-control-text-dim text-xs font-semibold hover:bg-mission-control-surface hover:text-mission-control-text transition-colors disabled:opacity-60"
          >
            {exporting ? <RefreshCw size={12} className="animate-spin" /> : <FileJson size={12} />}
            Export JSON
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ─── Automation Execution Section ─────────────────────────────────────────────

function AutomationExecutionSection() {
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [maxConcurrentAutomations, setMaxConcurrentAutomations] = useState(3);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data['automation.enabled'] !== undefined) setAutomationEnabled(data['automation.enabled'] !== 'false');
          if (data['automation.maxConcurrent']) setMaxConcurrentAutomations(parseInt(data['automation.maxConcurrent']) || 3);
        }
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          'automation.enabled': String(automationEnabled),
          'automation.maxConcurrent': String(maxConcurrentAutomations),
        }),
      });
      showToast('success', 'Automation settings saved');
    } catch {
      showToast('error', 'Failed to save automation settings');
    }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <CollapsibleSection title="Automation Execution" icon={<Zap size={16} />} description="Global automation execution controls">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Enable automation execution</div>
            <div className="text-xs text-mission-control-text-dim">Allow n8n automations and scheduled tasks to run</div>
          </div>
          <Toggle checked={automationEnabled} onChange={setAutomationEnabled} />
        </div>
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Max concurrent automations: <span className="font-semibold text-mission-control-text">{maxConcurrentAutomations}</span>
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxConcurrentAutomations}
            onChange={e => setMaxConcurrentAutomations(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-32 bg-mission-control-bg border border-mission-control-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-mission-control-accent"
          />
          <div className="text-xs text-mission-control-text-dim mt-1">Allowed range: 1–10</div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-mission-control-accent text-white rounded-lg text-sm font-medium hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
          Save automation settings
        </button>
      </div>
    </CollapsibleSection>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EnhancedSettingsPanel() {
  const { connected } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = safeStorage.getItem('mission-control-settings');
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
    safeStorage.setItem('mission-control-settings', JSON.stringify(settings));

    try {
      await settingsApi.set('automation', {
        externalActionsEnabled: settings.externalActionsEnabled,
        rateLimitTweets: settings.rateLimitTweets,
        rateLimitEmails: settings.rateLimitEmails,
        defaultEmailAccount: settings.defaultEmailAccount,
        defaultCalendarAccount: settings.defaultCalendarAccount,
      });
    } catch (e) {
      showToast('error', 'Failed to save automation settings', String(e));
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2002);
    showToast('success', 'Settings saved', 'Your preferences have been updated');
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      setSettings(defaultSettings);
      safeStorage.removeItem('mission-control-settings');
      showToast('info', 'Settings reset', 'All settings restored to defaults');
    }
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
    <div className="h-full overflow-auto p-4">
      <div className="w-full">
        {/* Header with Search */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-heading-2 mb-2 flex items-center gap-2">
                <Settings size={24} /> Settings
              </h1>
              <p className="text-secondary">Configure Mission Control dashboard preferences</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  saved 
                    ? 'bg-success-subtle text-success' 
                    : 'bg-mission-control-accent text-white hover:bg-mission-control-accent-dim'
                }`}
              >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
            <input
              type="text"
              placeholder="Search settings..."
              aria-label="Search settings input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
            />
          </div>

          {/* Setting Presets */}
          {!searchQuery && (
            <div className="mt-4 flex gap-2">
              <span className="text-sm text-mission-control-text-dim self-center">Quick presets:</span>
              <button
                onClick={() => applyPreset('minimal')}
                className="px-3 py-1 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
              >
                Minimal
              </button>
              <button
                onClick={() => applyPreset('default')}
                className="px-3 py-1 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
              >
                Default
              </button>
              <button
                onClick={() => applyPreset('poweruser')}
                className="px-3 py-1 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg hover:border-mission-control-accent transition-colors"
              >
                Power User
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        {!searchQuery && (
          <div className="flex gap-2 mb-6 border-b border-mission-control-border overflow-x-auto scrollbar-hide pb-0">
            {[
              { id: 'general', label: 'General', icon: null },
              { id: 'appearance', label: 'Appearance', icon: <Palette size={14} /> },
              { id: 'notifications', label: 'Notifications', icon: <Bell size={14} /> },
              { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard size={14} /> },
              { id: 'performance', label: 'Performance', icon: <Cpu size={14} /> },
              { id: 'data', label: 'Data', icon: <HardDrive size={14} /> },
              { id: 'accessibility', label: 'Accessibility', icon: <Eye size={14} /> },
              { id: 'developer', label: 'Developer', icon: <Code size={14} /> },
              { id: 'automation', label: 'Automation', icon: <Zap size={14} /> },
              { id: 'accounts', label: 'Accounts', icon: <LinkIcon size={14} /> },
              { id: 'security', label: 'Security', icon: <Shield size={14} /> },
              { id: 'platform', label: 'Platform', icon: <Package size={14} /> },
              { id: 'sessions', label: 'Sessions', icon: <Terminal size={14} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 -mb-px ${
                  activeTab === tab.id
                    ? 'border-mission-control-accent text-mission-control-accent'
                    : 'border-transparent text-mission-control-text-dim hover:text-mission-control-text'
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
            {settingsMatch('connection system status') && (
              <CollapsibleSection
                title="System Status"
                icon={<Wifi size={16} />}
                description="Claude Code system overview"
              >
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-mission-control-text">Claude Code System</h3>
                  <div className="text-sm text-mission-control-text-dim space-y-1">
                    <div className="flex justify-between"><span>MCP Servers</span><span className="text-mission-control-text">mission-control-db &middot; memory &middot; cron</span></div>
                    <div className="flex justify-between"><span>Agents</span><span className="text-mission-control-text">13 defined</span></div>
                    <div className="flex justify-between"><span>Hooks</span><span className="text-mission-control-text">approval &middot; review-gate &middot; session-sync</span></div>
                    <div className="flex justify-between"><span>Vault</span><span className="text-mission-control-text-dim">~/mission-control/memory/</span></div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-mission-control-bg rounded-lg border border-mission-control-border">
                    <span className={`w-3 h-3 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
                    <span className="text-sm font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
                    {connected && <span className="text-xs text-mission-control-text-dim ml-auto">Active</span>}
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
                      <label htmlFor="default-panel" className="block text-sm font-medium text-mission-control-text">Default Panel on Startup</label>
                      <Tooltip text="This panel will open when you launch the app" />
                    </div>
                    <select
                      id="default-panel"
                      aria-label="Default panel on startup select"
                      value={settings.defaultPanel}
                      onChange={(e) => setSettings(s => ({ ...s, defaultPanel: e.target.value }))}
                      className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent"
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
                      <div className="text-sm text-mission-control-text-dim">Read responses aloud</div>
                    </div>
                    <Toggle 
                      checked={settings.voiceEnabled}
                      onChange={(checked) => setSettings(s => ({ ...s, voiceEnabled: checked }))}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <label htmlFor="speech-speed" className="block text-sm font-medium text-mission-control-text">
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
                      className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                      disabled={!settings.voiceEnabled}
                    />
                    <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
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
                      <div className="text-sm text-mission-control-text-dim">Automatically refresh sessions list</div>
                    </div>
                    <Toggle
                      checked={settings.autoRefresh}
                      onChange={(checked) => setSettings(s => ({ ...s, autoRefresh: checked }))}
                    />
                  </div>
                  {settings.autoRefresh && (
                    <div>
                      <label className="block text-sm font-medium text-mission-control-text mb-2">
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
                        className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                      />
                      <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
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
              </CollapsibleSection>
            )}

            {/* ── Agent Platform Section ── */}
            {settingsMatch('agent model defaults lead worker trivial dispatch pre-review clara concurrent') && (
              <AgentPlatformSection />
            )}

            {/* ── API Keys Section ── */}
            {settingsMatch('api key anthropic gemini secret token test') && (
              <ApiKeysSection />
            )}

            {/* ── Danger Zone Section ── */}
            {settingsMatch('danger zone clear completed tasks reset circuits export data json') && (
              <DangerZoneSection />
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
                    <label htmlFor="color-mode-select" className="block text-sm font-medium text-mission-control-text mb-2">Color Mode</label>
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
                              safeStorage.setItem('mission-control-settings', JSON.stringify(newSettings));
                              return newSettings;
                            });
                          }}
                          className={`py-3 px-4 rounded-lg border transition-colors ${
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
                    <label htmlFor="accent-color-picker" className="block text-sm font-medium text-mission-control-text mb-2">Accent Color</label>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#10b981'].map((color) => (
                        <button
                          key={color}
                          onClick={() => setSettings(s => ({ ...s, accentColor: color }))}
                          className={`w-12 h-12 rounded-full border-2 transition-transform hover:scale-110 ${
                            settings.accentColor === color ? 'border-white dark:border-white/80 scale-110 shadow-lg' : 'border-transparent'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Accent color ${color}`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="custom-accent-color" className="text-sm font-medium text-mission-control-text">Custom:</label>
                      <input
                        id="custom-accent-color"
                        type="color"
                        aria-label="Custom accent color picker"
                        value={settings.accentColor}
                        onChange={(e) => setSettings(s => ({ ...s, accentColor: e.target.value }))}
                        className="h-10 w-20 rounded-lg border border-mission-control-border cursor-pointer"
                      />
                      <span className="text-sm font-mono text-mission-control-text-dim">{settings.accentColor}</span>
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
                    <label htmlFor="font-family" className="block text-sm font-medium text-mission-control-text mb-2">Font Family</label>
                    <select
                      id="font-family"
                      aria-label="Font family select"
                      value={settings.fontFamily}
                      onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value }))}
                      className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 focus:outline-none focus:border-mission-control-accent"
                    >
                      <option value="system">System Default</option>
                      <option value="inter">Inter</option>
                      <option value="roboto-mono">Roboto Mono (Monospace)</option>
                      <option value="sf-pro">SF Pro Display</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mission-control-text mb-2">
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
                      className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
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
                    <span className="text-sm text-mission-control-text-dim">Click any shortcut to edit</span>
                    <button
                      onClick={resetShortcuts}
                      className="text-sm text-mission-control-text-dim hover:text-mission-control-accent transition-colors flex items-center gap-1"
                    >
                      <RotateCcw size={14} />
                      Reset to Defaults
                    </button>
                  </div>
                  {settings.keyboardShortcuts.map((shortcut) => (
                    <div key={shortcut.id} className="flex items-center justify-between py-3 border-b border-mission-control-border last:border-0">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{shortcut.name}</div>
                        <div className="text-xs text-mission-control-text-dim">{shortcut.description}</div>
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
                            className="w-24 px-2 py-1 text-center bg-mission-control-bg border border-mission-control-accent rounded-lg text-sm"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingShortcut(shortcut.id)}
                            className="px-3 py-1.5 bg-mission-control-bg border border-mission-control-border rounded-lg text-sm font-mono hover:border-mission-control-accent transition-colors"
                          >
                            {shortcut.modifiers.map(m => m === 'cmd' ? 'Cmd+' : m === 'shift' ? 'Shift+' : m === 'alt' ? 'Alt+' : 'Ctrl+').join('')}
                            {shortcut.currentKey.toUpperCase()}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 text-xs text-mission-control-text-dim space-y-1">
                    <p>• Press Enter to save or Escape to cancel</p>
                    <p>• Cmd = Command • Shift = Shift • Alt = Option • Ctrl = Control</p>
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
                      <div className="text-sm text-mission-control-text-dim">Cache responses for faster loading</div>
                    </div>
                    <Toggle
                      checked={settings.performance.enableCache}
                      onChange={(checked) => setSettings(s => ({ ...s, performance: { ...s.performance, enableCache: checked } }))}
                    />
                  </div>

                  {settings.performance.enableCache && (
                    <div>
                      <label className="block text-sm font-medium text-mission-control-text mb-2">
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
                        className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                      />
                      <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
                        <span>50 MB</span>
                        <span>500 MB</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-mission-control-text mb-2">
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
                      className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Lazy Loading</div>
                      <div className="text-sm text-mission-control-text-dim">Load content as needed</div>
                    </div>
                    <Toggle
                      checked={settings.performance.enableLazyLoading}
                      onChange={(checked) => setSettings(s => ({ ...s, performance: { ...s.performance, enableLazyLoading: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Animations</div>
                      <div className="text-sm text-mission-control-text-dim">Enable UI animations</div>
                    </div>
                    <Toggle
                      checked={settings.performance.animationsEnabled}
                      onChange={(checked) => setSettings(s => ({ ...s, performance: { ...s.performance, animationsEnabled: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">List Virtualization</div>
                      <div className="text-sm text-mission-control-text-dim">Render only visible items in long lists</div>
                    </div>
                    <Toggle
                      checked={settings.performance.enableVirtualization}
                      onChange={(checked) => setSettings(s => ({ ...s, performance: { ...s.performance, enableVirtualization: checked } }))}
                    />
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
                      <label className="block text-sm font-medium text-mission-control-text">
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
                      className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                    />
                    <div className="flex justify-between text-xs text-mission-control-text-dim mt-1">
                      <span>30 days</span>
                      <span>180 days</span>
                      <span>1 year</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Auto Cleanup</div>
                      <div className="text-sm text-mission-control-text-dim">Automatically delete old data</div>
                    </div>
                    <Toggle
                      checked={settings.data.autoCleanup}
                      onChange={(checked) => setSettings(s => ({ ...s, data: { ...s.data, autoCleanup: checked } }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-mission-control-text mb-2">
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
                      className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Usage Analytics</div>
                      <div className="text-sm text-mission-control-text-dim">Collect anonymous usage data</div>
                    </div>
                    <Toggle
                      checked={settings.data.enableAnalytics}
                      onChange={(checked) => setSettings(s => ({ ...s, data: { ...s.data, enableAnalytics: checked } }))}
                    />
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
                      <div className="text-sm text-mission-control-text-dim">Minimize animations and transitions</div>
                    </div>
                    <Toggle
                      checked={settings.accessibility.reduceMotion}
                      onChange={(checked) => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, reduceMotion: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">High Contrast</div>
                      <div className="text-sm text-mission-control-text-dim">Increase color contrast</div>
                    </div>
                    <Toggle
                      checked={settings.accessibility.highContrast}
                      onChange={(checked) => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, highContrast: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Large Text</div>
                      <div className="text-sm text-mission-control-text-dim">Use larger text sizes throughout</div>
                    </div>
                    <Toggle
                      checked={settings.accessibility.largeText}
                      onChange={(checked) => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, largeText: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Screen Reader Optimized</div>
                      <div className="text-sm text-mission-control-text-dim">Optimize for screen readers</div>
                    </div>
                    <Toggle
                      checked={settings.accessibility.screenReaderOptimized}
                      onChange={(checked) => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, screenReaderOptimized: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Keyboard Navigation Hints</div>
                      <div className="text-sm text-mission-control-text-dim">Show keyboard shortcuts in UI</div>
                    </div>
                    <Toggle
                      checked={settings.accessibility.keyboardNavigationHints}
                      onChange={(checked) => setSettings(s => ({ ...s, accessibility: { ...s.accessibility, keyboardNavigationHints: checked } }))}
                    />
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
                      <div className="text-sm text-mission-control-text-dim">Enable developer features</div>
                    </div>
                    <Toggle
                      checked={settings.developer.devMode}
                      onChange={(checked) => setSettings(s => ({ ...s, developer: { ...s.developer, devMode: checked } }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Show Debug Info</div>
                      <div className="text-sm text-mission-control-text-dim">Display debug information in UI</div>
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
                      <div className="text-sm text-mission-control-text-dim">Enable features in development</div>
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
                      <div className="text-sm text-mission-control-text-dim">Enable detailed console logs</div>
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
                      <div className="text-sm text-mission-control-text-dim">Show render times and stats</div>
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
            {settingsMatch('automation execution global enable disable concurrent') && (
              <AutomationExecutionSection />
            )}
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

                  <div className="flex items-center justify-between p-4 bg-mission-control-bg rounded-lg border-2 border-mission-control-border">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Kill Switch
                        {settings.externalActionsEnabled ? (
                          <span className="text-xs px-2 py-0.5 bg-success-subtle text-success rounded font-bold">LIVE</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-error-subtle text-error rounded font-bold">BLOCKED</span>
                        )}
                      </div>
                      <div className="text-sm text-mission-control-text-dim">
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
                          <label className="block text-sm font-medium text-mission-control-text">
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
                          className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <label className="block text-sm font-medium text-mission-control-text">
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
                          className="unstyled w-full h-2 rounded-full appearance-none cursor-pointer bg-mission-control-border [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-mission-control-accent"
                        />
                      </div>

                      <div className="p-4 bg-info-subtle border border-info-border rounded-lg">
                        <div className="flex items-start gap-2">
                          <Bot size={20} className="text-info flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-medium text-info mb-2">Smart Account Selection</div>
                            <div className="text-sm text-info space-y-2">
                              <p>Mission Control intelligently chooses accounts based on context:</p>
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

        {/* PLATFORM TAB */}
        {activeTab === 'platform' && (
          <div className="space-y-6">
            <PlatformInfoSection />
            <PlatformUpdateTab />
          </div>
        )}

        {/* SESSIONS TAB */}
        {activeTab === 'sessions' && !searchQuery && <SessionsManagementSection />}

        {/* Actions */}
        {!['security', 'accounts', 'config', 'logs', 'exportBackup', 'platform', 'sessions'].includes(activeTab) && (
          <div className="flex gap-3 mt-8 sticky bottom-0 bg-mission-control-bg/95 backdrop-blur-sm pt-4 pb-2 border-t border-mission-control-border">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
            >
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-mission-control-border text-mission-control-text-dim rounded-lg hover:bg-mission-control-border/80 transition-colors flex items-center gap-2"
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
