import { useState } from 'react';
import {
  X, ChevronRight, CheckCircle, Bot, Cpu, Loader2, User, Briefcase,
  Search, Calendar, Tag, FlaskConical,
} from 'lucide-react';
import type { CatalogAgent } from '../types/catalog';
import { catalogApi } from '../lib/api';
import { useStore } from '../store/store';

interface AgentHireWizardProps {
  agent: CatalogAgent;
  onClose: () => void;
  onHired: () => void;
}

type Step = 'match' | 'review' | 'personalize' | 'confirm' | 'installing' | 'done';

const STEP_ORDER: Step[] = ['match', 'review', 'personalize', 'confirm', 'installing', 'done'];
// Steps shown in the progress indicator (excluding installing/done which are terminal)
const PROGRESS_STEPS: Step[] = ['match', 'review', 'personalize', 'confirm'];

const MODEL_BADGE: Record<string, { label: string; cls: string }> = {
  opus:   { label: 'Opus',   cls: 'bg-review-subtle text-review border border-review-border' },
  sonnet: { label: 'Sonnet', cls: 'bg-info-subtle text-info border border-info-border' },
  haiku:  { label: 'Haiku',  cls: 'bg-warning-subtle text-warning border border-warning-border' },
};

export default function AgentHireWizard({ agent, onClose, onHired }: AgentHireWizardProps) {
  const fetchAgents = useStore(s => s.fetchAgents);
  const [step, setStep]           = useState<Step>('match');
  const [query, setQuery]         = useState('');
  const [role, setRole]           = useState(agent.role ?? '');
  const [personality, setPersonality] = useState(agent.defaultPersonality ?? '');
  const [userContext, setUserContext]  = useState(agent.description ?? '');
  const [trialMode, setTrialMode]     = useState(false);
  const [startDate]                   = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = useState<string | null>(null);

  const modelBadge = MODEL_BADGE[agent.model] ?? MODEL_BADGE.sonnet;

  // Step 0 keyword match score — simple stub filter
  const matchScore = (() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    const hits = [
      agent.name.toLowerCase().includes(q),
      (agent.role ?? '').toLowerCase().includes(q),
      (agent.description ?? '').toLowerCase().includes(q),
      agent.capabilities.some(c => c.toLowerCase().includes(q)),
    ].filter(Boolean).length;
    return Math.round((hits / 4) * 100);
  })();

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      const personalityBlock = [
        personality && `Personality: ${personality}`,
        userContext  && `User context: ${userContext}`,
        trialMode    && `Note: Hired on 7-day trial.`,
      ].filter(Boolean).join('\n\n');

      await catalogApi.hireAgent({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: role || agent.role || 'Agent',
        personality: personalityBlock || undefined,
        capabilities: agent.capabilities,
        ...(trialMode ? { tags: ['trial-7d'] } : {}),
      });

      await fetchAgents();
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hire failed');
      setStep('confirm');
    }
  };

  const currentProgressIndex = PROGRESS_STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-mission-control-surface border border-mission-control-border overflow-hidden flex items-center justify-center text-xl flex-shrink-0">
              {agent.avatar ? (
                <img
                  src={`/api/agents/${agent.id}/avatar`}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.textContent = '';
                    }
                  }}
                />
              ) : (
                <Bot size={20} className="text-mission-control-text-dim" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">{agent.name}</h2>
              <p className="text-xs text-mission-control-text-dim">{agent.role || 'Agent'}</p>
            </div>
          </div>
          {step !== 'installing' && (
            <button
              type="button"
              onClick={onClose}
              className="icon-btn"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step progress indicator */}
        {currentProgressIndex >= 0 && (
          <div className="flex items-center gap-1 px-6 pt-4 pb-2">
            {PROGRESS_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  step === s
                    ? 'bg-mission-control-accent'
                    : currentProgressIndex > i
                      ? 'bg-success'
                      : 'bg-mission-control-border'
                }`} />
                {i < PROGRESS_STEPS.length - 1 && <div className="w-6 h-px bg-mission-control-border" />}
              </div>
            ))}
            <span className="ml-2 text-xs text-mission-control-text-dim capitalize">{step}</span>
          </div>
        )}

        {/* ── Step 0: Match ── */}
        {step === 'match' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm font-medium mb-1">What do you need help with?</p>
            <p className="text-xs text-mission-control-text-dim mb-4">
              Describe your goal — we'll check if {agent.name} is the right fit.
            </p>

            <div className="relative mb-4">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mission-control-text-dim" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Write a product launch email campaign…"
                className="w-full pl-8 pr-3 py-2.5 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
                autoFocus
              />
            </div>

            {/* Match result */}
            {query.trim() && (
              <div className={`flex items-start gap-3 p-3 rounded-lg mb-4 border ${
                matchScore !== null && matchScore >= 50
                  ? 'bg-success-subtle border-success-border'
                  : 'bg-warning-subtle border-warning-border'
              }`}>
                {matchScore !== null && matchScore >= 50 ? (
                  <CheckCircle size={16} className="text-success mt-0.5 flex-shrink-0" />
                ) : (
                  <Bot size={16} className="text-warning mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${matchScore !== null && matchScore >= 50 ? 'text-success' : 'text-warning'}`}>
                    {matchScore !== null && matchScore >= 50
                      ? `${agent.name} looks like a great fit`
                      : `${agent.name} may partially match`}
                  </p>
                  <p className="text-xs text-mission-control-text-dim mt-0.5">
                    {agent.role || agent.description || 'Specialized AI agent'}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('review')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium"
            >
              Continue <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setStep('review')}
              className="w-full mt-2 text-xs text-mission-control-text-dim hover:text-mission-control-text transition-colors py-1"
            >
              Skip and review agent
            </button>
          </div>
        )}

        {/* ── Step 1: Review ── */}
        {step === 'review' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm text-mission-control-text-dim mb-4">
              {agent.description || `${agent.name} will join your Mission Control team.`}
            </p>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim uppercase tracking-wide">
                {agent.category}
              </span>
              <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${modelBadge.cls}`}>
                {modelBadge.label}
              </span>
            </div>

            {/* Capabilities */}
            {agent.capabilities.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-mission-control-text-dim mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[11px] rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Required APIs warning */}
            {agent.requiredApis.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-subtle border border-warning-border text-warning text-xs mb-4">
                <Cpu size={13} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">Required APIs</p>
                  <p>{agent.requiredApis.join(', ')}</p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('match')}
                className="px-4 py-2.5 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('personalize')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium"
              >
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Personalize ── */}
        {step === 'personalize' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm text-mission-control-text-dim mb-5">
              Help {agent.name} understand your context. This gets written into their workspace so every session starts with the right frame.
            </p>

            {/* Role override */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-medium text-mission-control-text-dim mb-1.5">
                <Briefcase size={12} /> Their role on your team
              </label>
              <input
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder={agent.role || 'e.g. Head of Growth'}
                className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
              />
            </div>

            {/* Personality */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-medium text-mission-control-text-dim mb-1.5">
                <Bot size={12} /> Personality or working style
              </label>
              <textarea
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                placeholder="e.g. Direct, data-driven, bias to action"
                rows={3}
                className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
              />
            </div>

            {/* User context */}
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-xs font-medium text-mission-control-text-dim mb-1.5">
                <User size={12} /> Your context for this agent
              </label>
              <textarea
                value={userContext}
                onChange={e => setUserContext(e.target.value)}
                placeholder={`e.g. I'm a VP of Growth at a crypto startup. We use Solana. Focus on DeFi users and KOL partnerships.`}
                rows={4}
                className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
              />
              <p className="text-[11px] text-mission-control-text-dim mt-1">
                The more context you give, the better they'll perform from day one.
              </p>
            </div>

            {/* Trial mode toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-mission-control-surface border border-mission-control-border mb-5">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <FlaskConical size={13} className="text-mission-control-accent" />
                  <span className="text-sm font-medium">Try for 7 days</span>
                </div>
                <p className="text-xs text-mission-control-text-dim">
                  Adds a trial tag to the agent. Remove any time from their settings.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={trialMode}
                onClick={() => setTrialMode(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                  trialMode ? 'bg-mission-control-accent' : 'bg-mission-control-border'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  trialMode ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('review')}
                className="px-4 py-2.5 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium text-sm"
              >
                Review &amp; Hire <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirmation summary ── */}
        {step === 'confirm' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm font-medium mb-4">Confirm hire details</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-subtle border border-error-border text-error text-sm">
                {error}
              </div>
            )}

            <div className="rounded-lg border border-mission-control-border divide-y divide-mission-control-border overflow-hidden mb-5">
              {/* Agent name */}
              <div className="flex items-start gap-3 px-4 py-3">
                <Bot size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Agent</p>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-mission-control-text-dim">{agent.description || agent.role || '—'}</p>
                </div>
              </div>
              {/* Role */}
              <div className="flex items-start gap-3 px-4 py-3">
                <Briefcase size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Role</p>
                  <p className="text-sm">{role || agent.role || 'Agent'}</p>
                </div>
              </div>
              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3">
                  <Tag size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim mb-1">Assigned tasks</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 5).map((cap, i) => (
                        <span key={i} className="px-1.5 py-0.5 text-[11px] rounded bg-mission-control-surface border border-mission-control-border text-mission-control-text-dim">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Start date */}
              <div className="flex items-start gap-3 px-4 py-3">
                <Calendar size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Start date</p>
                  <p className="text-sm">{startDate}</p>
                </div>
              </div>
              {/* Trial */}
              {trialMode && (
                <div className="flex items-start gap-3 px-4 py-3 bg-info-subtle/30">
                  <FlaskConical size={14} className="text-info mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-info mb-0.5">Trial mode</p>
                    <p className="text-sm text-mission-control-text-dim">7-day trial tag applied</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('personalize')}
                className="px-4 py-2.5 text-sm border border-mission-control-border rounded-lg hover:bg-mission-control-surface transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium text-sm"
              >
                <CheckCircle size={15} />
                Confirm &amp; Hire
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Installing ── */}
        {step === 'installing' && (
          <div className="px-6 py-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-mission-control-accent/10 border border-mission-control-accent/30 flex items-center justify-center">
              <Loader2 size={28} className="text-mission-control-accent animate-spin" />
            </div>
            <div>
              <p className="font-medium mb-1">Setting up {agent.name}…</p>
              <p className="text-sm text-mission-control-text-dim">Creating workspace, writing soul file, registering agent</p>
            </div>
          </div>
        )}

        {/* ── Step: Done ── */}
        {step === 'done' && (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-success-subtle border border-success-border flex items-center justify-center">
              <CheckCircle size={32} className="text-success" />
            </div>
            <div>
              <p className="font-semibold text-lg mb-1">{agent.name} is hired!</p>
              {trialMode && (
                <p className="text-xs text-info mb-1">7-day trial is active.</p>
              )}
              <p className="text-sm text-mission-control-text-dim">
                Their workspace is ready at{' '}
                <code className="text-xs bg-mission-control-surface px-1 py-0.5 rounded">
                  ~/mission-control/agents/{agent.id}/
                </code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { onHired(); onClose(); }}
              className="mt-2 px-6 py-2.5 bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent-dim transition-colors font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
