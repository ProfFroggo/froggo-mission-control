// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  Zap,
  Rocket,
  ChevronDown,
} from 'lucide-react';
import AgentAvatar from './AgentAvatar';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
export const ONBOARDING_KEY = 'mission-control.onboarded';
const TIPS_KEY = 'mission-control.tips-seen';
const STEP_KEY = 'onboarding_step';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface OnboardingFlowProps {
  onComplete: () => void;
  onNavigate?: (view: string) => void;
}

interface AgentDef {
  id: string;
  name: string;
  role: string;
  tagline: string;
  description: string;
  color: string;
}

type Direction = 'forward' | 'backward';

// ─────────────────────────────────────────────
// Agent definitions
// ─────────────────────────────────────────────
const AGENT_DEFS: AgentDef[] = [
  {
    id: 'clara',
    name: 'Clara',
    role: 'Chief of Staff',
    tagline: 'Orchestrates your entire operation',
    description: 'Reviews tasks, coordinates agents, and ensures nothing falls through the cracks.',
    color: '#22c55e',
  },
  {
    id: 'rex',
    name: 'Rex',
    role: 'Research Analyst',
    tagline: 'Turns data into actionable insights',
    description: 'Deep-dives on markets, competitors, and trends so you can make informed decisions.',
    color: '#3b82f6',
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Content Strategist',
    tagline: 'Creates copy that converts',
    description: 'Writes, edits, and schedules content across every channel your brand touches.',
    color: '#a855f7',
  },
  {
    id: 'sage',
    name: 'Sage',
    role: 'Operations Lead',
    tagline: 'Keeps workflows running smoothly',
    description: 'Manages automations, tracks deliverables, and flags blockers before they become fires.',
    color: '#f59e0b',
  },
];

// ─────────────────────────────────────────────
// Step dots progress indicator
// ─────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 bg-mission-control-accent'
              : i < current
              ? 'w-1.5 bg-mission-control-accent/50'
              : 'w-1.5 bg-mission-control-border'
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 1 — Welcome
// ─────────────────────────────────────────────
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-7">
      {/* Animated gradient hero */}
      <div
        className="relative -mx-6 -mt-2 h-36 rounded-t-xl overflow-hidden flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, var(--mission-control-accent) 0%, #3b82f6 50%, #a855f7 100%)',
          backgroundSize: '200% 200%',
          animation: 'ob-gradient-shift 6s ease infinite',
        }}
      >
        <div className="text-center z-10 px-4">
          <div className="flex items-center justify-center mb-1">
            <Rocket size={22} className="text-white/90" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mission Control</h1>
          <p className="text-white/75 text-sm mt-1">Your AI-powered operations platform</p>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="space-y-3 px-1">
        {[
          { Icon: Zap, label: 'Delegate work to specialized AI agents' },
          { Icon: Check, label: 'Track tasks, projects, and automations in one place' },
          { Icon: Rocket, label: 'Ship faster with intelligent workflows' },
        ].map(({ Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mission-control-accent/10 flex items-center justify-center">
              <Icon size={15} className="text-mission-control-accent" />
            </div>
            <span className="text-sm text-mission-control-text">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
      >
        Get started
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Platform Setup
// ─────────────────────────────────────────────
interface PlatformData {
  platformName: string;
  industry: string;
  teamSize: string;
}

function StepPlatformSetup({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: PlatformData;
  onChange: (d: PlatformData) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Set up your platform</h2>
        <p className="text-sm text-mission-control-text-dim">Tell us a bit about your operation.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="ob-platform-name" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Platform name
          </label>
          <input
            id="ob-platform-name"
            type="text"
            value={data.platformName}
            onChange={e => onChange({ ...data, platformName: e.target.value })}
            placeholder="e.g. Acme Corp Command Center"
            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
          />
        </div>

        <div>
          <label htmlFor="ob-industry" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Industry / use case
          </label>
          <div className="relative">
            <select
              id="ob-industry"
              value={data.industry}
              onChange={e => onChange({ ...data, industry: e.target.value })}
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            >
              <option value="">Select one</option>
              <option value="agency">Agency</option>
              <option value="startup">Startup</option>
              <option value="enterprise">Enterprise</option>
              <option value="solo">Solo Creator</option>
              <option value="other">Other</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Team size
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { value: 'solo', label: 'Just me' },
              { value: '2-5', label: '2–5' },
              { value: '6-20', label: '6–20' },
              { value: '20+', label: '20+' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...data, teamSize: opt.value })}
                className={`px-2 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  data.teamSize === opt.value
                    ? 'border-mission-control-accent bg-mission-control-accent/10 text-mission-control-accent'
                    : 'border-mission-control-border bg-mission-control-bg text-mission-control-text-dim hover:border-mission-control-accent/40 hover:text-mission-control-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3 — Meet Your AI Agents
// ─────────────────────────────────────────────
function StepMeetAgents({
  selected,
  onToggle,
  onNext,
  onBack,
  creating,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
  creating: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Meet your AI agents</h2>
        <p className="text-sm text-mission-control-text-dim">Select the agents you want on your team. You can add more later.</p>
      </div>

      <div className="space-y-2.5">
        {AGENT_DEFS.map(agent => {
          const isSelected = selected.has(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onToggle(agent.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all duration-150 ${
                isSelected
                  ? 'border-mission-control-accent bg-mission-control-accent/5'
                  : 'border-mission-control-border bg-mission-control-bg hover:border-mission-control-accent/40'
              }`}
            >
              {/* Avatar */}
              <AgentAvatar agentId={agent.id} size="md" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-mission-control-text">{agent.name}</span>
                  <span className="text-xs text-mission-control-text-dim">·</span>
                  <span className="text-xs text-mission-control-text-dim">{agent.role}</span>
                </div>
                <p className="text-xs font-medium mt-0.5" style={{ color: agent.color }}>{agent.tagline}</p>
                <p className="text-xs text-mission-control-text-dim mt-1 leading-relaxed">{agent.description}</p>
              </div>

              {/* Checkbox */}
              <div
                className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors mt-0.5 ${
                  isSelected
                    ? 'border-mission-control-accent bg-mission-control-accent'
                    : 'border-mission-control-border bg-transparent'
                }`}
              >
                {isSelected && <Check size={11} className="text-white" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selected.size === 0 || creating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating ? 'Adding agents...' : `Add ${selected.size} agent${selected.size !== 1 ? 's' : ''} & continue`}
          {!creating && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 4 — First Task
// ─────────────────────────────────────────────
interface TaskData {
  title: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
}

function StepFirstTask({
  data,
  onChange,
  onSubmit,
  onSkip,
  onBack,
  loading,
  taskCreated,
}: {
  data: TaskData;
  onChange: (d: TaskData) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onBack: () => void;
  loading: boolean;
  taskCreated: boolean;
}) {
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!data.title.trim()) {
      setError('Task title is required');
      return;
    }
    setError('');
    onSubmit();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Create your first task</h2>
        <p className="text-sm text-mission-control-text-dim">Give your agents something to work on.</p>
      </div>

      <div className="space-y-3.5">
        <div>
          <label htmlFor="ob-task-title" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Task title <span className="text-red-500">*</span>
          </label>
          <input
            id="ob-task-title"
            type="text"
            value={data.title}
            onChange={e => { onChange({ ...data, title: e.target.value }); setError(''); }}
            placeholder="e.g. Draft a product announcement"
            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            disabled={taskCreated}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div>
          <label htmlFor="ob-priority" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Priority
          </label>
          <div className="relative">
            <select
              id="ob-priority"
              value={data.priority}
              onChange={e => onChange({ ...data, priority: e.target.value as 'low' | 'medium' | 'high' })}
              className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
              disabled={taskCreated}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none" />
          </div>
        </div>

        <div>
          <label htmlFor="ob-due-date" className="block text-xs font-medium text-mission-control-text-dim mb-1.5">
            Due date <span className="text-mission-control-text-dim font-normal">(optional)</span>
          </label>
          <input
            id="ob-due-date"
            type="date"
            value={data.dueDate}
            onChange={e => onChange({ ...data, dueDate: e.target.value })}
            className="w-full bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text focus:outline-none focus:border-mission-control-accent"
            disabled={taskCreated}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          disabled={loading}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || taskCreated}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : taskCreated ? 'Task created' : 'Create task & continue'}
          {!loading && !taskCreated && <ArrowRight size={16} />}
          {taskCreated && <Check size={16} />}
        </button>
      </div>

      <div className="text-center">
        <button
          onClick={onSkip}
          className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors underline-offset-2 hover:underline"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 5 — Ready!
// ─────────────────────────────────────────────
function StepReady({
  platformName,
  agentsAdded,
  taskCreated,
  onLaunch,
  loading,
}: {
  platformName: string;
  agentsAdded: number;
  taskCreated: boolean;
  onLaunch: () => void;
  loading: boolean;
}) {
  const items = [
    { label: platformName ? `Platform named "${platformName}"` : 'Platform configured', done: true },
    { label: `${agentsAdded} agent${agentsAdded !== 1 ? 's' : ''} added to your team`, done: agentsAdded > 0 },
    { label: 'First task created', done: taskCreated },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div
        className="relative -mx-6 -mt-2 h-28 rounded-t-xl overflow-hidden flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--mission-control-accent) 0%, #3b82f6 100%)' }}
      >
        <div className="text-center z-10 px-4">
          <Rocket size={28} className="text-white mx-auto mb-1" />
          <p className="text-white font-semibold text-base">{"You're all set!"}</p>
        </div>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="space-y-1.5 px-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Ready to launch</h2>
        <p className="text-sm text-mission-control-text-dim">{"Here's what we set up for you:"}</p>
      </div>

      <div className="space-y-2 px-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                item.done ? 'bg-mission-control-accent' : 'bg-mission-control-border'
              }`}
            >
              <Check size={11} className={item.done ? 'text-white' : 'text-mission-control-text-dim'} />
            </div>
            <span className={`text-sm ${item.done ? 'text-mission-control-text' : 'text-mission-control-text-dim line-through'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={onLaunch}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : 'Launch Mission Control'}
        {!loading && <Rocket size={16} />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main OnboardingFlow component
// ─────────────────────────────────────────────
export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const TOTAL_STEPS = 5;

  const getInitialStep = (): number => {
    try {
      const saved = localStorage.getItem(STEP_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 0 && n < TOTAL_STEPS) return n;
      }
    } catch {
      // Ignore
    }
    return 0;
  };

  const [step, setStep] = useState<number>(getInitialStep);
  const [animating, setAnimating] = useState(false);
  const [enterClass, setEnterClass] = useState('');
  const [exitClass, setExitClass] = useState('');
  const [renderStep, setRenderStep] = useState<number>(getInitialStep);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Platform setup state
  const [platformData, setPlatformData] = useState<PlatformData>({ platformName: '', industry: '', teamSize: 'solo' });

  // Agent selection (Clara pre-selected)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set(['clara']));
  const [creatingAgents, setCreatingAgents] = useState(false);
  const [agentsCreated, setAgentsCreated] = useState(0);

  // Task state
  const [taskData, setTaskData] = useState<TaskData>({ title: '', priority: 'medium', dueDate: '' });
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskCreated, setTaskCreated] = useState(false);

  // Launch state
  const [launching, setLaunching] = useState(false);

  // Persist step
  useEffect(() => {
    try {
      localStorage.setItem(STEP_KEY, String(step));
    } catch {
      // Ignore
    }
  }, [step]);

  const goTo = useCallback((next: number, dir: Direction) => {
    if (animating) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setAnimating(true);
    setExitClass(dir === 'forward' ? 'ob-slide-exit-left' : 'ob-slide-exit-right');
    setEnterClass('');

    timeoutRef.current = setTimeout(() => {
      setRenderStep(next);
      setStep(next);
      setExitClass('');
      setEnterClass(dir === 'forward' ? 'ob-slide-enter-right' : 'ob-slide-enter-left');

      timeoutRef.current = setTimeout(() => {
        setEnterClass('');
        setAnimating(false);
      }, 220);
    }, 180);
  }, [animating]);

  const advance = useCallback(() => {
    if (renderStep < TOTAL_STEPS - 1) goTo(renderStep + 1, 'forward');
  }, [renderStep, goTo, TOTAL_STEPS]);

  const retreat = useCallback(() => {
    if (renderStep > 0) goTo(renderStep - 1, 'backward');
  }, [renderStep, goTo]);

  const handleToggleAgent = useCallback((id: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePlatformNext = useCallback(() => {
    if (platformData.platformName.trim()) {
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'platform.name': platformData.platformName.trim() }),
      }).catch(() => {});
    }
    advance();
  }, [platformData, advance]);

  const handleAgentsNext = useCallback(async () => {
    setCreatingAgents(true);
    let created = 0;
    for (const agentId of selectedAgents) {
      const def = AGENT_DEFS.find(a => a.id === agentId);
      if (!def) continue;
      try {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: def.id, name: def.name, capabilities: [def.role] }),
        });
        if (res.ok) created++;
      } catch {
        // Non-blocking
      }
    }
    setAgentsCreated(created || selectedAgents.size);
    setCreatingAgents(false);
    advance();
  }, [selectedAgents, advance]);

  const handleTaskSubmit = useCallback(async () => {
    setCreatingTask(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskData.title.trim(),
          priority: taskData.priority,
          dueDate: taskData.dueDate || undefined,
          status: 'todo',
        }),
      });
      setTaskCreated(true);
    } catch {
      setTaskCreated(true);
    } finally {
      setCreatingTask(false);
      advance();
    }
  }, [taskData, advance]);

  const handleTaskSkip = useCallback(() => {
    advance();
  }, [advance]);

  const handleLaunch = useCallback(async () => {
    setLaunching(true);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 'onboarding.completed': true }),
      });
    } catch {
      // Non-blocking
    }
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      localStorage.removeItem(STEP_KEY);
    } catch {
      // Ignore
    }
    setLaunching(false);
    onComplete();
  }, [onComplete]);

  const handleSkipAll = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      localStorage.removeItem(STEP_KEY);
    } catch {
      // Ignore
    }
    onComplete();
  }, [onComplete]);

  const slideClass = `${exitClass} ${enterClass}`.trim();

  return (
    <>
      <style>{`
        @keyframes ob-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ob-slide-exit-left {
          transform: translateX(-32px);
          opacity: 0;
          transition: transform 180ms ease-in, opacity 180ms ease-in;
        }
        .ob-slide-exit-right {
          transform: translateX(32px);
          opacity: 0;
          transition: transform 180ms ease-in, opacity 180ms ease-in;
        }
        .ob-slide-enter-right {
          transform: translateX(32px);
          opacity: 0;
          transition: transform 220ms ease-out, opacity 220ms ease-out;
        }
        .ob-slide-enter-left {
          transform: translateX(-32px);
          opacity: 0;
          transition: transform 220ms ease-out, opacity 220ms ease-out;
        }
      `}</style>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding setup wizard"
      >
        <div
          className="relative w-full max-w-md mx-4 bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <StepDots total={TOTAL_STEPS} current={step} />
            <button
              onClick={handleSkipAll}
              className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors p-1.5 rounded-lg hover:bg-mission-control-border"
              aria-label="Skip onboarding"
            >
              <X size={14} />
            </button>
          </div>

          {/* Step content */}
          <div
            className={`px-6 pb-6 pt-4 ${slideClass}`}
            key={renderStep}
          >
            {renderStep === 0 && <StepWelcome onNext={advance} />}
            {renderStep === 1 && (
              <StepPlatformSetup
                data={platformData}
                onChange={setPlatformData}
                onNext={handlePlatformNext}
                onBack={retreat}
              />
            )}
            {renderStep === 2 && (
              <StepMeetAgents
                selected={selectedAgents}
                onToggle={handleToggleAgent}
                onNext={handleAgentsNext}
                onBack={retreat}
                creating={creatingAgents}
              />
            )}
            {renderStep === 3 && (
              <StepFirstTask
                data={taskData}
                onChange={setTaskData}
                onSubmit={handleTaskSubmit}
                onSkip={handleTaskSkip}
                onBack={retreat}
                loading={creatingTask}
                taskCreated={taskCreated}
              />
            )}
            {renderStep === 4 && (
              <StepReady
                platformName={platformData.platformName}
                agentsAdded={agentsCreated}
                taskCreated={taskCreated}
                onLaunch={handleLaunch}
                loading={launching}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Quick-tips tooltip overlay
// ─────────────────────────────────────────────
interface TipDef {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

const TIPS: TipDef[] = [
  {
    target: 'nav[role="navigation"]',
    title: 'Navigate panels',
    content: 'Navigate between panels here',
    position: 'right',
  },
  {
    target: '[data-toolbar]',
    title: 'Create tasks',
    content: 'Create tasks for your agents',
    position: 'top',
  },
  {
    target: 'button[aria-label*="Search"], [data-search-trigger]',
    title: 'Search everything',
    content: 'Search everything with Cmd+K',
    position: 'bottom',
  },
];

interface QuickTipsProps {
  onDone: () => void;
}

export function QuickTips({ onDone }: QuickTipsProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const tip = TIPS[tipIndex];

  useEffect(() => {
    if (!tip) return;

    const update = () => {
      const el = document.querySelector(tip.target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect(r);

      const tw = 320;
      const th = 120;
      const gap = 12;
      let top = 0;
      let left = 0;

      switch (tip.position) {
        case 'right':
          top = r.top + (r.height - th) / 2;
          left = r.right + gap;
          break;
        case 'left':
          top = r.top + (r.height - th) / 2;
          left = r.left - tw - gap;
          break;
        case 'top':
          top = r.top - th - gap;
          left = r.left + (r.width - tw) / 2;
          break;
        case 'bottom':
        default:
          top = r.bottom + gap;
          left = r.left + (r.width - tw) / 2;
          break;
      }

      const pad = 12;
      if (left < pad) left = pad;
      if (left + tw > window.innerWidth - pad) left = window.innerWidth - tw - pad;
      if (top < pad) top = pad;

      setPos({ top, left });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [tip]);

  const handleNext = () => {
    if (tipIndex < TIPS.length - 1) {
      setTipIndex(i => i + 1);
    } else {
      try {
        localStorage.setItem(TIPS_KEY, 'true');
      } catch {
        // Ignore
      }
      onDone();
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(TIPS_KEY, 'true');
    } catch {
      // Ignore
    }
    onDone();
  };

  if (!tip) return null;

  const isLast = tipIndex === TIPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" role="dialog" aria-modal="true" aria-label="Quick tips">
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={handleSkip} />

      {rect && (
        <div
          className="absolute border-2 border-mission-control-accent rounded-lg animate-pulse pointer-events-none"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}

      <div
        className="absolute w-80 bg-mission-control-surface border border-mission-control-border rounded-lg shadow-2xl pointer-events-auto"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-mission-control-accent font-medium uppercase tracking-wide">
                Tip {tipIndex + 1} of {TIPS.length}
              </p>
              <h3 className="text-sm font-semibold text-mission-control-text mt-0.5">{tip.title}</h3>
              <p className="text-xs text-mission-control-text-dim mt-1 leading-relaxed">{tip.content}</p>
            </div>
            <button
              onClick={handleSkip}
              className="flex-shrink-0 p-1 rounded text-mission-control-text-dim hover:text-mission-control-text transition-colors"
              aria-label="Close tips"
            >
              <X size={14} />
            </button>
          </div>

          <div className="h-0.5 bg-mission-control-border rounded-full overflow-hidden">
            <div
              className="h-full bg-mission-control-accent transition-all duration-300"
              style={{ width: `${((tipIndex + 1) / TIPS.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors"
            >
              Skip tips
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
            >
              {isLast ? (
                <>
                  <Check size={12} />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ArrowRight size={12} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Hook — manages show/hide logic
// ─────────────────────────────────────────────
export function useOnboardingFlow() {
  const [showFlow, setShowFlow] = useState(false);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        setShowFlow(true);
      }
    } catch {
      // Ignore
    }
  }, []);

  const completeFlow = useCallback(() => {
    setShowFlow(false);
    setTimeout(() => {
      try {
        const tipsSeen = localStorage.getItem(TIPS_KEY);
        if (!tipsSeen) {
          setShowTips(true);
        }
      } catch {
        // Ignore
      }
    }, 600);
  }, []);

  const completeTips = useCallback(() => {
    setShowTips(false);
  }, []);

  const restartOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
      localStorage.removeItem(TIPS_KEY);
      localStorage.removeItem(STEP_KEY);
    } catch {
      // Ignore
    }
    setShowFlow(true);
  }, []);

  return { showFlow, showTips, completeFlow, completeTips, restartOnboarding };
}
