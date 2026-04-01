// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useCallback } from 'react';
import {
  ChevronUp, ChevronDown, Trash2, Plus, ChevronRight, ChevronDown as Expand, X, Save, Users,
} from 'lucide-react';
import { Button, Heading, Text, Spinner, Select, TextField, TextArea } from '@radix-ui/themes';

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
  | 'send-email'
  | 'run-workflow';

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
  { value: 'run-workflow',       label: 'Run Workflow' },
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
    case 'run-workflow':       return { workflowId: '', inputs: '{}' };
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
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim">
        {label}
      </label>
      {children}
    </div>
  );
}

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
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-mission-control-text-dim flex-shrink-0" />
              <TextField.Root className="flex-1" value={c.assignTo ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('assignTo', e.target.value)} placeholder="coder, designer, growth-director..." />
            </div>
          </Field>
          <Field label="Subtasks">
            <div className="flex flex-col gap-1.5">
              {subtasks.map((st, i) => (
                <div key={i} className="flex flex-col gap-1 px-2.5 py-2 rounded-xl border border-mission-control-border bg-mission-control-bg">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-mission-control-text-dim w-4 flex-shrink-0">{i + 1}</span>
                    <TextField.Root
                      className="flex-1"
                      value={st.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubtask(i, 'title', e.target.value)}
                      placeholder={`Subtask ${i + 1} title`}
                    />
                    <button
                      type="button"
                      onClick={() => removeSubtask(i)}
                      title="Remove subtask"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-error hover:bg-mission-control-surface transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1 pl-5">
                    <Users size={11} className="text-mission-control-text-dim flex-shrink-0" />
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
    case 'run-workflow':
      return (
        <>
          <Field label="Workflow ID"><TextField.Root value={c.workflowId ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('workflowId', e.target.value)} placeholder="Workflow Studio workflow ID" /></Field>
          <Field label="Inputs (JSON)"><TextArea variant="soft" value={c.inputs ?? '{}'} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set('inputs', e.target.value)} placeholder='{"key": "value"}' rows={4} /></Field>
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
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="w-6 h-6 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>

        <div className="flex-1 max-w-[220px]" onClick={e => e.stopPropagation()}>
          <Select.Root value={step.type} onValueChange={val => { onChangeType(step.id, val as StepType); }}>
            <Select.Trigger />
            <Select.Content>
              {STEP_TYPES.map(t => (
                <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors ${index === 0 ? 'opacity-30' : ''}`}
            onClick={e => { e.stopPropagation(); onMove(index, -1); }}
            disabled={index === 0}
            title="Move up"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors ${index === total - 1 ? 'opacity-30' : ''}`}
            onClick={e => { e.stopPropagation(); onMove(index, 1); }}
            disabled={index === total - 1}
            title="Move down"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-error hover:bg-mission-control-surface transition-colors"
            onClick={e => { e.stopPropagation(); onDelete(step.id); }}
            title="Delete step"
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <Expand size={14} className="text-mission-control-text-dim" /> : <ChevronRight size={14} className="text-mission-control-text-dim" />}
        </div>
      </div>

      {/* Config */}
      {expanded && (
        <div
          className="px-3.5 pb-3.5 flex flex-col gap-2.5 border-t border-mission-control-border"
          onClick={e => e.stopPropagation()}
        >
          <div className="pt-2.5">
            <ConfigEditor step={step} onChange={cfg => onChangeConfig(step.id, cfg)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── JSON Preview ─────────────────────────────────────────────────────────────

function JsonPreview({ steps }: { steps: AutomationStepDef[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-mission-control-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-start gap-1.5 w-full px-3.5 py-2 text-sm text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
      >
        {open ? <Expand size={12} /> : <ChevronRight size={12} />}
        Preview JSON
      </button>
      {open && (
        <pre className="m-0 px-3.5 py-3 bg-mission-control-bg text-mission-control-text text-[11px] overflow-x-auto max-h-60 overflow-y-auto leading-[1.5]">
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
      className="fixed inset-0 z-[60] flex items-start justify-end bg-[var(--black-a4)]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[480px] h-full bg-mission-control-bg border-l border-mission-control-border flex flex-col overflow-y-auto"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-mission-control-border sticky top-0 bg-mission-control-bg z-[1]"
        >
          <div>
            <Heading size="4" weight="medium">Step Builder</Heading>
            <Text size="1" className="text-mission-control-text-dim">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"><X size={18} /></button>
        </div>

        {/* Steps */}
        <div className="flex-1 px-6 py-5 flex flex-col gap-2.5">
          {steps.length === 0 && (
            <div className="text-center text-[13px] text-mission-control-text-dim rounded-[10px] px-5 py-10 border-2 border-dashed border-mission-control-border">
              No steps yet. Add your first step below.
            </div>
          )}

          {steps.map((step, i) => (
            <div key={step.id}>
              <StepRow
                step={step}
                index={i}
                total={steps.length}
                onMove={moveStep}
                onDelete={deleteStep}
                onChangeType={changeType}
                onChangeConfig={changeConfig}
              />
              {i < steps.length - 1 && (
                <div className="w-px h-4 bg-mission-control-border mx-auto" />
              )}
            </div>
          ))}

          <Button
            variant="ghost"
            size="2"
            onClick={addStep}
            className="w-full justify-center"
          >
            <Plus size={16} /> Add step
          </Button>

          <JsonPreview steps={steps} />
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t border-mission-control-border flex flex-col gap-2 sticky bottom-0 bg-mission-control-bg"
        >
          {error && (
            <p className="text-[13px] text-error m-0">{error}</p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button variant="solid" onClick={handleSave} disabled={saving} className="flex-[2]">
              {saving ? <Spinner size="1" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save steps'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
