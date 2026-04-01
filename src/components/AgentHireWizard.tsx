import { useState } from 'react';
import {
  X, ChevronRight, CheckCircle, Bot, Cpu, Loader2, User, Briefcase,
  Search, Calendar, Tag, FlaskConical,
} from 'lucide-react';
import { Button, TextField, TextArea, Switch, Box, Flex } from '@radix-ui/themes';
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
  opus:   { label: 'Opus',   cls: 'bg-review-subtle text-review' },
  sonnet: { label: 'Sonnet', cls: 'bg-info/10 text-info' },
  haiku:  { label: 'Haiku',  cls: 'bg-warning/10 text-warning' },
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
    <Flex align="center" justify="center" p="4" className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
      <Box className="w-full max-w-lg bg-mission-control-surface border border-mission-control-border rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-mission-control-border flex-shrink-0">
          <Flex align="center" gap="3">
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
              <h2 className="text-base font-semibold leading-tight">{agent.name}</h2>
              <p className="text-xs text-mission-control-text-dim">{agent.role || 'Agent'}</p>
            </div>
          </Flex>
          {step !== 'installing' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Step progress indicator */}
        {currentProgressIndex >= 0 && (
          <div className="px-6 pt-5 pb-3">
            <div className="flex items-center">
              {PROGRESS_STEPS.map((s, i) => {
                const isActive = step === s;
                const isCompleted = currentProgressIndex > i;
                const stepLabel = s.charAt(0).toUpperCase() + s.slice(1);
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1 flex-shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums transition-colors transition-[background-color,border-color,color] ${
                        isCompleted
                          ? 'bg-[var(--mission-control-accent)] text-white'
                          : isActive
                            ? 'bg-transparent text-[var(--mission-control-accent)] border-2 border-[var(--mission-control-accent)] ring-2 ring-[var(--mission-control-accent)]/20'
                            : 'bg-mission-control-border/20 text-mission-control-text-dim border border-mission-control-border'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle size={14} />
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-[10px] font-medium ${isActive ? 'text-mission-control-text' : isCompleted ? 'text-[var(--mission-control-accent)]' : 'text-mission-control-text-dim'}`}>
                        {stepLabel}
                      </span>
                    </div>
                    {i < PROGRESS_STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-2 mb-4 transition-[background-color] duration-300 ${
                        isCompleted ? 'bg-[var(--mission-control-accent)]' : 'bg-mission-control-border'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step body */}
        <div className="flex-1 overflow-y-auto">

        {/* ── Step 0: Match ── */}
        {step === 'match' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm font-medium mb-1">What do you need help with?</p>
            <p className="text-xs text-mission-control-text-dim mb-4">
              Describe your goal — we'll check if {agent.name} is the right fit.
            </p>

            <div className="relative mb-4">
              <TextField.Root
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Write a product launch email campaign…"
                size="2"
                autoFocus
              >
                <TextField.Slot>
                  <Search size={14} />
                </TextField.Slot>
              </TextField.Root>
            </div>

            {/* Match result */}
            {query.trim() && (
              <Flex align="start" gap="3" className={`p-3 rounded-lg mb-4 border ${
                matchScore !== null && matchScore >= 50
                  ? 'bg-success/10 border-success/30'
                  : 'bg-warning/10 border-warning/30'
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
              </Flex>
            )}

            <Button
              type="button"
              size="2"
              variant="solid"
              onClick={() => setStep('review')}
              className="w-full"
            >
              Continue <ChevronRight size={16} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="2"
              onClick={() => setStep('review')}
              className="w-full mt-2"
            >
              Skip and review agent
            </Button>
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
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim uppercase tracking-wide">
                {agent.category}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${modelBadge.cls}`}>
                {modelBadge.label}
              </span>
            </div>

            {/* Capabilities */}
            {agent.capabilities.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">Capabilities</p>
                <div className="flex flex-wrap gap-1">
                  {agent.capabilities.map((cap, i) => (
                    <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Required APIs warning */}
            {agent.requiredApis.length > 0 && (
              <Flex align="start" gap="2" className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs mb-4">
                <Cpu size={13} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-0.5">Required APIs</p>
                  <p>{agent.requiredApis.join(', ')}</p>
                </div>
              </Flex>
            )}

            <Flex gap="2">
              <Button
                type="button"
                size="2"
                variant="ghost"
                onClick={() => setStep('match')}
              >
                Back
              </Button>
              <Button
                type="button"
                size="2"
                variant="solid"
                onClick={() => setStep('personalize')}
                className="flex-1"
              >
                Continue <ChevronRight size={16} />
              </Button>
            </Flex>
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
              <label className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1.5 flex items-center gap-1 block">
                <Briefcase size={11} /> Their role on your team
              </label>
              <TextField.Root
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder={agent.role || 'e.g. Head of Growth'}
                size="2"
              />
            </div>

            {/* Personality */}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1.5 flex items-center gap-1 block">
                <Bot size={11} /> Personality or working style
              </label>
              <TextArea
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                placeholder="e.g. Direct, data-driven, bias to action"
                rows={3}
                size="2"
                style={{ resize: 'none' }}
              />
            </div>

            {/* User context */}
            <div className="mb-4">
              <label className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1.5 flex items-center gap-1 block">
                <User size={11} /> Your context for this agent
              </label>
              <TextArea
                value={userContext}
                onChange={e => setUserContext(e.target.value)}
                placeholder={`e.g. I'm a VP of Growth at a crypto startup. We use Solana. Focus on DeFi users and KOL partnerships.`}
                rows={4}
                size="2"
                style={{ resize: 'none' }}
              />
              <p className="text-xs text-mission-control-text-dim mt-1">
                The more context you give, the better they'll perform from day one.
              </p>
            </div>

            {/* Trial mode toggle */}
            <Flex align="center" gap="3" className="p-3 rounded-lg bg-mission-control-surface border border-mission-control-border mb-5">
              <div className="flex-1">
                <Flex align="center" gap="1" className="mb-0.5">
                  <FlaskConical size={13} className="text-mission-control-accent" />
                  <span className="text-sm font-medium">Try for 7 days</span>
                </Flex>
                <p className="text-xs text-mission-control-text-dim">
                  Adds a trial tag to the agent. Remove any time from their settings.
                </p>
              </div>
              <Switch
                size="2"
                checked={trialMode}
                onCheckedChange={(checked) => setTrialMode(checked)}
              />
            </Flex>

            <Flex gap="2">
              <Button
                type="button"
                size="2"
                variant="ghost"
                onClick={() => setStep('review')}
              >
                Back
              </Button>
              <Button
                type="button"
                size="2"
                variant="solid"
                onClick={() => setStep('confirm')}
                className="flex-1"
              >
                Review &amp; Hire <ChevronRight size={15} />
              </Button>
            </Flex>
          </div>
        )}

        {/* ── Step 3: Confirmation summary ── */}
        {step === 'confirm' && (
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm font-medium mb-4">Confirm hire details</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/30 text-error text-sm">
                {error}
              </div>
            )}

            <div className="rounded-lg border border-mission-control-border divide-y divide-mission-control-border overflow-hidden mb-5">
              {/* Agent name */}
              <Flex align="start" gap="3" className="px-4 py-3">
                <Bot size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Agent</p>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-mission-control-text-dim">{agent.description || agent.role || '—'}</p>
                </div>
              </Flex>
              {/* Role */}
              <Flex align="start" gap="3" className="px-4 py-3">
                <Briefcase size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Role</p>
                  <p className="text-sm">{role || agent.role || 'Agent'}</p>
                </div>
              </Flex>
              {/* Capabilities */}
              {agent.capabilities.length > 0 && (
                <Flex align="start" gap="3" className="px-4 py-3">
                  <Tag size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-1">Assigned tasks</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 5).map((cap, i) => (
                        <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                </Flex>
              )}
              {/* Start date */}
              <Flex align="start" gap="3" className="px-4 py-3">
                <Calendar size={14} className="text-mission-control-text-dim mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-0.5">Start date</p>
                  <p className="text-sm">{startDate}</p>
                </div>
              </Flex>
              {/* Trial */}
              {trialMode && (
                <Flex align="start" gap="3" className="px-4 py-3 bg-info/10">
                  <FlaskConical size={14} className="text-info mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-info mb-0.5">Trial mode</p>
                    <p className="text-sm text-mission-control-text-dim">7-day trial tag applied</p>
                  </div>
                </Flex>
              )}
            </div>

            <Flex gap="2">
              <Button
                type="button"
                size="2"
                variant="ghost"
                onClick={() => setStep('personalize')}
              >
                Back
              </Button>
              <Button
                type="button"
                size="2"
                variant="solid"
                onClick={handleInstall}
                className="flex-1"
              >
                <CheckCircle size={15} />
                Confirm &amp; Hire
              </Button>
            </Flex>
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
            <div className="w-16 h-16 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center">
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
            <Button
              type="button"
              size="2"
              variant="solid"
              onClick={() => { onHired(); onClose(); }}
              style={{ marginTop: '8px' }}
            >
              Done
            </Button>
          </div>
        )}

        </div>{/* end step body */}
      </Box>
    </Flex>
  );
}
