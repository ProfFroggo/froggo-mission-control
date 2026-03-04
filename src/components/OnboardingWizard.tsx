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
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (startTour: boolean) => void;
  onSkip: () => void;
}

// Install instructions shown inline for each failed dependency
const INSTALL_INSTRUCTIONS: Record<string, { title: string; instructions: string[] }> = {
  database: {
    title: 'Task Database Missing',
    instructions: [
      'The task database was not found at ~/froggo/data/froggo.db',
      'Run: mkdir -p ~/froggo/data',
      'Then restore from backup or initialize a new database',
    ],
  },
  cli: {
    title: 'OpenClaw CLI Not Found',
    instructions: [
      'Install OpenClaw: npm install -g openclaw',
      'Then run: openclaw setup',
      'CLI expected at: /opt/homebrew/bin/openclaw',
    ],
  },
  gateway: {
    title: 'Gateway Not Running',
    instructions: [
      'The OpenClaw gateway is required for AI features',
      'Start it: launchctl kickstart gui/$(id -u)/ai.openclaw.gateway',
      'Or run: openclaw gateway start',
    ],
  },
  config: {
    title: 'OpenClaw Config Missing',
    instructions: [
      'Configuration file not found at ~/.openclaw/openclaw.json',
      'Run: openclaw setup to create initial config',
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

const STEP_COUNT = 6;
const STORAGE_KEY = 'froggo-onboarding-completed';

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
      <div className="w-20 h-20 rounded-2xl bg-clawd-accent/20 flex items-center justify-center mb-6">
        <Bot size={40} className="text-clawd-accent" />
      </div>
      <h2 className="text-2xl font-bold text-clawd-text mb-3">Welcome to Froggo</h2>
      <p className="text-clawd-text-dim max-w-sm mb-8">
        Your AI-powered dashboard for managing agents, tasks, and workflows.
      </p>
      <button
        onClick={goNext}
        className="px-6 py-3 bg-clawd-accent text-white rounded-xl font-medium hover:bg-clawd-accent-dim transition-colors"
      >
        Get Started
      </button>
      <button
        onClick={handleSkip}
        className="mt-4 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
      >
        Skip Setup
      </button>
    </div>
  );

  const depIcon = (status: DepStatus) => {
    if (status === 'checking') return <Loader size={18} className="text-clawd-text-dim animate-spin" />;
    if (status === 'ok') return <CheckCircle size={18} className="text-green-500" />;
    return <XCircle size={18} className="text-red-500" />;
  };

  const renderDependencies = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={20} className="text-clawd-accent" />
        <h2 className="text-xl font-bold text-clawd-text">System Check</h2>
      </div>
      <p className="text-clawd-text-dim text-sm mb-6">
        Let's make sure everything is set up correctly.
      </p>
      <div className="space-y-3 mb-6">
        {[
          { key: 'cli' as const, label: 'OpenClaw CLI installed' },
          { key: 'gateway' as const, label: 'Gateway running' },
          { key: 'config' as const, label: 'Configuration file found' },
          { key: 'database' as const, label: 'Task database found' },
        ].map(item => (
          <div
            key={item.key}
            className="rounded-lg bg-clawd-bg border border-clawd-border overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3">
              {depIcon(depStatus[item.key])}
              <span className="text-sm text-clawd-text">{item.label}</span>
            </div>
            {depStatus[item.key] === 'fail' && INSTALL_INSTRUCTIONS[item.key] && (
              <div className="ml-8 pb-3 pr-3 space-y-1">
                {INSTALL_INSTRUCTIONS[item.key].instructions.map((line, i) => (
                  <p key={i} className="text-xs text-clawd-text-dim font-mono">{line}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={checkDependencies}
        className="flex items-center gap-2 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
      >
        <RefreshCw size={14} />
        Re-check
      </button>
    </div>
  );

  const permIcon = (status: PermStatus) => {
    if (status === 'granted') return <CheckCircle size={18} className="text-green-500" />;
    if (status === 'denied') return <XCircle size={18} className="text-red-500" />;
    return <Loader size={18} className="text-clawd-text-dim animate-spin" />;
  };

  const permMeta: Record<string, { icon: typeof Mic; label: string }> = {
    microphone: { icon: Mic, label: 'Microphone' },
    camera: { icon: Camera, label: 'Camera' },
    screen: { icon: Monitor, label: 'Screen Recording' },
  };

  const renderPermissions = () => (
    <div className="py-4">
      <h2 className="text-xl font-bold text-clawd-text mb-1">Permissions</h2>
      <p className="text-clawd-text-dim text-sm mb-6">
        Froggo needs some permissions for voice and screen features.
      </p>
      <div className="space-y-3">
        {(['microphone', 'camera', 'screen'] as const).map(type => {
          const meta = permMeta[type];
          const Icon = meta.icon;
          const status = permStatus[type];
          return (
            <div
              key={type}
              className="flex items-center justify-between p-3 rounded-lg bg-clawd-bg border border-clawd-border"
            >
              <div className="flex items-center gap-3">
                <Icon size={18} className="text-clawd-text-dim" />
                <span className="text-sm text-clawd-text">{meta.label}</span>
              </div>
              <div className="flex items-center gap-3">
                {permIcon(status)}
                {status !== 'granted' && type !== 'screen' && (
                  <button
                    onClick={() => requestPermission(type)}
                    className="px-3 py-1 text-xs rounded-lg bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 transition-colors"
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
      <h2 className="text-xl font-bold text-clawd-text mb-1">Gateway Connection</h2>
      <p className="text-clawd-text-dim text-sm mb-6">
        Connect to the OpenClaw gateway for AI agent communication.
      </p>
      <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-clawd-bg border border-clawd-border">
        {gatewayStatus === 'connected' ? (
          <Wifi size={32} className="text-green-500" />
        ) : gatewayStatus === 'error' ? (
          <WifiOff size={32} className="text-red-500" />
        ) : (
          <Wifi size={32} className="text-clawd-text-dim" />
        )}
        <p className="text-sm text-clawd-text">
          {gatewayStatus === 'idle' && 'Click below to test your gateway connection.'}
          {gatewayStatus === 'testing' && 'Testing connection...'}
          {gatewayStatus === 'connected' && 'Connected successfully'}
          {gatewayStatus === 'error' && `Could not connect \u2014 ${gatewayError}`}
        </p>
        <button
          onClick={testGateway}
          disabled={gatewayStatus === 'testing'}
          className="px-4 py-2 text-sm rounded-lg bg-clawd-accent text-white hover:bg-clawd-accent-dim transition-colors disabled:opacity-50"
        >
          {gatewayStatus === 'testing' ? (
            <span className="flex items-center gap-2">
              <Loader size={14} className="animate-spin" /> Testing...
            </span>
          ) : (
            'Test Connection'
          )}
        </button>
      </div>
    </div>
  );

  const renderSampleData = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <Database size={20} className="text-clawd-accent" />
        <h2 className="text-xl font-bold text-clawd-text">Sample Data</h2>
      </div>
      <p className="text-clawd-text-dim text-sm mb-6">
        Want to explore with some demo tasks and data?
      </p>
      {sampleDataStatus === 'idle' && (
        <div className="flex gap-3">
          <button
            onClick={populateSampleData}
            className="flex-1 px-4 py-3 rounded-xl bg-clawd-accent text-white font-medium hover:bg-clawd-accent-dim transition-colors"
          >
            Yes, add sample data
          </button>
          <button
            onClick={() => {
              setSampleDataStatus('skipped');
              goNext();
            }}
            className="flex-1 px-4 py-3 rounded-xl border border-clawd-border text-clawd-text hover:bg-clawd-border/50 transition-colors"
          >
            No thanks, start fresh
          </button>
        </div>
      )}
      {sampleDataStatus === 'loading' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-clawd-bg border border-clawd-border">
          <Loader size={18} className="animate-spin text-clawd-accent" />
          <span className="text-sm text-clawd-text">Adding sample data...</span>
        </div>
      )}
      {sampleDataStatus === 'done' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle size={18} className="text-green-500" />
          <span className="text-sm text-clawd-text">
            Added {sampleDataCount} sample tasks
          </span>
        </div>
      )}
    </div>
  );

  const renderFinish = () => (
    <div className="flex flex-col items-center text-center py-6">
      <div className="w-20 h-20 rounded-2xl bg-clawd-accent/20 flex items-center justify-center mb-6">
        <PartyPopper size={40} className="text-clawd-accent" />
      </div>
      <h2 className="text-2xl font-bold text-clawd-text mb-3">You're All Set!</h2>
      <p className="text-clawd-text-dim max-w-sm mb-8">
        Your dashboard is ready. Would you like a quick tour?
      </p>
      <button
        onClick={() => handleFinish(true)}
        className="px-6 py-3 bg-clawd-accent text-white rounded-xl font-medium hover:bg-clawd-accent-dim transition-colors w-full max-w-xs"
      >
        Start Tour
      </button>
      <button
        onClick={() => handleFinish(false)}
        className="mt-3 px-6 py-3 border border-clawd-border rounded-xl text-clawd-text hover:bg-clawd-border/50 transition-colors w-full max-w-xs"
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
      <div className="w-full max-w-lg bg-clawd-surface rounded-2xl shadow-2xl border border-clawd-border overflow-hidden">
        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-2">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? 'w-6 bg-clawd-accent'
                  : i < currentStep
                    ? 'w-2 bg-clawd-accent/50'
                    : 'w-2 bg-clawd-border'
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
                className="flex items-center gap-1 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
              >
                <ArrowLeft size={14} />
                Back
              </button>
              <span className="text-xs text-clawd-text-dim">
                Step {currentStep + 1} of {STEP_COUNT}
              </span>
              <div className="flex items-center gap-2">
                {criticalFailed && (
                  <button
                    onClick={checkDependencies}
                    className="px-3 py-1 text-sm rounded bg-clawd-accent/20 text-clawd-accent hover:bg-clawd-accent/30 transition-colors"
                  >
                    Re-check
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={criticalFailed}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
