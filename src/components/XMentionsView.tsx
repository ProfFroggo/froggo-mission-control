// LEGACY: XMentionsView uses file-level suppression for intentional patterns.
// loadMentions is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import React, { useState, useEffect } from 'react';
import { Heart, Repeat2, MessageCircle, Clock, HelpCircle, Ban, CheckCircle, StickyNote, RefreshCw, Inbox } from 'lucide-react';
import { inboxApi, approvalApi } from '../lib/api';

interface Mention {
  id: string;
  tweet_id: string;
  author_id: string;
  author_username: string;
  author_name: string;
  text: string;
  created_at: number;
  conversation_id: string;
  in_reply_to_user_id: string;
  reply_status: 'pending' | 'considering' | 'ignored' | 'replied';
  replied_at?: number;
  replied_with_id?: string;
  fetched_at: number;
  metadata: any;
}

export const XMentionsView: React.FC = () => {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'considering' | 'ignored' | 'replied'>('all');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedMention, setSelectedMention] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMentions();
  }, [filter]);

  const loadMentions = async () => {
    try {
      const allItems = await inboxApi.getAll();
      const items = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'x-mention')
        .filter((item: any) => filter === 'all' || item.status === filter);
      setMentions(items as Mention[]);
      setLoading(false);
    } catch (error) {
      // 'Error loading mentions:', error;
      setLoading(false);
    }
  };

  const fetchNewMentions = async () => {
    setFetching(true);
    try {
      // Fetch is server-side — just reload from inbox
      await loadMentions();
    } catch (error) {
      // 'Error fetching mentions:', error;
    } finally {
      setFetching(false);
    }
  };

  const updateStatus = async (id: string, status: 'pending' | 'considering' | 'ignored' | 'replied') => {
    try {
      // Stub: status updates not available via REST inbox API
      setMentions(prev => prev.map(m => m.id === id ? { ...m, reply_status: status } : m));
    } catch (error) {
      // 'Error updating mention status:', error;
    }
  };

  const saveNotes = async (id: string, noteText: string) => {
    try {
      // Stub: notes not available via REST inbox API — update local state only
      setNotes({ ...notes, [id]: '' });
    } catch (error) {
      // 'Error saving notes:', error;
    }
  };

  const handleReply = async (mentionId: string, tweetId: string) => {
    if (!replyText.trim()) return;

    try {
      // External posting MUST go through approval
      await approvalApi.create({
        type: 'x-reply',
        tier: 3,
        payload: { mentionId, tweetId, replyText },
        requestedBy: 'user',
      });
      setReplyText('');
      setSelectedMention(null);
      await loadMentions();
    } catch (error) {
      // 'Error replying to mention:', error;
    }
  };

  const renderMention = (mention: Mention) => {
    const metadata = mention.metadata ? JSON.parse(mention.metadata) : {};
    const metrics = metadata.public_metrics || {};
    const isSelected = selectedMention === mention.id;
    
    return (
      <div
        key={mention.id}
        className="border-b border-mission-control-border p-4 hover:bg-mission-control-surface transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="font-medium text-mission-control-text">@{mention.author_username}</div>
            <div className="text-sm text-mission-control-text-dim">{mention.author_name}</div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs text-mission-control-text-dim mb-3">
          {metrics.like_count !== undefined && (
            <div><Heart size={12} className="inline" /> {metrics.like_count}</div>
          )}
          {metrics.retweet_count !== undefined && (
            <div><Repeat2 size={12} className="inline" /> {metrics.retweet_count}</div>
          )}
          {metrics.reply_count !== undefined && (
            <div><MessageCircle size={12} className="inline" /> {metrics.reply_count}</div>
          )}
          <a
            href={`https://twitter.com/${mention.author_username}/status/${mention.tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-info hover:underline"
          >
            View on X →
          </a>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => updateStatus(mention.id, 'pending')}
            className={`px-2 py-1 text-xs rounded ${
              mention.reply_status === 'pending'
                ? 'bg-warning-subtle text-warning border border-warning'
                : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80'
            }`}
          >
            <Clock size={12} className="inline" /> Pending
          </button>
          <button
            onClick={() => updateStatus(mention.id, 'considering')}
            className={`px-2 py-1 text-xs rounded ${
              mention.reply_status === 'considering'
                ? 'bg-info-subtle text-info border border-info'
                : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80'
            }`}
          >
            <HelpCircle size={12} className="inline" /> Considering
          </button>
          <button
            onClick={() => updateStatus(mention.id, 'ignored')}
            className={`px-2 py-1 text-xs rounded ${
              mention.reply_status === 'ignored'
                ? 'bg-mission-control-surface text-mission-control-text border border-mission-control-border'
                : 'bg-mission-control-surface text-mission-control-text-dim hover:bg-mission-control-surface/80'
            }`}
          >
            <Ban size={12} className="inline" /> Ignored
          </button>
          {mention.reply_status === 'replied' && (
            <div className="px-2 py-1 text-xs rounded bg-success-subtle text-success border border-success">
              <CheckCircle size={12} className="inline" /> Replied
              {mention.replied_at && (
                <span className="ml-1 text-mission-control-text-dim">
                  {new Date(mention.replied_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={notes[mention.id] || ''}
              onChange={(e) => setNotes({ ...notes, [mention.id]: e.target.value })}
              placeholder="Add notes..."
              className="flex-1 px-2 py-1 text-sm border border-mission-control-border rounded bg-mission-control-bg text-mission-control-text"
            />
            <button
              onClick={() => saveNotes(mention.id, notes[mention.id] || '')}
              disabled={!notes[mention.id]?.trim()}
              className="px-3 py-1 text-sm bg-mission-control-surface text-mission-control-text rounded hover:bg-mission-control-surface/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>
          {metadata.notes && (
            <div className="mt-1 text-xs text-mission-control-text-dim bg-mission-control-surface p-2 rounded">
              <StickyNote size={12} className="inline" /> {metadata.notes}
            </div>
          )}
        </div>

        {/* Reply section */}
        {mention.reply_status !== 'replied' && mention.reply_status !== 'ignored' && (
          <div>
            {isSelected ? (
              <div className="space-y-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  className="w-full px-3 py-2 text-sm border border-mission-control-border rounded resize-none bg-mission-control-bg text-mission-control-text"
                  rows={3}
                  maxLength={280}
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-mission-control-text-dim">
                    {replyText.length}/280 characters
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedMention(null);
                        setReplyText('');
                      }}
                      className="px-3 py-1 text-sm border border-mission-control-border rounded hover:bg-mission-control-surface"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReply(mention.id, mention.tweet_id)}
                      disabled={!replyText.trim()}
                      className="px-3 py-1 text-sm bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSelectedMention(mention.id)}
                className="px-3 py-1 text-sm border border-info text-info rounded hover:bg-info-subtle"
              >
                <MessageCircle size={14} className="inline" /> Reply
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-mission-control-text-dim">Loading mentions...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-mission-control-bg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mission-control-border">
        <div className="text-lg font-semibold text-mission-control-text">X Mentions</div>
        <button
          onClick={fetchNewMentions}
          disabled={fetching}
          className="px-4 py-2 bg-info text-white rounded hover:bg-info/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {fetching ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Fetching...
            </>
          ) : (
            <><RefreshCw size={16} className="inline" /> Fetch New</>
          )}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-4 border-b border-mission-control-border bg-mission-control-surface">
        {(['all', 'pending', 'considering', 'ignored', 'replied'] as const).map((status) => {
          const count = status === 'all' 
            ? mentions.length 
            : mentions.filter(m => m.reply_status === status).length;
          
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                filter === status
                  ? 'bg-info text-white'
                  : 'bg-mission-control-bg text-mission-control-text hover:bg-mission-control-surface border border-mission-control-border'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {/* Mentions list */}
      <div className="flex-1 overflow-y-auto">
        {mentions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-mission-control-text-dim">
            <div className="text-center">
              <div className="mb-2 flex justify-center"><Inbox size={48} className="text-mission-control-text-dim" /></div>
              <div>No mentions found</div>
              <div className="text-sm mt-2">Click &quot;Fetch New&quot; to check for mentions</div>
            </div>
          </div>
        ) : (
          mentions.map(renderMention)
        )}
      </div>
    </div>
  );
};
