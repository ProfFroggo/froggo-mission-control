import { useState, useEffect } from 'react';
import { Wand2, X, ArrowRight, BookOpen, BookText, Type, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { Button, TextField, TextArea } from '@radix-ui/themes';
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
    streaming,
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
      <div className="h-full overflow-y-auto bg-mission-control-bg">
        <div className="max-w-2xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg bg-mission-control-accent/15">
              <Wand2 size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-mission-control-text">Plan Your Book</h1>
              <p className="text-sm text-mission-control-text-dim mt-0.5">
                Describe your idea and an AI agent will help you build a full plan.
              </p>
            </div>
          </div>

          {/* Card */}
          <div className="p-6 rounded-lg border border-mission-control-border bg-mission-control-surface space-y-6">
            {/* Book type selector */}
            <div>
              <span className="block text-xs font-medium text-mission-control-text-dim mb-2">
                Book Type
              </span>
              <div className="flex gap-2">
                {typeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedType === opt.key;
                  return (
                    <Button
                      key={opt.key}
                      size="2"
                      variant={isSelected ? 'soft' : 'ghost'}
                      onClick={() => handleTypeSelect(opt.key, opt.agent)}
                    >
                      <Icon size={16} />
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
              {/* Custom type name input */}
              {selectedType === 'other' && (
                <TextField.Root
                  id="custom-type-input"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g. Fantasy, Sci-Fi, Thriller..."
                  className="mt-2"
                />
              )}
            </div>

            {/* Brain dump textarea */}
            <div>
              <label htmlFor="brain-dump-textarea" className="block text-xs font-medium text-mission-control-text-dim mb-2">
                Describe your book idea
              </label>
              <TextArea
                id="brain-dump-textarea"
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                rows={6}
                placeholder="What's your book about? Pour out everything -- characters, themes, plot points, personal experiences, inspiration..."
                style={{ minHeight: '120px', resize: 'vertical' }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                size="2"
                variant="ghost"
                onClick={() => cancelWizard()}
              >
                <X size={14} />
                Cancel
              </Button>
              <Button
                size="2"
                variant="solid"
                onClick={handleStartPlanning}
                disabled={!brainDump.trim()}
              >
                Start Planning
                <ArrowRight size={16} />
              </Button>
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
      <div className="h-full flex flex-col bg-mission-control-bg">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-mission-control-border bg-mission-control-surface flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-mission-control-accent" />
            <span className="text-sm font-medium text-mission-control-text">
              Planning with {agent.name}
            </span>
            {messages.length > 0 && (
              <span className="text-xs text-mission-control-text-dim">
                ({messages.length} message{messages.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="1"
              variant="solid"
              onClick={() => setStep('extracting')}
              disabled={step === 'extracting' || streaming || messages.length < 4}
            >
              <Wand2 size={12} />
              Generate Plan
            </Button>
            <Button
              size="1"
              variant="ghost"
              onClick={() => cancelWizard()}
            >
              <X size={12} />
              Cancel
            </Button>
          </div>
        </div>

        {/* Chat + optional plan preview sidebar */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-h-0">
            <WizardChat />
          </div>
          {plan && (
            <div className="w-[280px] flex-shrink-0 border-l border-mission-control-border overflow-y-auto p-2">
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
      <div className="h-full flex items-center justify-center bg-mission-control-bg">
        <div className="text-center p-8">
          <Loader2 size={32} className="mx-auto text-mission-control-accent animate-spin mb-4" />
          <p className="text-mission-control-text text-sm font-medium">Creating your project...</p>
        </div>
      </div>
    );
  }

  // -- complete step --
  if (step === 'complete') {
    return (
      <div className="h-full flex items-center justify-center bg-mission-control-bg">
        <div className="text-center p-8">
          <CheckCircle size={48} className="mx-auto text-success mb-4" />
          <p className="text-mission-control-text text-sm font-medium">Project created successfully!</p>
          <p className="text-mission-control-text-dim text-xs mt-1">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Fallback (should not reach here if wizard is active)
  return null;
}
