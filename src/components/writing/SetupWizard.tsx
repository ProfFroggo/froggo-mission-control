import { useState, useEffect } from 'react';
import { Wand2, X, ArrowRight, BookOpen, BookText, Type, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { useWizardStore } from '../../store/wizardStore';
import { getWizardAgent } from '../../lib/wizardPrompts';
import WizardChat from './WizardChat';
import WizardReview from './WizardReview';
import WizardPlanPreview from './WizardPlanPreview';

export default function SetupWizard() {
  const {
    step,
    brainDump,
    setBrainDump,
    setStep,
    selectedAgent,
    setSelectedAgent,
    cancelWizard,
    messages,
    plan,
    reset,
  } = useWizardStore();

  const [customType, setCustomType] = useState('');

  // Book type button helper
  const typeOptions = [
    { key: 'memoir', label: 'Memoir', icon: BookOpen, agent: 'jess' },
    { key: 'novel', label: 'Novel', icon: BookText, agent: 'writer' },
    { key: 'other', label: 'Other', icon: Type, agent: 'writer' },
  ] as const;

  const [selectedType, setSelectedType] = useState<string>('memoir');

  const handleTypeSelect = (key: string, agent: string) => {
    setSelectedType(key);
    setSelectedAgent(agent);
  };

  const handleStartPlanning = () => {
    if (!brainDump.trim()) return;
    setStep('conversation');
  };

  // Auto-redirect on completion
  useEffect(() => {
    if (step === 'complete') {
      const timer = setTimeout(() => reset(), 500);
      return () => clearTimeout(timer);
    }
  }, [step, reset]);

  // -- braindump step --
  if (step === 'braindump') {
    return (
      <div className="h-full overflow-y-auto bg-clawd-bg">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-clawd-accent/15">
              <Wand2 size={24} className="text-clawd-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-clawd-text">Plan Your Book</h1>
              <p className="text-sm text-clawd-text-dim mt-0.5">
                Describe your idea and an AI agent will help you build a full plan.
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="p-6 rounded-xl border border-clawd-border bg-clawd-surface space-y-6">
            {/* Book type selector */}
            <div>
              <label className="block text-xs font-medium text-clawd-text-dim mb-2">
                Book Type
              </label>
              <div className="flex gap-2">
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleTypeSelect(opt.key, opt.agent)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        isSelected
                          ? 'border-clawd-accent bg-clawd-accent/10 text-clawd-accent'
                          : 'border-clawd-border text-clawd-text-dim hover:border-clawd-text-dim'
                      }`}
                    >
                      <Icon size={16} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {/* Custom type name input */}
              {selectedType === 'other' && (
                <input
                  id="custom-type-input"
                  type="text"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. Fantasy, Sci-Fi, Thriller..."
                  className="mt-2 w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent"
                />
              )}
            </div>

            {/* Brain dump textarea */}
            <div>
              <label htmlFor="brain-dump-textarea" className="block text-xs font-medium text-clawd-text-dim mb-2">
                Describe your book idea
              </label>
              <textarea
                id="brain-dump-textarea"
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                rows={6}
                placeholder="What's your book about? Pour out everything -- characters, themes, plot points, personal experiences, inspiration..."
                className="w-full px-3 py-2 rounded-lg bg-clawd-bg border border-clawd-border text-clawd-text text-sm placeholder:text-clawd-text-dim/50 focus:outline-none focus:border-clawd-accent resize-y min-h-[120px]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => cancelWizard()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
              <button
                onClick={handleStartPlanning}
                disabled={!brainDump.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-clawd-accent text-white text-sm font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start Planning
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -- conversation / extracting step --
  if (step === 'conversation' || step === 'extracting') {
    const agent = getWizardAgent(selectedAgent);
    return (
      <div className="h-full flex flex-col bg-clawd-bg">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-clawd-border bg-clawd-surface flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-clawd-accent" />
            <span className="text-sm font-medium text-clawd-text">
              Planning with {agent.name}
            </span>
            {messages.length > 0 && (
              <span className="text-xs text-clawd-text-dim">
                ({messages.length} message{messages.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep('extracting')}
              disabled={step === 'extracting' || messages.length < 2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clawd-accent text-white text-xs font-medium hover:bg-clawd-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Wand2 size={12} />
              Generate Plan
            </button>
            <button
              onClick={() => cancelWizard()}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-bg transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>

        {/* Chat + optional plan preview sidebar */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-h-0">
            <WizardChat />
          </div>
          {plan && (
            <div className="w-[280px] flex-shrink-0 border-l border-clawd-border overflow-y-auto p-2">
              <WizardPlanPreview />
            </div>
          )}
        </div>
      </div>
    );
  }

  // -- review step --
  if (step === 'review') {
    return <WizardReview />;
  }

  // -- creating step --
  if (step === 'creating') {
    return (
      <div className="h-full flex items-center justify-center bg-clawd-bg">
        <div className="text-center p-8">
          <Loader2 size={32} className="mx-auto text-clawd-accent animate-spin mb-4" />
          <p className="text-clawd-text text-sm font-medium">Creating your project...</p>
        </div>
      </div>
    );
  }

  // -- complete step --
  if (step === 'complete') {
    return (
      <div className="h-full flex items-center justify-center bg-clawd-bg">
        <div className="text-center p-8">
          <CheckCircle size={48} className="mx-auto text-success mb-4" />
          <p className="text-clawd-text text-sm font-medium">Project created successfully!</p>
          <p className="text-clawd-text-dim text-xs mt-1">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Fallback (should not reach here if wizard is active)
  return null;
}
