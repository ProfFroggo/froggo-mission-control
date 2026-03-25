// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState } from 'react';
import { X, ChevronRight, Plus, Layers } from 'lucide-react';
import { Button, Heading, Text, Spinner } from '@radix-ui/themes';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TemplateCategory = 'Workflow' | 'Notification' | 'AI' | 'Data';

interface TemplateStep {
  type: string;
  label: string;
  config: Record<string, string>;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  trigger_type: string;
  trigger_config: Record<string, string>;
  steps: TemplateStep[];
}

interface Props {
  onClose: () => void;
  onUseTemplate: (template: AutomationTemplate) => void;
}

// ─── Built-in templates ──────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'tpl-v2-task-notify',
    name: 'Task Assigned — Notify Agent',
    description: 'When a task is assigned, automatically send a notification to the assigned agent with task details.',
    category: 'Notification',
    trigger_type: 'event',
    trigger_config: { event: 'task.assigned' },
    steps: [
      {
        type: 'notify-agent',
        label: 'Notify assigned agent',
        config: { agentId: '{{task.assignedTo}}', message: 'You have been assigned a new task: {{task.title}}' },
      },
    ],
  },
  {
    id: 'tpl-v2-weekly-report',
    name: 'Weekly Progress Report',
    description: 'Every week, create a summary task and post a progress message to the team.',
    category: 'Data',
    trigger_type: 'schedule',
    trigger_config: { frequency: 'weekly', dayOfWeek: 'monday', time: '09:00' },
    steps: [
      {
        type: 'create-task',
        label: 'Create weekly report task',
        config: { title: 'Weekly Progress Report', priority: 'p2', assignTo: '' },
      },
      {
        type: 'send-message',
        label: 'Post to team',
        config: { to: 'general', message: 'Weekly report task created. Please update your progress.' },
      },
    ],
  },
  {
    id: 'tpl-v2-approval-workflow',
    name: 'Approval Workflow',
    description: 'Manually trigger an approval request, wait for a response, then notify the requesting agent.',
    category: 'Workflow',
    trigger_type: 'manual',
    trigger_config: {},
    steps: [
      {
        type: 'send-for-approval',
        label: 'Send for approval',
        config: { description: 'Please review and approve this request.', approvers: '' },
      },
      {
        type: 'wait',
        label: 'Wait for response',
        config: { duration: '24', unit: 'hours' },
      },
      {
        type: 'notify-agent',
        label: 'Notify requester of outcome',
        config: { agentId: '', message: 'Your approval request has been processed.' },
      },
    ],
  },
  {
    id: 'tpl-v2-auto-assign',
    name: 'New Task Auto-Assign',
    description: 'When a task is created, automatically assign it to a designated agent and send a notification.',
    category: 'AI',
    trigger_type: 'event',
    trigger_config: { event: 'task.created' },
    steps: [
      {
        type: 'assign-task',
        label: 'Assign task to agent',
        config: { taskId: '{{task.id}}', agentId: '' },
      },
      {
        type: 'notify-agent',
        label: 'Notify agent of assignment',
        config: { agentId: '', message: 'A new task has been assigned to you: {{task.title}}' },
      },
    ],
  },
  {
    id: 'tpl-v2-standup-reminder',
    name: 'Daily Standup Reminder',
    description: 'Every morning at 9am, send a standup reminder message to all agents.',
    category: 'Notification',
    trigger_type: 'schedule',
    trigger_config: { frequency: 'daily', time: '09:00' },
    steps: [
      {
        type: 'send-message',
        label: 'Post standup prompt',
        config: { to: 'general', message: 'Good morning! Time for the daily standup. Please share: 1) What you did yesterday, 2) What you plan today, 3) Any blockers.' },
      },
      {
        type: 'notify-agent',
        label: 'Notify all active agents',
        config: { agentId: 'all', message: 'Daily standup is starting now.' },
      },
    ],
  },
  {
    id: 'tpl-v2-hr-training',
    name: 'Daily Agent Training Session',
    description: 'HR reviews each active agent, assesses performance from Clara patterns, identifies skill gaps, writes individual training logs, and creates tasks for action items.',
    category: 'AI',
    trigger_type: 'schedule',
    trigger_config: { frequency: 'daily', time: '02:00' },
    steps: [
      {
        type: 'create-task',
        label: 'Create training task for HR',
        config: { title: 'HR: Daily Agent Training Session', priority: 'p2', assignTo: 'hr' },
      },
    ],
  },
  {
    id: 'tpl-v2-hr-report',
    name: 'Daily Team Health Report',
    description: 'HR compiles a team health report covering all agents: task stats, training insights, highlights, concerns, and actionable recommendations.',
    category: 'Data',
    trigger_type: 'schedule',
    trigger_config: { frequency: 'daily', time: '23:30' },
    steps: [
      {
        type: 'create-task',
        label: 'Create report task for HR',
        config: { title: 'HR: Daily Team Health Report', priority: 'p2', assignTo: 'hr' },
      },
    ],
  },
];

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  Workflow:     'var(--color-review)',
  Notification: 'var(--color-warning)',
  AI:           'var(--color-review)',
  Data:         'var(--color-info)',
};

const ALL_CATEGORIES: TemplateCategory[] = ['Workflow', 'Notification', 'AI', 'Data'];

// ─── Template card ───────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: AutomationTemplate;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ template, selected, onSelect }: TemplateCardProps) {
  const color = CATEGORY_COLORS[template.category];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex flex-col gap-2.5 p-4 rounded-xl text-left transition-colors',
        selected
          ? 'bg-mission-control-surface border-2 border-mission-control-accent'
          : 'bg-mission-control-surface border-2 border-mission-control-border hover:border-mission-control-accent/30',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
        >
          <Layers size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-mission-control-text m-0">{template.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
              {template.category}
            </span>
            <span className="text-[10px] text-mission-control-text-dim">
              {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <ChevronRight size={14} className="text-mission-control-text-dim flex-shrink-0" />
      </div>
      <p className="text-xs text-mission-control-text-dim m-0 leading-snug">
        {template.description}
      </p>
    </button>
  );
}

// ─── Step preview ─────────────────────────────────────────────────────────────

function StepPreview({ steps }: { steps: TemplateStep[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {steps.map((step, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-mission-control-surface border border-mission-control-border"
        >
          <span className="w-5 h-5 rounded-full bg-mission-control-accent/10 text-mission-control-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-px">
            {i + 1}
          </span>
          <div>
            <div className="text-[13px] font-semibold text-mission-control-text">
              {step.label}
            </div>
            <div className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-mission-control-border/30 text-mission-control-text-dim inline-block mt-0.5">
              {step.type}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AutomationTemplatesGallery({ onClose, onUseTemplate }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');
  const [creating, setCreating] = useState(false);

  const selectedTemplate = BUILT_IN_TEMPLATES.find(t => t.id === selectedId) ?? null;

  const filtered = activeCategory === 'All'
    ? BUILT_IN_TEMPLATES
    : BUILT_IN_TEMPLATES.filter(t => t.category === activeCategory);

  const handleUse = async () => {
    if (!selectedTemplate) return;
    setCreating(true);
    try {
      await onUseTemplate(selectedTemplate);
    } finally {
      setCreating(false);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--black-a5)]"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[90vw] max-w-[900px] max-h-[85vh] bg-mission-control-bg border border-mission-control-border rounded-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-mission-control-border"
        >
          <div>
            <Heading size="5" weight="bold">Automation Templates</Heading>
            <Text size="2" className="text-mission-control-text-dim block mt-0.5">
              Pick a template to get started instantly
            </Text>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-surface transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category filter */}
        <div
          className="flex gap-1.5 px-6 py-3 border-b border-mission-control-border overflow-x-auto"
        >
          {(['All', ...ALL_CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Template list */}
          <div
            className="overflow-y-auto px-6 py-4 grid gap-2.5 content-start transition-[width] duration-200"
            style={{
              width: selectedTemplate ? '55%' : '100%',
              gridTemplateColumns: selectedTemplate ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            }}
          >
            {filtered.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selectedId === template.id}
                onSelect={() => setSelectedId(id => id === template.id ? null : template.id)}
              />
            ))}
          </div>

          {/* Preview panel */}
          {selectedTemplate && (
            <div
              className="w-[45%] border-l border-mission-control-border overflow-y-auto px-6 py-5 flex flex-col gap-4"
            >
              <div>
                <Heading size="3" weight="bold" className="block">{selectedTemplate.name}</Heading>
                <p className="text-xs text-mission-control-text-dim mt-1.5 leading-relaxed mb-0">
                  {selectedTemplate.description}
                </p>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">
                  Trigger
                </div>
                <div className="text-xs text-mission-control-text px-3 py-2.5 rounded-lg bg-mission-control-surface border border-mission-control-border">
                  <span className="font-semibold">{selectedTemplate.trigger_type}</span>
                  {selectedTemplate.trigger_config.event && (
                    <span className="text-mission-control-text-dim"> — {selectedTemplate.trigger_config.event}</span>
                  )}
                  {selectedTemplate.trigger_config.frequency && (
                    <span className="text-mission-control-text-dim"> — {selectedTemplate.trigger_config.frequency} at {selectedTemplate.trigger_config.time}</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-mission-control-text-dim mb-2">
                  Steps ({selectedTemplate.steps.length})
                </div>
                <StepPreview steps={selectedTemplate.steps} />
              </div>

              <Button
                variant="solid"
                size="3"
                onClick={handleUse}
                disabled={creating}
                className="mt-auto w-full"
              >
                {creating ? <Spinner size="1" /> : <Plus size={16} />}
                {creating ? 'Creating...' : 'Use this template'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
