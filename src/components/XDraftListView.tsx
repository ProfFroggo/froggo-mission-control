import { useState, useEffect } from 'react';
import { FileText, Plus, ArrowLeft } from 'lucide-react';
import XDraftComposer from './XDraftComposer';
import { XImageThumbnails } from './XImageAttachment';
import { scheduleApi } from '../lib/api';

interface Draft {
  id: string;
  plan_id: string;
  version: string;
  content: string;
  status: string;
  proposed_by: string;
  created_at: number;
  media_paths?: string[];
}

export default function XDraftListView() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    try {
      setLoading(true);
      const allItems = await scheduleApi.getAll();
      const drafts = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'draft');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-clawd-bg">
        <div className="w-8 h-8 border-2 border-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showComposer) {
    return (
      <div className="flex flex-col h-full bg-clawd-bg">
        <div className="p-4 border-b border-clawd-border">
          <button
            onClick={() => { setShowComposer(false); loadDrafts(); }}
            className="flex items-center gap-2 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
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
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-clawd-border">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-info" />
          <h3 className="text-lg font-semibold text-clawd-text">Drafts</h3>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Draft
        </button>
      </div>

      {/* List */}
      {drafts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-clawd-text-dim">
            <FileText className="w-12 h-12 mx-auto mb-3 text-clawd-text-dim" />
            <p className="font-medium text-clawd-text">No drafts yet</p>
            <p className="text-sm mt-1">Create a draft to start writing tweets.</p>
            <button
              onClick={() => setShowComposer(true)}
              className="mt-4 px-4 py-2 text-sm bg-info hover:bg-info/80 text-clawd-text rounded-lg transition-colors"
            >
              Create your first draft
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {drafts.map((draft) => {
            const tweets = parseTweets(draft.content);
            const mediaPaths = draft.media_paths || [];

            return (
              <div key={draft.id} className="bg-clawd-bg-alt border border-clawd-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-1 text-xs bg-success-subtle text-success rounded-full">
                    Version {draft.version}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(draft.status)}`}>
                    {draft.status}
                  </span>
                </div>

                {/* Tweet content preview */}
                <div className="space-y-2 mb-2">
                  {tweets.slice(0, 2).map((tweet, idx) => (
                    <div key={idx} className="p-2 bg-clawd-surface rounded border border-clawd-border">
                      <span className="text-xs text-clawd-text-dim">Tweet {idx + 1}:</span>
                      <p className="text-sm text-clawd-text line-clamp-2">
                        {typeof tweet === 'string' ? tweet.slice(0, 140) : String(tweet).slice(0, 140)}
                        {(typeof tweet === 'string' ? tweet : String(tweet)).length > 140 ? '...' : ''}
                      </p>
                    </div>
                  ))}
                  {tweets.length > 2 && (
                    <p className="text-xs text-clawd-text-dim">+{tweets.length - 2} more tweet{tweets.length - 2 > 1 ? 's' : ''}</p>
                  )}
                </div>

                {/* Image thumbnails */}
                {mediaPaths.length > 0 && (
                  <XImageThumbnails paths={mediaPaths} />
                )}

                <p className="text-xs text-clawd-text-dim mt-2">
                  Proposed by {draft.proposed_by} &middot; {new Date(draft.created_at).toLocaleDateString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
