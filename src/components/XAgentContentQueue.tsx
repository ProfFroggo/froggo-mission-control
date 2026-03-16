// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XAgentContentQueue — "Let agents run your social" panel with agent mode toggle,
// content brief, draft queue, approval workflow, batch approve, and activity log.

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Zap,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  Clock,
  RefreshCw,
  MessageSquare,
  CheckSquare,
  Square,
  Eye,
} from 'lucide-react';
import { showToast } from './Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentModeSettings {
  enabled: boolean;
  brief: string;
  autoApprove: boolean;
}

type DraftStatus = 'pending' | 'approved' | 'rejected';

interface AgentDraft {
  id: string;
  content: string;
  scheduledAt: string;
  topic: string;
  status: DraftStatus;
  feedback?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const X_CHAR_LIMIT = 280;

interface ActivityEntry {
  id: string;
  action: 'Posted' | 'Scheduled' | 'Drafted' | 'Rejected' | 'Approved';
  summary: string;
  timestamp: number;
}

// ─── Mock seed data ───────────────────────────────────────────────────────────

const MOCK_DRAFTS: AgentDraft[] = [
  {
    id: 'ad-1',
    content: 'The most underrated growth lever: making your existing users happier before chasing new ones.',
    scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    topic: 'Growth',
    status: 'pending',
  },
  {
    id: 'ad-2',
    content: 'Thread: 5 activation patterns that reduced our onboarding drop-off by 34% — here is what actually worked.',
    scheduledAt: new Date(Date.now() + 5 * 3_600_000).toISOString(),
    topic: 'Product',
    status: 'pending',
  },
  {
    id: 'ad-3',
    content: 'Data without context is noise. Always pair your metrics with the "so what" for your team.',
    scheduledAt: new Date(Date.now() + 9 * 3_600_000).toISOString(),
    topic: 'Analytics',
    status: 'pending',
  },
  {
    id: 'ad-4',
    content: 'Shipped: real-time analytics pipeline is live. Every user action is now reflected in under 3 seconds.',
    scheduledAt: new Date(Date.now() + 26 * 3_600_000).toISOString(),
    topic: 'Product update',
    status: 'pending',
  },
];

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: 'act-1', action: 'Posted', summary: '"Consistent posting > viral posts. Build the habit first."', timestamp: Date.now() - 18 * 60_000 },
  { id: 'act-2', action: 'Scheduled', summary: 'Thread on retention loops for 2:00 PM today', timestamp: Date.now() - 55 * 60_000 },
  { id: 'act-3', action: 'Drafted', summary: '"Founders who skip documentation are paying a hidden tax."', timestamp: Date.now() - 2 * 3_600_000 },
  { id: 'act-4', action: 'Scheduled', summary: 'Monday morning growth take for 9:00 AM', timestamp: Date.now() - 5 * 3_600_000 },
  { id: 'act-5', action: 'Posted', summary: '"Users don\'t read, they scan. Design for scanners."', timestamp: Date.now() - 8 * 3_600_000 },
  { id: 'act-6', action: 'Drafted', summary: '3-tweet thread on pricing psychology', timestamp: Date.now() - 11 * 3_600_000 },
  { id: 'act-7', action: 'Rejected', summary: '"Hot take: sprints are overrated" — flagged as off-topic', timestamp: Date.now() - 14 * 3_600_000 },
  { id: 'act-8', action: 'Scheduled', summary: 'Weekly metrics recap for Friday 5:00 PM', timestamp: Date.now() - 24 * 3_600_000 },
  { id: 'act-9', action: 'Posted', summary: '"Retention is the new acquisition. Fight me."', timestamp: Date.now() - 28 * 3_600_000 },
  { id: 'act-10', action: 'Drafted', summary: 'Case study: 0-to-1000 users in 60 days', timestamp: Date.now() - 33 * 3_600_000 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatScheduledTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (diffMs < 0) return 'Overdue';
  if (diffMs < 3_600_000) return `in ${Math.floor(diffMs / 60_000)}m`;
  if (diffMs < 86_400_000) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function actionColor(action: ActivityEntry['action']): string {
  switch (action) {
    case 'Posted': return 'var(--color-success)';
    case 'Scheduled': return 'var(--color-info)';
    case 'Drafted': return 'var(--color-warning)';
    case 'Rejected': return 'var(--color-error)';
    case 'Approved': return 'var(--color-success)';
    default: return 'var(--color-info)';
  }
}

// ─── Post Preview ─────────────────────────────────────────────────────────────

interface PostPreviewProps {
  content: string;
}

function PostPreview({ content }: PostPreviewProps) {
  const overLimit = content.length > X_CHAR_LIMIT;
  const remaining = X_CHAR_LIMIT - content.length;

  return (
    <div
      className="p-3 rounded-lg border border-mission-control-border text-sm leading-relaxed bg-mission-control-bg text-mission-control-text"
      style={{
        borderColor: overLimit ? 'var(--color-error)' : undefined,
        fontFamily: 'system-ui, sans-serif',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content || (
        <span className="text-mission-control-text-dim italic">
          Post content will appear here...
        </span>
      )}
      <div
        className={`text-xs mt-2 text-right ${overLimit ? 'text-error' : 'text-mission-control-text-dim'}`}
      >
        {overLimit ? `${Math.abs(remaining)} over limit` : `${remaining} remaining`}
      </div>
    </div>
  );
}

// ─── Draft Card ───────────────────────────────────────────────────────────────

interface DraftCardProps {
  draft: AgentDraft;
  selected: boolean;
  autoApprove: boolean;
  onToggleSelect: () => void;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, feedback: string) => void;
  onReject: (id: string, feedback: string) => void;
  onSchedule: (id: string) => Promise<void>;
}

function DraftCard({
  draft,
  selected,
  autoApprove,
  onToggleSelect,
  onApprove,
  onRequestChanges,
  onReject,
  onSchedule,
}: DraftCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackMode, setFeedbackMode] = useState<'changes' | 'reject'>('changes');
  const [showPreview, setShowPreview] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    if (feedbackMode === 'changes') {
      onRequestChanges(draft.id, feedbackText.trim());
    } else {
      onReject(draft.id, feedbackText.trim());
    }
    setShowFeedback(false);
    setFeedbackText('');
  };

  const handleApproveAndSchedule = async () => {
    onApprove(draft.id);
    setScheduling(true);
    try {
      await onSchedule(draft.id);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-2xl border bg-mission-control-surface ${
        selected ? 'border-info' : 'border-mission-control-border'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {!autoApprove && (
            <button
              onClick={onToggleSelect}
              className="flex-shrink-0"
              aria-label={selected ? 'Deselect draft' : 'Select draft'}
            >
              {selected ? (
                <CheckSquare size={16} className="text-info" />
              ) : (
                <Square size={16} className="text-mission-control-text-dim" />
              )}
            </button>
          )}
          <span className="px-2 py-0.5 text-xs rounded bg-info-subtle text-info">
            {draft.topic}
          </span>
          <span className="text-xs text-mission-control-text-dim">
            {formatScheduledTime(draft.scheduledAt)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1 rounded hover:opacity-70 ${showPreview ? 'text-info' : 'text-mission-control-text-dim'}`}
            title="Toggle preview"
          >
            <Eye size={13} />
          </button>
          <Bot size={14} className="text-mission-control-text-dim flex-shrink-0" />
        </div>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed mb-3 text-mission-control-text">
        {draft.content}
      </p>

      {/* Preview */}
      {showPreview && (
        <div className="mb-3">
          <div className="text-xs font-medium mb-1 text-mission-control-text-dim">
            Post preview
          </div>
          <PostPreview content={draft.content} />
        </div>
      )}

      {/* Actions */}
      {autoApprove ? (
        <span className="text-xs flex items-center gap-1 text-mission-control-text-dim">
          <Zap size={11} className="text-warning" />
          Will auto-approve
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleApproveAndSchedule}
            disabled={scheduling}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-success-subtle text-success transition-opacity disabled:opacity-50"
          >
            <Check size={12} />
            {scheduling ? 'Scheduling...' : 'Approve'}
          </button>
          <button
            onClick={() => { setFeedbackMode('changes'); setShowFeedback(!showFeedback); }}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-warning bg-warning-subtle text-warning transition-opacity hover:opacity-70"
          >
            <MessageSquare size={12} />
            Changes
          </button>
          <button
            onClick={() => { setFeedbackMode('reject'); setShowFeedback(!showFeedback); }}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-error-subtle text-error transition-opacity hover:opacity-70"
          >
            <X size={12} />
            Reject
          </button>
        </div>
      )}

      {/* Feedback field */}
      {showFeedback && (
        <div className="mt-3 space-y-2">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={2}
            placeholder={
              feedbackMode === 'changes'
                ? 'Describe what changes you want...'
                : 'Reason for rejection (optional)...'
            }
            className="w-full px-3 py-2 text-xs border border-mission-control-border rounded-lg resize-none focus:outline-none bg-mission-control-bg text-mission-control-text"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleFeedbackSubmit}
              className={`px-3 py-1.5 text-xs rounded-lg ${
                feedbackMode === 'changes'
                  ? 'bg-warning-subtle text-warning'
                  : 'bg-error-subtle text-error'
              }`}
            >
              {feedbackMode === 'changes' ? 'Send Feedback' : 'Reject Draft'}
            </button>
            <button
              onClick={() => { setShowFeedback(false); setFeedbackText(''); }}
              className="px-3 py-1.5 text-xs rounded-lg bg-mission-control-surface text-mission-control-text-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function XAgentContentQueue() {
  const [settings, setSettings] = useState<AgentModeSettings>({ enabled: false, brief: '', autoApprove: false });
  const [drafts, setDrafts] = useState<AgentDraft[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [briefText, setBriefText] = useState('');
  const [briefContext, setBriefContext] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/x/agent-mode');
      if (res.ok) {
        const data: AgentModeSettings = await res.json();
        setSettings(data);
        setBriefText(data.brief);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  // Load real drafts from schedule API (agent-generated content)
  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/schedule');
      if (res.ok) {
        const items = await res.json();
        const all = Array.isArray(items) ? items : [];
        // Agent-generated drafts: proposed_by contains 'agent' or 'social-manager'
        const agentItems = all.filter((item: any) =>
          (item.platform === 'twitter' || item.platform === 'x') &&
          (item.type === 'draft' || item.type === 'idea')
        );
        const mapped: AgentDraft[] = agentItems.map((item: any) => {
          let meta: any = {};
          try { meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {}); } catch { /* noop */ }
          return {
            id: String(item.id),
            content: item.content || '',
            scheduledAt: item.scheduledFor ? new Date(item.scheduledFor).toISOString() : new Date(Date.now() + 3_600_000).toISOString(),
            topic: meta.topic || meta.content_type || 'General',
            status: item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending',
            feedback: meta.feedback,
          };
        });
        setDrafts(mapped);

        // Build activity from recent schedule events
        const activityEntries: ActivityEntry[] = all
          .filter((item: any) => item.platform === 'twitter' || item.platform === 'x')
          .slice(0, 10)
          .map((item: any) => ({
            id: `act-${item.id}`,
            action: item.status === 'published' ? 'Posted'
              : item.status === 'scheduled' ? 'Scheduled'
              : item.status === 'approved' ? 'Approved'
              : item.status === 'rejected' ? 'Rejected'
              : 'Drafted',
            summary: (item.content || '').slice(0, 80) + ((item.content || '').length > 80 ? '...' : ''),
            timestamp: item.scheduledFor || item.createdAt || Date.now(),
          }));
        setActivity(activityEntries);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadSettings(); loadDrafts(); }, [loadSettings, loadDrafts]);

  const patchSettings = async (updates: Partial<AgentModeSettings>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/x/agent-mode', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data: AgentModeSettings = await res.json();
        setSettings(data);
        setBriefText(data.brief);
        showToast('success', 'Saved', 'Agent settings updated');
      }
    } catch {
      showToast('error', 'Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgentMode = () => {
    patchSettings({ ...settings, enabled: !settings.enabled });
  };

  const handleToggleAutoApprove = () => {
    patchSettings({ ...settings, autoApprove: !settings.autoApprove });
  };

  const handleSaveBrief = () => {
    const combined = briefContext.trim()
      ? `${briefText}\n\n[Additional context]: ${briefContext.trim()}`
      : briefText;
    patchSettings({ ...settings, brief: combined });
  };

  // Schedule an approved draft to the social schedule API
  const scheduleApprovedDraft = async (draftId: string) => {
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    try {
      await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draft.content,
          scheduledAt: draft.scheduledAt,
          platform: 'x',
          status: 'scheduled',
        }),
      });
    } catch {
      // non-fatal — draft is already approved locally
    }
  };

  const handleApprove = (id: string) => {
    setDrafts((prev) =>
      prev.map((d) => d.id === id ? { ...d, status: 'approved' } : d)
    );
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    showToast('success', 'Approved', 'Draft moved to Scheduled');
  };

  const handleRequestChanges = (id: string, feedback: string) => {
    setDrafts((prev) =>
      prev.map((d) => d.id === id ? { ...d, status: 'pending', feedback } : d)
    );
    showToast('info', 'Feedback Sent', 'Changes requested for this draft');
  };

  const handleReject = (id: string, feedback: string) => {
    setDrafts((prev) =>
      prev.map((d) => d.id === id ? { ...d, status: 'rejected', feedback } : d)
    );
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    showToast('info', 'Rejected', 'Draft has been rejected');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchApprove = async () => {
    const ids = Array.from(selectedIds);
    setDrafts((prev) =>
      prev.map((d) => ids.includes(d.id) && d.status === 'pending' ? { ...d, status: 'approved' } : d)
    );
    setSelectedIds(new Set());
    await Promise.allSettled(ids.map(scheduleApprovedDraft));
    showToast('success', 'Batch Approved', `${ids.length} draft${ids.length !== 1 ? 's' : ''} approved and scheduled`);
  };

  const pendingDrafts = drafts.filter((d) => d.status === 'pending');
  const approvedDrafts = drafts.filter((d) => d.status === 'approved');
  const pendingSelectedCount = Array.from(selectedIds).filter((id) =>
    drafts.find((d) => d.id === id && d.status === 'pending')
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <div className="w-6 h-6 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2 mb-1">
          <Bot size={20} className="text-info" />
          <h2 className="text-lg font-semibold text-mission-control-text">Agent Mode</h2>
          <span
            className={`px-2 py-0.5 text-xs rounded-full font-medium ${
              settings.enabled
                ? 'bg-success-subtle text-success'
                : 'bg-mission-control-surface text-mission-control-text-dim'
            }`}
          >
            {settings.enabled ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-sm text-mission-control-text-dim">
          Let agents draft, schedule, and post within your defined limits.
        </p>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-mission-control-border bg-mission-control-surface">
          <div>
            <div className="text-sm font-medium text-mission-control-text mb-0.5">Agent Mode</div>
            <div className="text-xs text-mission-control-text-dim">
              When ON, agents can auto-draft and schedule posts based on your brief.
            </div>
          </div>
          <button
            onClick={handleToggleAgentMode}
            disabled={saving}
            aria-label={settings.enabled ? 'Disable agent mode' : 'Enable agent mode'}
          >
            {settings.enabled ? (
              <ToggleRight size={36} className="text-info" />
            ) : (
              <ToggleLeft size={36} className="text-mission-control-text-dim" />
            )}
          </button>
        </div>

        {/* Content brief */}
        <div>
          <label className="block text-sm font-medium text-mission-control-text mb-2">
            Content Brief
          </label>
          <textarea
            value={briefText}
            onChange={(e) => setBriefText(e.target.value)}
            rows={4}
            placeholder="Describe your brand voice, key topics, posting frequency, and any restrictions the agent should follow..."
            className="w-full px-3 py-2 text-sm border border-mission-control-border rounded-lg resize-none focus:outline-none focus:ring-2 bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim"
            style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
          />
          {/* Additional context / constraints */}
          <div className="mt-2">
            <label className="block text-xs font-medium mb-1 text-mission-control-text-dim">
              Additional context / constraints (added to next generation)
            </label>
            <textarea
              value={briefContext}
              onChange={(e) => setBriefContext(e.target.value)}
              rows={2}
              placeholder="e.g. Focus on product launch this week. Avoid any competitor mentions. Use a conversational tone."
              className="w-full px-3 py-2 text-sm border border-mission-control-border rounded-lg resize-none focus:outline-none bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-mission-control-text-dim">
              Agents reference this brief when generating content.
            </p>
            <button
              onClick={handleSaveBrief}
              disabled={saving || (briefText === settings.brief && !briefContext.trim())}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50 bg-info text-white"
            >
              {saving ? 'Saving...' : 'Save Brief'}
            </button>
          </div>
        </div>

        {/* Auto-approve toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap size={14} className="text-warning" />
              <span className="text-sm font-medium text-mission-control-text">Auto-approve drafts</span>
            </div>
            <p className="text-xs text-mission-control-text-dim">
              Approved drafts go directly to Scheduled without manual review.
            </p>
          </div>
          <button
            onClick={handleToggleAutoApprove}
            disabled={saving}
            aria-label={settings.autoApprove ? 'Disable auto-approve' : 'Enable auto-approve'}
          >
            {settings.autoApprove ? (
              <ToggleRight size={28} className="text-warning" />
            ) : (
              <ToggleLeft size={28} className="text-mission-control-text-dim" />
            )}
          </button>
        </div>

        {settings.autoApprove && (
          <div className="flex items-start gap-2 p-3 rounded-lg text-xs bg-warning-subtle text-warning">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <span>
              Auto-approve is ON — agent drafts will be scheduled without human review. Monitor the activity log regularly.
            </span>
          </div>
        )}

        {/* Agent draft queue */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-mission-control-text-dim" />
              <span className="text-sm font-medium text-mission-control-text">
                Upcoming Drafts
              </span>
              {pendingDrafts.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-info-subtle text-info">
                  {pendingDrafts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingSelectedCount > 0 && (
                <button
                  onClick={handleBatchApprove}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium bg-success-subtle text-success"
                >
                  <CheckSquare size={12} />
                  Approve selected ({pendingSelectedCount})
                </button>
              )}
              <button
                onClick={loadDrafts}
                className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
          </div>

          {pendingDrafts.length === 0 ? (
            <div className="text-center py-8 text-mission-control-text-dim text-sm border border-dashed border-mission-control-border rounded-lg">
              <Bot size={32} className="mx-auto mb-2 opacity-40" />
              No pending drafts
              {!settings.enabled && (
                <div className="text-xs mt-1">Enable Agent Mode to start generating drafts</div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDrafts.map((draft) => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  selected={selectedIds.has(draft.id)}
                  autoApprove={settings.autoApprove}
                  onToggleSelect={() => handleToggleSelect(draft.id)}
                  onApprove={handleApprove}
                  onRequestChanges={handleRequestChanges}
                  onReject={handleReject}
                  onSchedule={scheduleApprovedDraft}
                />
              ))}
            </div>
          )}
        </div>

        {/* Approved queue */}
        {approvedDrafts.length > 0 && (
          <div>
            <div className="text-sm font-medium text-mission-control-text mb-2">
              Scheduled by Agents ({approvedDrafts.length})
            </div>
            <div className="space-y-2">
              {approvedDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-mission-control-border bg-mission-control-bg-alt opacity-75"
                >
                  <Check size={14} className="text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-mission-control-text">{draft.content}</p>
                    <p className="text-xs text-mission-control-text-dim mt-1">{formatScheduledTime(draft.scheduledAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity log */}
        <div>
          <div className="text-sm font-medium text-mission-control-text mb-3">Activity Log</div>
          <div className="space-y-0">
            {activity.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2 text-sm border-b border-mission-control-border last:border-b-0">
                <span
                  className="text-xs font-medium flex-shrink-0 w-16 text-right"
                  style={{ color: actionColor(entry.action) }}
                >
                  {entry.action}
                </span>
                <span className="text-mission-control-text flex-1 leading-relaxed truncate">{entry.summary}</span>
                <span className="text-xs text-mission-control-text-dim flex-shrink-0 w-14 text-right tabular-nums">{relativeTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default XAgentContentQueue;
