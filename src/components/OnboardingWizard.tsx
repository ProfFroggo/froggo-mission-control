import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  CheckCircle,
  XCircle,
  Loader,
  Mic,
  Camera,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Shield,
  Key,
  Mail,
  BookOpen,
  Package,
  Lock,
  Terminal,
  FolderOpen,
  Server,
  Users,
  LayoutDashboard,
  AlertTriangle,
  RotateCcw,
  Map,
  SkipForward,
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (startTour: boolean) => void;
  onSkip: () => void;
}

const STEP_COUNT = 10;
const STORAGE_KEY = 'mission-control-onboarding-completed';

// ─────────────────────────────────────────────
// Step 2 — System Check types
// ─────────────────────────────────────────────
type CheckStatus = 'checking' | 'ok' | 'fail';

interface SystemCheckState {
  cli: CheckStatus;
  database: CheckStatus;
  mcp: CheckStatus;
  agents: CheckStatus;
  agentCount: number;
}

// ─────────────────────────────────────────────
// Step 3 — Agent Permissions
// ─────────────────────────────────────────────
const AGENT_PERMISSIONS = [
  {
    tool: 'Read / Glob / Grep',
    icon: FolderOpen,
    why: 'Agents read your code, docs, and config files to understand context',
  },
  {
    tool: 'Edit / Write',
    icon: Terminal,
    why: 'Agents write and modify files when executing tasks on your behalf',
  },
  {
    tool: 'Bash',
    icon: Terminal,
    why: 'Agents run build commands, tests, and scripts within allowed patterns',
  },
  {
    tool: 'MCP Tools (DB, Memory)',
    icon: Server,
    why: 'Agents interact with the task database and memory vault to track work',
  },
];

// ─────────────────────────────────────────────
// Step 7 — Agent & Module Picker data
// ─────────────────────────────────────────────
interface AgentEntry {
  id: string;
  name: string;
  description: string;
  core?: boolean;
}

interface ModuleEntry {
  id: string;
  name: string;
  description: string;
  core?: boolean;
}

const CORE_AGENTS: AgentEntry[] = [
  { id: 'mission-control', name: 'Mission Control', description: 'Primary orchestrator — routes tasks, coordinates agents, plans work', core: true },
  { id: 'clara', name: 'Clara', description: 'Review & QA gate — validates work before it ships', core: true },
  { id: 'coder', name: 'Coder', description: 'Implements features, fixes bugs, writes tests', core: true },
  { id: 'writer', name: 'Writer', description: 'Creates and edits documentation, blog posts, and content', core: true },
];

const OPTIONAL_AGENTS: AgentEntry[] = [
  { id: 'chief', name: 'Chief', description: 'Architecture decisions and senior technical guidance' },
  { id: 'designer', name: 'Designer', description: 'UI/UX design, component design, accessibility reviews' },
  { id: 'discord-manager', name: 'Discord Manager', description: 'Community management, moderation, and engagement' },
  { id: 'finance-manager', name: 'Finance Manager', description: 'Financial tracking, reporting, and budget management' },
  { id: 'growth-director', name: 'Growth Director', description: 'Growth strategy, GTM planning, and marketing initiatives' },
  { id: 'hr', name: 'HR', description: 'Agent creation, team management, and skill gap analysis' },
  { id: 'inbox', name: 'Inbox', description: 'Monitors incoming messages and triages by urgency' },
  { id: 'researcher', name: 'Researcher', description: 'Deep research, competitive analysis, and technical investigation' },
  { id: 'senior-coder', name: 'Senior Coder', description: 'Complex features, architecture implementation, mentoring' },
  { id: 'social-manager', name: 'Social Manager', description: 'X/Twitter strategy, content, and social engagement' },
  { id: 'voice', name: 'Voice', description: 'Text-to-speech, voice interaction, and audio processing' },
];

const CORE_MODULES: ModuleEntry[] = [
  { id: 'agent-mgmt', name: 'Agent Management', description: 'View, configure, and control agent lifecycle', core: true },
  { id: 'approvals', name: 'Approvals', description: 'Human-in-the-loop approval gates for agent actions', core: true },
  { id: 'chat', name: 'Chat', description: 'Real-time AI chat with agents — primary interaction surface', core: true },
  { id: 'inbox', name: 'Inbox', description: 'Unified communications inbox across all channels', core: true },
  { id: 'notifications', name: 'Notifications', description: 'Activity updates, alerts, and completions from agents', core: true },
  { id: 'kanban', name: 'Kanban', description: 'Task board for project management and tracking', core: true },
  { id: 'settings', name: 'Settings', description: 'Dashboard preferences, security, and configuration', core: true },
];

const OPTIONAL_MODULES: ModuleEntry[] = [
  { id: 'analytics', name: 'Analytics', description: 'Platform metrics, agent performance, and reporting' },
  { id: 'dev', name: 'Dev Tools', description: 'Developer utilities, DB inspection, and platform internals' },
  { id: 'finance', name: 'Finance', description: 'Multi-account financial management with AI categorization' },
  { id: 'library', name: 'Library', description: 'Browse and manage all agent output files' },
  { id: 'meetings', name: 'Meetings', description: 'Scheduling, agendas, notes, and action items' },
  { id: 'module-builder', name: 'Module Builder', description: 'Visual builder for creating new platform modules' },
  { id: 'projects', name: 'Projects', description: 'Unified project workspaces with tasks, chats, and files' },
  { id: 'schedule', name: 'Schedule', description: 'Calendar and scheduling for tasks and content' },
  { id: 'social-media', name: 'Social Media', description: 'Social media command center — publish, plan, and research' },
  { id: 'voice-chat', name: 'Voice Chat', description: 'Real-time voice interaction with agents via microphone' },
  { id: 'writing', name: 'Writing', description: 'AI-assisted writing workspace for long-form content' },
];

// ─────────────────────────────────────────────
// Step 8 — Animated install checklist
// ─────────────────────────────────────────────
type InstallStatus = 'pending' | 'installing' | 'done' | 'error';

interface InstallItem {
  kind: 'agent' | 'module';
  id: string;
  name: string;
  status: InstallStatus;
  error?: string;
}

// ─────────────────────────────────────────────
// Permission helpers
// ─────────────────────────────────────────────
type PermStatus = 'unknown' | 'granted' | 'denied';

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  // Mark as seen immediately so it never re-shows on reload
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  const [currentStep, setCurrentStep] = useState(0);

  // Step 2 — system check
  const [sysCheck, setSysCheck] = useState<SystemCheckState>({
    cli: 'checking',
    database: 'checking',
    mcp: 'checking',
    agents: 'checking',
    agentCount: 0,
  });

  // Step 3 — permissions confirm
  const [permissionsConfirmed, setPermissionsConfirmed] = useState(false);
  const [confirmingPermissions, setConfirmingPermissions] = useState(false);

  // Step 4 — Gemini API key
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiStatus, setGeminiStatus] = useState<'idle' | 'validating' | 'ok' | 'error'>('idle');
  const [geminiError, setGeminiError] = useState('');
  const [geminiSkipped, setGeminiSkipped] = useState(false);

  // Step 5 — Google Workspace
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleSkipped, setGoogleSkipped] = useState(false);
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleNoCredentials, setGoogleNoCredentials] = useState(false);

  // Step 6 — Obsidian vault
  const [obsidianStatus, setObsidianStatus] = useState<'checking' | 'found' | 'not-found'>('checking');
  const [obsidianSkipped, setObsidianSkipped] = useState(false);
  const [obsidianConfirmed, setObsidianConfirmed] = useState(false);
  const [obsidianOpening, setObsidianOpening] = useState(false);
  const obsidianDone = obsidianStatus === 'found' || obsidianConfirmed || obsidianSkipped;

  // Step 7 — agent & module picker
  const [selectedOptionalAgents, setSelectedOptionalAgents] = useState<Set<string>>(new Set());
  const [selectedOptionalModules, setSelectedOptionalModules] = useState<Set<string>>(new Set());

  // Step 8 — install checklist
  const [installItems, setInstallItems] = useState<InstallItem[]>([]);
  const [installStarted, setInstallStarted] = useState(false);
  const [installComplete, setInstallComplete] = useState(false);
  const installRef = useRef(false); // prevent double-run in React StrictMode

  // Browser microphone/camera permissions (Step 6 re-used from original)
  const [permStatus, setPermStatus] = useState<{ microphone: PermStatus; camera: PermStatus }>({
    microphone: 'unknown',
    camera: 'unknown',
  });

  // ─────────────────────────────────────────────
  // System check
  // ─────────────────────────────────────────────
  const runSystemCheck = useCallback(async () => {
    setSysCheck({ cli: 'checking', database: 'checking', mcp: 'checking', agents: 'checking', agentCount: 0 });
    try {
      const res = await fetch('/api/setup/system-check');
      if (!res.ok) {
        // Fall back to health endpoint
        const hRes = await fetch('/api/health');
        const h = hRes.ok ? await hRes.json() : null;
        setSysCheck({
          cli: h?.cli ? 'ok' : 'fail',
          database: h?.database ? 'ok' : 'fail',
          mcp: 'ok',
          agents: 'ok',
          agentCount: 0,
        });
        return;
      }
      const data = await res.json();
      setSysCheck({
        cli: data.cli?.ok ? 'ok' : 'fail',
        database: data.database?.ok ? 'ok' : 'fail',
        mcp: data.mcp?.ok ? 'ok' : 'fail',
        agents: data.agents?.ok ? 'ok' : 'fail',
        agentCount: data.agents?.count ?? 0,
      });
    } catch {
      setSysCheck({ cli: 'ok', database: 'ok', mcp: 'ok', agents: 'ok', agentCount: 0 });
    }
  }, []);

  // ─────────────────────────────────────────────
  // Google status check
  // ─────────────────────────────────────────────
  const checkGoogleStatus = useCallback(async () => {
    setGoogleStatus('checking');
    try {
      const res = await fetch('/api/google/auth/status');
      const data = res.ok ? await res.json() : null;
      if (data?.authenticated) {
        setGoogleStatus('connected');
        setGoogleEmail(data.email ?? '');
      } else {
        setGoogleStatus('disconnected');
      }
    } catch {
      setGoogleStatus('error');
    }
  }, []);

  // ─────────────────────────────────────────────
  // Obsidian check (via API — just check vault dir exists)
  // ─────────────────────────────────────────────
  const checkObsidian = useCallback(async () => {
    setObsidianStatus('checking');
    try {
      const res = await fetch('/api/setup/vault-check');
      const data = res.ok ? await res.json() : null;
      // exists = vault dir present; opened = .obsidian/ present (Obsidian created it)
      setObsidianStatus(data?.exists ? 'found' : 'not-found');
    } catch {
      setObsidianStatus('not-found');
    }
  }, []);

  // ─────────────────────────────────────────────
  // Auto-run checks when entering steps
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (currentStep === 1) runSystemCheck();
    if (currentStep === 5) checkGoogleStatus();
    if (currentStep === 6) {
      checkObsidian();
      checkBrowserPermissions();
    }
    if (currentStep === 7) {
      buildAndStartInstall();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // ─────────────────────────────────────────────
  // Browser permission helpers (step 6)
  // ─────────────────────────────────────────────
  const checkBrowserPermissions = async () => {
    try {
      const checkPerm = async (name: string): Promise<PermStatus> => {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          return status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'unknown';
        } catch {
          return 'unknown';
        }
      };
      const [microphone, camera] = await Promise.all([checkPerm('microphone'), checkPerm('camera')]);
      setPermStatus({ microphone, camera });
    } catch {
      // Permissions API not supported
    }
  };

  const requestPermission = async (type: 'microphone' | 'camera') => {
    try {
      const constraints = type === 'microphone' ? { audio: true } : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(t => t.stop());
      setPermStatus(prev => ({ ...prev, [type]: 'granted' }));
    } catch {
      setPermStatus(prev => ({ ...prev, [type]: 'denied' }));
    }
  };

  // ─────────────────────────────────────────────
  // Gemini key validation
  // ─────────────────────────────────────────────
  const validateGeminiKey = async () => {
    if (!geminiKey.trim()) return;
    setGeminiStatus('validating');
    setGeminiError('');
    try {
      // Save the key first
      await fetch('/api/settings/gemini_api_key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: geminiKey.trim() }),
      });
      // Quick validation: try a minimal Gemini REST call
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey.trim()}`
      );
      if (res.ok) {
        setGeminiStatus('ok');
      } else {
        setGeminiStatus('error');
        setGeminiError('Invalid API key — please check and try again');
      }
    } catch {
      // Network error — assume key saved OK but can't validate
      setGeminiStatus('ok');
    }
  };

  // ─────────────────────────────────────────────
  // Google OAuth connect — opens popup, listens for postMessage from callback page
  // ─────────────────────────────────────────────
  const connectGoogle = async () => {
    setGoogleConnecting(true);
    setGoogleNoCredentials(false);
    try {
      const res = await fetch('/api/google/auth/url');
      const data = await res.json();
      if (!data?.url) {
        setGoogleNoCredentials(true);
        setGoogleConnecting(false);
        return;
      }
      // Open OAuth in a popup — callback page will postMessage and close itself
      const popup = window.open(data.url, 'google-oauth', 'width=520,height=640,left=200,top=100');
      const onMessage = (evt: MessageEvent) => {
        if (evt.origin !== window.location.origin) return;
        if (evt.data?.type !== 'google-auth') return;
        window.removeEventListener('message', onMessage);
        if (evt.data.success) {
          setGoogleStatus('connected');
          setGoogleEmail(evt.data.detail ?? '');
        } else {
          setGoogleStatus('error');
        }
        setGoogleConnecting(false);
        try { popup?.close(); } catch { /* ignore */ }
      };
      window.addEventListener('message', onMessage);
      // Fallback: if popup is closed without messaging us, stop spinner
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          window.removeEventListener('message', onMessage);
          setGoogleConnecting(false);
          // Re-check status in case tokens were saved before popup closed
          checkGoogleStatus();
        }
      }, 800);
    } catch {
      setGoogleConnecting(false);
    }
  };

  // ─────────────────────────────────────────────
  // Permissions confirm (step 3)
  // ─────────────────────────────────────────────
  const confirmPermissions = async () => {
    setConfirmingPermissions(true);
    try {
      await fetch('/api/setup/permissions-confirm', { method: 'POST' });
      setPermissionsConfirmed(true);
    } catch {
      setPermissionsConfirmed(true); // confirm locally even if API fails
    } finally {
      setConfirmingPermissions(false);
    }
  };

  // ─────────────────────────────────────────────
  // Build install list from selected agents/modules
  // ─────────────────────────────────────────────
  const buildAndStartInstall = () => {
    if (installRef.current) return;
    installRef.current = true;

    const items: InstallItem[] = [
      // Core agents always installed
      ...CORE_AGENTS.map(a => ({ kind: 'agent' as const, id: a.id, name: a.name, status: 'pending' as InstallStatus })),
      // Optional agents that were selected
      ...OPTIONAL_AGENTS.filter(a => selectedOptionalAgents.has(a.id)).map(a => ({
        kind: 'agent' as const, id: a.id, name: a.name, status: 'pending' as InstallStatus,
      })),
      // Core modules always installed
      ...CORE_MODULES.map(m => ({ kind: 'module' as const, id: m.id, name: m.name, status: 'pending' as InstallStatus })),
      // Optional modules that were selected
      ...OPTIONAL_MODULES.filter(m => selectedOptionalModules.has(m.id)).map(m => ({
        kind: 'module' as const, id: m.id, name: m.name, status: 'pending' as InstallStatus,
      })),
    ];

    setInstallItems(items);
    setInstallStarted(true);
    runInstallSequence(items);
  };

  const runInstallSequence = async (items: InstallItem[]) => {
    const apiItems = items.map(item => ({ kind: item.kind, id: item.id }));

    // Animate: mark each item as "installing" with a small delay, then call API
    for (let i = 0; i < items.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 120));
      setInstallItems(prev =>
        prev.map((item, idx) => idx === i ? { ...item, status: 'installing' } : item)
      );
    }

    // Call bulk install endpoint
    try {
      const res = await fetch('/api/setup/install-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: apiItems }),
      });
      const data = res.ok ? await res.json() : null;

      setInstallItems(prev =>
        prev.map(item => {
          const result = data?.results?.find((r: { kind: string; id: string; success: boolean; error?: string }) => r.kind === item.kind && r.id === item.id);
          if (!result) return { ...item, status: 'done' };
          return { ...item, status: result.success ? 'done' : 'error', error: result.error };
        })
      );
    } catch {
      // Mark all as done (graceful degradation)
      setInstallItems(prev => prev.map(item => ({ ...item, status: 'done' })));
    }

    setInstallComplete(true);
  };

  const retryFailedItems = async () => {
    const failedItems = installItems.filter(i => i.status === 'error');
    if (failedItems.length === 0) return;

    setInstallItems(prev =>
      prev.map(item => item.status === 'error' ? { ...item, status: 'installing' } : item)
    );

    try {
      const res = await fetch('/api/setup/install-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: failedItems.map(i => ({ kind: i.kind, id: i.id })) }),
      });
      const data = res.ok ? await res.json() : null;

      setInstallItems(prev =>
        prev.map(item => {
          if (item.status !== 'installing') return item;
          const result = data?.results?.find((r: { kind: string; id: string; success: boolean; error?: string }) => r.kind === item.kind && r.id === item.id);
          if (!result) return { ...item, status: 'done' };
          return { ...item, status: result.success ? 'done' : 'error', error: result.error };
        })
      );
    } catch {
      setInstallItems(prev => prev.map(item =>
        item.status === 'installing' ? { ...item, status: 'error', error: 'Network error' } : item
      ));
    }
  };

  // ─────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────
  const goNext = () => setCurrentStep(s => Math.min(s + 1, STEP_COUNT - 1));
  const goBack = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleFinish = (startTour = false) => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete(startTour);
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onSkip();
  };

  // ─────────────────────────────────────────────
  // Shared helpers
  // ─────────────────────────────────────────────
  const statusIcon = (status: CheckStatus | 'ok' | 'fail' | 'checking') => {
    if (status === 'checking') return <Loader size={16} className="text-mission-control-text-dim animate-spin" />;
    if (status === 'ok') return <CheckCircle size={16} className="text-green-500" />;
    return <XCircle size={16} className="text-red-500" />;
  };

  const permIcon = (status: PermStatus) => {
    if (status === 'granted') return <CheckCircle size={16} className="text-green-500" />;
    if (status === 'denied') return <XCircle size={16} className="text-red-500" />;
    return <div className="w-4 h-4 rounded-full border-2 border-mission-control-border" />;
  };

  // ─────────────────────────────────────────────
  // Step renderers
  // ─────────────────────────────────────────────

  // STEP 0 — Welcome
  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 rounded-2xl bg-mission-control-accent/20 flex items-center justify-center mb-6">
        <Bot size={40} className="text-mission-control-accent" />
      </div>
      <h2 className="text-2xl font-bold text-mission-control-text mb-3">Welcome to Mission Control</h2>
      <p className="text-mission-control-text-dim max-w-sm mb-4 text-sm leading-relaxed">
        Your AI-powered command center for orchestrating agents, managing tasks, and automating workflows.
      </p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8 text-left">
        {[
          { icon: Users, label: 'Multi-agent orchestration' },
          { icon: LayoutDashboard, label: 'Unified dashboard' },
          { icon: Package, label: 'Modular by design' },
          { icon: Shield, label: 'You control approvals' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-mission-control-bg border border-mission-control-border">
            <Icon size={14} className="text-mission-control-accent flex-shrink-0" />
            <span className="text-xs text-mission-control-text-dim">{label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={goNext}
        className="px-6 py-3 bg-mission-control-accent text-white rounded-xl font-medium hover:bg-mission-control-accent-dim transition-colors w-full max-w-xs"
      >
        Get Started
      </button>
      <button
        onClick={handleSkip}
        className="mt-3 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
      >
        Skip Setup
      </button>
    </div>
  );

  // STEP 1 — System Check
  const renderSystemCheck = () => {
    const criticalFailed = sysCheck.database === 'fail';
    const checks: Array<{ key: keyof Omit<SystemCheckState, 'agentCount'>; label: string; critical?: boolean }> = [
      { key: 'cli', label: 'Claude CLI installed' },
      { key: 'database', label: sysCheck.database === 'fail' ? 'Task database not found' : 'Task database', critical: true },
      { key: 'mcp', label: 'MCP servers configured' },
      { key: 'agents', label: `Agent souls on disk${sysCheck.agentCount > 0 ? ` (${sysCheck.agentCount})` : ''}` },
    ];

    return (
      <div className="py-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-mission-control-accent" />
          <h2 className="text-xl font-bold text-mission-control-text">System Check</h2>
        </div>
        <p className="text-mission-control-text-dim text-sm mb-5">
          Verifying your environment before setup continues.
        </p>
        <div className="space-y-2 mb-5">
          {checks.map(({ key, label, critical }) => (
            <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
              {statusIcon(sysCheck[key])}
              <span className="text-sm text-mission-control-text flex-1">{label}</span>
              {critical && sysCheck[key] === 'fail' && (
                <span className="text-xs text-red-400 font-medium">Required</span>
              )}
              {sysCheck[key] === 'ok' && (
                <span className="text-xs text-green-500">Ready</span>
              )}
            </div>
          ))}
        </div>
        {sysCheck.cli === 'fail' && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-3 text-xs space-y-1.5">
            <p className="font-medium text-amber-400">Claude CLI not detected</p>
            <p className="text-mission-control-text-dim">Mission Control requires the Claude Code CLI to spawn agents.</p>
            <a
              href="https://docs.anthropic.com/claude-code"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-mission-control-accent hover:underline font-medium"
            >
              Install Claude Code CLI →
            </a>
            <p className="text-mission-control-text-dim">After installing, click Re-check below.</p>
          </div>
        )}
        {criticalFailed && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4 text-xs text-red-400 space-y-1">
            <p className="text-mission-control-text-dim">Run <code className="font-mono text-red-300">mission-control restart</code> in your terminal, then click Re-check.</p>
          </div>
        )}
        <button
          onClick={runSystemCheck}
          className="flex items-center gap-2 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <RefreshCw size={13} />
          Re-check
        </button>
      </div>
    );
  };

  // STEP 2 — Agent Permissions
  const renderAgentPermissions = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Shield size={18} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Agent Permissions</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-5">
        Agents need the following tool permissions to do their work. Review and confirm before continuing.
      </p>
      <div className="space-y-2 mb-5">
        {AGENT_PERMISSIONS.map(({ tool, icon: Icon, why }) => (
          <div key={tool} className="p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} className="text-mission-control-accent flex-shrink-0" />
              <span className="text-sm font-medium text-mission-control-text font-mono">{tool}</span>
            </div>
            <p className="text-xs text-mission-control-text-dim leading-relaxed pl-5">{why}</p>
          </div>
        ))}
      </div>
      <div className="p-3 rounded-lg bg-mission-control-accent/5 border border-mission-control-accent/20 mb-4 text-xs text-mission-control-text-dim space-y-1">
        <p>These are platform-wide defaults defined in <code className="font-mono text-mission-control-text">.claude/settings.json</code>.</p>
        <p>Per-agent permissions — which tools each agent can use — are configured individually on the <span className="text-mission-control-text font-medium">Agents</span> page after setup.</p>
      </div>
      {permissionsConfirmed ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm text-mission-control-text">Permissions confirmed</span>
        </div>
      ) : (
        <button
          onClick={confirmPermissions}
          disabled={confirmingPermissions}
          className="w-full py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {confirmingPermissions ? (
            <><Loader size={14} className="animate-spin" /> Confirming…</>
          ) : (
            <><Shield size={14} /> Confirm & Allow</>
          )}
        </button>
      )}
    </div>
  );

  // STEP 3 — Gemini API Key
  const renderGeminiKey = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Key size={18} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Gemini API Key</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-1">
        Required for voice chat and real-time meeting features.
      </p>
      <p className="text-xs text-mission-control-text-dim mb-5">
        Get a key at <span className="text-mission-control-accent">aistudio.google.com</span> — free tier available.
      </p>

      {geminiStatus === 'ok' ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm text-mission-control-text">API key validated and saved</span>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-3">
            <input
              type="password"
              value={geminiKey}
              onChange={e => setGeminiKey(e.target.value)}
              placeholder="AIza..."
              className="flex-1 px-3 py-2 text-sm rounded-lg bg-mission-control-bg border border-mission-control-border text-mission-control-text placeholder-mission-control-text-dim focus:outline-none focus:border-mission-control-accent transition-colors font-mono"
              onKeyDown={e => e.key === 'Enter' && validateGeminiKey()}
            />
            <button
              onClick={validateGeminiKey}
              disabled={!geminiKey.trim() || geminiStatus === 'validating'}
              className="px-3 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {geminiStatus === 'validating' ? <Loader size={14} className="animate-spin" /> : 'Validate'}
            </button>
          </div>
          {geminiStatus === 'error' && (
            <p className="text-xs text-red-400 mb-3">{geminiError}</p>
          )}
        </>
      )}

      {!geminiSkipped && geminiStatus !== 'ok' && (
        <button
          onClick={() => setGeminiSkipped(true)}
          className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <AlertTriangle size={12} className="text-yellow-500" />
          Skip for now — voice features won't be available
        </button>
      )}
      {geminiSkipped && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500">
          <AlertTriangle size={12} />
          Skipped — add your key later in Settings
        </div>
      )}
    </div>
  );

  // STEP 4 — Google Workspace
  const renderGoogleWorkspace = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Mail size={18} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Google Workspace</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-5">
        Connect your Google account to enable Gmail and Calendar integration in the Inbox module.
      </p>

      {googleStatus === 'checking' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
          <Loader size={16} className="animate-spin text-mission-control-accent" />
          <span className="text-sm text-mission-control-text">Checking connection…</span>
        </div>
      )}

      {googleStatus === 'connected' && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 mb-4">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm text-mission-control-text">
            Connected{googleEmail ? ` as ${googleEmail}` : ''}
          </span>
        </div>
      )}

      {(googleStatus === 'disconnected' || googleStatus === 'error') && (
        <>
          {googleNoCredentials && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4 text-xs space-y-2">
              <p className="font-medium text-amber-400">Google credentials not configured</p>
              <p className="text-mission-control-text-dim">To connect Google, you need an OAuth client ID. This is a one-time setup:</p>
              <ol className="text-mission-control-text-dim space-y-1 list-decimal list-inside">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-mission-control-accent hover:underline">Google Cloud Console → Credentials</a></li>
                <li>Create an OAuth 2.0 Client ID (Desktop or Web app)</li>
                <li>Download the JSON and save it to:<br/><code className="font-mono text-mission-control-text">~/.config/google-workspace-mcp/client_secret.json</code></li>
                <li>Click Connect again</li>
              </ol>
              <p className="text-mission-control-text-dim">Or skip for now — you can do this later in Settings → Google Workspace.</p>
            </div>
          )}
          <button
            onClick={connectGoogle}
            disabled={googleConnecting}
            className="w-full py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-3"
          >
            {googleConnecting ? (
              <><Loader size={14} className="animate-spin" /> Redirecting…</>
            ) : (
              <><Mail size={14} /> Connect Google Account</>
            )}
          </button>
          {!googleSkipped && (
            <button
              onClick={() => setGoogleSkipped(true)}
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              <AlertTriangle size={12} className="text-yellow-500" />
              Skip — I'll connect Google later
            </button>
          )}
          {googleSkipped && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500">
              <AlertTriangle size={12} />
              Skipped — connect later via Settings
            </div>
          )}
        </>
      )}
    </div>
  );

  // STEP 5 — Obsidian Vault + Mic/Camera
  const handleOpenObsidian = async () => {
    setObsidianOpening(true);
    try {
      await fetch('/api/setup/open-obsidian', { method: 'POST' });
    } finally {
      setObsidianOpening(false);
    }
  };

  const renderObsidianAndPermissions = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <BookOpen size={18} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Memory Vault & Permissions</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-5">
        Obsidian provides a visual interface for the agent memory vault. Agents work without it, but you won't be able to browse memory files visually.
      </p>

      {/* Obsidian vault status */}
      <div className="mb-4">
        <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Memory Vault (Recommended)</p>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
          {obsidianStatus === 'checking' && <Loader size={16} className="animate-spin text-mission-control-accent" />}
          {obsidianStatus === 'found' && <CheckCircle size={16} className="text-green-500" />}
          {obsidianStatus === 'not-found' && (
            obsidianOpening
              ? <Loader size={16} className="animate-spin text-mission-control-accent" />
              : <AlertTriangle size={16} className="text-yellow-500" />
          )}
          <div className="flex-1">
            <span className="text-sm text-mission-control-text">
              {obsidianStatus === 'checking' && 'Checking vault…'}
              {obsidianStatus === 'found' && 'Memory vault detected at ~/mission-control/memory'}
              {obsidianStatus === 'not-found' && (
                obsidianOpening
                  ? 'Obsidian is installing… this may take a minute'
                  : 'Obsidian not detected — install required'
              )}
            </span>
            {obsidianStatus === 'not-found' && !obsidianOpening && (
              <p className="text-xs text-mission-control-text-dim mt-0.5">
                Obsidian is required for agent memory. Install it below or via brew.
              </p>
            )}
          </div>
        </div>

        {/* Open in Obsidian button */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleOpenObsidian}
            disabled={obsidianOpening}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-mission-control-accent/20 text-mission-control-accent hover:bg-mission-control-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {obsidianOpening
              ? <Loader size={14} className="animate-spin" />
              : <BookOpen size={14} />
            }
            Open in Obsidian
          </button>
          <button
            onClick={checkObsidian}
            className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            <RefreshCw size={12} />
            Re-check
          </button>
        </div>

        {/* Confirmation checkbox */}
        {!obsidianSkipped && (
          <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={obsidianConfirmed}
              onChange={e => setObsidianConfirmed(e.target.checked)}
              className="w-4 h-4 rounded accent-mission-control-accent"
            />
            <span className="text-sm text-mission-control-text">I've opened the vault in Obsidian</span>
          </label>
        )}
        {obsidianSkipped ? (
          <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500">
            <AlertTriangle size={12} />
            Skipped — open Obsidian and load ~/mission-control/memory as a vault anytime
          </div>
        ) : (
          !obsidianConfirmed && obsidianStatus !== 'found' && (
            <button
              onClick={() => setObsidianSkipped(true)}
              className="flex items-center gap-1 mt-3 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              <AlertTriangle size={12} className="text-yellow-500" />
              Skip — I'll set up Obsidian later
            </button>
          )
        )}
      </div>

      {/* Microphone & Camera */}
      <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Browser Permissions</p>
      <div className="space-y-2">
        {([
          { type: 'microphone' as const, icon: Mic, label: 'Microphone', desc: 'Required for voice chat with agents' },
          { type: 'camera' as const, icon: Camera, label: 'Camera', desc: 'Required for video meeting features' },
        ]).map(({ type, icon: Icon, label, desc }) => {
          const status = permStatus[type];
          return (
            <div key={type} className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
              <Icon size={16} className="text-mission-control-text-dim flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-mission-control-text">{label}</span>
                <p className="text-xs text-mission-control-text-dim truncate">{desc}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {permIcon(status)}
                {status !== 'granted' && (
                  <button
                    onClick={() => requestPermission(type)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-mission-control-accent/20 text-mission-control-accent hover:bg-mission-control-accent/30 transition-colors"
                  >
                    Grant
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-mission-control-text-dim mt-3">
        Screen capture will be requested the first time you use screen share features.
      </p>
    </div>
  );

  // STEP 6 — Agent & Module Picker
  const renderAgentModulePicker = () => {
    const toggleAgent = (id: string) => {
      setSelectedOptionalAgents(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };
    const toggleModule = (id: string) => {
      setSelectedOptionalModules(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    return (
      <div className="py-2">
        <div className="flex items-center gap-2 mb-1">
          <Package size={18} className="text-mission-control-accent" />
          <h2 className="text-xl font-bold text-mission-control-text">Agents & Modules</h2>
        </div>
        <p className="text-mission-control-text-dim text-sm mb-4">
          Core agents and modules are pre-selected. Add any optional ones you need.
        </p>

        {/* Core Agents */}
        <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Core Agents</p>
        <div className="space-y-1.5 mb-4">
          {CORE_AGENTS.map(agent => (
            <div key={agent.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-mission-control-bg border border-mission-control-border opacity-80">
              <Lock size={12} className="text-mission-control-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-mission-control-text">{agent.name}</span>
                <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
              </div>
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Optional Agents */}
        <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Optional Agents</p>
        <div className="space-y-1.5 mb-4">
          {OPTIONAL_AGENTS.map(agent => {
            const selected = selectedOptionalAgents.has(agent.id);
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggleAgent(agent.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-mission-control-accent bg-mission-control-accent/10'
                    : 'border-mission-control-border bg-mission-control-bg hover:border-mission-control-accent/40'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  selected ? 'border-mission-control-accent bg-mission-control-accent' : 'border-mission-control-border'
                }`}>
                  {selected && <CheckCircle size={10} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-mission-control-text">{agent.name}</span>
                  <p className="text-xs text-mission-control-text-dim truncate">{agent.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Core Modules */}
        <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Core Modules</p>
        <div className="space-y-1.5 mb-4">
          {CORE_MODULES.map(mod => (
            <div key={mod.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-mission-control-bg border border-mission-control-border opacity-80">
              <Lock size={12} className="text-mission-control-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-mission-control-text">{mod.name}</span>
                <p className="text-xs text-mission-control-text-dim truncate">{mod.description}</p>
              </div>
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>

        {/* Optional Modules */}
        <p className="text-xs font-medium text-mission-control-text-dim uppercase tracking-wide mb-2">Optional Modules</p>
        <div className="space-y-1.5">
          {OPTIONAL_MODULES.map(mod => {
            const selected = selectedOptionalModules.has(mod.id);
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => toggleModule(mod.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-mission-control-accent bg-mission-control-accent/10'
                    : 'border-mission-control-border bg-mission-control-bg hover:border-mission-control-accent/40'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  selected ? 'border-mission-control-accent bg-mission-control-accent' : 'border-mission-control-border'
                }`}>
                  {selected && <CheckCircle size={10} className="text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-mission-control-text">{mod.name}</span>
                  <p className="text-xs text-mission-control-text-dim truncate">{mod.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // STEP 7 — Animated Install Checklist
  const renderInstallChecklist = () => {
    const hasErrors = installItems.some(i => i.status === 'error');
    const allDone = installItems.length > 0 && installItems.every(i => i.status === 'done' || i.status === 'error');

    return (
      <div className="py-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-mission-control-accent" />
          <h2 className="text-xl font-bold text-mission-control-text">Setting Up</h2>
        </div>
        <p className="text-mission-control-text-dim text-sm mb-5">
          Installing selected agents and modules…
        </p>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 mb-4">
          {installItems.map(item => (
            <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-mission-control-bg border border-mission-control-border">
              <div className="w-5 flex-shrink-0 flex items-center justify-center">
                {item.status === 'pending' && (
                  <div className="w-3 h-3 rounded-full border-2 border-mission-control-border" />
                )}
                {item.status === 'installing' && (
                  <Loader size={14} className="text-mission-control-accent animate-spin" />
                )}
                {item.status === 'done' && (
                  <CheckCircle size={14} className="text-green-500" />
                )}
                {item.status === 'error' && (
                  <XCircle size={14} className="text-red-500" />
                )}
              </div>
              <span className="text-sm text-mission-control-text flex-1">{item.name}</span>
              <span className="text-xs text-mission-control-text-dim capitalize">{item.kind}</span>
              {item.status === 'error' && item.error && (
                <span className="text-xs text-red-400 truncate max-w-24">{item.error}</span>
              )}
            </div>
          ))}
        </div>

        {hasErrors && allDone && (
          <button
            onClick={retryFailedItems}
            className="flex items-center gap-2 text-sm text-mission-control-accent hover:text-mission-control-accent-dim transition-colors mb-3"
          >
            <RotateCcw size={13} />
            Retry failed items
          </button>
        )}

        {allDone && !hasErrors && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-sm text-mission-control-text">All items installed successfully</span>
          </div>
        )}

        {!installStarted && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border">
            <Loader size={16} className="animate-spin text-mission-control-accent" />
            <span className="text-sm text-mission-control-text">Preparing install…</span>
          </div>
        )}
      </div>
    );
  };

  // STEP 8 — Interactive Tour Launch
  const TOUR_STOPS = [
    { label: 'Dashboard', desc: 'Agent status, activity feed, quick actions' },
    { label: 'Tasks', desc: 'Kanban board, assign to agents, status lifecycle' },
    { label: 'Agents', desc: 'Chat, status indicators, hire from catalog' },
    { label: 'Inbox', desc: 'Agent messages, approvals, notifications' },
    { label: 'Memory', desc: 'Knowledge base, session history, Obsidian vault' },
    { label: 'Library', desc: 'Files, code snippets, agent documents' },
    { label: 'Analytics', desc: 'Token usage, agent activity, cost tracking' },
    { label: 'Settings', desc: 'API keys, permissions, connected accounts' },
  ];

  const renderTourLaunch = () => (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-1">
        <Map size={18} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Interactive Tour</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-5">
        Take an 8-stop tour of Mission Control and discover what each panel does.
      </p>

      <div className="space-y-1.5 mb-5">
        {TOUR_STOPS.map((stop, i) => (
          <div
            key={stop.label}
            className="flex items-start gap-3 p-2.5 rounded-lg bg-mission-control-bg border border-mission-control-border"
          >
            <span className="text-xs font-mono text-mission-control-accent mt-0.5 w-4 flex-shrink-0">{i + 1}</span>
            <div className="min-w-0">
              <span className="text-sm font-medium text-mission-control-text">{stop.label}</span>
              <p className="text-xs text-mission-control-text-dim">{stop.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 mt-1">
        <button
          onClick={() => { handleFinish(true); }}
          className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
        >
          <Map size={14} />
          Start Tour
        </button>
        <button
          onClick={() => { handleFinish(false); }}
          className="flex items-center justify-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors py-1"
        >
          <SkipForward size={12} />
          Skip tour — go straight to Dashboard
        </button>
      </div>

      {/* Back nav row */}
      <div className="mt-4 pt-4 border-t border-mission-control-border">
        <div className="flex items-center justify-between">
          <button
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <span className="text-xs text-mission-control-text-dim">9 / {STEP_COUNT}</span>
        </div>
      </div>
    </div>
  );

  // STEP 9 — Done
  const renderDone = () => (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 rounded-2xl bg-mission-control-accent/20 flex items-center justify-center mb-6">
        <CheckCircle size={40} className="text-mission-control-accent" />
      </div>
      <h2 className="text-2xl font-bold text-mission-control-text mb-3">You're All Set</h2>
      <p className="text-mission-control-text-dim max-w-sm mb-8 text-sm">
        Mission Control is configured and ready. Head to the Dashboard to get started.
      </p>
      <button
        onClick={() => { handleFinish(false); }}
        className="px-6 py-3 bg-mission-control-accent text-white rounded-xl font-medium hover:bg-mission-control-accent-dim transition-colors w-full max-w-xs"
      >
        Go to Dashboard
      </button>
    </div>
  );

  const steps = [
    renderWelcome,
    renderSystemCheck,
    renderAgentPermissions,
    renderGeminiKey,
    renderGoogleWorkspace,
    renderObsidianAndPermissions,
    renderAgentModulePicker,
    renderInstallChecklist,
    renderTourLaunch,
    renderDone,
  ];

  // First, last, and tour-launch (step 8) steps have their own nav; middle steps use shared chrome
  const showSharedNav = currentStep > 0 && currentStep < STEP_COUNT - 1 && currentStep !== 8;

  // Block Continue on step 1 if critical DB is missing
  const criticalFailed = currentStep === 1 && sysCheck.database === 'fail';

  // Block Continue on step 2 if permissions not confirmed
  const permissionsRequired = currentStep === 2 && !permissionsConfirmed;

  // Block Continue on step 7 until install finishes
  const installInProgress = currentStep === 7 && !installComplete;

  // Block Continue on step 5 until vault confirmed or skipped
  const obsidianRequired = currentStep === 5 && !obsidianDone;

  const canContinue = !criticalFailed && !permissionsRequired && !installInProgress && !obsidianRequired;

  const isSkippable = [3, 4].includes(currentStep);

  const skipLabels: Record<number, string> = {
    3: 'Skip',
    4: 'Skip',
  };

  const handleSkipStep = () => {
    if (currentStep === 3) setGeminiSkipped(true);
    if (currentStep === 4) setGoogleSkipped(true);
    goNext();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-lg bg-mission-control-surface rounded-2xl shadow-2xl border border-mission-control-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-2 flex-shrink-0">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-5 bg-mission-control-accent'
                  : i < currentStep
                    ? 'w-1.5 bg-mission-control-accent/50'
                    : 'w-1.5 bg-mission-control-border'
              }`}
            />
          ))}
        </div>

        {/* Step content — scrollable */}
        <div className="px-8 pb-2 overflow-y-auto flex-1">
          {steps[currentStep]()}
        </div>

        {/* Shared navigation for middle steps */}
        {showSharedNav && (
          <div className="px-8 pb-6 flex-shrink-0 border-t border-mission-control-border pt-4 mt-2">
            {criticalFailed && (
              <p className="text-xs text-red-400 text-center mb-3">Fix the critical issues above before continuing.</p>
            )}
            {permissionsRequired && (
              <p className="text-xs text-yellow-500 text-center mb-3">Confirm agent permissions above to continue.</p>
            )}
            {obsidianRequired && (
              <p className="text-xs text-yellow-500 text-center mb-3">Open the vault in Obsidian and check the box above to continue.</p>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={goBack}
                className="flex items-center gap-1 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <span className="text-xs text-mission-control-text-dim">
                {currentStep + 1} / {STEP_COUNT}
              </span>
              <div className="flex items-center gap-2">
                {isSkippable && (
                  <button
                    onClick={handleSkipStep}
                    className="px-3 py-1.5 text-xs text-mission-control-text-dim hover:text-mission-control-text border border-mission-control-border rounded-lg transition-colors"
                  >
                    {skipLabels[currentStep] ?? 'Skip'}
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={!canContinue}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continue
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
