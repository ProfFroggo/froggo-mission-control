// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState, useCallback } from 'react';
import {
  ChevronUp, ChevronDown, Trash2, Plus, ChevronRight, ChevronDown as Expand, X, Save,
} from 'lucide-react';

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
  config: Record<string, string>;
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

function defaultConfig(type: StepType): Record<string, string> {
  switch (type) {
    case 'send-message':       return { to: '', message: '' };
    case 'assign-task':        return { taskId: '', agentId: '' };
    case 'send-for-approval':  return { description: '', approvers: '' };
    case 'wait':               return { duration: '1', unit: 'hours' };
    case 'condition':          return { field: '', operator: 'equals', value: '' };
    case 'notify-agent':       return { agentId: '', message: '' };
    case 'create-task':        return { title: '', priority: 'p2', assignTo: '' };
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
  background: 'var(--mission-control-bg)',
  color: 'var(--mission-control-text)',
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 60 };

interface ConfigEditorProps {
  step: AutomationStepDef;
  onChange: (config: Record<string, string>) => void;
}

function ConfigEditor({ step, onChange }: ConfigEditorProps) {
  const set = (key: string, val: string) => onChange({ ...step.config, [key]: val });
  const c = step.config;

  switch (step.type) {
    case 'send-message':
      return (
        <>
          <Field label="To"><input style={inputStyle} value={c.to ?? ''} onChange={e => set('to', e.target.value)} placeholder="Agent ID or room" /></Field>
          <Field label="Message"><textarea style={textareaStyle} value={c.message ?? ''} onChange={e => set('message', e.target.value)} placeholder="Message content..." /></Field>
        </>
      );
    case 'assign-task':
      return (
        <>
          <Field label="Task ID"><input style={inputStyle} value={c.taskId ?? ''} onChange={e => set('taskId', e.target.value)} placeholder="task-xxx" /></Field>
          <Field label="Agent ID"><input style={inputStyle} value={c.agentId ?? ''} onChange={e => set('agentId', e.target.value)} placeholder="agent-xxx" /></Field>
        </>
      );
    case 'send-for-approval':
      return (
        <>
          <Field label="Description"><textarea style={textareaStyle} value={c.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="What needs approval?" /></Field>
          <Field label="Approvers (comma-separated)"><input style={inputStyle} value={c.approvers ?? ''} onChange={e => set('approvers', e.target.value)} placeholder="user-1, user-2" /></Field>
        </>
      );
    case 'wait':
      return (
        <>
          <Field label="Duration">
            <input style={inputStyle} type="number" min="1" value={c.duration ?? '1'} onChange={e => set('duration', e.target.value)} />
          </Field>
          <Field label="Unit">
            <select style={selectStyle} value={c.unit ?? 'hours'} onChange={e => set('unit', e.target.value)}>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </Field>
        </>
      );
    case 'condition':
      return (
        <>
          <Field label="Field"><input style={inputStyle} value={c.field ?? ''} onChange={e => set('field', e.target.value)} placeholder="e.g. task.status" /></Field>
          <Field label="Operator">
            <select style={selectStyle} value={c.operator ?? 'equals'} onChange={e => set('operator', e.target.value)}>
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="greater_than">Greater than</option>
              <option value="less_than">Less than</option>
            </select>
          </Field>
          <Field label="Value"><input style={inputStyle} value={c.value ?? ''} onChange={e => set('value', e.target.value)} placeholder="Comparison value" /></Field>
        </>
      );
    case 'notify-agent':
      return (
        <>
          <Field label="Agent ID"><input style={inputStyle} value={c.agentId ?? ''} onChange={e => set('agentId', e.target.value)} placeholder="agent-xxx" /></Field>
          <Field label="Message"><textarea style={textareaStyle} value={c.message ?? ''} onChange={e => set('message', e.target.value)} placeholder="Notification message..." /></Field>
        </>
      );
    case 'create-task':
      return (
        <>
          <Field label="Title"><input style={inputStyle} value={c.title ?? ''} onChange={e => set('title', e.target.value)} placeholder="Task title" /></Field>
          <Field label="Priority">
            <select style={selectStyle} value={c.priority ?? 'p2'} onChange={e => set('priority', e.target.value)}>
              <option value="p0">P0 — Critical</option>
              <option value="p1">P1 — High</option>
              <option value="p2">P2 — Medium</option>
              <option value="p3">P3 — Low</option>
            </select>
          </Field>
          <Field label="Assign to (Agent ID)"><input style={inputStyle} value={c.assignTo ?? ''} onChange={e => set('assignTo', e.target.value)} placeholder="agent-xxx" /></Field>
        </>
      );
    case 'update-task-status':
      return (
        <>
          <Field label="Task ID"><input style={inputStyle} value={c.taskId ?? ''} onChange={e => set('taskId', e.target.value)} placeholder="task-xxx" /></Field>
          <Field label="New Status">
            <select style={selectStyle} value={c.status ?? 'in-progress'} onChange={e => set('status', e.target.value)}>
              <option value="todo">Todo</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </Field>
        </>
      );
    case 'send-email':
      return (
        <>
          <Field label="To"><input style={inputStyle} value={c.to ?? ''} onChange={e => set('to', e.target.value)} placeholder="recipient@example.com" /></Field>
          <Field label="Subject"><input style={inputStyle} value={c.subject ?? ''} onChange={e => set('subject', e.target.value)} placeholder="Email subject" /></Field>
          <Field label="Body"><textarea style={textareaStyle} value={c.body ?? ''} onChange={e => set('body', e.target.value)} placeholder="Email body..." /></Field>
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
  onChangeConfig: (id: string, config: Record<string, string>) => void;
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
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {index + 1}
        </span>

        <select
          value={step.type}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onChangeType(step.id, e.target.value as StepType); }}
          style={{ ...selectStyle, flex: 1, maxWidth: 220 }}
        >
          {STEP_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={e => { e.stopPropagation(); onMove(index, -1); }}
            disabled={index === 0}
            title="Move up"
            style={{ ...btnIcon, opacity: index === 0 ? 0.3 : 1 }}
          >
            <ChevronUp size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onMove(index, 1); }}
            disabled={index === total - 1}
            title="Move down"
            style={{ ...btnIcon, opacity: index === total - 1 ? 0.3 : 1 }}
          >
            <ChevronDown size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(step.id); }}
            title="Delete step"
            style={{ ...btnIcon, color: 'var(--status-error, #ef4444)' }}
          >
            <Trash2 size={14} />
          </button>
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
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          background: 'var(--mission-control-surface)',
          border: 'none',
          color: 'var(--mission-control-text-dim)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {open ? <Expand size={12} /> : <ChevronRight size={12} />}
        Preview JSON
      </button>
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

  const changeConfig = useCallback((id: string, config: Record<string, string>) => {
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
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--mission-control-text)', margin: 0 }}>Step Builder</h2>
            <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', margin: '2px 0 0' }}>
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} style={btnIcon}><X size={18} /></button>
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

          <button
            onClick={addStep}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px',
              borderRadius: 8,
              border: '2px dashed var(--mission-control-border)',
              background: 'transparent',
              color: 'var(--mission-control-text-dim)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mission-control-accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--mission-control-accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--mission-control-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--mission-control-text-dim)'; }}
          >
            <Plus size={16} /> Add step
          </button>

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
            <p style={{ fontSize: 12, color: 'var(--status-error, #ef4444)', margin: 0 }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: 8,
                border: '1px solid var(--mission-control-border)',
                background: 'transparent',
                color: 'var(--mission-control-text)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px',
                borderRadius: 8,
                border: 'none',
                background: saving ? 'var(--mission-control-border)' : 'var(--mission-control-accent)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save steps'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
