// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Zap,
  BarChart2,
  ArrowRight,
  X,
  Check,
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Bot,
  Workflow,
  BookOpen,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
export const ONBOARDING_KEY = 'mission-control.onboarded';
const TIPS_KEY = 'mission-control.tips-seen';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
}

interface OnboardingFlowProps {
  onComplete: () => void;
  onNavigate?: (view: string) => void;
}

// ─────────────────────────────────────────────
// Step progress indicator
// ─────────────────────────────────────────────
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={current + 1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`block h-1.5 rounded-full transition-all duration-300 ${
            i === current
              ? 'w-4 bg-mission-control-accent'
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
  const features = [
    { Icon: Users, label: 'Assign tasks to specialized AI agents' },
    { Icon: Zap, label: 'Automate workflows across your business' },
    { Icon: BarChart2, label: 'Track progress in real-time' },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-mission-control-text">Welcome to Mission Control</h2>
        <p className="text-sm text-mission-control-text-dim">Your AI-powered operations platform</p>
      </div>

      <div className="space-y-3">
        {features.map(({ Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border"
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-mission-control-accent/10 flex items-center justify-center">
              <Icon size={16} className="text-mission-control-accent" />
            </div>
            <span className="text-sm text-mission-control-text">{label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
      >
        Get started
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 2 — Create first task
// ─────────────────────────────────────────────
function StepCreateTask({ onNext }: { onNext: () => void }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown) => {
        const list: Agent[] = Array.isArray(data)
          ? data
          : Array.isArray((data as any)?.agents)
          ? (data as any).agents
          : [];
        setAgents(list.map((a: any) => ({ id: a.id, name: a.name || a.identityName || a.id })));
      })
      .catch(() => setAgents([]));
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Task title is required');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          assignedTo: assignedTo || undefined,
          status: 'todo',
        }),
      });
    } catch {
      // Non-blocking — continue onboarding even if task creation fails
    } finally {
      setLoading(false);
      onNext();
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Create your first task</h2>
        <p className="text-sm text-mission-control-text-dim">Assign work to an agent and watch it get done.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label htmlFor="ob-task-title" className="block text-xs font-medium text-mission-control-text-dim mb-1">
            Task title
          </label>
          <input
            id="ob-task-title"
            type="text"
            value={title}
            onChange={e => { setTitle(e.target.value); setError(''); }}
            placeholder="e.g. Draft a product announcement"
            className="form-input w-full"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div>
          <label htmlFor="ob-priority" className="block text-xs font-medium text-mission-control-text-dim mb-1">
            Priority
          </label>
          <select
            id="ob-priority"
            value={priority}
            onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            className="form-select w-full"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label htmlFor="ob-agent" className="block text-xs font-medium text-mission-control-text-dim mb-1">
            Assign to agent
          </label>
          <select
            id="ob-agent"
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            className="form-select w-full"
          >
            <option value="">Unassigned</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCreate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create task & continue'}
          {!loading && <ArrowRight size={16} />}
        </button>
        <button
          onClick={onNext}
          className="px-4 py-2.5 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Step 3 — Explore the platform
// ─────────────────────────────────────────────
const PANELS = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'kanban', label: 'Tasks', Icon: CheckSquare },
  { id: 'projects', label: 'Projects', Icon: FolderKanban },
  { id: 'agents', label: 'Agents', Icon: Bot },
  { id: 'automations', label: 'Automations', Icon: Workflow },
  { id: 'library', label: 'Library', Icon: BookOpen },
] as const;

function StepExplore({
  onReady,
  onNavigate,
}: {
  onReady: () => void;
  onNavigate?: (view: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-mission-control-text">Explore Mission Control</h2>
        <p className="text-sm text-mission-control-text-dim">Jump into any panel to get started.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {PANELS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate?.(id)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg bg-mission-control-bg border border-mission-control-border hover:border-mission-control-accent/60 hover:bg-mission-control-accent/5 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-mission-control-surface border border-mission-control-border flex items-center justify-center group-hover:border-mission-control-accent/40 transition-colors">
              <Icon size={18} className="text-mission-control-text-dim group-hover:text-mission-control-accent transition-colors" />
            </div>
            <span className="text-xs text-mission-control-text-dim group-hover:text-mission-control-text transition-colors">{label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={onReady}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors"
      >
        <Check size={16} />
        I'm ready
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main OnboardingFlow component
// ─────────────────────────────────────────────
export default function OnboardingFlow({ onComplete, onNavigate }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 3;

  const advance = useCallback(() => {
    setStep(s => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
    onComplete();
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Onboarding">
      <div
        className="relative w-full max-w-md mx-4 bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl p-6 space-y-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header row: step dots + close */}
        <div className="flex items-center justify-between">
          <StepDots total={TOTAL_STEPS} current={step} />
          <button
            onClick={handleComplete}
            className="p-1 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border transition-colors"
            aria-label="Close onboarding"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step content */}
        {step === 0 && <StepWelcome onNext={advance} />}
        {step === 1 && <StepCreateTask onNext={advance} />}
        {step === 2 && (
          <StepExplore
            onReady={handleComplete}
            onNavigate={(view) => {
              onNavigate?.(view);
              // Small delay so the panel is visible before closing modal
              setTimeout(handleComplete, 150);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Quick-tips tooltip overlay (Step 4)
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
      {/* Dim overlay (allows clicks through to underlying UI via pointer-events) */}
      <div className="absolute inset-0 bg-black/50 pointer-events-auto" onClick={handleSkip} />

      {/* Highlight ring */}
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

      {/* Tooltip */}
      <div
        className="absolute w-80 bg-mission-control-surface border border-mission-control-border rounded-xl shadow-2xl pointer-events-auto"
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

          {/* Progress bar */}
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
    // Show tips after brief delay if not already seen
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

  /** Called from Settings — resets both localStorage keys and shows the flow again */
  const restartOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
      localStorage.removeItem(TIPS_KEY);
    } catch {
      // Ignore
    }
    setShowFlow(true);
  }, []);

  return { showFlow, showTips, completeFlow, completeTips, restartOnboarding };
}
