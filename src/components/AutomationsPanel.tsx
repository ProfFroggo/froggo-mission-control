// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback, type ComponentType } from 'react';
import {
  Zap, Clock, Globe, Bot, Plus, Play, Trash2, Edit2,
  Search, LayoutGrid, ChevronRight, AlertCircle, CheckCircle,
  RefreshCw, FileText, MessageSquare, Archive, Layers, List, History,
  Users, BarChart2,
} from 'lucide-react';
import { Button, IconButton, TextField, Switch, Flex } from '@radix-ui/themes';
import TabNav, { type TabNavItem } from './TabNav';
import AutomationBuilderModal from './AutomationBuilderModal';
import AutomationStepBuilder, { type AutomationStepDef } from './AutomationStepBuilder';
import AutomationRunLog from './AutomationRunLog';
import AutomationTemplatesGallery, { type AutomationTemplate } from './AutomationTemplatesGallery';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutomationStatus = 'active' | 'paused' | 'draft' | 'error';
export type TriggerType = 'schedule' | 'event' | 'webhook' | 'manual';

export interface AutomationStep {
  id: string;
  type: 'run-agent' | 'post-chat' | 'save-library' | 'send-approval' | 'delay' | 'create-task';
  label: string;
  config: Record<string, unknown>;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  steps: AutomationStep[];
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
  updatedAt: number;
}

// ─── Template definitions ────────────────────────────────────────────────────

type TemplateCategory = 'Content' | 'Social' | 'Reporting' | 'Tasks' | 'Alerts';

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: ComponentType<any>;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  steps: Omit<AutomationStep, 'id'>[];
}

const TEMPLATES: Template[] = [
  {
    id: 'tpl-daily-brief',
    name: 'Daily Content Brief',
    description: 'Every morning at 8am, agent researches trending topics and posts a brief to the team chat room.',
    category: 'Content',
    icon: FileText,
    trigger_type: 'schedule',
    trigger_config: { time: '08:00', frequency: 'daily' },
    steps: [
      { type: 'run-agent', label: 'Researcher: find trending topics in niche', config: { agentRole: 'researcher', prompt: 'Research trending topics in our niche and summarize top 5' } },
      { type: 'post-chat', label: 'Post summary to team chat room', config: { room: 'general' } },
    ],
  },
  {
    id: 'tpl-weekly-report',
    name: 'Weekly Performance Report',
    description: 'Every Monday, generates a performance summary of last week\'s tasks.',
    category: 'Reporting',
    icon: LayoutGrid,
    trigger_type: 'schedule',
    trigger_config: { time: '09:00', frequency: 'weekly', dayOfWeek: 'monday' },
    steps: [
      { type: 'run-agent', label: 'Analytics: query task metrics', config: { agentRole: 'analytics', prompt: 'Summarize last week task completion rate and blockers' } },
      { type: 'save-library', label: 'Save markdown report to library', config: { folder: 'reports' } },
    ],
  },
  {
    id: 'tpl-auto-approve',
    name: 'Auto-approve safe posts',
    description: 'When a social post is created by Writer agent, auto-approve if it meets quality criteria.',
    category: 'Social',
    icon: CheckCircle,
    trigger_type: 'event',
    trigger_config: { event: 'approval.created' },
    steps: [
      { type: 'run-agent', label: 'Check: no profanity, under 280 chars, has hashtags', config: { agentRole: 'reviewer', prompt: 'Validate post quality: no profanity, ≤280 chars, has hashtags' } },
      { type: 'send-approval', label: 'Auto-approve or escalate to human', config: { autoApprove: true, escalateOnFail: true } },
    ],
  },
  {
    id: 'tpl-task-notify',
    name: 'New task notification',
    description: 'When a task is created and assigned to an agent, post to the relevant chat room.',
    category: 'Tasks',
    icon: MessageSquare,
    trigger_type: 'event',
    trigger_config: { event: 'task.created' },
    steps: [
      { type: 'post-chat', label: 'Post notification to agent\'s room', config: { room: 'dynamic', template: 'New task assigned: {{title}}' } },
    ],
  },
  {
    id: 'tpl-overdue-alert',
    name: 'Overdue task alert',
    description: 'Daily check for tasks past their due date; notify in chat.',
    category: 'Alerts',
    icon: AlertCircle,
    trigger_type: 'schedule',
    trigger_config: { time: '17:00', frequency: 'daily' },
    steps: [
      { type: 'run-agent', label: 'Query overdue tasks', config: { agentRole: 'analytics', prompt: 'Find all tasks past due date' } },
      { type: 'post-chat', label: 'Post alert to ops chat room', config: { room: 'ops' } },
    ],
  },
  {
    id: 'tpl-content-recycler',
    name: 'Content recycler',
    description: 'Weekly, find best-performing old content and suggest refreshing it.',
    category: 'Content',
    icon: Archive,
    trigger_type: 'schedule',
    trigger_config: { time: '10:00', frequency: 'weekly', dayOfWeek: 'friday' },
    steps: [
      { type: 'run-agent', label: 'Researcher: analyze past content performance', config: { agentRole: 'researcher', prompt: 'Find top 3 pieces of content worth recycling based on engagement' } },
      { type: 'post-chat', label: 'Suggest top 3 to recycle', config: { room: 'content' } },
    ],
  },
  {
    id: 'tpl-hr-training',
    name: 'Daily Agent Training',
    description: 'HR reviews each active agent, writes per-agent training logs to hr/training/, creates tasks for every action item identified.',
    category: 'Tasks',
    icon: Users,
    trigger_type: 'schedule',
    trigger_config: { time: '02:00', frequency: 'daily' },
    steps: [
      { type: 'create-task', label: 'Create training task for HR', config: {
        title: 'HR: Daily Agent Training Session — {date}',
        assignTo: 'hr', priority: 'p2',
        planningNotes: 'For EACH active agent: read SOUL.md, check task history, read Clara patterns, assess strengths/gaps, write training log. Save per-agent logs to ~/mission-control/library/docs/hr/training/{id}_training-log_{date}.md. CREATE TASKS for every action item identified.',
        subtasks: 'Review and train: clara\nReview and train: coder\nReview and train: designer\nReview and train: social-manager\nReview and train: growth-director\nReview and train: qa-engineer\nReview and train: security\nReview and train: inbox\nReview and train: mission-control\nReview and train: senior-coder\nCreate tasks for all action items\nSubmit training logs and mark complete',
      } },
    ],
  },
  {
    id: 'tpl-hr-report',
    name: 'Daily Team Health Report',
    description: 'HR compiles team health report with agent stats, highlights, concerns. Saves to hr/reports/.',
    category: 'Reporting',
    icon: BarChart2,
    trigger_type: 'schedule',
    trigger_config: { time: '23:30', frequency: 'daily' },
    steps: [
      { type: 'create-task', label: 'Create report task for HR', config: {
        title: 'HR: Daily Team Health Report — {date}',
        assignTo: 'hr', priority: 'p2',
        planningNotes: 'Compile team health report: check all agent task stats, read today training logs from hr/training/, read Clara patterns, identify top performer + most improved, flag concerns. Save to ~/mission-control/library/docs/hr/reports/{date}_team-health-report.md',
        subtasks: 'Gather task statistics for all agents\nRead training logs and Clara patterns\nWrite team health report to hr/reports/\nSubmit report and mark complete',
      } },
    ],
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AutomationStatus }) {
  const map: Record<AutomationStatus, { label: string; className: string }> = {
    active:  { label: 'Active',  className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-subtle text-success text-xs font-medium' },
    paused:  { label: 'Paused',  className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning-subtle text-warning text-xs font-medium' },
    draft:   { label: 'Draft',   className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-mission-control-border text-mission-control-text-dim text-xs font-medium' },
    error:   { label: 'Error',   className: 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error-subtle text-error text-xs font-medium' },
  };
  const { label, className } = map[status];
  return (
    <span className={className}>
      <span className="w-1.5 h-1.5 rounded-full bg-current inline-block flex-shrink-0" />
      {label}
    </span>
  );
}

function TriggerIcon({ type }: { type: TriggerType }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons: Record<TriggerType, ComponentType<any>> = {
    schedule: Clock,
    event:    Zap,
    webhook:  Globe,
    manual:   Bot,
  };
  const Icon = icons[type];
  return (
    <span title={type} className="text-mission-control-text-dim">
      <Icon size={14} />
    </span>
  );
}

function formatTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Automation card ─────────────────────────────────────────────────────────

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string, status: AutomationStatus) => void;
  onDelete: (id: string) => void;
  onEdit: (automation: Automation) => void;
  onRunNow: (id: string) => void;
  onOpenStepBuilder: (automation: Automation) => void;
  onOpenRunLog: (automation: Automation) => void;
}

function AutomationCard({ automation, onToggle, onDelete, onEdit, onRunNow, onOpenStepBuilder, onOpenRunLog }: AutomationCardProps) {
  const isActive = automation.status === 'active';

  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl px-5 py-4 flex flex-col gap-3">
      {/* Top row: name + status + toggle */}
      <Flex align="start" gap="3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TriggerIcon type={automation.trigger_type} />
            <span className="font-semibold text-sm text-mission-control-text overflow-hidden text-ellipsis whitespace-nowrap">
              {automation.name}
            </span>
            <StatusBadge status={automation.status} />
          </div>
          {automation.description && (
            <p className="text-xs text-mission-control-text-dim mt-1 leading-relaxed">
              {automation.description}
            </p>
          )}
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={() => onToggle(automation.id, automation.status)}
          title={isActive ? 'Pause automation' : 'Activate automation'}
          aria-label={isActive ? 'Pause automation' : 'Activate automation'}
        />
      </Flex>

      {/* Meta row: last run, next run */}
      <div className="flex gap-4 flex-wrap">
        <span className="text-xs text-mission-control-text-dim tabular-nums">
          Last run: {formatTime(automation.lastRun)}
        </span>
        <span className="text-xs text-mission-control-text-dim tabular-nums">
          Next run: {formatTime(automation.nextRun)}
        </span>
        <span className="text-xs text-mission-control-text-dim tabular-nums">
          {automation.steps.length} step{automation.steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action row */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="1" variant="solid" onClick={() => onRunNow(automation.id)}>
          <Play size={12} /> Run now
        </Button>
        <Button size="1" variant="ghost" color="gray" onClick={() => onEdit(automation)}>
          <Edit2 size={12} /> Edit
        </Button>
        <Button size="1" variant="ghost" color="gray" onClick={() => onOpenStepBuilder(automation)}>
          <List size={12} /> Steps
        </Button>
        <Button size="1" variant="ghost" color="gray" onClick={() => onOpenRunLog(automation)}>
          <History size={12} /> History
        </Button>
        <IconButton
          size="1"
          variant="ghost"
          color="red"
         
          onClick={() => onDelete(automation.id)}
          title="Delete automation"
          aria-label="Delete automation"
          className="ml-auto"
        >
          <Trash2 size={12} />
        </IconButton>
      </div>
    </div>
  );
}

// ─── Template card ───────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
}

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  Content:   'var(--review)',
  Social:    'var(--danger)',
  Reporting: 'var(--info)',
  Tasks:     'var(--success)',
  Alerts:    'var(--warning)',
};

function TemplateCard({ template, onUse }: TemplateCardProps) {
  const Icon: ComponentType<any> = template.icon; // eslint-disable-line @typescript-eslint/no-explicit-any
  const color = CATEGORY_COLORS[template.category];
  return (
    <div className="bg-mission-control-surface border border-mission-control-border rounded-xl p-5 flex flex-col gap-3">
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
      >
        <Icon size={24} />
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-sm text-mission-control-text">
            {template.name}
          </span>
          <span
            className="text-[11px] font-bold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
          >
            {template.category}
          </span>
        </div>
        <p className="text-xs text-mission-control-text-dim leading-relaxed">
          {template.description}
        </p>
      </div>

      {/* CTA */}
      <Button onClick={() => onUse(template)} size="2" variant="soft" className="w-full justify-center">
        Use template <ChevronRight size={14} />
      </Button>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onNew, onBrowseTemplates }: { onNew: () => void; onBrowseTemplates: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-5 gap-4 text-center min-h-[300px]">
      <div className="w-16 h-16 rounded-2xl bg-mission-control-accent/15 flex items-center justify-center text-mission-control-accent">
        <Zap size={32} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-mission-control-text mb-1.5">No automations yet</h3>
        <p className="text-sm text-mission-control-text-dim max-w-sm">
          Build your first automation below or pick a template to get started in seconds.
        </p>
      </div>
      <Flex gap="3">
        <Button onClick={onNew} size="2" variant="solid">
          <Plus size={16} /> New Automation
        </Button>
        <Button onClick={onBrowseTemplates} size="2" variant="soft">
          Browse templates
        </Button>
      </Flex>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

type ActiveTab = 'my-automations' | 'templates';

const AUTOMATION_TABS: TabNavItem[] = [
  { id: 'my-automations', label: 'My Automations', icon: Zap    },
  { id: 'templates',      label: 'Templates',      icon: Layers },
];

export default function AutomationsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('my-automations');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Automation | null>(null);
  const [prefillTemplate, setPrefillTemplate] = useState<Template | null>(null);
  // New v2 drawers
  const [stepBuilderTarget, setStepBuilderTarget] = useState<Automation | null>(null);
  const [runLogTarget, setRunLogTarget] = useState<Automation | null>(null);
  const [templatesGalleryOpen, setTemplatesGalleryOpen] = useState(false);

  const fetchAutomations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/automations');
      if (res.ok) {
        const data = await res.json();
        setAutomations(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const handleToggle = async (id: string, currentStatus: AutomationStatus) => {
    const newStatus: AutomationStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/automations?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setAutomations(prev =>
        prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
      );
    } catch {
      // silent fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    try {
      await fetch(`/api/automations?id=${id}`, { method: 'DELETE' });
      setAutomations(prev => prev.filter(a => a.id !== id));
    } catch {
      // silent fail
    }
  };

  const handleRunNow = async (id: string) => {
    // Stub — would POST to a run endpoint in production
    try {
      await fetch(`/api/automations?id=${id}&action=run`, { method: 'POST' });
    } catch {
      // silent fail
    }
  };

  const handleEdit = (automation: Automation) => {
    setEditTarget(automation);
    setPrefillTemplate(null);
    setBuilderOpen(true);
  };

  const handleNewAutomation = () => {
    setEditTarget(null);
    setPrefillTemplate(null);
    setBuilderOpen(true);
  };

  const handleUseTemplate = (template: Template) => {
    setEditTarget(null);
    setPrefillTemplate(template);
    setActiveTab('my-automations');
    setBuilderOpen(true);
  };

  const handleUseGalleryTemplate = (template: AutomationTemplate) => {
    // Open builder modal pre-filled with gallery template data
    setEditTarget(null);
    setPrefillTemplate({
      id: template.id,
      name: template.name,
      description: template.description,
      category: 'Tasks' as const,
      icon: Layers,
      trigger_type: template.trigger_type as TriggerType,
      trigger_config: template.trigger_config as Record<string, unknown>,
      steps: template.steps.map((s, i) => ({
        id: `step-${i + 1}`,
        type: s.type as AutomationStep['type'],
        label: s.label,
        config: s.config as Record<string, unknown>,
      })),
    });
    setTemplatesGalleryOpen(false);
    setActiveTab('my-automations');
    setBuilderOpen(true);
  };

  const handleSaveAutomation = async (automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editTarget) {
        const res = await fetch(`/api/automations?id=${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(automation),
        });
        if (res.ok) {
          const updated = await res.json();
          setAutomations(prev => prev.map(a => a.id === editTarget.id ? updated : a));
        }
      } else {
        const res = await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(automation),
        });
        if (res.ok) {
          const created = await res.json();
          setAutomations(prev => [created, ...prev]);
        }
      }
    } catch {
      // silent fail
    }
    setBuilderOpen(false);
    setEditTarget(null);
    setPrefillTemplate(null);
  };

  const filtered = automations.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Flex direction="column" gap="5" height="100%" className="overflow-auto bg-mission-control-bg">
      {/* Header + Tabs */}
      <div className="border-b border-mission-control-border bg-mission-control-surface">
        {/* Header */}
        <Flex align="center" justify="between" className="px-6 py-4">
          <Flex align="center" gap="3">
            <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
              <Zap size={24} className="text-mission-control-accent" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-mission-control-text">Automations</h1>
              <p className="text-sm text-mission-control-text-dim">
                Describe what you want in plain English — the agent builds it for you.
              </p>
            </div>
          </Flex>
          <Flex gap="2">
            <Button onClick={() => setTemplatesGalleryOpen(true)} size="2" variant="soft">
              <Layers size={16} /> From Template
            </Button>
            <Button onClick={handleNewAutomation} size="2" variant="solid">
              <Plus size={16} /> New Automation
            </Button>
          </Flex>
        </Flex>

        {/* Tabs */}
        <div className="border-t border-mission-control-border">
          <TabNav
            tabs={AUTOMATION_TABS}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as ActiveTab)}
            paddingX="px-6"
          />
        </div>
      </div>

      {/* My Automations tab content */}
      <div className="px-8 flex flex-col gap-6">
      {/* My Automations tab */}
      {activeTab === 'my-automations' && (
        <>
          {/* Search + filter bar */}
          <Flex gap="3" align="center">
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mission-control-text-dim pointer-events-none z-[1]" />
              <TextField.Root
                placeholder="Search automations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                size="2"
                className="pl-8"
              />
            </div>
            <IconButton onClick={fetchAutomations} title="Refresh" aria-label="Refresh automations" size="2" variant="ghost">
              <RefreshCw size={14} />
            </IconButton>
          </Flex>

          {/* Automation list or empty state */}
          {loading ? (
            <Flex align="center" justify="center" gap="3" className="py-16 text-mission-control-text-dim">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Loading automations...</span>
            </Flex>
          ) : filtered.length === 0 ? (
            <EmptyState
              onNew={handleNewAutomation}
              onBrowseTemplates={() => setActiveTab('templates')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(automation => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onRunNow={handleRunNow}
                  onOpenStepBuilder={a => setStepBuilderTarget(a)}
                  onOpenRunLog={a => setRunLogTarget(a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={handleUseTemplate}
            />
          ))}
        </div>
      )}

      {/* Builder modal */}
      {builderOpen && (
        <AutomationBuilderModal
          onClose={() => {
            setBuilderOpen(false);
            setEditTarget(null);
            setPrefillTemplate(null);
          }}
          onSave={handleSaveAutomation}
          editTarget={editTarget}
          prefillTemplate={prefillTemplate ? {
            name: prefillTemplate.name,
            description: prefillTemplate.description,
            trigger_type: prefillTemplate.trigger_type,
            trigger_config: prefillTemplate.trigger_config,
            steps: prefillTemplate.steps.map((s, i) => ({ ...s, id: `step-${i + 1}` })),
          } : null}
        />
      )}

      {/* Step Builder drawer */}
      {stepBuilderTarget && (
        <AutomationStepBuilder
          automationId={stepBuilderTarget.id}
          initialSteps={(stepBuilderTarget.steps ?? []) as unknown as AutomationStepDef[]}
          onClose={() => setStepBuilderTarget(null)}
          onSaved={fetchAutomations}
        />
      )}

      {/* Run Log drawer */}
      {runLogTarget && (
        <AutomationRunLog
          automationId={runLogTarget.id}
          automationName={runLogTarget.name}
          onClose={() => setRunLogTarget(null)}
        />
      )}

      {/* Templates Gallery modal */}
      {templatesGalleryOpen && (
        <AutomationTemplatesGallery
          onClose={() => setTemplatesGalleryOpen(false)}
          onUseTemplate={handleUseGalleryTemplate}
        />
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </Flex>
  );
}
