// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// XAgentContentQueue — "Let agents run your social" panel with agent mode toggle,
// content brief, draft queue, and activity log.

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
}

interface ActivityEntry {
  id: string;
  action: 'Posted' | 'Scheduled' | 'Drafted' | 'Rejected';
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
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function XAgentContentQueue() {
  const [settings, setSettings] = useState<AgentModeSettings>({ enabled: false, brief: '', autoApprove: false });
  const [drafts, setDrafts] = useState<AgentDraft[]>(MOCK_DRAFTS);
  const [activity] = useState<ActivityEntry[]>(MOCK_ACTIVITY);
  const [briefText, setBriefText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { loadSettings(); }, [loadSettings]);

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
    patchSettings({ ...settings, brief: briefText });
  };

  const handleDraftAction = (id: string, action: 'approve' | 'reject') => {
    setDrafts(prev =>
      prev.map(d => {
        if (d.id !== id) return d;
        const newStatus: DraftStatus = action === 'approve' ? 'approved' : 'rejected';
        return { ...d, status: newStatus };
      })
    );
    showToast(
      action === 'approve' ? 'success' : 'info',
      action === 'approve' ? 'Approved' : 'Rejected',
      action === 'approve' ? 'Draft moved to Scheduled' : 'Draft rejected and removed from queue'
    );
  };

  const pendingDrafts = drafts.filter(d => d.status === 'pending');
  const approvedDrafts = drafts.filter(d => d.status === 'approved');

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
          <Bot size={20} style={{ color: 'var(--color-info)' }} />
          <h2 className="text-lg font-semibold text-mission-control-text">Agent Mode</h2>
          <span
            className="px-2 py-0.5 text-xs rounded-full font-medium"
            style={
              settings.enabled
                ? { background: 'var(--color-success-subtle)', color: 'var(--color-success)' }
                : { background: 'var(--color-mission-control-surface)', color: 'var(--color-mission-control-text-dim)' }
            }
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
              <ToggleRight size={36} style={{ color: 'var(--color-info)' }} />
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
            onChange={e => setBriefText(e.target.value)}
            rows={5}
            placeholder="Describe your brand voice, key topics, posting frequency, and any restrictions the agent should follow..."
            className="w-full px-3 py-2 text-sm border border-mission-control-border rounded-lg resize-none focus:outline-none focus:ring-2 bg-mission-control-bg text-mission-control-text placeholder:text-mission-control-text-dim"
            style={{ '--tw-ring-color': 'var(--color-info)' } as React.CSSProperties}
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-mission-control-text-dim">
              Agents reference this brief when generating content.
            </p>
            <button
              onClick={handleSaveBrief}
              disabled={saving || briefText === settings.brief}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-info)', color: '#fff' }}
            >
              {saving ? 'Saving...' : 'Save Brief'}
            </button>
          </div>
        </div>

        {/* Auto-approve toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-mission-control-border bg-mission-control-surface">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap size={14} style={{ color: 'var(--color-warning)' }} />
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
              <ToggleRight size={28} style={{ color: 'var(--color-warning)' }} />
            ) : (
              <ToggleLeft size={28} className="text-mission-control-text-dim" />
            )}
          </button>
        </div>

        {settings.autoApprove && (
          <div
            className="flex items-start gap-2 p-3 rounded-lg text-xs"
            style={{ background: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}
          >
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
                <span
                  className="px-2 py-0.5 text-xs rounded-full font-medium"
                  style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
                >
                  {pendingDrafts.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setDrafts(MOCK_DRAFTS)}
              className="flex items-center gap-1 text-xs text-mission-control-text-dim hover:text-mission-control-text"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
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
              {pendingDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="p-3 rounded-lg border border-mission-control-border bg-mission-control-surface"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 text-xs rounded"
                        style={{ background: 'var(--color-info-subtle)', color: 'var(--color-info)' }}
                      >
                        {draft.topic}
                      </span>
                      <span className="text-xs text-mission-control-text-dim">
                        {formatScheduledTime(draft.scheduledAt)}
                      </span>
                    </div>
                    <Bot size={14} className="flex-shrink-0 text-mission-control-text-dim" />
                  </div>
                  <p className="text-sm text-mission-control-text mb-3 leading-relaxed">
                    {draft.content}
                  </p>
                  <div className="flex items-center gap-2">
                    {settings.autoApprove ? (
                      <span className="text-xs text-mission-control-text-dim flex items-center gap-1">
                        <Zap size={11} style={{ color: 'var(--color-warning)' }} />
                        Will auto-approve
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDraftAction(draft.id, 'approve')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors"
                          style={{ background: 'var(--color-success-subtle)', color: 'var(--color-success)' }}
                        >
                          <Check size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => handleDraftAction(draft.id, 'reject')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors"
                          style={{ background: 'var(--color-error-subtle)', color: 'var(--color-error)' }}
                        >
                          <X size={12} />
                          Reject
                        </button>
                        <button
                          onClick={() => {
                            const msg = `Review this agent-generated draft and suggest improvements:\n\n"${draft.content}"\n\nScheduled for: ${formatScheduledTime(draft.scheduledAt)}\nTopic: ${draft.topic}`;
                            window.dispatchEvent(new CustomEvent('x-agent-chat-inject', { detail: { message: msg } }));
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-mission-control-border hover:bg-mission-control-bg-alt transition-colors text-mission-control-text-dim"
                        >
                          Review
                        </button>
                      </>
                    )}
                  </div>
                </div>
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
              {approvedDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-mission-control-border bg-mission-control-bg-alt opacity-75"
                >
                  <Check size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} className="mt-0.5" />
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
          <div className="space-y-1">
            {activity.map(entry => (
              <div key={entry.id} className="flex items-start gap-3 py-1.5 text-sm">
                <span
                  className="text-xs font-medium flex-shrink-0 w-16 text-right"
                  style={{ color: actionColor(entry.action) }}
                >
                  {entry.action}
                </span>
                <span className="text-mission-control-text flex-1 leading-relaxed">{entry.summary}</span>
                <span className="text-xs text-mission-control-text-dim flex-shrink-0">{relativeTime(entry.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default XAgentContentQueue;
