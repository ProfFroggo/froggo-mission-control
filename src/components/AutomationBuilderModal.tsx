// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useRef, useEffect } from 'react';
import {
  X, Bot, Wand2, Clock, Zap, Globe, Play, Plus, Trash2,
  ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import type { Automation, AutomationStep, TriggerType } from './AutomationsPanel';

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
    borderRadius: 7,
    border: '1px solid var(--mission-control-border)',
    background: 'var(--mission-control-bg)',
    color: 'var(--mission-control-text)',
    fontSize: 12,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle };

  return (
    <div
      style={{
        border: '1px solid var(--mission-control-border)',
        borderRadius: 10,
        background: 'var(--mission-control-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Step header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: 'var(--mission-control-surface)',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(c => !c)}
      >
        <span
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--mission-control-accent) 20%, transparent)',
            color: 'var(--mission-control-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--mission-control-text)' }}>
          {step.label || STEP_TYPES.find(s => s.value === step.type)?.label || 'New step'}
        </span>
        <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
          <button
            disabled={index === 0}
            onClick={onMoveUp}
            style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: index === 0 ? 'default' : 'pointer', color: 'var(--mission-control-text-dim)', opacity: index === 0 ? 0.3 : 1 }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            disabled={index === total - 1}
            onClick={onMoveDown}
            style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: index === total - 1 ? 'default' : 'pointer', color: 'var(--mission-control-text-dim)', opacity: index === total - 1 ? 0.3 : 1 }}
          >
            <ChevronDown size={12} />
          </button>
          <button
            onClick={onRemove}
            style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mission-control-text-dim)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
        {collapsed ? <ChevronDown size={14} style={{ color: 'var(--mission-control-text-dim)' }} /> : <ChevronUp size={14} style={{ color: 'var(--mission-control-text-dim)' }} />}
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Action type */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Action type
            </label>
            <select value={step.type} onChange={e => setType(e.target.value as StepType)} style={selectStyle}>
              {STEP_TYPES.map(s => (
                <option key={s.value} value={s.value}>{s.label} — {s.description}</option>
              ))}
            </select>
          </div>

          {/* Step label */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Label
            </label>
            <input
              type="text"
              placeholder="Describe this step..."
              value={step.label}
              onChange={e => setLabel(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Type-specific config */}
          {step.type === 'run-agent' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Agent role
                </label>
                <input
                  type="text"
                  placeholder="e.g. researcher, analytics, writer"
                  value={(step.config.agentRole as string) ?? ''}
                  onChange={e => setConfig('agentRole', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Prompt / instruction
                </label>
                <textarea
                  placeholder="What should the agent do?"
                  value={(step.config.prompt as string) ?? ''}
                  onChange={e => setConfig('prompt', e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {step.type === 'post-chat' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Chat room
                </label>
                <input
                  type="text"
                  placeholder="e.g. general, ops, content"
                  value={(step.config.room as string) ?? ''}
                  onChange={e => setConfig('room', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Message template (optional)
                </label>
                <textarea
                  placeholder="e.g. New task assigned: {{title}}"
                  value={(step.config.template as string) ?? ''}
                  onChange={e => setConfig('template', e.target.value)}
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {step.type === 'save-library' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Folder
              </label>
              <input
                type="text"
                placeholder="e.g. reports, research"
                value={(step.config.folder as string) ?? ''}
                onChange={e => setConfig('folder', e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {step.type === 'send-approval' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id={`auto-approve-${step.id}`}
                checked={!!(step.config.autoApprove)}
                onChange={e => setConfig('autoApprove', e.target.checked)}
                style={{ accentColor: 'var(--mission-control-accent)' }}
              />
              <label htmlFor={`auto-approve-${step.id}`} style={{ fontSize: 12, color: 'var(--mission-control-text)' }}>
                Auto-approve if criteria pass (escalate on failure)
              </label>
            </div>
          )}

          {step.type === 'delay' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Delay (minutes)
              </label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 60"
                value={(step.config.minutes as string) ?? ''}
                onChange={e => setConfig('minutes', parseInt(e.target.value, 10) || 1)}
                style={{ ...inputStyle, maxWidth: 120 }}
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--mission-control-border)',
    background: 'var(--mission-control-bg)',
    color: 'var(--mission-control-text)',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--mission-control-text-dim)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

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
    } catch {
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
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001,
          width: 'min(680px, 96vw)',
          maxHeight: '90vh',
          background: 'var(--mission-control-surface)',
          border: '1px solid var(--mission-control-border)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--mission-control-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={18} style={{ color: 'var(--mission-control-accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--mission-control-text)' }}>
              {editTarget ? 'Edit Automation' : 'New Automation'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mode toggle */}
            <div
              style={{
                display: 'flex', gap: 2,
                background: 'var(--mission-control-bg)',
                borderRadius: 8, padding: 2,
                border: '1px solid var(--mission-control-border)',
              }}
            >
              {(['natural', 'manual'] as BuildMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: mode === m ? 'var(--mission-control-surface)' : 'transparent',
                    color: mode === m ? 'var(--mission-control-text)' : 'var(--mission-control-text-dim)',
                    transition: 'all 0.15s',
                  }}
                >
                  {m === 'natural' ? 'Natural language' : 'Manual builder'}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--mission-control-text-dim)', display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* ── Natural language path ── */}
          {mode === 'natural' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--mission-control-text-dim)', lineHeight: 1.6, marginBottom: 16 }}>
                  Describe your automation in plain English. The agent will parse it into structured steps that you can review and refine.
                </p>
                <textarea
                  ref={descRef}
                  value={nlDescription}
                  onChange={e => setNlDescription(e.target.value)}
                  placeholder={'Every Monday morning, have the researcher agent find trending topics and post a summary to the team chat.'}
                  rows={5}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: 'inherit',
                  }}
                />
                {nlError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'color-mix(in srgb, #f59e0b 12%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)' }}>
                    <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>{nlError}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleBuildWithAI}
                disabled={!nlDescription.trim() || nlParsing}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  background: !nlDescription.trim() || nlParsing ? 'var(--mission-control-border)' : 'var(--mission-control-accent)',
                  color: !nlDescription.trim() || nlParsing ? 'var(--mission-control-text-dim)' : '#fff',
                  border: 'none', cursor: !nlDescription.trim() || nlParsing ? 'default' : 'pointer',
                }}
              >
                <Bot size={16} />
                <Wand2 size={16} />
                {nlParsing ? 'Building...' : 'Build with AI'}
              </button>

              <div style={{ borderTop: '1px solid var(--mission-control-border)', paddingTop: 16, marginTop: 4 }}>
                <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', textAlign: 'center' }}>
                  Or{' '}
                  <button
                    onClick={() => setMode('manual')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mission-control-accent)', fontSize: 12, fontWeight: 600, padding: 0 }}
                  >
                    switch to the manual builder
                  </button>
                  {' '}to configure each step yourself.
                </p>
              </div>
            </div>
          )}

          {/* ── Manual builder path ── */}
          {mode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Name & description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Automation name</label>
                  <input
                    type="text"
                    placeholder="e.g. Daily Content Brief"
                    value={draft.name}
                    onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Description (optional)</label>
                  <textarea
                    placeholder="What does this automation do?"
                    value={draft.description}
                    onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                    rows={2}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* Trigger */}
              <div
                style={{
                  background: 'var(--mission-control-bg)',
                  border: '1px solid var(--mission-control-border)',
                  borderRadius: 12, padding: '16px',
                }}
              >
                <label style={{ ...labelStyle, marginBottom: 12 }}>
                  Step 1 — Trigger
                </label>

                {/* Trigger type selector */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  {(['schedule', 'event', 'webhook', 'manual'] as TriggerType[]).map(t => {
                    const TIcon = triggerIcons[t];
                    const active = draft.trigger_type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => {
                          const defaultConfigs: Record<TriggerType, TriggerConfig> = {
                            schedule: { time: '09:00', frequency: 'daily' } as TriggerScheduleConfig,
                            event:    { event: 'task.created' } as TriggerEventConfig,
                            webhook:  {} as TriggerWebhookConfig,
                            manual:   {},
                          };
                          setDraft(d => ({ ...d, trigger_type: t, trigger_config: defaultConfigs[t] }));
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 8, border: '1px solid',
                          borderColor: active ? 'var(--mission-control-accent)' : 'var(--mission-control-border)',
                          background: active ? 'color-mix(in srgb, var(--mission-control-accent) 15%, transparent)' : 'var(--mission-control-surface)',
                          color: active ? 'var(--mission-control-accent)' : 'var(--mission-control-text-dim)',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                        }}
                      >
                        <TIcon size={13} /> {t}
                      </button>
                    );
                  })}
                </div>

                {/* Trigger config */}
                {draft.trigger_type === 'schedule' && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 120px' }}>
                      <label style={labelStyle}>Time (HH:MM)</label>
                      <input
                        type="time"
                        value={scheduleConfig.time ?? '09:00'}
                        onChange={e => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, time: e.target.value } }))}
                        style={inputStyle}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={labelStyle}>Frequency</label>
                      <select
                        value={scheduleConfig.frequency ?? 'daily'}
                        onChange={e => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, frequency: e.target.value as Frequency } }))}
                        style={selectStyle}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {scheduleConfig.frequency === 'weekly' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={labelStyle}>Day of week</label>
                        <select
                          value={scheduleConfig.dayOfWeek ?? 'monday'}
                          onChange={e => setDraft(d => ({ ...d, trigger_config: { ...scheduleConfig, dayOfWeek: e.target.value as DayOfWeek } }))}
                          style={selectStyle}
                        >
                          {DAYS_OF_WEEK.map(d => (
                            <option key={d.value} value={d.value}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {draft.trigger_type === 'event' && (
                  <div>
                    <label style={labelStyle}>Event type</label>
                    <select
                      value={eventConfig.event ?? 'task.created'}
                      onChange={e => setDraft(d => ({ ...d, trigger_config: { event: e.target.value } }))}
                      style={selectStyle}
                    >
                      {EVENTS.map(ev => (
                        <option key={ev.value} value={ev.value}>{ev.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {draft.trigger_type === 'webhook' && (
                  <div>
                    <label style={labelStyle}>Webhook URL (generated on save)</label>
                    <input
                      type="text"
                      disabled
                      placeholder="/api/automations/webhook/[id]"
                      style={{ ...inputStyle, opacity: 0.5 }}
                    />
                  </div>
                )}

                {draft.trigger_type === 'manual' && (
                  <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)' }}>
                    This automation will only run when triggered manually via the Run now button.
                  </p>
                )}
              </div>

              {/* Steps */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <label style={labelStyle}>
                    Step 2 — Actions ({draft.steps.length} step{draft.steps.length !== 1 ? 's' : ''})
                  </label>
                  <button
                    onClick={addStep}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 12px', borderRadius: 7, border: '1px solid var(--mission-control-border)',
                      background: 'var(--mission-control-surface)', color: 'var(--mission-control-text)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <Plus size={13} /> Add step
                  </button>
                </div>

                {draft.steps.length === 0 ? (
                  <div
                    style={{
                      padding: '24px', border: '2px dashed var(--mission-control-border)', borderRadius: 10,
                      textAlign: 'center', color: 'var(--mission-control-text-dim)', fontSize: 13,
                    }}
                  >
                    No steps yet. Click "Add step" to define what this automation does.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {draft.steps.map((step, i) => (
                      <StepEditor
                        key={step.id}
                        step={step}
                        index={i}
                        total={draft.steps.length}
                        onChange={s => updateStep(i, s)}
                        onRemove={() => removeStep(i)}
                        onMoveUp={() => moveStep(i, -1)}
                        onMoveDown={() => moveStep(i, 1)}
                      />
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
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              padding: '16px 24px',
              borderTop: '1px solid var(--mission-control-border)',
              background: 'var(--mission-control-surface)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'transparent', color: 'var(--mission-control-text-dim)',
                border: '1px solid var(--mission-control-border)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave(false)}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'var(--mission-control-border)', color: 'var(--mission-control-text)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Save as draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!draft.name.trim() || draft.steps.length === 0}
              style={{
                padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: !draft.name.trim() || draft.steps.length === 0 ? 'var(--mission-control-border)' : 'var(--mission-control-accent)',
                color: !draft.name.trim() || draft.steps.length === 0 ? 'var(--mission-control-text-dim)' : '#fff',
                border: 'none',
                cursor: !draft.name.trim() || draft.steps.length === 0 ? 'default' : 'pointer',
              }}
            >
              Activate
            </button>
          </div>
        )}
      </div>
    </>
  );
}
