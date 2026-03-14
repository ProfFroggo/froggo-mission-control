// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
'use client';
import { useState } from 'react';
import { X, ChevronRight, Plus, Layers } from 'lucide-react';

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
];

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  Workflow:     '#6366f1',
  Notification: '#f59e0b',
  AI:           '#8b5cf6',
  Data:         '#0ea5e9',
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
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '16px',
        borderRadius: 10,
        border: `2px solid ${selected ? 'var(--mission-control-accent)' : 'var(--mission-control-border)'}`,
        background: selected
          ? 'color-mix(in srgb, var(--mission-control-accent) 8%, var(--mission-control-surface))'
          : 'var(--mission-control-surface)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          <Layers size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mission-control-text)' }}>{template.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                color,
                background: `color-mix(in srgb, ${color} 15%, transparent)`,
              }}
            >
              {template.category}
            </span>
            <span style={{ fontSize: 10, color: 'var(--mission-control-text-dim)' }}>
              {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <ChevronRight size={14} style={{ color: 'var(--mission-control-text-dim)', flexShrink: 0 }} />
      </div>
      <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', margin: 0, lineHeight: 1.5 }}>
        {template.description}
      </p>
    </button>
  );
}

// ─── Step preview ─────────────────────────────────────────────────────────────

function StepPreview({ steps }: { steps: TemplateStep[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--mission-control-bg)',
            border: '1px solid var(--mission-control-border)',
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 20,
              height: 20,
              borderRadius: 5,
              background: 'var(--mission-control-accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i + 1}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mission-control-text)' }}>
              {step.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--mission-control-text-dim)', marginTop: 1 }}>
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '90vw',
          maxWidth: 900,
          maxHeight: '85vh',
          background: 'var(--mission-control-bg)',
          border: '1px solid var(--mission-control-border)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--mission-control-text)', margin: 0 }}>
              Automation Templates
            </h2>
            <p style={{ fontSize: 13, color: 'var(--mission-control-text-dim)', margin: '2px 0 0' }}>
              Pick a template to get started instantly
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--mission-control-text-dim)',
              display: 'flex',
              alignItems: 'center',
              padding: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Category filter */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '12px 24px',
            borderBottom: '1px solid var(--mission-control-border)',
            overflowX: 'auto',
          }}
        >
          {(['All', ...ALL_CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '5px 14px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: activeCategory === cat ? 'var(--mission-control-accent)' : 'var(--mission-control-border)',
                background: activeCategory === cat ? 'var(--mission-control-accent)' : 'transparent',
                color: activeCategory === cat ? '#fff' : 'var(--mission-control-text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Template list */}
          <div
            style={{
              width: selectedTemplate ? '55%' : '100%',
              overflowY: 'auto',
              padding: '16px 24px',
              display: 'grid',
              gridTemplateColumns: selectedTemplate ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
              alignContent: 'start',
              transition: 'width 0.2s',
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
              style={{
                width: '45%',
                borderLeft: '1px solid var(--mission-control-border)',
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--mission-control-text)', margin: 0 }}>
                  {selectedTemplate.name}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', margin: '6px 0 0', lineHeight: 1.6 }}>
                  {selectedTemplate.description}
                </p>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mission-control-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Trigger
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--mission-control-surface)',
                    border: '1px solid var(--mission-control-border)',
                    fontSize: 12,
                    color: 'var(--mission-control-text)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{selectedTemplate.trigger_type}</span>
                  {selectedTemplate.trigger_config.event && (
                    <span style={{ color: 'var(--mission-control-text-dim)' }}> — {selectedTemplate.trigger_config.event}</span>
                  )}
                  {selectedTemplate.trigger_config.frequency && (
                    <span style={{ color: 'var(--mission-control-text-dim)' }}> — {selectedTemplate.trigger_config.frequency} at {selectedTemplate.trigger_config.time}</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mission-control-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Steps ({selectedTemplate.steps.length})
                </div>
                <StepPreview steps={selectedTemplate.steps} />
              </div>

              <button
                onClick={handleUse}
                disabled={creating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: creating ? 'var(--mission-control-border)' : 'var(--mission-control-accent)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? 'not-allowed' : 'pointer',
                  marginTop: 'auto',
                }}
              >
                <Plus size={16} />
                {creating ? 'Creating...' : 'Use this template'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
