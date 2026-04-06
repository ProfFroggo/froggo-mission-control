// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useRef, useEffect } from 'react';
import {
  X, Bot, Wand2, Clock, Zap, Globe, Play, Plus, Trash2,
  ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import type { Automation, AutomationStep, TriggerType } from './AutomationsPanel';
import { Button, Checkbox, Heading, Text, Spinner, Select, TextField, TextArea } from '@radix-ui/themes';

// ─── Types ───────────────────────────────────────────────────────────────────

type BuildMode = 'natural' | 'manual';
type StepType = AutomationStep['type'];
type Frequency = 'daily' | 'weekly' | 'monthly';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

interface TriggerScheduleConfig {
  time: string;
  frequency: Frequency;
  dayOfWeek?: DayOfWeek;
}

interface TriggerEventConfig {
  event: string;
}

interface TriggerWebhookConfig {
  url?: string;
}

type TriggerConfig = TriggerScheduleConfig | TriggerEventConfig | TriggerWebhookConfig | Record<string, unknown>;

export interface AutomationDraft {
  name: string;
  description: string;
  status: 'draft' | 'active';
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  steps: AutomationStep[];
}

interface AutomationBuilderModalProps {
  onClose: () => void;
  onSave: (automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  editTarget: Automation | null;
  prefillTemplate: {
    name: string;
    description: string;
    trigger_type: TriggerType;
    trigger_config: Record<string, unknown>;
    steps: AutomationStep[];
  } | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EVENTS = [
  { value: 'task.created',        label: 'Task created' },
  { value: 'task.done',           label: 'Task completed' },
  { value: 'approval.created',    label: 'Approval request created' },
  { value: 'approval.approved',   label: 'Approval approved' },
  { value: 'approval.rejected',   label: 'Approval rejected' },
  { value: 'agent.message',       label: 'Agent sends message' },
  { value: 'campaign.started',    label: 'Campaign started' },
  { value: 'campaign.ended',      label: 'Campaign ended' },
];

const STEP_TYPES: { value: StepType; label: string; description: string }[] = [
  { value: 'run-agent',      label: 'Run Agent Task',    description: 'Have an agent execute a task or query' },
  { value: 'post-chat',      label: 'Post to Chat',      description: 'Post a message to a chat room' },
  { value: 'save-library',   label: 'Save to Library',   description: 'Save output to the document library' },
  { value: 'send-approval',  label: 'Send for Approval', description: 'Route to the approval queue' },
  { value: 'delay',          label: 'Delay',             description: 'Wait before proceeding to next step' },
];

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday',    label: 'Monday' },
  { value: 'tuesday',   label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday' },
  { value: 'friday',    label: 'Friday' },
  { value: 'saturday',  label: 'Saturday' },
  { value: 'sunday',    label: 'Sunday' },
];

// ─── Step editor ─────────────────────────────────────────────────────────────

interface StepEditorProps {
  step: AutomationStep;
  index: number;
  total: number;
  onChange: (step: AutomationStep) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepEditor({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: StepEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const setType = (type: StepType) => {
    onChange({ ...step, type, config: {}, label: STEP_TYPES.find(s => s.value === type)?.label ?? '' });
  };

  const setLabel = (label: string) => onChange({ ...step, label });

  const setConfig = (key: string, value: unknown) =>
    onChange({ ...step, config: { ...step.config, [key]: value } });


  return (
    <div className="bg-mission-control-bg border border-mission-control-border rounded-xl overflow-hidden">
      {/* Step header */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-mission-control-surface cursor-pointer"
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="w-6 h-6 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim leading-none mb-0.5">
            {STEP_TYPES.find(s => s.value === step.type)?.label ?? 'Step'}
          </p>
          <p className="text-sm font-medium text-mission-control-text truncate">
            {step.label || STEP_TYPES.find(s => s.value === step.type)?.label || 'New step'}
          </p>
        </div>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="Move step up"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors disabled:opacity-40"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Move step down"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors disabled:opacity-40"
          >
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove step"
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-bg transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-mission-control-text-dim" /> : <ChevronUp size={14} className="text-mission-control-text-dim" />}
      </div>

      {!collapsed && (
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {/* Action type */}
          <div>
            <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
              Action type
            </label>
            <Select.Root value={step.type} onValueChange={val => setType(val as StepType)} size="1">
              <Select.Trigger className="w-full" />
              <Select.Content>
                {STEP_TYPES.map(s => (
                  <Select.Item key={s.value} value={s.value}>{s.label} — {s.description}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>

          {/* Step label */}
          <div>
            <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
              Label
            </label>
            <TextField.Root
              placeholder="Describe this step..."
              value={step.label}
              onChange={e => setLabel(e.target.value)}
              size="1"
            />
          </div>

          {/* Type-specific config */}
          {step.type === 'run-agent' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                  Agent role
                </label>
                <TextField.Root
                  placeholder="e.g. researcher, analytics, writer"
                  value={(step.config.agentRole as string) ?? ''}
                  onChange={e => setConfig('agentRole', e.target.value)}
                  size="1"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                  Prompt / instruction
                </label>
                <TextArea
                  placeholder="What should the agent do?"
                  value={(step.config.prompt as string) ?? ''}
                  onChange={e => setConfig('prompt', e.target.value)}
                  rows={3}
                  size="1"
                />
              </div>
            </>
          )}

          {step.type === 'post-chat' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                  Chat room
                </label>
                <TextField.Root
                  placeholder="e.g. general, ops, content"
                  value={(step.config.room as string) ?? ''}
                  onChange={e => setConfig('room', e.target.value)}
                  size="1"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                  Message template (optional)
                </label>
                <TextArea
                  placeholder="e.g. New task assigned: {{title}}"
                  value={(step.config.template as string) ?? ''}
                  onChange={e => setConfig('template', e.target.value)}
                  rows={2}
                  size="1"
                />
              </div>
            </>
          )}

          {step.type === 'save-library' && (
            <div>
              <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                Folder
              </label>
              <TextField.Root
                placeholder="e.g. reports, research"
                value={(step.config.folder as string) ?? ''}
                onChange={e => setConfig('folder', e.target.value)}
                size="1"
              />
            </div>
          )}

          {step.type === 'send-approval' && (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id={`auto-approve-${step.id}`}
                checked={!!(step.config.autoApprove)}
                onCheckedChange={(val) => setConfig('autoApprove', val === true)}
                size="1"
              />
              <label htmlFor={`auto-approve-${step.id}`} className="text-xs text-mission-control-text">
                Auto-approve if criteria pass (escalate on failure)
              </label>
            </div>
          )}

          {step.type === 'delay' && (
            <div>
              <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1">
                Delay (minutes)
              </label>
              <TextField.Root
                type="number"
                min={1}
                placeholder="e.g. 60"
                value={(step.config.minutes as string) ?? ''}
                onChange={e => setConfig('minutes', parseInt(e.target.value, 10) || 1)}
                size="1"
                style={{ maxWidth: 120 }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

export default function AutomationBuilderModal({
  onClose,
  onSave,
  editTarget,
  prefillTemplate,
}: AutomationBuilderModalProps) {
  const [mode, setMode] = useState<BuildMode>('natural');
  const [nlDescription, setNlDescription] = useState('');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlError, setNlError] = useState('');
  const [draft, setDraft] = useState<AutomationDraft>(() => {
    if (editTarget) {
      return {
        name: editTarget.name,
        description: editTarget.description,
        status: editTarget.status === 'draft' ? 'draft' : 'active',
        trigger_type: editTarget.trigger_type,
        trigger_config: editTarget.trigger_config as TriggerConfig,
        steps: editTarget.steps,
      };
    }
    if (prefillTemplate) {
      return {
        name: prefillTemplate.name,
        description: prefillTemplate.description,
        status: 'draft',
        trigger_type: prefillTemplate.trigger_type,
        trigger_config: prefillTemplate.trigger_config as TriggerConfig,
        steps: prefillTemplate.steps,
      };
    }
    return {
      name: '',
      description: '',
      status: 'draft',
      trigger_type: 'schedule',
      trigger_config: { time: '09:00', frequency: 'daily' } as TriggerScheduleConfig,
      steps: [],
    };
  });

  const descRef = useRef<HTMLTextAreaElement>(null);

  // Auto-switch to manual if prefill/edit present
  useEffect(() => {
    if (editTarget || prefillTemplate) {
      setMode('manual');
    }
  }, [editTarget, prefillTemplate]);

  const fieldLabelClass = 'block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1.5';

  // Natural language parse — calls /api/automations with ?action=parse
  const handleBuildWithAI = async () => {
    if (!nlDescription.trim()) return;
    setNlParsing(true);
    setNlError('');
    try {
      const res = await fetch('/api/automations?action=parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nlDescription }),
      });
      if (res.ok) {
        const parsed = await res.json();
        setDraft(d => ({
          ...d,
          name: parsed.name ?? d.name,
          description: parsed.description ?? nlDescription,
          trigger_type: parsed.trigger_type ?? d.trigger_type,
          trigger_config: parsed.trigger_config ?? d.trigger_config,
          steps: parsed.steps ?? d.steps,
        }));
        setMode('manual');
      } else {
        // Fallback: do a basic parse locally
        setDraft(d => ({
          ...d,
          name: nlDescription.slice(0, 60),
          description: nlDescription,
        }));
        setMode('manual');
        setNlError('AI parse unavailable — review and complete the form manually.');
      }
    } catch (err) {
      console.warn('[AutomationBuilderModal] Non-critical:', err);
      setDraft(d => ({ ...d, name: nlDescription.slice(0, 60), description: nlDescription }));
      setMode('manual');
      setNlError('AI parse unavailable — review and complete the form manually.');
    } finally {
      setNlParsing(false);
    }
  };

  // Step management
  const addStep = () => {
    const newStep: AutomationStep = {
      id: `step-${Date.now()}`,
      type: 'run-agent',
      label: '',
      config: {},
    };
    setDraft(d => ({ ...d, steps: [...d.steps, newStep] }));
  };

  const updateStep = (index: number, step: AutomationStep) => {
    setDraft(d => {
      const steps = [...d.steps];
      steps[index] = step;
      return { ...d, steps };
    });
  };

  const removeStep = (index: number) => {
    setDraft(d => ({ ...d, steps: d.steps.filter((_, i) => i !== index) }));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    setDraft(d => {
      const steps = [...d.steps];
      const other = index + dir;
      if (other < 0 || other >= steps.length) return d;
      [steps[index], steps[other]] = [steps[other], steps[index]];
      return { ...d, steps };
    });
  };

  const handleSave = (activate: boolean) => {
    onSave({
      ...draft,
      status: activate ? 'active' : 'draft',
      trigger_config: draft.trigger_config as Record<string, unknown>,
    } as Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>);
  };

  const scheduleConfig = draft.trigger_config as TriggerScheduleConfig;
  const eventConfig = draft.trigger_config as TriggerEventConfig;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerIcons: Record<TriggerType, React.ComponentType<any>> = {
    schedule: Clock,
    event:    Zap,
    webhook:  Globe,
    manual:   Play,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[1000] bg-[var(--black-a6)] backdrop-blur-sm"
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[min(680px,96vw)] max-h-[90vh] bg-mission-control-surface border border-mission-control-border rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_64px_var(--black-a5)]"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-mission-control-border"
        >
          <div className="flex items-center gap-2.5">
            <Zap size={18} className="text-mission-control-accent" />
            <span className="font-bold text-base text-mission-control-text">
              {editTarget ? 'Edit Automation' : 'New Automation'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Mode toggle */}
            <div className="flex gap-0.5 bg-mission-control-bg rounded-lg p-0.5 border border-mission-control-border">
              {(['natural', 'manual'] as BuildMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    mode === m ? 'bg-mission-control-accent/10 text-mission-control-accent' : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {m === 'natural' ? 'Natural language' : 'Manual builder'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Natural language path ── */}
          {mode === 'natural' && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[13px] text-mission-control-text-dim leading-relaxed mb-4">
                  Describe your automation in plain English. The agent will parse it into structured steps that you can review and refine.
                </p>
                <TextArea
                  ref={descRef}
                  variant="soft"
                  value={nlDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNlDescription(e.target.value)}
                  placeholder={'Every Monday morning, have the researcher agent find trending topics and post a summary to the team chat.'}
                  rows={5}
                  className="w-full text-sm leading-relaxed font-[inherit]"
                />
                {nlError && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)]">
                    <AlertCircle size={14} className="text-warning flex-shrink-0" />
                    <span className="text-[13px] text-warning">{nlError}</span>
                  </div>
                )}
              </div>
              <Button
                variant="solid"
                size="3"
                onClick={handleBuildWithAI}
                disabled={!nlDescription.trim() || nlParsing}
                className="w-full"
              >
                {nlParsing ? <Spinner size="1" /> : <Bot size={16} />}
                <Wand2 size={16} />
                {nlParsing ? 'Building...' : 'Build with AI'}
              </Button>

              <div className="border-t border-mission-control-border pt-4 mt-1">
                <p className="text-xs text-mission-control-text-dim text-center">
                  Or{' '}
                  <button type="button" onClick={() => setMode('manual')} className="text-mission-control-accent hover:underline transition-colors">
                    switch to the manual builder
                  </button>
                  {' '}to configure each step yourself.
                </p>
              </div>
            </div>
          )}

          {/* ── Manual builder path ── */}
          {mode === 'manual' && (
            <div className="flex flex-col gap-5">

              {/* Name & description */}
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className={fieldLabelClass}>Automation name</label>
                  <TextField.Root
                    placeholder="e.g. Daily Content Brief"
                    value={draft.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Description (optional)</label>
                  <TextArea
                    variant="soft"
                    placeholder="What does this automation do?"
                    value={draft.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(d => ({ ...d, description: e.target.value }))}
                    rows={2}
                    className="w-full font-[inherit]"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div
                className="bg-mission-control-bg border border-mission-control-border rounded-xl p-4"
              >
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">
                  Step 1 — Trigger
                </label>

                {/* Trigger type selector */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {(['schedule', 'event', 'webhook', 'manual'] as TriggerType[]).map(t => {
                    const TIcon = triggerIcons[t];
                    const active = draft.trigger_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          const defaultConfigs: Record<TriggerType, TriggerConfig> = {
                            schedule: { time: '09:00', frequency: 'daily' } as TriggerScheduleConfig,
                            event:    { event: 'task.created' } as TriggerEventConfig,
                            webhook:  {} as TriggerWebhookConfig,
                            manual:   {},
                          };
                          setDraft(d => ({ ...d, trigger_type: t, trigger_config: defaultConfigs[t] }));
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize ${
                          active ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent' : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                        }`}
                      >
                        <TIcon size={13} /> {t}
                      </button>
                    );
                  })}
                </div>

                {/* Trigger config */}
                {draft.trigger_type === 'schedule' && (
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-[1_1_120px]">
                      <label className={fieldLabelClass}>Time (HH:MM)</label>
                      <TextField.Root
                        type="time"
                        value={scheduleConfig.time ?? '09:00'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, time: e.target.value } }))}
                      />
                    </div>
                    <div className="flex-[1_1_140px]">
                      <label className={fieldLabelClass}>Frequency</label>
                      <Select.Root
                        value={scheduleConfig.frequency ?? 'daily'}
                        onValueChange={val => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, frequency: val as Frequency } }))}
                      >
                        <Select.Trigger className="w-full" />
                        <Select.Content>
                          <Select.Item value="daily">Daily</Select.Item>
                          <Select.Item value="weekly">Weekly</Select.Item>
                          <Select.Item value="monthly">Monthly</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </div>
                    {scheduleConfig.frequency === 'weekly' && (
                      <div className="flex-[1_1_140px]">
                        <label className={fieldLabelClass}>Day of week</label>
                        <Select.Root
                          value={scheduleConfig.dayOfWeek ?? 'monday'}
                          onValueChange={val => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, dayOfWeek: val as DayOfWeek } }))}
                        >
                          <Select.Trigger className="w-full" />
                          <Select.Content>
                            {DAYS_OF_WEEK.map(d => (
                              <Select.Item key={d.value} value={d.value}>{d.label}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </div>
                    )}
                  </div>
                )}

                {draft.trigger_type === 'event' && (
                  <div>
                    <label className={fieldLabelClass}>Event type</label>
                    <Select.Root
                      value={eventConfig.event ?? 'task.created'}
                      onValueChange={val => setDraft(d => ({ ...d, trigger_config: { event: val } }))}
                    >
                      <Select.Trigger className="w-full" />
                      <Select.Content>
                        {EVENTS.map(ev => (
                          <Select.Item key={ev.value} value={ev.value}>{ev.label}</Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </div>
                )}

                {draft.trigger_type === 'webhook' && (
                  <div>
                    <label className={fieldLabelClass}>Webhook URL (generated on save)</label>
                    <TextField.Root
                      disabled
                      placeholder="/api/automations/webhook/[id]"
                      className="opacity-50"
                    />
                  </div>
                )}

                {draft.trigger_type === 'manual' && (
                  <p className="text-xs text-mission-control-text-dim">
                    This automation will only run when triggered manually via the Run now button.
                  </p>
                )}
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={fieldLabelClass}>
                    Step 2 — Actions ({draft.steps.length} step{draft.steps.length !== 1 ? 's' : ''})
                  </label>
                  <Button variant="ghost" size="1" onClick={addStep}>
                    <Plus size={13} /> Add step
                  </Button>
                </div>

                {draft.steps.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-mission-control-border rounded-[10px] text-center text-[14px] text-mission-control-text-dim">
                    No steps yet. Click "Add step" to define what this automation does.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {draft.steps.map((step, i) => (
                      <div key={step.id}>
                        <StepEditor
                          step={step}
                          index={i}
                          total={draft.steps.length}
                          onChange={s => updateStep(i, s)}
                          onRemove={() => removeStep(i)}
                          onMoveUp={() => moveStep(i, -1)}
                          onMoveDown={() => moveStep(i, 1)}
                        />
                        {i < draft.steps.length - 1 && (
                          <div className="w-px h-4 bg-mission-control-border mx-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'manual' && (
          <div
            className="flex justify-end gap-2.5 px-6 py-4 border-t border-mission-control-border bg-mission-control-surface"
          >
            <Button variant="outline" size="2" onClick={onClose}>Cancel</Button>
            <Button variant="soft" size="2" onClick={() => handleSave(false)}>Save as draft</Button>
            <Button
              variant="solid"
              size="2"
              onClick={() => handleSave(true)}
              disabled={!draft.name.trim() || draft.steps.length === 0}
            >
              Activate
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
