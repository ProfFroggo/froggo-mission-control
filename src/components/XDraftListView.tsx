import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowLeft, Check, X, Send, CheckCheck } from 'lucide-react';
import { Button, Badge, Spinner, Flex } from '@radix-ui/themes';
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
        <Spinner size="3" />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className="flex flex-col h-full bg-mission-control-bg">
        <div className="p-4 border-b border-mission-control-border">
          <Button
            onClick={() => { setShowComposer(false); loadDrafts(); }}
            variant="ghost"
            color="gray"
            size="2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to list
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <XDraftComposer />
        </div>
      </div>
    );
  }

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
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
            <Button
              onClick={handleBulkApprove}
              disabled={approvingAll}
              variant="solid"
              color="grass"
              size="2"
              title={`Approve all ${pendingDrafts.length} pending drafts`}
            >
              {approvingAll ? <Spinner size="1" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Approve all ({pendingDrafts.length})
            </Button>
          )}
          <Button
            onClick={() => setShowComposer(true)}
            variant="solid"
            color="grass"
            size="2"
          >
            <Plus className="w-4 h-4" />
            New Draft
          </Button>
        </div>
      </div>

      {/* Pipeline filter pills */}
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-mission-control-border overflow-x-auto">
        {PIPELINE_FILTERS.map((f) => {
          const count = f.id === 'all' ? drafts.length : drafts.filter(d => matchesFilter(d, f.id)).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-mission-control-accent/10 text-mission-control-accent'
                  : 'text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40'
              }`}
            >
              {f.label}
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filteredDrafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
          <FileText size={32} className="text-mission-control-text-dim opacity-50" />
          <p className="text-sm font-medium text-mission-control-text">
            {filter === 'all' ? 'No drafts yet' : `No ${filter} yet`}
          </p>
          <p className="text-xs text-mission-control-text-dim max-w-xs">
            {filter === 'all' ? 'Create a draft to start writing tweets.' : `No drafts match the "${filter}" filter.`}
          </p>
          {filter === 'all' && (
            <Button
              onClick={() => setShowComposer(true)}
              variant="solid"
              color="grass"
              size="2"
            >
              Create your first draft
            </Button>
          )}
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
                  <Badge color="blue" variant="soft" radius="full">Version {draft.version}</Badge>
                  <Badge
                    color={
                      draft.status === 'approved' ? 'grass' :
                      draft.status === 'rejected' ? 'red' :
                      draft.status === 'idea' ? 'blue' : 'amber'
                    }
                    variant="soft"
                    radius="full"
                  >
                    {draft.status}
                  </Badge>
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
                  <Button
                    onClick={() => handlePromoteToPublish(draft)}
                    variant="ghost"
                    color="gray"
                    size="1"
                    title="Move to Publish"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Publish
                  </Button>

                  {/* Approve (if pending) */}
                  {isPending && (
                    <Button
                      onClick={() => handleApprove(draft.id)}
                      disabled={isActionLoading}
                      variant="solid"
                      color="grass"
                      size="1"
                      title="Approve draft"
                    >
                      {isActionLoading ? <Spinner size="1" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                  )}

                  {/* Reject */}
                  {!isRejected && (
                    <Button
                      onClick={() => handleReject(draft.id)}
                      disabled={isActionLoading}
                      variant="soft"
                      color="red"
                      size="1"
                      title="Reject draft"
                    >
                      {isActionLoading ? <Spinner size="1" /> : <X className="w-3.5 h-3.5" />}
                      Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Flex>
  );
}
