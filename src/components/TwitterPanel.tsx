import { useState, useEffect } from 'react';
import { Twitter, Send, Heart, MessageCircle, Repeat, BarChart2, RefreshCw, Clock, Check, Edit, Trash2 } from 'lucide-react';
import { gateway } from '../lib/gateway';
import { useStore } from '../store/store';

interface Tweet {
  id: string;
  text: string;
  author: string;
  timestamp: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  url?: string;
}

interface DraftTweet {
  id: string;
  text: string;
  scheduledFor?: string;
  status: 'draft' | 'pending' | 'approved' | 'posted';
}

export default function TwitterPanel() {
  const { connected, addActivity } = useStore();
  const [activeTab, setActiveTab] = useState<'compose' | 'drafts' | 'mentions' | 'analytics'>('compose');
  const [tweetText, setTweetText] = useState('');
  const [drafts, setDrafts] = useState<DraftTweet[]>([
    { id: '1', text: 'GM 🐸\n\nWhat\'s one thing you\'re building this week?', status: 'draft' },
    { id: '2', text: 'Thread: Why your AI agent is probably trash 🧵\n\n1/ Everyone\'s building AI agents rn but most miss the point entirely...', status: 'pending' },
  ]);
  const [mentions, setMentions] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);

  const charCount = tweetText.length;
  const charLimit = 280;

  const fetchMentions = async () => {
    setLoading(true);
    try {
      if (connected) {
        // Ask Froggo to fetch mentions via bird CLI
        const result = await gateway.sendChat(
          '[SYSTEM] Check @Prof_Frogo mentions using bird CLI. ' +
          'Return the recent mentions with author, text, timestamp, and engagement stats. ' +
          'Format as a summary I can review.'
        );
        
        // The response will come through chat, user can see it there
        addActivity({ type: 'task', message: 'Fetched X mentions - check Chat panel', timestamp: Date.now() });
      }
    } catch (e) {
      console.error('Failed to fetch mentions:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCompose = () => {
    if (!tweetText.trim()) return;
    
    const newDraft: DraftTweet = {
      id: `draft-${Date.now()}`,
      text: tweetText,
      status: 'draft',
    };
    setDrafts(prev => [newDraft, ...prev]);
    setTweetText('');
    addActivity({ type: 'task', message: 'Draft tweet saved', timestamp: Date.now() });
  };

  const handlePost = async (draft: DraftTweet) => {
    // Queue for approval instead of posting directly
    const { addApproval } = useStore.getState();
    addApproval({
      type: 'tweet',
      title: `Tweet: ${draft.text.slice(0, 50)}...`,
      content: draft.text,
      context: 'Composed in Twitter panel',
      metadata: { platform: 'X/Twitter' },
    });
    addActivity({ type: 'task', message: `Tweet queued for approval`, timestamp: Date.now() });
    setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'pending' } : d));
  };

  const handleDelete = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.id !== draftId));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Twitter size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">@Prof_Frogo</h1>
              <p className="text-sm text-clawd-text-dim">X/Twitter Management</p>
            </div>
          </div>
          <button
            onClick={fetchMentions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-clawd-border rounded-xl hover:bg-clawd-border/80 transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['compose', 'drafts', 'mentions', 'analytics'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'drafts' && drafts.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                  {drafts.filter(d => d.status !== 'posted').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'compose' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
              <textarea
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                placeholder="What's happening?"
                className="w-full bg-transparent resize-none outline-none text-lg min-h-32"
                maxLength={charLimit}
              />
              <div className="flex items-center justify-between pt-4 border-t border-clawd-border">
                <div className={`text-sm ${charCount > charLimit * 0.9 ? 'text-yellow-500' : 'text-clawd-text-dim'}`}>
                  {charCount}/{charLimit}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCompose}
                    disabled={!tweetText.trim()}
                    className="px-4 py-2 bg-clawd-border text-clawd-text rounded-lg hover:bg-clawd-border/80 disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={() => handlePost({ id: 'new', text: tweetText, status: 'draft' })}
                    disabled={!tweetText.trim() || !connected}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    <Send size={16} /> Post
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">Quick Templates</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'GM 🐸',
                  'Thread: [topic] 🧵',
                  'Hot take: ',
                  'Building in public update:',
                ].map((template, i) => (
                  <button
                    key={i}
                    onClick={() => setTweetText(template)}
                    className="p-3 text-left text-sm bg-clawd-surface rounded-lg border border-clawd-border hover:border-clawd-accent transition-colors"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drafts' && (
          <div className="max-w-xl mx-auto space-y-4">
            {drafts.filter(d => d.status !== 'posted').length === 0 ? (
              <div className="text-center py-12 text-clawd-text-dim">
                <Edit size={48} className="mx-auto mb-4 opacity-30" />
                <p>No drafts</p>
              </div>
            ) : (
              drafts.filter(d => d.status !== 'posted').map((draft) => (
                <div key={draft.id} className="bg-clawd-surface rounded-xl border border-clawd-border p-4">
                  <p className="whitespace-pre-wrap mb-4">{draft.text}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      draft.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                      draft.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                      'bg-clawd-border text-clawd-text-dim'
                    }`}>
                      {draft.status}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTweetText(draft.text)}
                        className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="p-2 hover:bg-clawd-border text-red-400 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button
                        onClick={() => handlePost(draft)}
                        disabled={!connected}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50"
                      >
                        <Send size={14} /> Post
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'mentions' && (
          <div className="max-w-xl mx-auto">
            <div className="text-center py-12 text-clawd-text-dim">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
              <p>Click Refresh to load mentions</p>
              <p className="text-sm mt-2">Uses bird CLI to fetch @Prof_Frogo mentions</p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <BarChart2 size={24} className="mx-auto mb-2 text-blue-400" />
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-clawd-text-dim">Impressions</div>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <Heart size={24} className="mx-auto mb-2 text-red-400" />
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-clawd-text-dim">Likes</div>
              </div>
              <div className="bg-clawd-surface rounded-xl border border-clawd-border p-4 text-center">
                <Repeat size={24} className="mx-auto mb-2 text-green-400" />
                <div className="text-2xl font-bold">--</div>
                <div className="text-sm text-clawd-text-dim">Retweets</div>
              </div>
            </div>
            <div className="text-center py-8 text-clawd-text-dim">
              <p>Analytics integration coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
