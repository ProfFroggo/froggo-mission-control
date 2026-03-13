// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Clock, Globe, Bot, Plus, Play, Pause, Trash2, Edit2,
  Search, LayoutGrid, List, ChevronRight, AlertCircle, CheckCircle,
  RefreshCw, Calendar, FileText, MessageSquare, Archive,
} from 'lucide-react';
import AutomationBuilderModal from './AutomationBuilderModal';

// ─── Types ──────────────────────────────────────────────────────────────────

export type AutomationStatus = 'active' | 'paused' | 'draft' | 'error';
export type TriggerType = 'schedule' | 'event' | 'webhook' | 'manual';

export interface AutomationStep {
  id: string;
  type: 'run-agent' | 'post-chat' | 'save-library' | 'send-approval' | 'delay';
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
  icon: any;
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
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AutomationStatus }) {
  const map: Record<AutomationStatus, { label: string; color: string }> = {
    active:  { label: 'Active',  color: 'var(--status-active, #22c55e)' },
    paused:  { label: 'Paused',  color: 'var(--status-paused, #f59e0b)' },
    draft:   { label: 'Draft',   color: 'var(--mission-control-text-dim)' },
    error:   { label: 'Error',   color: 'var(--status-error, #ef4444)' },
  };
  const { label, color } = map[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}

function TriggerIcon({ type }: { type: TriggerType }) {
  const icons: Record<TriggerType, any> = {
    schedule: Clock,
    event:    Zap,
    webhook:  Globe,
    manual:   Bot,
  };
  const Icon = icons[type];
  return (
    <span title={type} style={{ color: 'var(--mission-control-text-dim)' }}>
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
}

function AutomationCard({ automation, onToggle, onDelete, onEdit, onRunNow }: AutomationCardProps) {
  const isActive = automation.status === 'active';

  return (
    <div
      style={{
        background: 'var(--mission-control-surface)',
        border: '1px solid var(--mission-control-border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Top row: name + status + toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <TriggerIcon type={automation.trigger_type} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--mission-control-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {automation.name}
            </span>
            <StatusBadge status={automation.status} />
          </div>
          {automation.description && (
            <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', marginTop: 4, lineHeight: 1.5 }}>
              {automation.description}
            </p>
          )}
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => onToggle(automation.id, automation.status)}
          title={isActive ? 'Pause automation' : 'Activate automation'}
          style={{
            flexShrink: 0,
            width: 36,
            height: 20,
            borderRadius: 10,
            background: isActive ? 'var(--mission-control-accent)' : 'var(--mission-control-border)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: isActive ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>

      {/* Meta row: last run, next run */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)' }}>
          Last run: {formatTime(automation.lastRun)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)' }}>
          Next run: {formatTime(automation.nextRun)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mission-control-text-dim)' }}>
          {automation.steps.length} step{automation.steps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onRunNow(automation.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: 'var(--mission-control-accent)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          <Play size={12} /> Run now
        </button>
        <button
          onClick={() => onEdit(automation)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: 'transparent', color: 'var(--mission-control-text-dim)',
            border: '1px solid var(--mission-control-border)', cursor: 'pointer',
          }}
        >
          <Edit2 size={12} /> Edit
        </button>
        <button
          onClick={() => onDelete(automation.id)}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: 'transparent', color: 'var(--mission-control-text-dim)',
            border: '1px solid var(--mission-control-border)', cursor: 'pointer',
          }}
        >
          <Trash2 size={12} />
        </button>
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
  Content:   '#6366f1',
  Social:    '#ec4899',
  Reporting: '#0ea5e9',
  Tasks:     '#22c55e',
  Alerts:    '#f59e0b',
};

function TemplateCard({ template, onUse }: TemplateCardProps) {
  const Icon = template.icon;
  const color = CATEGORY_COLORS[template.category];
  return (
    <div
      style={{
        background: 'var(--mission-control-surface)',
        border: '1px solid var(--mission-control-border)',
        borderRadius: 12,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 48, height: 48, borderRadius: 12,
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}
      >
        <Icon size={24} />
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--mission-control-text)' }}>
            {template.name}
          </span>
          <span
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              background: `color-mix(in srgb, ${color} 15%, transparent)`, color,
            }}
          >
            {template.category}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mission-control-text-dim)', lineHeight: 1.5 }}>
          {template.description}
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={() => onUse(template)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: 'var(--mission-control-border)',
          color: 'var(--mission-control-text)',
          border: 'none', cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mission-control-accent)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--mission-control-border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--mission-control-text)'; }}
      >
        Use template <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ onNew, onBrowseTemplates }: { onNew: () => void; onBrowseTemplates: () => void }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 20px', gap: 16, textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'color-mix(in srgb, var(--mission-control-accent) 15%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--mission-control-accent)',
        }}
      >
        <Zap size={32} />
      </div>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--mission-control-text)', marginBottom: 6 }}>
          No automations yet
        </h3>
        <p style={{ fontSize: 14, color: 'var(--mission-control-text-dim)', maxWidth: 360 }}>
          Build your first automation below or pick a template to get started in seconds.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--mission-control-accent)', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          <Plus size={16} /> New Automation
        </button>
        <button
          onClick={onBrowseTemplates}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            background: 'var(--mission-control-border)', color: 'var(--mission-control-text)',
            border: 'none', cursor: 'pointer',
          }}
        >
          Browse templates
        </button>
      </div>
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

type ActiveTab = 'my-automations' | 'templates';

export default function AutomationsPanel() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('my-automations');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Automation | null>(null);
  const [prefillTemplate, setPrefillTemplate] = useState<Template | null>(null);

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
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        background: 'var(--mission-control-bg)',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--mission-control-text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={22} style={{ color: 'var(--mission-control-accent)' }} />
            Automations
          </h1>
          <p style={{ fontSize: 13, color: 'var(--mission-control-text-dim)' }}>
            Describe what you want in plain English — the agent builds it for you.
          </p>
        </div>
        <button
          onClick={handleNewAutomation}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: 'var(--mission-control-accent)', color: '#fff', border: 'none',
            cursor: 'pointer', boxShadow: '0 2px 8px color-mix(in srgb, var(--mission-control-accent) 40%, transparent)',
          }}
        >
          <Plus size={16} /> New Automation
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--mission-control-border)', paddingBottom: 0 }}>
        {(['my-automations', 'templates'] as ActiveTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === tab ? 'var(--mission-control-surface)' : 'transparent',
              color: activeTab === tab ? 'var(--mission-control-text)' : 'var(--mission-control-text-dim)',
              borderBottom: activeTab === tab ? '2px solid var(--mission-control-accent)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab === 'my-automations' ? 'My Automations' : 'Templates'}
          </button>
        ))}
      </div>

      {/* My Automations tab */}
      {activeTab === 'my-automations' && (
        <>
          {/* Search + filter bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--mission-control-text-dim)' }} />
              <input
                type="text"
                placeholder="Search automations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 8,
                  border: '1px solid var(--mission-control-border)',
                  background: 'var(--mission-control-surface)',
                  color: 'var(--mission-control-text)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={fetchAutomations}
              title="Refresh"
              style={{
                padding: '8px', borderRadius: 8,
                border: '1px solid var(--mission-control-border)',
                background: 'var(--mission-control-surface)',
                color: 'var(--mission-control-text-dim)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* Automation list or empty state */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--mission-control-text-dim)', gap: 10 }}>
              <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 14 }}>Loading automations...</span>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              onNew={handleNewAutomation}
              onBrowseTemplates={() => setActiveTab('templates')}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(automation => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  onRunNow={handleRunNow}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Templates tab */}
      {activeTab === 'templates' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16,
          }}
        >
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

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
