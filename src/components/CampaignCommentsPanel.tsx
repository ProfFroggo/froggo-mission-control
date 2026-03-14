'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, CornerDownRight, Send } from 'lucide-react';
import { Spinner } from './LoadingStates';
import { showToast } from './Toast';

interface Comment {
  id: string;
  campaignId: string;
  author: string;
  body: string;
  parentId: string | null;
  createdAt: string;
}

interface CampaignCommentsPanelProps {
  campaignId: string;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ── Single comment row ────────────────────────────────────────────────────────
function CommentRow({
  comment,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: Comment;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  isReply?: boolean;
}) {
  return (
    <div className={`flex gap-3 ${isReply ? 'pl-8' : ''}`}>
      {isReply && (
        <CornerDownRight size={14} className="text-mission-control-text-dim flex-shrink-0 mt-1" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-mission-control-text-primary">
            {comment.author}
          </span>
          <span className="text-[10px] text-mission-control-text-dim">
            {formatDate(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-mission-control-text-primary whitespace-pre-wrap break-words leading-relaxed">
          {comment.body}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          {!isReply && (
            <button
              onClick={() => onReply(comment.id)}
              className="text-[11px] text-mission-control-text-dim hover:text-mission-control-accent transition-colors"
            >
              Reply
            </button>
          )}
          <button
            onClick={() => onDelete(comment.id)}
            className="text-[11px] text-mission-control-text-dim hover:text-mission-control-error transition-colors flex items-center gap-1"
          >
            <Trash2 size={10} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Comment composer ──────────────────────────────────────────────────────────
function CommentComposer({
  campaignId,
  parentId,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment\u2026',
  autoFocus = false,
}: {
  campaignId: string;
  parentId?: string;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed, parentId: parentId ?? null }),
      });
      if (!res.ok) throw new Error('Failed');
      setText('');
      onSubmit();
    } catch {
      showToast('Failed to post comment', 'error');
    } finally {
      setSaving(false);
    }
  }, [text, campaignId, parentId, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="w-full px-3 py-2 text-sm bg-mission-control-surface border border-mission-control-border rounded-lg text-mission-control-text-primary placeholder-mission-control-text-dim resize-none focus:outline-none focus:border-mission-control-accent transition-colors"
      />
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-mission-control-text-dim hover:text-mission-control-text-primary transition-colors px-2 py-1"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--mission-control-accent)', color: '#fff' }}
        >
          {saving ? <Spinner size={12} /> : <Send size={12} />}
          {parentId ? 'Reply' : 'Post'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CampaignCommentsPanel({ campaignId }: CampaignCommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/comments`);
      const data = await res.json();
      if (data.success) setComments(data.comments);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/comments/${commentId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed');
        setComments(prev => prev.filter(c => c.id !== commentId));
        showToast('Comment deleted', 'success');
      } catch {
        showToast('Failed to delete comment', 'error');
      }
    },
    [campaignId]
  );

  // Build threaded structure
  const topLevel = comments.filter(c => !c.parentId);
  const repliesMap: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (c.parentId) {
      if (!repliesMap[c.parentId]) repliesMap[c.parentId] = [];
      repliesMap[c.parentId].push(c);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {topLevel.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <MessageSquare size={28} className="text-mission-control-text-dim" />
            <p className="text-sm text-mission-control-text-dim">No comments yet.</p>
            <p className="text-xs text-mission-control-text-dim">
              Be the first to leave a comment on this campaign.
            </p>
          </div>
        )}

        {topLevel.map(comment => (
          <div key={comment.id} className="space-y-3">
            <CommentRow
              comment={comment}
              onReply={id => setReplyingTo(replyingTo === id ? null : id)}
              onDelete={handleDelete}
            />

            {(repliesMap[comment.id] ?? []).map(reply => (
              <CommentRow
                key={reply.id}
                comment={reply}
                onReply={() => setReplyingTo(comment.id)}
                onDelete={handleDelete}
                isReply
              />
            ))}

            {replyingTo === comment.id && (
              <div className="pl-8">
                <CommentComposer
                  campaignId={campaignId}
                  parentId={comment.id}
                  placeholder={`Replying to ${comment.author}\u2026`}
                  autoFocus
                  onSubmit={() => {
                    setReplyingTo(null);
                    load();
                  }}
                  onCancel={() => setReplyingTo(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-mission-control-border p-4">
        <CommentComposer
          campaignId={campaignId}
          placeholder="Add a comment\u2026 (Cmd+Enter to post)"
          onSubmit={load}
        />
      </div>
    </div>
  );
}
