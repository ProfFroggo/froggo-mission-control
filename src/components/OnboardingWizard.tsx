import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  CheckCircle,
  XCircle,
  Loader,
  Mic,
  Camera,
  Monitor,
  Wifi,
  WifiOff,
  Database,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  PartyPopper,
  RefreshCw,
  Users,
} from 'lucide-react';
import { catalogApi, moduleApi } from '../lib/api';

interface OnboardingWizardProps {
  onComplete: (startTour: boolean) => void;
  onSkip: () => void;
}

// Install instructions shown inline for each failed dependency
const INSTALL_INSTRUCTIONS: Record<string, { title: string; instructions: string[] }> = {
  database: {
    title: 'Task Database Missing',
    instructions: [
      'The task database was not found at ~/mission-control/data/mission-control.db',
      'Run: mkdir -p ~/mission-control/data',
      'Then restore from backup or initialize a new database',
    ],
  },
  cli: {
    title: 'Claude CLI Not Found',
    instructions: [
      'Install Claude Code: npm install -g @anthropic-ai/claude-code',
      'Then authenticate: claude auth',
    ],
  },
  gateway: {
    title: 'AI Backend Check',
    instructions: [
      'Mission Control uses Claude Code CLI — no external gateway required',
    ],
  },
  config: {
    title: 'Configuration Missing',
    instructions: [
      'Create .env.local in the project root',
      'Add VITE_GEMINI_API_KEY for voice/meeting features',
    ],
  },
};

// Only database is critical — app cannot function without it
const CRITICAL_DEPS = ['database'] as const;

type DepStatus = 'checking' | 'ok' | 'fail';

interface DependencyState {
  cli: DepStatus;
  gateway: DepStatus;
  config: DepStatus;
  database: DepStatus;
}

type PermStatus = 'unknown' | 'granted' | 'denied';

interface PermissionState {
  microphone: PermStatus;
  camera: PermStatus;
  screen: PermStatus;
}

type GatewayStatus = 'idle' | 'testing' | 'connected' | 'error';
type SampleDataStatus = 'idle' | 'loading' | 'done' | 'skipped';

const STEP_COUNT = 7;
const STORAGE_KEY = 'mission-control-onboarding-completed';

interface RolePreset {
  id: string;
  emoji: string;
  label: string;
  description: string;
  agents: string[];
  modules: string[];
}

const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'developer',
    emoji: '💻',
    label: 'Developer',
    description: 'Coding, code review, and engineering tasks',
    agents: ['coder', 'senior-coder'],
    modules: ['dev', 'kanban', 'notifications'],
  },
  {
    id: 'designer',
    emoji: '🎨',
    label: 'Designer',
    description: 'UI/UX design, creative production, and brand assets',
    agents: ['designer', 'writer'],
    modules: ['library', 'kanban', 'notifications'],
  },
  {
    id: 'marketing',
    emoji: '📣',
    label: 'Marketing',
    description: 'Growth campaigns, social media, and content strategy',
    agents: ['social-manager', 'growth-director', 'writer'],
    modules: ['twitter', 'analytics', 'schedule'],
  },
  {
    id: 'executive',
    emoji: '🏢',
    label: 'Executive',
    description: 'Strategy, risk, research, and team oversight',
    agents: ['chief', 'clara', 'researcher'],
    modules: ['analytics', 'approvals', 'finance'],
  },
];

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [depStatus, setDepStatus] = useState<DependencyState>({
    cli: 'checking',
    gateway: 'checking',
    config: 'checking',
    database: 'checking',
  });
  const [permStatus, setPermStatus] = useState<PermissionState>({
    microphone: 'unknown',
    camera: 'unknown',
    screen: 'unknown',
  });
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>('idle');
  const [gatewayError, setGatewayError] = useState('');
  const [sampleDataStatus, setSampleDataStatus] = useState<SampleDataStatus>('idle');
  const [sampleDataCount, setSampleDataCount] = useState(0);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [presetStatus, setPresetStatus] = useState<'idle' | 'applying' | 'done'>('idle');

  // --- Dependency Check ---
  const checkDependencies = useCallback(async () => {
    setDepStatus({
      cli: 'checking',
      gateway: 'checking',
      config: 'checking',
      database: 'checking',
    });
    try {
      const res = await fetch('/api/health');
      const result = res.ok ? await res.json() : null;
      if (result) {
        setDepStatus({
          cli: result.cli ? 'ok' : 'fail',
          gateway: result.gateway ? 'ok' : 'fail',
          config: result.config ? 'ok' : 'fail',
          database: result.database ? 'ok' : 'fail',
        });
      }
    } catch {
      // API not available -- leave as checking
    }
  }, []);

  // --- Permission Check (Browser Permissions API) ---
  const checkPermissions = useCallback(async () => {
    try {
      const checkPerm = async (name: string): Promise<PermStatus> => {
        try {
          const status = await navigator.permissions.query({ name: name as PermissionName });
          return status.state === 'granted' ? 'granted' : 'denied';
        } catch {
          return 'unknown';
        }
      };
      const [microphone, camera] = await Promise.all([
        checkPerm('microphone'),
        checkPerm('camera'),
      ]);
      // Screen capture permission can't be queried via Permissions API
      setPermStatus({ microphone, camera, screen: 'unknown' });
    } catch {
      // Permissions API not available
    }
  }, []);

  // --- Gateway Test ---
  const testGateway = useCallback(async () => {
    setGatewayStatus('testing');
    setGatewayError('');
    try {
      const res = await fetch('/api/health');
      const result = res.ok ? await res.json() : null;
      if (result?.gateway) {
        setGatewayStatus('connected');
      } else {
        setGatewayStatus('error');
        setGatewayError(result?.error || 'Could not connect');
      }
    } catch {
      setGatewayStatus('error');
      setGatewayError('API not reachable');
    }
  }, []);

  // --- Sample Data ---
  const populateSampleData = useCallback(async () => {
    setSampleDataStatus('loading');
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'populate-sample-data' }),
      });
      const result = res.ok ? await res.json() : null;
      setSampleDataCount(result?.inserted ?? 0);
      setSampleDataStatus('done');
    } catch {
      setSampleDataStatus('done');
      setSampleDataCount(0);
    }
  }, []);

  // Auto-run checks when entering relevant steps
  useEffect(() => {
    if (currentStep === 1) checkDependencies();
    if (currentStep === 2) checkPermissions();
  }, [currentStep, checkDependencies, checkPermissions]);

  // --- Navigation ---
  const goNext = () => setCurrentStep(s => Math.min(s + 1, STEP_COUNT - 1));
  const goBack = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleFinish = (startTour: boolean) => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete(startTour);
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onSkip();
  };

  const requestPermission = async (type: 'microphone' | 'camera' | 'screen') => {
    try {
      // Screen recording permission is system-level, can't be requested via browser
      if (type === 'screen') return;
      // Request via getUserMedia to trigger browser permission prompt
      const constraints = type === 'microphone' ? { audio: true } : { video: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // Stop tracks immediately — we only needed the permission grant
      stream.getTracks().forEach(t => t.stop());
      setPermStatus(prev => ({ ...prev, [type]: 'granted' }));
    } catch {
      // Permission denied or API not available
    }
  };

  // --- Step Renderers ---
  const renderWelcome = () => (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 rounded-2xl bg-mission-control-accent/20 flex items-center justify-center mb-6">
        <Bot size={40} className="text-mission-control-accent" />
      </div>
      <h2 className="text-2xl font-bold text-mission-control-text mb-3">Welcome to Mission Control</h2>
      <p className="text-mission-control-text-dim max-w-sm mb-8">
        Your AI-powered dashboard for managing agents, tasks, and workflows.
      </p>
      <button
        onClick={goNext}
        className="px-6 py-3 bg-mission-control-accent text-white rounded-xl font-medium hover:bg-mission-control-accent-dim transition-colors"
      >
        Get Started
      </button>
      <button
        onClick={handleSkip}
        className="mt-4 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
      >
        Skip Setup
      </button>
    </div>
  );

  const depIcon = (status: DepStatus) => {
    if (status === 'checking') return <Loader size={18} className="text-mission-control-text-dim animate-spin" />;
    if (status === 'ok') return <CheckCircle size={18} className="text-green-500" />;
    return <XCircle size={18} className="text-red-500" />;
  };

  const renderDependencies = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">System Check</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-6">
        Let's make sure everything is set up correctly.
      </p>
      <div className="space-y-3 mb-6">
        {[
          { key: 'cli' as const, label: 'Claude CLI ready' },
          { key: 'gateway' as const, label: 'AI backend ready' },
          { key: 'config' as const, label: 'Configuration found' },
          { key: 'database' as const, label: 'Task database found' },
        ].map(item => (
          <div
            key={item.key}
            className="rounded-lg bg-mission-control-bg border border-mission-control-border overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3">
              {depIcon(depStatus[item.key])}
              <span className="text-sm text-mission-control-text">{item.label}</span>
            </div>
            {depStatus[item.key] === 'fail' && INSTALL_INSTRUCTIONS[item.key] && (
              <div className="ml-8 pb-3 pr-3 space-y-1">
                {INSTALL_INSTRUCTIONS[item.key].instructions.map((line, i) => (
                  <p key={i} className="text-xs text-mission-control-text-dim font-mono">{line}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={checkDependencies}
        className="flex items-center gap-2 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
      >
        <RefreshCw size={14} />
        Re-check
      </button>
    </div>
  );

  const permIcon = (status: PermStatus) => {
    if (status === 'granted') return <CheckCircle size={18} className="text-green-500" />;
    if (status === 'denied') return <XCircle size={18} className="text-red-500" />;
    return <Loader size={18} className="text-mission-control-text-dim animate-spin" />;
  };

  const permMeta: Record<string, { icon: typeof Mic; label: string }> = {
    microphone: { icon: Mic, label: 'Microphone' },
    camera: { icon: Camera, label: 'Camera' },
    screen: { icon: Monitor, label: 'Screen Recording' },
  };

  const renderPermissions = () => (
    <div className="py-4">
      <h2 className="text-xl font-bold text-mission-control-text mb-1">Permissions</h2>
      <p className="text-mission-control-text-dim text-sm mb-6">
        Mission Control needs some permissions for voice and screen features.
      </p>
      <div className="space-y-3">
        {(['microphone', 'camera', 'screen'] as const).map(type => {
          const meta = permMeta[type];
          const Icon = meta.icon;
          const status = permStatus[type];
          return (
            <div
              key={type}
              className="flex items-center justify-between p-3 rounded-lg bg-mission-control-bg border border-mission-control-border"
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className="text-mission-control-text-dim" />
                <span className="text-sm text-mission-control-text">{meta.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {permIcon(status)}
                {status !== 'granted' && type !== 'screen' && (
                  <button
                    onClick={() => requestPermission(type)}
                    className="px-3 py-1 text-xs rounded-lg bg-mission-control-accent/20 text-mission-control-accent hover:bg-mission-control-accent/30 transition-colors"
                  >
                    Grant
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGateway = () => (
    <div className="py-4">
      <h2 className="text-xl font-bold text-mission-control-text mb-1">AI Backend</h2>
      <p className="text-mission-control-text-dim text-sm mb-6">
        Mission Control uses Claude Code CLI — no external gateway required.
      </p>
      <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-mission-control-bg border border-mission-control-border">
        <Wifi size={32} className="text-green-500" />
        <p className="text-sm text-mission-control-text">
          Claude Code CLI is your AI backend. Agents run as Claude CLI processes.
        </p>
        <div className="text-xs text-mission-control-text-dim text-center">
          MCP servers handle task DB, memory vault, and scheduled jobs.
        </div>
      </div>
    </div>
  );

  const renderSampleData = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Database size={20} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Sample Data</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-6">
        Want to explore with some demo tasks and data?
      </p>
      {sampleDataStatus === 'idle' && (
        <div className="flex gap-3">
          <button
            onClick={populateSampleData}
            className="flex-1 px-4 py-3 rounded-xl bg-mission-control-accent text-white font-medium hover:bg-mission-control-accent-dim transition-colors"
          >
            Yes, add sample data
          </button>
          <button
            onClick={() => {
              setSampleDataStatus('skipped');
              goNext();
            }}
            className="flex-1 px-4 py-3 rounded-xl border border-mission-control-border text-mission-control-text hover:bg-mission-control-border/50 transition-colors"
          >
            No thanks, start fresh
          </button>
        </div>
      )}
      {sampleDataStatus === 'loading' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-mission-control-bg border border-mission-control-border">
          <Loader size={18} className="animate-spin text-mission-control-accent" />
          <span className="text-sm text-mission-control-text">Adding sample data...</span>
        </div>
      )}
      {sampleDataStatus === 'done' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle size={18} className="text-green-500" />
          <span className="text-sm text-mission-control-text">
            Added {sampleDataCount} sample tasks
          </span>
        </div>
      )}
    </div>
  );

  const applyPreset = async (preset: RolePreset) => {
    setPresetStatus('applying');
    await Promise.allSettled([
      ...preset.agents.map(id => catalogApi.setAgentInstalled(id, true)),
      ...preset.modules.map(id => moduleApi.install(id)),
    ]);
    setPresetStatus('done');
  };

  const renderRolePresets = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Users size={20} className="text-mission-control-accent" />
        <h2 className="text-xl font-bold text-mission-control-text">Your Role</h2>
      </div>
      <p className="text-mission-control-text-dim text-sm mb-5">
        Select your primary role to pre-install relevant agents and modules.
      </p>

      {presetStatus !== 'done' ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {ROLE_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedRole(preset.id)}
                className={`text-left p-3 rounded-xl border-2 transition-all ${
                  selectedRole === preset.id
                    ? 'border-mission-control-accent bg-mission-control-accent/10'
                    : 'border-mission-control-border hover:border-mission-control-accent/40'
                }`}
              >
                <div className="text-2xl mb-1.5">{preset.emoji}</div>
                <div className="font-semibold text-sm text-mission-control-text mb-0.5">{preset.label}</div>
                <div className="text-[11px] text-mission-control-text-dim leading-tight">{preset.description}</div>
              </button>
            ))}
          </div>

          {selectedRole && (
            <div className="mb-4 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border text-xs text-mission-control-text-dim">
              {(() => {
                const preset = ROLE_PRESETS.find(r => r.id === selectedRole)!;
                return (
                  <>
                    <span className="text-mission-control-text font-medium">Will install: </span>
                    {[...preset.agents, ...preset.modules].join(', ')}
                  </>
                );
              })()}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!selectedRole || presetStatus === 'applying'}
              onClick={() => {
                const preset = ROLE_PRESETS.find(r => r.id === selectedRole);
                if (preset) applyPreset(preset);
              }}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {presetStatus === 'applying' ? (
                <><Loader size={14} className="animate-spin" /> Applying…</>
              ) : (
                <><Sparkles size={14} /> Apply Preset</>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
          <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
          <span className="text-sm text-mission-control-text">
            {ROLE_PRESETS.find(r => r.id === selectedRole)?.label} preset applied!
          </span>
        </div>
      )}
    </div>
  );

  const renderFinish = () => (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 rounded-2xl bg-mission-control-accent/20 flex items-center justify-center mb-6">
        <PartyPopper size={40} className="text-mission-control-accent" />
      </div>
      <h2 className="text-2xl font-bold text-mission-control-text mb-3">You're All Set!</h2>
      <p className="text-mission-control-text-dim max-w-sm mb-8">
        Your dashboard is ready. Would you like a quick tour?
      </p>
      <button
        onClick={() => handleFinish(true)}
        className="px-6 py-3 bg-mission-control-accent text-white rounded-xl font-medium hover:bg-mission-control-accent-dim transition-colors w-full max-w-xs"
      >
        Start Tour
      </button>
      <button
        onClick={() => handleFinish(false)}
        className="mt-3 px-6 py-3 border border-mission-control-border rounded-xl text-mission-control-text hover:bg-mission-control-border/50 transition-colors w-full max-w-xs"
      >
        Skip Tour
      </button>
    </div>
  );

  const steps = [
    renderWelcome,
    renderDependencies,
    renderPermissions,
    renderGateway,
    renderSampleData,
    renderRolePresets,
    renderFinish,
  ];

  // Welcome and Finish have their own nav; middle steps use shared chrome
  const showSharedNav = currentStep > 0 && currentStep < STEP_COUNT - 1;

  // Block Continue on the dependency step when critical deps (database) fail
  const criticalFailed = currentStep === 1
    ? CRITICAL_DEPS.some(dep => depStatus[dep] === 'fail')
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-full max-w-lg bg-mission-control-surface rounded-2xl shadow-2xl border border-mission-control-border overflow-hidden">
        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-2">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-6 bg-mission-control-accent'
                  : i < currentStep
                    ? 'w-2 bg-mission-control-accent/50'
                    : 'w-2 bg-mission-control-border'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-8 pb-2">{steps[currentStep]()}</div>

        {/* Shared navigation for middle steps */}
        {showSharedNav && (
          <div className="px-8 pb-6">
            {criticalFailed && (
              <div className="mb-3 text-center">
                <p className="text-sm text-red-400">
                  Fix the critical issues above before continuing.
                </p>
              </div>
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
                Step {currentStep + 1} of {STEP_COUNT}
              </span>
              <div className="flex items-center gap-2">
                {criticalFailed && (
                  <button
                    onClick={checkDependencies}
                    className="px-3 py-1 text-sm rounded bg-mission-control-accent/20 text-mission-control-accent hover:bg-mission-control-accent/30 transition-colors"
                  >
                    Re-check
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={criticalFailed}
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
