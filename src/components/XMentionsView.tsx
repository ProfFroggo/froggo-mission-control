import React, { useState, useEffect } from 'react';

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
      const filters = filter === 'all' ? {} : { replyStatus: filter };
      const result = await window.electron.xMention.list(filters);
      
      if (result.success) {
        setMentions(result.mentions);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading mentions:', error);
      setLoading(false);
    }
  };

  const fetchNewMentions = async () => {
    setFetching(true);
    try {
      const result = await window.electron.xMention.fetch();
      
      if (result.success) {
        await loadMentions();
      }
    } catch (error) {
      console.error('Error fetching mentions:', error);
    } finally {
      setFetching(false);
    }
  };

  const updateStatus = async (id: string, status: 'pending' | 'considering' | 'ignored' | 'replied') => {
    try {
      await window.electron.xMention.update({ id, replyStatus: status });
      await loadMentions();
    } catch (error) {
      console.error('Error updating mention status:', error);
    }
  };

  const saveNotes = async (id: string, noteText: string) => {
    try {
      await window.electron.xMention.update({ id, notes: noteText });
      setNotes({ ...notes, [id]: '' });
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleReply = async (mentionId: string, tweetId: string) => {
    if (!replyText.trim()) return;
    
    try {
      const result = await window.electron.xMention.reply({
        mentionId,
        replyText,
        tweetId,
      });
      
      if (result.success) {
        setReplyText('');
        setSelectedMention(null);
        await loadMentions();
      }
    } catch (error) {
      console.error('Error replying to mention:', error);
    }
  };

  const renderMention = (mention: Mention) => {
    const metadata = mention.metadata ? JSON.parse(mention.metadata) : {};
    const metrics = metadata.public_metrics || {};
    const isSelected = selectedMention === mention.id;
    
    return (
      <div
        key={mention.id}
        className="border-b border-gray-200 p-4 hover:bg-gray-50 transition-colors"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="font-medium text-gray-900">@{mention.author_username}</div>
            <div className="text-sm text-gray-500">{mention.author_name}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-400">
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
        <div className="text-sm text-gray-800 mb-3 whitespace-pre-wrap">{mention.text}</div>

        {/* Metrics */}
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
          {metrics.like_count !== undefined && (
            <div>❤️ {metrics.like_count}</div>
          )}
          {metrics.retweet_count !== undefined && (
            <div>🔄 {metrics.retweet_count}</div>
          )}
          {metrics.reply_count !== undefined && (
            <div>💬 {metrics.reply_count}</div>
          )}
          <a
            href={`https://twitter.com/${mention.author_username}/status/${mention.tweet_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
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
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ⏳ Pending
          </button>
          <button
            onClick={() => updateStatus(mention.id, 'considering')}
            className={`px-2 py-1 text-xs rounded ${
              mention.reply_status === 'considering'
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🤔 Considering
          </button>
          <button
            onClick={() => updateStatus(mention.id, 'ignored')}
            className={`px-2 py-1 text-xs rounded ${
              mention.reply_status === 'ignored'
                ? 'bg-gray-200 text-gray-700 border border-gray-400'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🚫 Ignored
          </button>
          {mention.reply_status === 'replied' && (
            <div className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 border border-green-300">
              ✅ Replied
              {mention.replied_at && (
                <span className="ml-1 text-gray-500">
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
              className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
            />
            <button
              onClick={() => saveNotes(mention.id, notes[mention.id] || '')}
              disabled={!notes[mention.id]?.trim()}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Note
            </button>
          </div>
          {metadata.notes && (
            <div className="mt-1 text-xs text-gray-600 bg-gray-50 p-2 rounded">
              📝 {metadata.notes}
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
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded resize-none"
                  rows={3}
                  maxLength={280}
                />
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    {replyText.length}/280 characters
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedMention(null);
                        setReplyText('');
                      }}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleReply(mention.id, mention.tweet_id)}
                      disabled={!replyText.trim()}
                      className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send Reply
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSelectedMention(mention.id)}
                className="px-3 py-1 text-sm border border-blue-500 text-blue-600 rounded hover:bg-blue-50"
              >
                💬 Reply
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
        <div className="text-gray-500">Loading mentions...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="text-lg font-semibold text-gray-900">X Mentions</div>
        <button
          onClick={fetchNewMentions}
          disabled={fetching}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {fetching ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Fetching...
            </>
          ) : (
            <>🔄 Fetch New</>
          )}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-4 border-b border-gray-200 bg-gray-50">
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
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
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
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="text-4xl mb-2">📭</div>
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
