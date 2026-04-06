'use client';

import { useState, useCallback } from 'react';
import {
  X, Workflow, Zap, Clock, Globe, Play, Plus, Trash2, Bot, Wand2,
  ChevronUp, ChevronDown, ChevronRight, Mail, MessageSquare,
  CheckCircle, Shield, ArrowRight, GitBranch, Users, AlertCircle,
} from 'lucide-react';
import { Button, Select, TextField, TextArea, Spinner } from '@radix-ui/themes';
import { wsClient } from '@/lib/workflow-studio-client';
import type { WorkflowMeta, SerializedWorkflow, SerializedBlock, SerializedConnection } from './store';

// ─── Types ──────────────────────────────────────────────────────────────────

type BuildMode = 'natural' | 'steps' | 'visual';
type TriggerType = 'schedule' | 'event' | 'webhook' | 'manual';
type Frequency = 'daily' | 'weekly' | 'monthly';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type StepType =
  | 'send-message'
  | 'create-task'
  | 'assign-task'
  | 'send-for-approval'
  | 'wait'
  | 'condition'
  | 'notify-agent'
  | 'update-task-status'
  | 'send-email'
  | 'run-workflow';

interface StepDef {
  id: string;
  type: StepType;
  config: Record<string, unknown>;
  collapsed: boolean;
}

interface SubtaskItem {
  id: string;
  title: string;
}

interface WorkflowBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, meta: WorkflowMeta, state: SerializedWorkflow) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MODES: { value: BuildMode; label: string }[] = [
  { value: 'natural', label: 'Natural language' },
  { value: 'steps', label: 'Step builder' },
  { value: 'visual', label: 'Visual' },
];

const EVENTS = [
  { value: 'task.created', label: 'Task created' },
  { value: 'task.done', label: 'Task completed' },
  { value: 'approval.created', label: 'Approval request created' },
  { value: 'approval.approved', label: 'Approval approved' },
  { value: 'approval.rejected', label: 'Approval rejected' },
  { value: 'agent.message', label: 'Agent sends message' },
  { value: 'campaign.started', label: 'Campaign started' },
  { value: 'campaign.ended', label: 'Campaign ended' },
];

const STEP_OPTIONS: { value: StepType; label: string }[] = [
  { value: 'send-message', label: 'Send Message' },
  { value: 'create-task', label: 'Create Task' },
  { value: 'assign-task', label: 'Assign Task' },
  { value: 'send-for-approval', label: 'Send for Approval' },
  { value: 'wait', label: 'Wait' },
  { value: 'condition', label: 'Condition' },
  { value: 'notify-agent', label: 'Notify Agent' },
  { value: 'update-task-status', label: 'Update Task Status' },
  { value: 'send-email', label: 'Send Email' },
  { value: 'run-workflow', label: 'Run Workflow' },
];

const STEP_LABELS: Record<string, string> = {
  'send-message': 'Send Message',
  'create-task': 'Create Task',
  'assign-task': 'Assign Task',
  'send-for-approval': 'Send for Approval',
  'wait': 'Wait',
  'condition': 'Condition',
  'notify-agent': 'Notify Agent',
  'update-task-status': 'Update Task Status',
  'send-email': 'Send Email',
  'run-workflow': 'Run Workflow',
};

const STEP_ICONS: Record<string, string> = {
  'send-message': 'MessageSquare',
  'create-task': 'Plus',
  'assign-task': 'Users',
  'send-for-approval': 'Shield',
  'wait': 'Clock',
  'condition': 'GitBranch',
  'notify-agent': 'Bot',
  'update-task-status': 'CheckCircle',
  'send-email': 'Mail',
  'run-workflow': 'ArrowRight',
};

const STEP_COLORS: Record<string, string> = {
  'send-message': '#60a5fa',
  'create-task': '#22c55e',
  'assign-task': '#a78bfa',
  'send-for-approval': '#f59e0b',
  'wait': '#94a3b8',
  'condition': '#fbbf24',
  'notify-agent': '#e879f9',
  'update-task-status': '#14b8a6',
  'send-email': '#fb7185',
  'run-workflow': '#f97316',
};

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const FIELD_LABEL = 'block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-1.5';

// ─── Conversion: Steps → SerializedWorkflow ─────────────────────────────────

function stepsToWorkflow(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  steps: StepDef[],
): SerializedWorkflow {
  const blocks: SerializedBlock[] = [];
  const connections: SerializedConnection[] = [];

  // Starter block
  const starterId = 'starter-0';
  blocks.push({
    id: starterId,
    position: { x: 300, y: 0 },
    config: { tool: 'starter', params: { triggerType, ...triggerConfig } },
    inputs: {},
    outputs: { response: 'string' },
    metadata: { id: starterId, name: 'Trigger', icon: 'Zap', color: '#22c55e', category: 'trigger' },
    enabled: true,
  });

  // Step blocks
  steps.forEach((step, i) => {
    const blockId = `step-${i}-${Date.now()}`;
    const toolType = step.type.replace(/-/g, '_');
    blocks.push({
      id: blockId,
      position: { x: 300, y: (i + 1) * 200 },
      config: { tool: toolType, params: { ...step.config } },
      inputs: {},
      outputs: { response: 'string' },
      metadata: {
        id: blockId,
        name: STEP_LABELS[step.type] || step.type,
        icon: STEP_ICONS[step.type],
        color: STEP_COLORS[step.type],
      },
      enabled: true,
    });

    const prevId = i === 0 ? starterId : blocks[i].id;
    connections.push({ source: prevId, target: blockId });
  });

  return { version: '1', blocks, connections, loops: {} };
}

// ─── Step config editors ────────────────────────────────────────────────────

interface StepConfigProps {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function SendMessageConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>To</label>
        <TextField.Root
          placeholder="e.g. #general, @agent-name"
          value={(config.to as string) ?? ''}
          onChange={e => onChange('to', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Message</label>
        <TextArea
          variant="soft"
          placeholder="Message content..."
          value={(config.message as string) ?? ''}
          onChange={e => onChange('message', e.target.value)}
          rows={3}
          size="1"
        />
      </div>
    </>
  );
}

function CreateTaskConfig({ config, onChange }: StepConfigProps) {
  const subtasks = (config.subtasks as SubtaskItem[] | undefined) ?? [];

  const addSubtask = () => {
    onChange('subtasks', [...subtasks, { id: `sub-${Date.now()}`, title: '' }]);
  };

  const updateSubtask = (idx: number, title: string) => {
    const next = [...subtasks];
    next[idx] = { ...next[idx], title };
    onChange('subtasks', next);
  };

  const removeSubtask = (idx: number) => {
    onChange('subtasks', subtasks.filter((_, i) => i !== idx));
  };

  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Title</label>
        <TextField.Root
          placeholder="Task title"
          value={(config.title as string) ?? ''}
          onChange={e => onChange('title', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Description</label>
        <TextArea
          variant="soft"
          placeholder="Task description..."
          value={(config.description as string) ?? ''}
          onChange={e => onChange('description', e.target.value)}
          rows={2}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Planning Notes</label>
        <TextArea
          variant="soft"
          placeholder="Implementation notes, context, approach..."
          value={(config.planningNotes as string) ?? ''}
          onChange={e => onChange('planningNotes', e.target.value)}
          rows={2}
          size="1"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className={FIELD_LABEL}>Priority</label>
          <Select.Root
            value={(config.priority as string) ?? 'P2'}
            onValueChange={val => onChange('priority', val)}
            size="1"
          >
            <Select.Trigger className="w-full" />
            <Select.Content>
              <Select.Item value="P0">P0 - Critical</Select.Item>
              <Select.Item value="P1">P1 - High</Select.Item>
              <Select.Item value="P2">P2 - Medium</Select.Item>
              <Select.Item value="P3">P3 - Low</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        <div className="flex-1">
          <label className={FIELD_LABEL}>Assign to</label>
          <div className="relative">
            <TextField.Root
              placeholder="Agent or user..."
              value={(config.assignTo as string) ?? ''}
              onChange={e => onChange('assignTo', e.target.value)}
              size="1"
            />
            <Users size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none" />
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className={FIELD_LABEL}>Subtasks</label>
          <button
            type="button"
            onClick={addSubtask}
            className="flex items-center gap-1 text-[10px] font-medium text-mission-control-accent hover:underline"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        {subtasks.length === 0 ? (
          <p className="text-[11px] text-mission-control-text-dim">No subtasks added.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {subtasks.map((sub, idx) => (
              <div key={sub.id} className="flex items-center gap-2">
                <span className="text-[10px] text-mission-control-text-dim w-4 text-right">{idx + 1}.</span>
                <TextField.Root
                  className="flex-1"
                  placeholder="Subtask title..."
                  value={sub.title}
                  onChange={e => updateSubtask(idx, e.target.value)}
                  size="1"
                />
                <button
                  type="button"
                  onClick={() => removeSubtask(idx)}
                  className="text-mission-control-text-dim hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function AssignTaskConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Task ID</label>
        <TextField.Root
          placeholder="Task ID to assign"
          value={(config.taskId as string) ?? ''}
          onChange={e => onChange('taskId', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Agent ID</label>
        <TextField.Root
          placeholder="Agent to assign to"
          value={(config.agentId as string) ?? ''}
          onChange={e => onChange('agentId', e.target.value)}
          size="1"
        />
      </div>
    </>
  );
}

function SendForApprovalConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Description</label>
        <TextArea
          variant="soft"
          placeholder="What needs approval?"
          value={(config.description as string) ?? ''}
          onChange={e => onChange('description', e.target.value)}
          rows={3}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Approvers</label>
        <TextField.Root
          placeholder="e.g. clara, kevin (comma-separated)"
          value={(config.approvers as string) ?? ''}
          onChange={e => onChange('approvers', e.target.value)}
          size="1"
        />
      </div>
    </>
  );
}

function WaitConfig({ config, onChange }: StepConfigProps) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <label className={FIELD_LABEL}>Duration</label>
        <TextField.Root
          type="number"
          min={1}
          placeholder="e.g. 30"
          value={(config.duration as string) ?? ''}
          onChange={e => onChange('duration', parseInt(e.target.value, 10) || 1)}
          size="1"
        />
      </div>
      <div className="flex-1">
        <label className={FIELD_LABEL}>Unit</label>
        <Select.Root
          value={(config.unit as string) ?? 'minutes'}
          onValueChange={val => onChange('unit', val)}
          size="1"
        >
          <Select.Trigger className="w-full" />
          <Select.Content>
            <Select.Item value="minutes">Minutes</Select.Item>
            <Select.Item value="hours">Hours</Select.Item>
            <Select.Item value="days">Days</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
    </div>
  );
}

function ConditionConfig({ config, onChange }: StepConfigProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <div className="flex-[1_1_140px]">
        <label className={FIELD_LABEL}>Field</label>
        <TextField.Root
          placeholder="e.g. status"
          value={(config.field as string) ?? ''}
          onChange={e => onChange('field', e.target.value)}
          size="1"
        />
      </div>
      <div className="flex-[1_1_140px]">
        <label className={FIELD_LABEL}>Operator</label>
        <Select.Root
          value={(config.operator as string) ?? 'equals'}
          onValueChange={val => onChange('operator', val)}
          size="1"
        >
          <Select.Trigger className="w-full" />
          <Select.Content>
            <Select.Item value="equals">Equals</Select.Item>
            <Select.Item value="contains">Contains</Select.Item>
            <Select.Item value="greater_than">Greater than</Select.Item>
            <Select.Item value="less_than">Less than</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
      <div className="flex-[1_1_140px]">
        <label className={FIELD_LABEL}>Value</label>
        <TextField.Root
          placeholder="e.g. done"
          value={(config.value as string) ?? ''}
          onChange={e => onChange('value', e.target.value)}
          size="1"
        />
      </div>
    </div>
  );
}

function NotifyAgentConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Agent ID</label>
        <TextField.Root
          placeholder="Agent to notify"
          value={(config.agentId as string) ?? ''}
          onChange={e => onChange('agentId', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Message</label>
        <TextArea
          variant="soft"
          placeholder="Notification message..."
          value={(config.message as string) ?? ''}
          onChange={e => onChange('message', e.target.value)}
          rows={3}
          size="1"
        />
      </div>
    </>
  );
}

function UpdateTaskStatusConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Task ID</label>
        <TextField.Root
          placeholder="Task ID to update"
          value={(config.taskId as string) ?? ''}
          onChange={e => onChange('taskId', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>New Status</label>
        <Select.Root
          value={(config.newStatus as string) ?? 'todo'}
          onValueChange={val => onChange('newStatus', val)}
          size="1"
        >
          <Select.Trigger className="w-full" />
          <Select.Content>
            <Select.Item value="todo">Todo</Select.Item>
            <Select.Item value="in-progress">In Progress</Select.Item>
            <Select.Item value="review">Review</Select.Item>
            <Select.Item value="done">Done</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
    </>
  );
}

function SendEmailConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>To</label>
        <TextField.Root
          placeholder="recipient@example.com"
          value={(config.to as string) ?? ''}
          onChange={e => onChange('to', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Subject</label>
        <TextField.Root
          placeholder="Email subject"
          value={(config.subject as string) ?? ''}
          onChange={e => onChange('subject', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Body</label>
        <TextArea
          variant="soft"
          placeholder="Email body content..."
          value={(config.body as string) ?? ''}
          onChange={e => onChange('body', e.target.value)}
          rows={4}
          size="1"
        />
      </div>
    </>
  );
}

function RunWorkflowConfig({ config, onChange }: StepConfigProps) {
  return (
    <>
      <div>
        <label className={FIELD_LABEL}>Workflow ID</label>
        <TextField.Root
          placeholder="ID of workflow to run"
          value={(config.workflowId as string) ?? ''}
          onChange={e => onChange('workflowId', e.target.value)}
          size="1"
        />
      </div>
      <div>
        <label className={FIELD_LABEL}>Inputs JSON</label>
        <TextArea
          variant="soft"
          placeholder='{ "key": "value" }'
          value={(config.inputsJson as string) ?? ''}
          onChange={e => onChange('inputsJson', e.target.value)}
          rows={3}
          size="1"
        />
      </div>
    </>
  );
}

const CONFIG_EDITORS: Record<StepType, React.FC<StepConfigProps>> = {
  'send-message': SendMessageConfig,
  'create-task': CreateTaskConfig,
  'assign-task': AssignTaskConfig,
  'send-for-approval': SendForApprovalConfig,
  'wait': WaitConfig,
  'condition': ConditionConfig,
  'notify-agent': NotifyAgentConfig,
  'update-task-status': UpdateTaskStatusConfig,
  'send-email': SendEmailConfig,
  'run-workflow': RunWorkflowConfig,
};

// ─── Step editor row ────────────────────────────────────────────────────────

interface StepRowProps {
  step: StepDef;
  index: number;
  total: number;
  onChange: (step: StepDef) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: StepRowProps) {
  const setType = (type: StepType) => {
    onChange({ ...step, type, config: {} });
  };

  const setConfig = (key: string, value: unknown) => {
    onChange({ ...step, config: { ...step.config, [key]: value } });
  };

  const toggleCollapsed = () => {
    onChange({ ...step, collapsed: !step.collapsed });
  };

  const ConfigEditor = CONFIG_EDITORS[step.type];

  return (
    <div className="bg-mission-control-bg border border-mission-control-border rounded-xl overflow-hidden">
      {/* Step header */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-mission-control-surface cursor-pointer"
        onClick={toggleCollapsed}
      >
        <span className="w-6 h-6 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim leading-none mb-0.5">
            {STEP_LABELS[step.type] ?? 'Step'}
          </p>
          <p className="text-sm font-medium text-mission-control-text truncate">
            {STEP_LABELS[step.type] || 'New step'}
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
        {step.collapsed
          ? <ChevronRight size={14} className="text-mission-control-text-dim" />
          : <ChevronDown size={14} className="text-mission-control-text-dim" />}
      </div>

      {!step.collapsed && (
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {/* Action type */}
          <div>
            <label className={FIELD_LABEL}>Action type</label>
            <Select.Root value={step.type} onValueChange={val => setType(val as StepType)} size="1">
              <Select.Trigger className="w-full" />
              <Select.Content>
                {STEP_OPTIONS.map(s => (
                  <Select.Item key={s.value} value={s.value}>{s.label}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </div>

          {/* Type-specific config */}
          {ConfigEditor && <ConfigEditor config={step.config} onChange={setConfig} />}
        </div>
      )}
    </div>
  );
}

// ─── Trigger icons ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TRIGGER_ICONS: Record<TriggerType, React.ComponentType<any>> = {
  schedule: Clock,
  event: Zap,
  webhook: Globe,
  manual: Play,
};

// ─── Main dialog ────────────────────────────────────────────────────────────

export default function WorkflowBuilderDialog({ open, onClose, onCreated }: WorkflowBuilderDialogProps) {
  const [mode, setMode] = useState<BuildMode>('natural');

  // Natural language
  const [nlDescription, setNlDescription] = useState('');
  const [nlParsing, setNlParsing] = useState(false);
  const [nlError, setNlError] = useState('');

  // Shared fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Trigger config
  const [triggerType, setTriggerType] = useState<TriggerType>('schedule');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({
    time: '09:00',
    frequency: 'daily',
  });

  // Steps
  const [steps, setSteps] = useState<StepDef[]>([]);

  // Saving state
  const [saving, setSaving] = useState(false);

  // ── Natural language parse ──────────────────────────────────────────────

  const handleBuildWithAI = useCallback(async () => {
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
        if (parsed.name) setName(parsed.name);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.trigger_type) {
          setTriggerType(parsed.trigger_type);
          setTriggerConfig(parsed.trigger_config ?? { time: '09:00', frequency: 'daily' });
        }
        if (parsed.steps && Array.isArray(parsed.steps)) {
          setSteps(parsed.steps.map((s: { type?: string; config?: Record<string, unknown> }, i: number) => ({
            id: `step-${Date.now()}-${i}`,
            type: (s.type ?? 'send-message') as StepType,
            config: s.config ?? {},
            collapsed: false,
          })));
        }
        setMode('steps');
      } else {
        setName(nlDescription.slice(0, 60));
        setDescription(nlDescription);
        setMode('steps');
        setNlError('AI parse unavailable — review and complete the form manually.');
      }
    } catch (err) {
      console.warn('[WorkflowBuilderDialog] Non-critical:', err);
      setName(nlDescription.slice(0, 60));
      setDescription(nlDescription);
      setMode('steps');
      setNlError('AI parse unavailable — review and complete the form manually.');
    } finally {
      setNlParsing(false);
    }
  }, [nlDescription]);

  // ── Step management ─────────────────────────────────────────────────────

  const addStep = useCallback(() => {
    setSteps(prev => [
      ...prev,
      { id: `step-${Date.now()}`, type: 'send-message', config: {}, collapsed: false },
    ]);
  }, []);

  const updateStep = useCallback((index: number, step: StepDef) => {
    setSteps(prev => {
      const next = [...prev];
      next[index] = step;
      return next;
    });
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  }, []);

  const moveStep = useCallback((index: number, dir: -1 | 1) => {
    setSteps(prev => {
      const next = [...prev];
      const other = index + dir;
      if (other < 0 || other >= next.length) return prev;
      [next[index], next[other]] = [next[other], next[index]];
      return next;
    });
  }, []);

  // ── Trigger helpers ─────────────────────────────────────────────────────

  const handleTriggerTypeChange = useCallback((t: TriggerType) => {
    const defaults: Record<TriggerType, Record<string, unknown>> = {
      schedule: { time: '09:00', frequency: 'daily' },
      event: { event: 'task.created' },
      webhook: {},
      manual: {},
    };
    setTriggerType(t);
    setTriggerConfig(defaults[t]);
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (status: 'draft' | 'active') => {
    setSaving(true);
    try {
      const state = mode === 'visual'
        ? { version: '1' as const, blocks: [], connections: [], loops: {} }
        : stepsToWorkflow(triggerType, triggerConfig, steps);

      const result = await wsClient.createWorkflow({
        name: name.trim() || 'Untitled Workflow',
        state,
      });

      const meta: WorkflowMeta = {
        id: result.id,
        name: name.trim() || 'Untitled Workflow',
        description,
        color: '#7c3aed',
        is_deployed: status === 'active',
        run_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onCreated(result.id, meta, state as SerializedWorkflow);
      onClose();
    } catch (err) {
      console.error('Failed to create workflow:', err);
    } finally {
      setSaving(false);
    }
  }, [mode, name, description, triggerType, triggerConfig, steps, onCreated, onClose]);

  // ── Render gate ─────────────────────────────────────────────────────────

  if (!open) return null;

  const scheduleTime = (triggerConfig.time as string) ?? '09:00';
  const scheduleFrequency = (triggerConfig.frequency as string) ?? 'daily';
  const scheduleDayOfWeek = (triggerConfig.dayOfWeek as string) ?? 'monday';
  const eventValue = (triggerConfig.event as string) ?? 'task.created';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-[var(--black-a6)] backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(680px,96vw)] max-h-[90vh] bg-mission-control-surface border border-mission-control-border rounded-2xl flex flex-col overflow-hidden shadow-[0_24px_64px_var(--black-a5)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-mission-control-border">
          <div className="flex items-center gap-2.5">
            <Workflow size={18} className="text-mission-control-accent" />
            <span className="font-bold text-base text-mission-control-text">New Workflow</span>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Mode toggle */}
            <div className="flex gap-0.5 bg-mission-control-bg rounded-lg p-0.5 border border-mission-control-border">
              {MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    mode === m.value
                      ? 'bg-mission-control-accent/10 text-mission-control-accent'
                      : 'text-mission-control-text-dim hover:text-mission-control-text'
                  }`}
                >
                  {m.label}
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

          {/* ── Natural language mode ── */}
          {mode === 'natural' && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-[13px] text-mission-control-text-dim leading-relaxed mb-4">
                  Describe your workflow in plain English. The AI will parse it into structured steps that you can review and refine.
                </p>
                <TextArea
                  variant="soft"
                  value={nlDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNlDescription(e.target.value)}
                  placeholder="Every morning at 9am, create a task for the content writer to draft a blog post, then notify the reviewer agent for approval."
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
                  <button
                    type="button"
                    onClick={() => setMode('steps')}
                    className="text-mission-control-accent hover:underline transition-colors"
                  >
                    switch to the step builder
                  </button>
                  {' '}to configure each step yourself.
                </p>
              </div>
            </div>
          )}

          {/* ── Step builder mode ── */}
          {mode === 'steps' && (
            <div className="flex flex-col gap-5">
              {/* Name & description */}
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className={FIELD_LABEL}>Workflow name</label>
                  <TextField.Root
                    placeholder="e.g. Daily Content Pipeline"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Description (optional)</label>
                  <TextArea
                    variant="soft"
                    placeholder="What does this workflow do?"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full font-[inherit]"
                  />
                </div>
              </div>

              {/* Trigger */}
              <div className="bg-mission-control-bg border border-mission-control-border rounded-xl p-4">
                <label className="block text-[10px] font-bold text-mission-control-text-dim uppercase tracking-wider mb-3">
                  Trigger
                </label>

                {/* Trigger type selector */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {(['schedule', 'event', 'webhook', 'manual'] as TriggerType[]).map(t => {
                    const TIcon = TRIGGER_ICONS[t];
                    const active = triggerType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTriggerTypeChange(t)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors capitalize ${
                          active
                            ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                            : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
                        }`}
                      >
                        <TIcon size={13} /> {t}
                      </button>
                    );
                  })}
                </div>

                {/* Trigger config */}
                {triggerType === 'schedule' && (
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-[1_1_120px]">
                      <label className={FIELD_LABEL}>Time (HH:MM)</label>
                      <TextField.Root
                        type="time"
                        value={scheduleTime}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setTriggerConfig(c => ({ ...c, time: e.target.value }))
                        }
                      />
                    </div>
                    <div className="flex-[1_1_140px]">
                      <label className={FIELD_LABEL}>Frequency</label>
                      <Select.Root
                        value={scheduleFrequency}
                        onValueChange={val =>
                          setTriggerConfig(c => ({ ...c, frequency: val }))
                        }
                      >
                        <Select.Trigger className="w-full" />
                        <Select.Content>
                          <Select.Item value="daily">Daily</Select.Item>
                          <Select.Item value="weekly">Weekly</Select.Item>
                          <Select.Item value="monthly">Monthly</Select.Item>
                        </Select.Content>
                      </Select.Root>
                    </div>
                    {scheduleFrequency === 'weekly' && (
                      <div className="flex-[1_1_140px]">
                        <label className={FIELD_LABEL}>Day of week</label>
                        <Select.Root
                          value={scheduleDayOfWeek}
                          onValueChange={val =>
                            setTriggerConfig(c => ({ ...c, dayOfWeek: val }))
                          }
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

                {triggerType === 'event' && (
                  <div>
                    <label className={FIELD_LABEL}>Event type</label>
                    <Select.Root
                      value={eventValue}
                      onValueChange={val => setTriggerConfig({ event: val })}
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

                {triggerType === 'webhook' && (
                  <div>
                    <label className={FIELD_LABEL}>Webhook URL (generated on save)</label>
                    <TextField.Root
                      disabled
                      placeholder="/api/workflows/webhook/[id]"
                      className="opacity-50"
                    />
                  </div>
                )}

                {triggerType === 'manual' && (
                  <p className="text-xs text-mission-control-text-dim">
                    This workflow will only run when triggered manually via the Run button.
                  </p>
                )}
              </div>

              {/* Steps */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className={FIELD_LABEL}>
                    Steps ({steps.length} step{steps.length !== 1 ? 's' : ''})
                  </label>
                  <Button variant="ghost" size="1" onClick={addStep}>
                    <Plus size={13} /> Add step
                  </Button>
                </div>

                {steps.length === 0 ? (
                  <div className="p-6 border-2 border-dashed border-mission-control-border rounded-[10px] text-center text-[14px] text-mission-control-text-dim">
                    No steps yet. Click &quot;Add step&quot; to define what this workflow does.
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {steps.map((step, i) => (
                      <div key={step.id}>
                        <StepRow
                          step={step}
                          index={i}
                          total={steps.length}
                          onChange={s => updateStep(i, s)}
                          onRemove={() => removeStep(i)}
                          onMoveUp={() => moveStep(i, -1)}
                          onMoveDown={() => moveStep(i, 1)}
                        />
                        {i < steps.length - 1 && (
                          <div className="w-px h-4 bg-mission-control-border mx-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Visual mode ── */}
          {mode === 'visual' && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3.5">
                <div>
                  <label className={FIELD_LABEL}>Workflow name</label>
                  <TextField.Root
                    placeholder="e.g. Customer Onboarding Flow"
                    value={name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className={FIELD_LABEL}>Description (optional)</label>
                  <TextArea
                    variant="soft"
                    placeholder="What does this workflow do?"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full font-[inherit]"
                  />
                </div>
              </div>

              <div className="bg-mission-control-bg border border-mission-control-border rounded-xl p-6 text-center">
                <Workflow size={32} className="text-mission-control-accent mx-auto mb-3 opacity-60" />
                <p className="text-sm text-mission-control-text mb-1.5">Visual Canvas Builder</p>
                <p className="text-xs text-mission-control-text-dim leading-relaxed">
                  Continue to the visual canvas to build with drag-and-drop nodes.
                  You can add triggers, AI agents, logic gates, and integrations.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer (step builder and visual modes only) */}
        {(mode === 'steps' || mode === 'visual') && (
          <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-mission-control-border bg-mission-control-surface">
            <Button variant="outline" size="2" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="soft"
              size="2"
              onClick={() => handleSave('draft')}
              disabled={saving}
            >
              {saving ? <Spinner size="1" /> : null}
              Save as draft
            </Button>
            <Button
              variant="solid"
              size="2"
              onClick={() => handleSave('active')}
              disabled={!name.trim() || saving}
            >
              {saving ? <Spinner size="1" /> : null}
              {mode === 'visual' ? 'Open Canvas' : 'Save & Activate'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
