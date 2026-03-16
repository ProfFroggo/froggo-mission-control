import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowLeft, Check, X, Send, CheckCheck, Loader2 } from 'lucide-react';
import XDraftComposer from './XDraftComposer';
import { XImageThumbnails } from './XImageAttachment';
import { scheduleApi, approvalApi } from '../lib/api';
import { showToast } from './Toast';

interface Draft {
  id: string;
  plan_id: string;
  version: string;
  content: string;
  status: string;
  proposed_by: string;
  created_at: number;
  media_paths?: string[];
  type?: string;
}

type PipelineFilter = 'all' | 'ideas' | 'drafts' | 'approved' | 'rejected';

const PIPELINE_FILTERS: { id: PipelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ideas', label: 'Ideas' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

function matchesFilter(draft: Draft, filter: PipelineFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'ideas') return draft.status === 'idea' || draft.type === 'idea';
  if (filter === 'drafts') return draft.status === 'pending' || draft.status === 'draft';
  if (filter === 'approved') return draft.status === 'approved';
  if (filter === 'rejected') return draft.status === 'rejected';
  return true;
}

export default function XDraftListView() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [filter, setFilter] = useState<PipelineFilter>('all');
  const [approvingAll, setApprovingAll] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const allItems = await scheduleApi.getAll();
      const drafts = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'draft' || item.type === 'idea');
      setDrafts(drafts as Draft[]);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success-subtle text-success';
      case 'rejected':
        return 'bg-error-subtle text-error';
      case 'idea':
        return 'bg-info-subtle text-info';
      default:
        return 'bg-warning-subtle text-warning';
    }
  };

  const parseTweets = (content: string): string[] => {
    try {
      const parsed = JSON.parse(content);
      return parsed.tweets || [];
    } catch {
      return [content];
    }
  };

  const getPreviewText = (content: string): string => {
    const tweets = parseTweets(content);
    const first = typeof tweets[0] === 'string' ? tweets[0] : String(tweets[0]);
    return first.slice(0, 140) + (first.length > 140 ? '...' : '');
  };

  const pendingDrafts = drafts.filter(d => d.status === 'pending' || d.status === 'draft');
  const filteredDrafts = drafts.filter(d => matchesFilter(d, filter));

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await approvalApi.respond(id, 'approve');
      await loadDrafts();
      showToast('success', 'Draft approved');
    } catch {
      showToast('error', 'Failed to approve draft');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await approvalApi.respond(id, 'reject');
      await loadDrafts();
      showToast('success', 'Draft rejected');
    } catch {
      showToast('error', 'Failed to reject draft');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingDrafts.length === 0) return;
    setApprovingAll(true);
    let approved = 0;
    for (const draft of pendingDrafts) {
      try {
        await approvalApi.respond(draft.id, 'approve');
        approved++;
      } catch {
        // continue on individual failures
      }
    }
    await loadDrafts();
    setApprovingAll(false);
    showToast('success', `Approved ${approved} draft${approved !== 1 ? 's' : ''}`);
  };

  const handlePromoteToPublish = (draft: Draft) => {
    const tweets = parseTweets(draft.content);
    const first = typeof tweets[0] === 'string' ? tweets[0] : String(tweets[0]);
    // Inject content into publisher via custom event and switch tab
    window.dispatchEvent(new CustomEvent('x-agent-chat-inject', {
      detail: { message: `I want to publish this draft:\n\n${first}` },
    }));
    window.dispatchEvent(new CustomEvent('x-tab-change', { detail: 'publish' }));
    showToast('success', 'Switched to Publish — content sent to agent');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-mission-control-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className="flex flex-col h-full bg-mission-control-bg">
        <div className="p-4 border-b border-mission-control-border">
          <button
            onClick={() => { setShowComposer(false); loadDrafts(); }}
            className="flex items-center gap-2 text-sm text-mission-control-text-dim hover:text-mission-control-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <XDraftComposer />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-mission-control-text">Drafts</h3>
          {drafts.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-mission-control-bg-alt text-mission-control-text-dim rounded-full">
              {drafts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pendingDrafts.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={approvingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-success-subtle text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title={`Approve all ${pendingDrafts.length} pending drafts`}
            >
              {approvingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              Approve all ({pendingDrafts.length})
            </button>
          )}
          <button
            onClick={() => setShowComposer(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-info hover:bg-info/80 text-mission-control-text rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Draft
          </button>
        </div>
      </div>

      {/* Pipeline filter pills */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-mission-control-border overflow-x-auto">
        {PIPELINE_FILTERS.map((f) => {
          const count = f.id === 'all' ? drafts.length : drafts.filter(d => matchesFilter(d, f.id)).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-info text-mission-control-text font-medium'
                  : 'bg-mission-control-bg-alt text-mission-control-text-dim hover:text-mission-control-text border border-mission-control-border'
              }`}
            >
              {f.label}
              {count > 0 && (
                <span className={`text-xs ${filter === f.id ? 'text-mission-control-text/70' : 'text-mission-control-text-dim'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filteredDrafts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-mission-control-text-dim">
            <FileText className="w-12 h-12 mx-auto mb-3 text-mission-control-text-dim" />
            <p className="font-medium text-mission-control-text">
              {filter === 'all' ? 'No drafts yet' : `No ${filter} yet`}
            </p>
            <p className="text-sm mt-1">
              {filter === 'all' ? 'Create a draft to start writing tweets.' : `No drafts match the "${filter}" filter.`}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => setShowComposer(true)}
                className="mt-4 px-4 py-2 text-sm bg-info hover:bg-info/80 text-mission-control-text rounded-lg transition-colors"
              >
                Create your first draft
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredDrafts.map((draft) => {
            const mediaPaths = draft.media_paths || [];
            const previewText = getPreviewText(draft.content);
            const isRejected = draft.status === 'rejected';
            const isPending = draft.status === 'pending' || draft.status === 'draft';
            const isActionLoading = actionLoadingId === draft.id;

            return (
              <div
                key={draft.id}
                className={`bg-mission-control-bg-alt border border-mission-control-border rounded-lg p-4 transition-opacity ${
                  isRejected ? 'opacity-50' : ''
                }`}
              >
                {/* Status + meta row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-1 text-xs bg-success-subtle text-success rounded-full">
                    Version {draft.version}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(draft.status)}`}>
                    {draft.status}
                  </span>
                  {draft.proposed_by && (
                    <span className="text-xs text-mission-control-text-dim">
                      by {draft.proposed_by}
                    </span>
                  )}
                  <span className="text-xs text-mission-control-text-dim ml-auto">
                    {new Date(draft.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Tweet preview */}
                <p className="text-sm text-mission-control-text mb-3 leading-relaxed">
                  {previewText}
                </p>

                {/* Image thumbnails */}
                {mediaPaths.length > 0 && (
                  <XImageThumbnails paths={mediaPaths} />
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-mission-control-border">
                  {/* Promote to Publish */}
                  <button
                    onClick={() => handlePromoteToPublish(draft)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-mission-control-text-dim hover:text-info border border-mission-control-border hover:border-info rounded-lg transition-colors"
                    title="Move to Publish"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish
                  </button>

                  {/* Approve (if pending) */}
                  {isPending && (
                    <button
                      onClick={() => handleApprove(draft.id)}
                      disabled={isActionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-success border border-success/30 hover:bg-success/10 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Approve draft"
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Approve
                    </button>
                  )}

                  {/* Reject */}
                  {!isRejected && (
                    <button
                      onClick={() => handleReject(draft.id)}
                      disabled={isActionLoading}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-error border border-error/30 hover:bg-error/10 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      title="Reject draft"
                    >
                      {isActionLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                      Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
