'use client';

// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Trash2, CornerDownRight, Send } from 'lucide-react';
import { Button, Spinner, TextArea, Box, Flex } from '@radix-ui/themes';
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
    <Flex gap="3" className={isReply ? 'pl-8' : ''}>
      {isReply && (
        <CornerDownRight size={14} className="text-mission-control-text-dim flex-shrink-0 mt-1" />
      )}
      <Box className="flex-1 min-w-0">
        <Flex align="center" gap="2" mb="1">
          <span className="text-xs font-semibold text-mission-control-text">
            {comment.author}
          </span>
          <span className="text-xs text-mission-control-text-dim">
            {formatDate(comment.createdAt)}
          </span>
        </Flex>
        <p className="text-sm text-mission-control-text whitespace-pre-wrap break-words leading-relaxed">
          {comment.body}
        </p>
        <Flex align="center" gap="3" mt="2">
          {!isReply && (
            <Button
              onClick={() => onReply(comment.id)}
              variant="ghost"
              color="gray"
              size="1"
            >
              Reply
            </Button>
          )}
          <Button
            onClick={() => onDelete(comment.id)}
            variant="ghost"
            color="red"
            size="1"
          >
            <Trash2 size={10} />
            Delete
          </Button>
        </Flex>
      </Box>
    </Flex>
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
    <Flex direction="column" gap="2">
      <TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        resize="none"
      />
      <Flex align="center" gap="2" justify="end">
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="ghost"
            color="gray"
            size="2"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!text.trim() || saving}
          size="2"
        >
          {saving ? <Spinner size="1" /> : <Send size={12} />}
          {parentId ? 'Reply' : 'Post'}
        </Button>
      </Flex>
    </Flex>
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
      <Flex align="center" justify="center" py="9">
        <Spinner size="3" />
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Box p="6" className="flex-1 overflow-y-auto space-y-5">
        {topLevel.length === 0 && (
          <Flex direction="column" align="center" justify="center" height="100%" py="9" gap="3" className="text-center">
            <MessageSquare size={32} className="text-mission-control-text-dim opacity-40" />
            <p className="text-sm font-medium text-mission-control-text">No comments yet</p>
            <p className="text-xs text-mission-control-text-dim">
              Be the first to leave a comment on this campaign.
            </p>
          </Flex>
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
      </Box>

      <Box p="4" className="border-t border-mission-control-border">
        <CommentComposer
          campaignId={campaignId}
          placeholder="Add a comment… (Cmd+Enter to post)"
          onSubmit={load}
        />
      </Box>
    </Flex>
  );
}
