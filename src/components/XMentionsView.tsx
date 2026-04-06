// LEGACY: XMentionsView uses file-level suppression for intentional patterns.
// loadMentions is redefined on each render but captures latest state - safe pattern.
// Review: 2026-02-17 - suppression retained, pattern is safe

import React, { useState, useEffect } from 'react';
import { Heart, Repeat2, MessageCircle, Clock, HelpCircle, Ban, CheckCircle, StickyNote, RefreshCw, Inbox } from 'lucide-react';
import { Button, IconButton, Spinner, TextArea, TextField, Flex } from '@radix-ui/themes';
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
      // Try inbox first (cached mentions)
      const allItems = await inboxApi.getAll();
      const inboxMentions = (Array.isArray(allItems) ? allItems : [])
        .filter((item: any) => item.type === 'x-mention')
        .filter((item: any) => filter === 'all' || item.reply_status === filter);

      if (inboxMentions.length > 0) {
        setMentions(inboxMentions as Mention[]);
        setLoading(false);
        return;
      }

      // No cached mentions — fetch directly from X API
      const res = await fetch('/api/x/mentions');
      if (res.ok) {
        const data = await res.json();
        if (data.mentions?.length > 0) {
          const mapped = data.mentions.map((m: any) => ({
            id: m.id,
            tweet_id: m.id,
            author_id: m.author?.id || m.author_id || '',
            author_username: m.author?.username || 'unknown',
            author_name: m.author?.name || 'Unknown',
            text: m.text || '',
            created_at: m.created_at ? new Date(m.created_at).getTime() : Date.now(),
            conversation_id: m.conversation_id || '',
            in_reply_to_user_id: '',
            reply_status: 'pending' as const,
            fetched_at: Date.now(),
            metadata: JSON.stringify(m.public_metrics || {}),
          }));
          const filtered = filter === 'all' ? mapped : mapped.filter((m: Mention) => m.reply_status === filter);
          setMentions(filtered);
        }
      }
      setLoading(false);
    } catch (err) {
      console.warn('[XMentionsView] Non-critical:', err);
      setLoading(false);
    }
  };

  const fetchNewMentions = async () => {
    setFetching(true);
    try {
      // Fetch real mentions from X API
      const res = await fetch('/api/x/mentions');
      if (res.ok) {
        const data = await res.json();
        if (data.mentions?.length > 0) {
          // Save to inbox as x-mention items
          for (const m of data.mentions) {
            try {
              await inboxApi.create({
                type: 'x-mention',
                tweet_id: m.id,
                author_id: m.author?.id || m.author_id,
                author_username: m.author?.username || 'unknown',
                author_name: m.author?.name || 'Unknown',
                text: m.text,
                created_at: new Date(m.created_at).getTime(),
                conversation_id: m.conversation_id,
                reply_status: 'pending',
                metadata: JSON.stringify(m.public_metrics || {}),
              });
            } catch (err) { console.warn('[XMentionsView] Non-critical: duplicate or DB error — skip:', err); }
          }
        }
      }
      await loadMentions();
    } catch (err) {
      console.warn('[XMentionsView] Non-critical:', err);
      // Error fetching — just reload existing
      await loadMentions();
    } finally {
      setFetching(false);
    }
  };

  const updateStatus = async (id: string, status: 'pending' | 'considering' | 'ignored' | 'replied') => {
    // Optimistic update
    setMentions(prev => prev.map(m => m.id === id ? { ...m, reply_status: status } : m));
    try {
      await inboxApi.update(Number(id), { reply_status: status });
    } catch (err) {
      console.warn('[XMentionsView] Non-critical:', err);
      // Roll back on failure
      await loadMentions();
    }
  };

  const saveNotes = async (id: string, noteText: string) => {
    try {
      await inboxApi.update(Number(id), { notes: noteText });
      setNotes({ ...notes, [id]: noteText });
    } catch (err) {
      console.warn('[XMentionsView] Non-critical:', err);
      // Keep note text in local state even if persist fails
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
    let metadata: any = {};
    try { metadata = typeof mention.metadata === 'string' ? JSON.parse(mention.metadata) : (mention.metadata || {}); } catch { metadata = {}; }
    const metrics = metadata.public_metrics || metadata || {};
    const isSelected = selectedMention === mention.id;
    
    return (
      <div
        key={mention.id}
        className="border-b border-mission-control-border p-4 hover:bg-mission-control-surface transition-colors"
      >
        {/* Header */}
        <Flex align="start" justify="between" className="mb-2">
          <Flex align="center" gap="2">
            <div className="font-medium text-mission-control-text">@{mention.author_username}</div>
            <div className="text-sm text-mission-control-text-dim">{mention.author_name}</div>
          </Flex>
          <Flex align="center" gap="2">
            <div className="text-xs text-mission-control-text-dim">
              {new Date(mention.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </Flex>
        </Flex>

        {/* Tweet text */}
        <div className="text-sm text-mission-control-text mb-3 whitespace-pre-wrap">{mention.text}</div>

        {/* Metrics */}
        <Flex align="center" gap="4" className="text-xs text-mission-control-text-dim mb-3">
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
        </Flex>

        {/* Status badges */}
        <Flex align="center" gap="2" className="mb-3">
          <button
            type="button"
            onClick={() => updateStatus(mention.id, 'pending')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              mention.reply_status === 'pending'
                ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Clock size={12} /> Pending
          </button>
          <button
            type="button"
            onClick={() => updateStatus(mention.id, 'considering')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              mention.reply_status === 'considering'
                ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <HelpCircle size={12} /> Considering
          </button>
          <button
            type="button"
            onClick={() => updateStatus(mention.id, 'ignored')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              mention.reply_status === 'ignored'
                ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
            }`}
          >
            <Ban size={12} /> Ignored
          </button>
          {mention.reply_status === 'replied' && (
            <div className="px-2 py-1 text-xs rounded bg-success/10 text-success border border-success">
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
        </Flex>

        {/* Notes */}
        <div className="mb-3">
          <Flex align="center" gap="2">
            <div className="flex-1">
              <TextField.Root
                value={notes[mention.id] || ''}
                onChange={(e) => setNotes({ ...notes, [mention.id]: e.target.value })}
                placeholder="Add notes..."
                size="1"
              />
            </div>
            <Button
              onClick={() => saveNotes(mention.id, notes[mention.id] || '')}
              disabled={!notes[mention.id]?.trim()}
              variant="soft"
              color="gray"
              size="1"
            >
              Save Note
            </Button>
          </Flex>
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
                <TextArea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your reply..."
                  rows={3}
                  maxLength={280}
                  resize="vertical"
                />
                <Flex align="center" justify="between">
                  <div className="text-xs tabular-nums text-mission-control-text-dim">
                    {replyText.length}/280 characters
                  </div>
                  <Flex gap="2">
                    <Button
                      onClick={() => {
                        setSelectedMention(null);
                        setReplyText('');
                      }}
                      variant="outline"
                      color="gray"
                      size="1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleReply(mention.id, mention.tweet_id)}
                      disabled={!replyText.trim()}
                      variant="solid"
                      color="blue"
                      size="1"
                    >
                      Send Reply
                    </Button>
                  </Flex>
                </Flex>
              </div>
            ) : (
              <Button
                onClick={() => setSelectedMention(mention.id)}
                variant="outline"
                color="blue"
                size="1"
              >
                <MessageCircle size={14} /> Reply
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="3" />
      </div>
    );
  }

  return (
    <Flex direction="column" height="100%" className="bg-mission-control-bg">
      {/* Header */}
      <Flex align="center" justify="between" className="p-4 border-b border-mission-control-border">
        <div className="text-lg font-semibold text-mission-control-text">X Mentions</div>
        <Button
          onClick={fetchNewMentions}
          disabled={fetching}
          variant="solid"
          color="blue"
          size="2"
        >
          {fetching ? (
            <>
              <Spinner size="1" />
              Fetching...
            </>
          ) : (
            <><RefreshCw size={16} /> Fetch New</>
          )}
        </Button>
      </Flex>

      {/* Filter tabs */}
      <Flex gap="2" className="p-4 border-b border-mission-control-border bg-mission-control-surface">
        {(['all', 'pending', 'considering', 'ignored', 'replied'] as const).map((status) => {
          const count = status === 'all'
            ? mentions.length
            : mentions.filter(m => m.reply_status === status).length;

          return (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`flex items-center gap-0.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                filter === status
                  ? 'bg-mission-control-accent/10 border-mission-control-accent/30 text-mission-control-accent'
                  : 'border-mission-control-border text-mission-control-text-dim hover:text-mission-control-text'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          );
        })}
      </Flex>

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
    </Flex>
  );
};
