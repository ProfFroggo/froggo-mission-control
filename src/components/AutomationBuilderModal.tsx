// Automation Builder Modal — inline step builder for creating/editing automations
import { useState } from 'react';
import { X, Plus, Trash2, Zap, Clock, Globe, Bot } from 'lucide-react';
import type { Automation, AutomationStep, TriggerType } from './AutomationsPanel';

interface AutomationBuilderModalProps {
  onClose: () => void;
  onSave: (automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editTarget?: Automation | null;
  prefillTemplate?: {
    name: string;
    description: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    steps: AutomationStep[];
  } | null;
}

const STEP_TYPES: { value: AutomationStep['type']; label: string; description: string }[] = [
  { value: 'run-agent',       label: 'Run Agent',         description: 'Dispatch an agent with a prompt' },
  { value: 'post-chat',       label: 'Post to Chat',      description: 'Send a message to a chat room' },
  { value: 'save-library',    label: 'Save to Library',   description: 'Store output as a library file' },
  { value: 'send-approval',   label: 'Send for Approval', description: 'Create an approval request' },
  { value: 'delay',           label: 'Delay',             description: 'Wait a specified amount of time' },
];

export default function AutomationBuilderModal({ onClose, onSave, editTarget, prefillTemplate }: AutomationBuilderModalProps) {
  const prefill = editTarget || prefillTemplate;
  const [name, setName] = useState(prefill?.name || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [triggerType, setTriggerType] = useState<TriggerType>(prefill?.trigger_type || 'schedule');
  const [steps, setSteps] = useState<AutomationStep[]>(
    prefill?.steps && prefill.steps.length > 0
      ? prefill.steps
      : [{ id: 'step-1', type: 'run-agent', label: '', config: {} }]
  );

  const addStep = () => {
    setSteps(prev => [...prev, { id: `step-${Date.now()}`, type: 'run-agent', label: '', config: {} }]);
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  const updateStep = (id: string, patch: Partial<AutomationStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      status: editTarget?.status || 'draft',
      trigger_type: triggerType,
      trigger_config: {},
      steps,
    });
    onClose();
  };

  const triggerIcons: Record<TriggerType, any> = {
    schedule: Clock,
    event: Zap,
    webhook: Globe,
    manual: Bot,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-mission-control-surface border border-mission-control-border rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-mission-control-border">
          <h2 className="text-base font-semibold text-mission-control-text">
            {editTarget ? 'Edit Automation' : 'New Automation'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-mission-control-text-dim hover:bg-mission-control-border transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Daily content brief"
              className="w-full px-3 py-2 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this automation do?"
              className="w-full px-3 py-2 text-sm bg-mission-control-bg border border-mission-control-border rounded-lg focus:outline-none focus:border-mission-control-accent resize-none"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="block text-xs font-medium text-mission-control-text-dim mb-1.5">Trigger</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['schedule', 'event', 'webhook', 'manual'] as TriggerType[]).map(t => {
                const Icon = triggerIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTriggerType(t)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-colors ${
                      triggerType === t
                        ? 'bg-mission-control-accent text-white'
                        : 'bg-mission-control-bg border border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="capitalize">{t}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-mission-control-text-dim">Steps</label>
              <button onClick={addStep} className="flex items-center gap-1 text-xs text-mission-control-accent hover:underline">
                <Plus size={12} /> Add step
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-2 p-3 bg-mission-control-bg border border-mission-control-border rounded-lg">
                  <span className="text-xs text-mission-control-text-dim flex-shrink-0 pt-1">{idx + 1}.</span>
                  <div className="flex-1 space-y-1.5">
                    <select
                      value={step.type}
                      onChange={e => updateStep(step.id, { type: e.target.value as AutomationStep['type'] })}
                      className="w-full text-xs px-2 py-1 bg-mission-control-surface border border-mission-control-border rounded focus:outline-none focus:border-mission-control-accent"
                    >
                      {STEP_TYPES.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={step.label}
                      onChange={e => updateStep(step.id, { label: e.target.value })}
                      placeholder="Describe what this step does..."
                      className="w-full text-xs px-2 py-1 bg-mission-control-surface border border-mission-control-border rounded focus:outline-none focus:border-mission-control-accent"
                    />
                  </div>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="p-1 text-mission-control-text-dim hover:text-error transition-colors flex-shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-mission-control-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-sm bg-mission-control-accent text-white rounded-lg hover:bg-mission-control-accent/90 transition-colors disabled:opacity-50"
          >
            {editTarget ? 'Save changes' : 'Create automation'}
          </button>
        </div>
      </div>
    </div>
  );
}
