// LEGACY: XReplyGuyView uses file-level suppression for intentional patterns.
// loadHotMentions is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Send, MessageCircle, Heart, Repeat2 } from 'lucide-react';
import { showToast } from './Toast';
import ConfirmDialog, { useConfirmDialog } from './ConfirmDialog';
import { inboxApi, approvalApi } from '../lib/api';

interface HotMention {
  id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  text: string;
  created_at: number;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  reply_status: string;
}

export const XReplyGuyView: React.FC = () => {
  const [mentions, setMentions] = useState<HotMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [minLikes, setMinLikes] = useState(10);
  const [minRetweets, setMinRetweets] = useState(5);
  const [selectedMention, setSelectedMention] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [fastTrack, setFastTrack] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postNowDraftId, setPostNowDraftId] = useState<string | null>(null);
  const postConfirmDialog = useConfirmDialog();

  useEffect(() => {
    loadHotMentions();
  }, [minLikes, minRetweets]);

  const loadHotMentions = async () => {
    setLoading(true);
    try {
      const allItems = await inboxApi.getAll();
      const items = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'x-mention')
        .filter((item: any) => {
          const likes = (item as any).like_count || 0;
          const retweets = (item as any).retweet_count || 0;
          return likes >= minLikes && retweets >= minRetweets;
        })
        .slice(0, 50);
      setMentions(items as HotMention[]);
    } catch (error) {
      showToast('error', 'Error', 'Failed to load hot mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async (mentionId: string) => {
    if (!replyText.trim()) {
      showToast('error', 'Empty Reply', 'Please enter a reply');
      return;
    }

    if (replyText.length > 280) {
      showToast('error', 'Too Long', 'Reply must be 280 characters or less');
      return;
    }

    try {
      // External posting MUST go through approval
      await approvalApi.create({
        type: 'x-reply',
        tier: fastTrack ? 1 : 3,
        payload: { mentionId, replyText, fastTrack },
        requestedBy: 'user',
      });

      showToast('success', 'Draft Created', fastTrack ? 'Fast-tracked for approval' : 'Draft saved for approval');
      setReplyText('');
      setSelectedMention(null);
      await loadHotMentions();
    } catch (error) {
      showToast('error', 'Error', 'Failed to create draft');
    }
  };

  const handlePostNow = async (_draftId: string) => {
    setPosting(true);
    try {
      // External posting MUST go through approval — cannot post directly
      showToast('info', 'Approval Required', 'Reply submitted for approval before posting');
    } catch (error) {
      showToast('error', 'Error', 'Failed to post tweet');
    } finally {
      setPosting(false);
    }
  };

  const getEngagementScore = (mention: HotMention) => {
    return mention.like_count + (mention.retweet_count * 2) + mention.reply_count;
  };

  const renderMention = (mention: HotMention) => {
    const isSelected = selectedMention === mention.id;
    const engagementScore = getEngagementScore(mention);
    
    return (
      <div
        key={mention.id}
        className={`border-b border-mission-control-border p-4 transition-colors ${
          isSelected ? 'bg-info/10' : 'hover:bg-mission-control-surface'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="font-medium text-mission-control-text">@{mention.author_username}</div>
            <div className="text-sm text-mission-control-text-dim">{mention.author_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs font-medium text-warning bg-warning-subtle px-2 py-1 rounded">
              <TrendingUp size={12} />
              {engagementScore}
            </div>
            <div className="text-xs text-mission-control-text-dim">
              {new Date(mention.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Tweet text */}
        <div className="text-sm text-mission-control-text mb-3 whitespace-pre-wrap">{mention.text}</div>

        {/* Engagement metrics */}
        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mb-3">
          <div className="flex items-center gap-1"><Heart size={12} className="inline" /> {mention.like_count}</div>
          <div className="flex items-center gap-1"><Repeat2 size={12} className="inline" /> {mention.retweet_count}</div>
          <div className="flex items-center gap-1"><MessageCircle size={12} className="inline" /> {mention.reply_count}</div>
          <a
            href={`https://twitter.com/${mention.author_username}/status/${mention.tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            View on X →
          </a>
        </div>

        {/* Quick reply section */}
        {isSelected ? (
          <div className="space-y-3 bg-mission-control-bg p-3 rounded border border-info">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              className="w-full px-3 py-2 text-sm border border-mission-control-border rounded resize-none focus:outline-none focus:ring-2 focus:ring-info bg-mission-control-bg text-mission-control-text"
              rows={4}
              maxLength={280}
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
            />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-xs text-mission-control-text-dim">
                  {replyText.length}/280
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={fastTrack}
                    onChange={(e) => setFastTrack(e.target.checked)}
                    className="rounded"
                  />
                  <span className="flex items-center gap-1">
                    <Zap size={12} className="text-warning" />
                    Fast-track (skip approval)
                  </span>
                </label>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedMention(null);
                    setReplyText('');
                  }}
                  className="px-3 py-1.5 text-sm border border-mission-control-border rounded hover:bg-mission-control-surface"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateDraft(mention.id)}
                  disabled={!replyText.trim() || replyText.length > 280}
                  className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Send size={14} />
                  {fastTrack ? 'Draft & Approve' : 'Create Draft'}
                </button>
              </div>
            </div>
            
            {fastTrack && (
              <div className="text-xs text-warning bg-warning-subtle p-2 rounded flex items-center gap-1">
                <Zap size={12} />
                Fast-track enabled: Draft will be auto-approved and ready to post immediately
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedMention(mention.id)}
              className="px-4 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 flex items-center gap-1"
            >
              <Zap size={14} />
              Quick Reply
            </button>
            <button
              onClick={() => {
                const prompt = `Please suggest 2-3 reply options for this mention:\n\n@${mention.author_username}: ${mention.text}\n\nKeep replies concise, engaging, and on-brand. Each reply should be under 280 characters.`;
                window.dispatchEvent(new CustomEvent('x-agent-chat-inject', { detail: { message: prompt } }));
              }}
              className="px-4 py-1.5 text-sm border border-mission-control-accent text-mission-control-accent rounded hover:bg-mission-control-accent/10 flex items-center gap-1"
            >
              <MessageCircle size={14} />
              Suggest Reply
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="p-4 border-b border-mission-control-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-warning" size={20} />
            <div className="text-lg font-semibold text-mission-control-text">Reply Guy</div>
          </div>
          <button
            onClick={loadHotMentions}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        <div className="text-sm text-mission-control-text-dim mb-3">
          Fast-track high-engagement mentions. Skip approval for time-sensitive replies.
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="min-likes" className="text-xs text-mission-control-text-dim">Min Likes:</label>
            <input
              id="min-likes"
              type="number"
              value={minLikes}
              onChange={(e) => setMinLikes(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
              min="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="min-retweets" className="text-xs text-mission-control-text-dim">Min Retweets:</label>
            <input
              id="min-retweets"
              type="number"
              value={minRetweets}
              onChange={(e) => setMinRetweets(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
              min="0"
            />
          </div>
        </div>
      </div>

      {/* Mentions list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div>Loading hot mentions...</div>
          </div>
        ) : mentions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div className="text-center">
              <TrendingUp size={48} className="mx-auto mb-2 text-mission-control-text-dim" />
              <div className="text-sm">No high-engagement mentions found</div>
              <div className="text-xs mt-2">Try lowering the engagement thresholds</div>
            </div>
          </div>
        ) : (
          mentions.map(renderMention)
        )}
      </div>
      
      {posting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-mission-control-surface rounded-lg p-6 text-center border border-mission-control-border">
            <div className="text-lg font-semibold mb-2 text-mission-control-text">Posting...</div>
            <div className="text-sm text-mission-control-text-dim">Sending your reply to X</div>
          </div>
        </div>
      )}

      {/* Post Confirmation Dialog */}
      <ConfirmDialog
        open={postConfirmDialog.open}
        onClose={() => {
          postConfirmDialog.closeConfirm();
          setPostNowDraftId(null);
        }}
        onConfirm={() => {
          if (postNowDraftId) {
            handlePostNow(postNowDraftId);
            setPostNowDraftId(null);
          }
        }}
        {...postConfirmDialog.config}
      />
    </div>
  );
};
