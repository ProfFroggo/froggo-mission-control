import { useState } from 'react';
import { X, ChevronRight, CheckCircle, Sparkles, Bot, Cpu, Loader2, User, Briefcase } from 'lucide-react';
import type { CatalogAgent } from '../types/catalog';
import { catalogApi } from '../lib/api';
import { useStore } from '../store/store';

interface AgentHireWizardProps {
  agent: CatalogAgent;
  onClose: () => void;
  onHired: () => void;
}

type Step = 'review' | 'personalize' | 'installing' | 'done';

const MODEL_BADGE: Record<string, { label: string; cls: string }> = {
  opus:   { label: 'Opus',   cls: 'bg-review-subtle text-review border border-review-border' },
  sonnet: { label: 'Sonnet', cls: 'bg-info-subtle text-info border border-info-border' },
  haiku:  { label: 'Haiku',  cls: 'bg-warning-subtle text-warning border border-warning-border' },
};

export default function AgentHireWizard({ agent, onClose, onHired }: AgentHireWizardProps) {
  const fetchAgents = useStore(s => s.fetchAgents);
  const [step, setStep] = useState<Step>('review');
  const [role, setRole] = useState(agent.role ?? '');
  const [personality, setPersonality] = useState(agent.defaultPersonality ?? '');
  const [userContext, setUserContext] = useState('');
  const [error, setError] = useState<string | null>(null);

  const modelBadge = MODEL_BADGE[agent.model] ?? MODEL_BADGE.sonnet;

  const handleInstall = async () => {
    setStep('installing');
    setError(null);
    try {
      // Combine personality + user context into the personalization block
      const personalityBlock = [
        personality && `Personality: ${personality}`,
        userContext  && `User context: ${userContext}`,
      ].filter(Boolean).join('\n\n');

      await catalogApi.hireAgent({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        role: role || agent.role || 'Agent',
        personality: personalityBlock || undefined,
        capabilities: agent.capabilities,
      });

      await fetchAgents();
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hire failed');
      setStep('personalize');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-mission-control-bg border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mission-control-surface border border-mission-control-border overflow-hidden flex items-center justify-center text-xl flex-shrink-0">
              {agent.avatar ? (
                <img
                  src={`/api/agents/${agent.id}/avatar`}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.textContent = agent.emoji || '🤖';
                    }
                  }}
                />
              ) : (
                agent.emoji || '🤖'
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

        {/* Step indicator */}
        {step !== 'done' && (
          <div className="flex items-center gap-1 px-6 pt-4 pb-2">
            {(['review', 'personalize', 'installing'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  step === s
                    ? 'bg-mission-control-accent'
                    : (['review', 'personalize', 'installing'].indexOf(step) > i)
                      ? 'bg-success'
                      : 'bg-mission-control-border'
                }`} />
                {i < 2 && <div className="w-6 h-px bg-mission-control-border" />}
              </div>
            ))}
            <span className="ml-2 text-xs text-mission-control-text-dim capitalize">{step}</span>
          </div>
        )}

        {/* Step: Review */}
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

            <button
              type="button"
              onClick={() => setStep('personalize')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium"
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Step: Personalize */}
        {step === 'personalize' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm text-mission-control-text-dim mb-5">
              Help {agent.name} understand your context. This gets written into their workspace so every session starts with the right frame.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-subtle border border-error-border text-error text-sm">
                {error}
              </div>
            )}

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
              <input
                type="text"
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                placeholder="e.g. Direct, data-driven, bias to action"
                className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
              />
            </div>

            {/* User context */}
            <div className="mb-5">
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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('review')}
                className="px-4 py-2.5 text-sm border border-mission-control-border rounded-xl hover:bg-mission-control-surface transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium text-sm"
              >
                <Sparkles size={15} /> Hire {agent.name}
              </button>
            </div>
          </div>
        )}

        {/* Step: Installing */}
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

        {/* Step: Done */}
        {step === 'done' && (
          <div className="px-6 py-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-success-subtle border border-success-border flex items-center justify-center">
              <CheckCircle size={32} className="text-success" />
            </div>
            <div>
              <p className="font-semibold text-lg mb-1">{agent.name} is hired!</p>
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
              className="mt-2 px-6 py-2.5 bg-mission-control-accent text-white rounded-xl hover:bg-mission-control-accent-dim transition-colors font-medium"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
