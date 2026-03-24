// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useCallback } from 'react';
import {
  ChevronUp, ChevronDown, Trash2, Plus, ChevronRight, ChevronDown as Expand, X, Save, Users,
} from 'lucide-react';
import { Button, IconButton, Heading, Text, Spinner, Select, TextField, TextArea } from '@radix-ui/themes';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StepType =
  | 'send-message'
  | 'assign-task'
  | 'send-for-approval'
  | 'wait'
  | 'condition'
  | 'notify-agent'
  | 'create-task'
  | 'update-task-status'
  | 'send-email';

export interface AutomationStepDef {
  id: string;
  type: StepType;
  config: Record<string, unknown>;
}

interface Props {
  automationId: string;
  initialSteps?: AutomationStepDef[];
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'send-message',       label: 'Send Message' },
  { value: 'assign-task',        label: 'Assign Task' },
  { value: 'send-for-approval',  label: 'Send for Approval' },
  { value: 'wait',               label: 'Wait' },
  { value: 'condition',          label: 'Condition' },
  { value: 'notify-agent',       label: 'Notify Agent' },
  { value: 'create-task',        label: 'Create Task' },
  { value: 'update-task-status', label: 'Update Task Status' },
  { value: 'send-email',         label: 'Send Email' },
];

function defaultConfig(type: StepType): Record<string, unknown> {
  switch (type) {
    case 'send-message':       return { to: '', message: '' };
    case 'assign-task':        return { taskId: '', agentId: '' };
    case 'send-for-approval':  return { description: '', approvers: '' };
    case 'wait':               return { duration: '1', unit: 'hours' };
    case 'condition':          return { field: '', operator: 'equals', value: '' };
    case 'notify-agent':       return { agentId: '', message: '' };
    case 'create-task':        return { title: '', description: '', planningNotes: '', priority: 'p2', assignTo: '', subtasks: [] as Array<{ title: string; assignedTo: string }> };
    case 'update-task-status': return { taskId: '', status: 'in-progress' };
    case 'send-email':         return { to: '', subject: '', body: '' };
    default:                   return {};
  }
}

function newStep(type: StepType = 'send-message'): AutomationStepDef {
  return { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type, config: defaultConfig(type) };
}

// ─── Step config fields ──────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
}
function Field({ label, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mission-control-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--mission-control-border)',
  backgroundColor: 'var(--mission-control-surface)',
  color: 'var(--mission-control-text)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const selectClassName = 'w-full bg-mission-control-surface border border-mission-control-border rounded-lg px-3 py-2 text-sm text-mission-control-text focus:outline-none focus:border-mission-control-accent cursor-pointer';
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 60 };

interface ConfigEditorProps {
  step: AutomationStepDef;
  onChange: (config: Record<string, unknown>) => void;
}

function ConfigEditor({ step, onChange }: ConfigEditorProps) {
  const set = (key: string, val: unknown) => onChange({ ...step.config, [key]: val });
  const c = step.config as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  switch (step.type) {
    case 'send-message':
      return (
        <>
          <Field label="To"><TextField.Root value={c.to ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('to', e.target.value)} placeholder="Agent ID or room" /></Field>
          <Field label="Message"><TextArea variant="soft" value={c.message ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('message', e.target.value)} placeholder="Message content..." /></Field>
        </>
      );
    case 'assign-task':
      return (
        <>
          <Field label="Task ID"><TextField.Root value={c.taskId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('taskId', e.target.value)} placeholder="task-xxx" /></Field>
          <Field label="Agent ID"><TextField.Root value={c.agentId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('agentId', e.target.value)} placeholder="agent-xxx" /></Field>
        </>
      );
    case 'send-for-approval':
      return (
        <>
          <Field label="Description"><TextArea variant="soft" value={c.description ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} placeholder="What needs approval?" /></Field>
          <Field label="Approvers (comma-separated)"><TextField.Root value={c.approvers ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('approvers', e.target.value)} placeholder="user-1, user-2" /></Field>
        </>
      );
    case 'wait':
      return (
        <>
          <Field label="Duration">
            <TextField.Root type="number" min="1" value={c.duration ?? '1'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('duration', e.target.value)} />
          </Field>
          <Field label="Unit">
            <Select.Root value={c.unit ?? 'hours'} onValueChange={val => set('unit', val)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="minutes">Minutes</Select.Item>
                <Select.Item value="hours">Hours</Select.Item>
                <Select.Item value="days">Days</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
        </>
      );
    case 'condition':
      return (
        <>
          <Field label="Field"><TextField.Root value={c.field ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('field', e.target.value)} placeholder="e.g. task.status" /></Field>
          <Field label="Operator">
            <Select.Root value={c.operator ?? 'equals'} onValueChange={val => set('operator', val)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="equals">Equals</Select.Item>
                <Select.Item value="contains">Contains</Select.Item>
                <Select.Item value="greater_than">Greater than</Select.Item>
                <Select.Item value="less_than">Less than</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Value"><TextField.Root value={c.value ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('value', e.target.value)} placeholder="Comparison value" /></Field>
        </>
      );
    case 'notify-agent':
      return (
        <>
          <Field label="Agent ID"><TextField.Root value={c.agentId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('agentId', e.target.value)} placeholder="agent-xxx" /></Field>
          <Field label="Message"><TextArea variant="soft" value={c.message ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('message', e.target.value)} placeholder="Notification message..." /></Field>
        </>
      );
    case 'create-task': {
      // Normalize subtasks: support both legacy string[] and new {title, assignedTo}[]
      const rawSubtasks = Array.isArray(c.subtasks) ? c.subtasks : [];
      const subtasks: Array<{ title: string; assignedTo: string }> = rawSubtasks.map((st: unknown) =>
        typeof st === 'string' ? { title: st, assignedTo: '' } : { title: (st as { title?: string }).title ?? '', assignedTo: (st as { assignedTo?: string }).assignedTo ?? '' }
      );
      const updateSubtask = (i: number, field: 'title' | 'assignedTo', val: string) => {
        const updated = subtasks.map((s, j) => j === i ? { ...s, [field]: val } : s);
        set('subtasks', updated);
      };
      const addSubtask = () => set('subtasks', [...subtasks, { title: '', assignedTo: '' }]);
      const removeSubtask = (i: number) => set('subtasks', subtasks.filter((_, j) => j !== i));
      return (
        <>
          <Field label="Title"><TextField.Root value={c.title ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('title', e.target.value)} placeholder="Task title" /></Field>
          <Field label="Description"><TextArea variant="soft" value={c.description ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('description', e.target.value)} placeholder="What needs to be done..." /></Field>
          <Field label="Planning Notes"><TextArea variant="soft" value={c.planningNotes ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('planningNotes', e.target.value)} placeholder="Step-by-step approach for the agent..." /></Field>
          <Field label="Priority">
            <Select.Root value={c.priority ?? 'p2'} onValueChange={val => set('priority', val)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="p0">P0 — Critical</Select.Item>
                <Select.Item value="p1">P1 — High</Select.Item>
                <Select.Item value="p2">P2 — Medium</Select.Item>
                <Select.Item value="p3">P3 — Low</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
          <Field label="Assign to (Agent ID)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />
              <TextField.Root style={{ flex: 1 }} value={c.assignTo ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('assignTo', e.target.value)} placeholder="coder, designer, growth-director..." />
            </div>
          </Field>
          <Field label="Subtasks">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {subtasks.map((st, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--mission-control-border)', background: 'var(--mission-control-bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--mission-control-text-dim)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <TextField.Root
                      style={{ flex: 1 }}
                      value={st.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubtask(i, 'title', e.target.value)}
                      placeholder={`Subtask ${i + 1} title`}
                    />
                    <IconButton
                      type="button"
                      variant="ghost"
                      color="red"
                      size="1"
                      onClick={() => removeSubtask(i)}
                      title="Remove subtask"
                      style={{ flexShrink: 0 }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 20 }}>
                    <Users size={11} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />
                    <TextField.Root
                      value={st.assignedTo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubtask(i, 'assignedTo', e.target.value)}
                      placeholder="Assign to agent (optional)"
                    />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="1" onClick={addSubtask}>
                <Plus size={12} /> Add subtask
              </Button>
            </div>
          </Field>
        </>
      );
    }
    case 'update-task-status':
      return (
        <>
          <Field label="Task ID"><TextField.Root value={c.taskId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('taskId', e.target.value)} placeholder="task-xxx" /></Field>
          <Field label="New Status">
            <Select.Root value={c.status ?? 'in-progress'} onValueChange={val => set('status', val)}>
              <Select.Trigger />
              <Select.Content>
                <Select.Item value="todo">Todo</Select.Item>
                <Select.Item value="in-progress">In Progress</Select.Item>
                <Select.Item value="review">Review</Select.Item>
                <Select.Item value="done">Done</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
        </>
      );
    case 'send-email':
      return (
        <>
          <Field label="To"><TextField.Root value={c.to ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('to', e.target.value)} placeholder="recipient@example.com" /></Field>
          <Field label="Subject"><TextField.Root value={c.subject ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('subject', e.target.value)} placeholder="Email subject" /></Field>
          <Field label="Body"><TextArea variant="soft" value={c.body ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('body', e.target.value)} placeholder="Email body..." /></Field>
        </>
      );
    default:
      return null;
  }
}

// ─── Step row ─────────────────────────────────────────────────────────────────

interface StepRowProps {
  step: AutomationStepDef;
  index: number;
  total: number;
  onMove: (index: number, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onChangeType: (id: string, type: StepType) => void;
  onChangeConfig: (id: string, config: Record<string, unknown>) => void;
}

function StepRow({ step, index, total, onMove, onDelete, onChangeType, onChangeConfig }: StepRowProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      style={{
        border: '1px solid var(--mission-control-border)',
        borderRadius: 10,
        background: 'var(--mission-control-surface)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'var(--mission-control-accent)',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {index + 1}
        </span>

        <div style={{ flex: 1, maxWidth: 220 }} onClick={e => e.stopPropagation()}>
          <Select.Root value={step.type} onValueChange={val => { onChangeType(step.id, val as StepType); }}>
            <Select.Trigger />
            <Select.Content>
              {STEP_TYPES.map(t => (
                <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton
            variant="ghost" size="1"
            onClick={e => { e.stopPropagation(); onMove(index, -1); }}
            disabled={index === 0}
            title="Move up"
            style={{ opacity: index === 0 ? 0.3 : 1 }}
          >
            <ChevronUp size={14} />
          </IconButton>
          <IconButton
            variant="ghost" size="1"
            onClick={e => { e.stopPropagation(); onMove(index, 1); }}
            disabled={index === total - 1}
            title="Move down"
            style={{ opacity: index === total - 1 ? 0.3 : 1 }}
          >
            <ChevronDown size={14} />
          </IconButton>
          <IconButton
            variant="ghost" color="red" size="1"
            onClick={e => { e.stopPropagation(); onDelete(step.id); }}
            title="Delete step"
          >
            <Trash2 size={14} />
          </IconButton>
          {expanded ? <Expand size={14} style={{ color: 'var(--mission-control-text-dim)' }} /> : <ChevronRight size={14} style={{ color: 'var(--mission-control-text-dim)' }} />}
        </div>
      </div>

      {/* Config */}
      {expanded && (
        <div
          style={{
            padding: '0 14px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            borderTop: '1px solid var(--mission-control-border)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ paddingTop: 10 }}>
            <ConfigEditor step={step} onChange={cfg => onChangeConfig(step.id, cfg)} />
          </div>
        </div>
      )}
    </div>
  );
}

const btnIcon: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  color: 'var(--mission-control-text-dim)',
  display: 'flex',
  alignItems: 'center',
};

// ─── JSON Preview ─────────────────────────────────────────────────────────────

function JsonPreview({ steps }: { steps: AutomationStepDef[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--mission-control-border)', borderRadius: 8, overflow: 'hidden' }}>
      <Button
        variant="ghost"
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--mission-control-surface)', justifyContent: 'flex-start', height: 'auto' }}
      >
        {open ? <Expand size={12} /> : <ChevronRight size={12} />}
        Preview JSON
      </Button>
      {open && (
        <pre
          style={{
            margin: 0,
            padding: '12px 14px',
            background: 'var(--mission-control-bg)',
            color: 'var(--mission-control-text)',
            fontSize: 11,
            overflowX: 'auto',
            maxHeight: 240,
            overflowY: 'auto',
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(steps, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutomationStepBuilder({ automationId, initialSteps = [], onClose, onSaved }: Props) {
  const [steps, setSteps] = useState<AutomationStepDef[]>(
    initialSteps.length > 0 ? initialSteps : []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStep = useCallback(() => {
    setSteps(prev => [...prev, newStep()]);
  }, []);

  const deleteStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  }, []);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setSteps(prev => {
      const arr = [...prev];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

  const changeType = useCallback((id: string, type: StepType) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, type, config: defaultConfig(type) } : s));
  }, []);

  const changeConfig = useCallback((id: string, config: Record<string, unknown>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, config } : s));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/automations?id=${automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 480,
          height: '100%',
          background: 'var(--mission-control-bg)',
          borderLeft: '1px solid var(--mission-control-border)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid var(--mission-control-border)',
            position: 'sticky',
            top: 0,
            background: 'var(--mission-control-bg)',
            zIndex: 1,
          }}
        >
          <div>
            <Heading size="4" weight="medium">Step Builder</Heading>
            <Text size="1" style={{ color: 'var(--mission-control-text-dim)' }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <IconButton variant="ghost" size="2" onClick={onClose}><X size={18} /></IconButton>
        </div>

        {/* Steps */}
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--mission-control-text-dim)',
                fontSize: 13,
                border: '2px dashed var(--mission-control-border)',
                borderRadius: 10,
              }}
            >
              No steps yet. Add your first step below.
            </div>
          )}

          {steps.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              onMove={moveStep}
              onDelete={deleteStep}
              onChangeType={changeType}
              onChangeConfig={changeConfig}
            />
          ))}

          <Button
            variant="outline"
            onClick={addStep}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', width: '100%', height: 'auto' }}
          >
            <Plus size={16} /> Add step
          </Button>

          <JsonPreview steps={steps} />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--mission-control-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            position: 'sticky',
            bottom: 0,
            background: 'var(--mission-control-bg)',
          }}
        >
          {error && (
            <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
              Cancel
            </Button>
            <Button variant="solid" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
              {saving ? <Spinner size="1" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save steps'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
