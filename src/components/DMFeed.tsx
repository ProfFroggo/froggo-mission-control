import React, { useState, useEffect } from 'react';

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export const DMFeed: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dms' | 'knowledge'>('dms');
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);

  // DM polling (5s)
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        if (!window.clawdbot?.getDMHistory) {
          setMessages([]);
          setLoading(false);
          return;
        }
        const msgs = await window.clawdbot.getDMHistory({ limit: 50 });
        setMessages(msgs || []);
        setLoading(false);
      } catch (err) {
        setMessages([]);
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  // Knowledge polling (30s)
  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        if (!window.clawdbot?.getKnowledgeFeed) {
          setKnowledgeItems([]);
          setKnowledgeLoading(false);
          return;
        }
        const items = await window.clawdbot.getKnowledgeFeed({ limit: 50 });
        setKnowledgeItems(items || []);
        setKnowledgeLoading(false);
      } catch (err) {
        setKnowledgeItems([]);
        setKnowledgeLoading(false);
      }
    };

    fetchKnowledge();
    const interval = setInterval(fetchKnowledge, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Tab header */}
      <div className="flex items-center border-b border-clawd-border">
        <button
          onClick={() => setActiveTab('dms')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'dms'
              ? 'text-info border-b-2 border-info'
              : 'text-clawd-text-dim hover:text-clawd-text'
          }`}
        >
          Agent Messages
          {messages.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-info/20 text-info">
              {messages.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('knowledge')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'knowledge'
              ? 'text-info border-b-2 border-info'
              : 'text-clawd-text-dim hover:text-clawd-text'
          }`}
        >
          Shared Knowledge
          {knowledgeItems.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-info/20 text-info">
              {knowledgeItems.length}
            </span>
          )}
        </button>
      </div>

      {/* DMs tab */}
      {activeTab === 'dms' && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {messages.map(msg => (
            <div key={msg.id} className="p-2 rounded bg-clawd-surface/50 border border-clawd-border/50">
              <div className="flex items-center justify-between text-xs text-clawd-text-dim">
                <span>
                  <span className="text-info font-medium">{msg.from_agent}</span>
                  <span className="mx-1">&rarr;</span>
                  <span className="text-success font-medium">{msg.to_agent}</span>
                </span>
                <span>{formatTimeAgo(msg.created_at)}</span>
              </div>
              <div className="text-sm text-clawd-text mt-1 font-medium">{msg.subject}</div>
              <div className="text-xs text-clawd-text-dim mt-0.5 line-clamp-2">{msg.body}</div>
              <div className="flex items-center gap-2 mt-1 text-xs text-clawd-text-dim">
                <span className={`px-1.5 py-0.5 rounded ${
                  msg.message_type === 'request' ? 'bg-warning-subtle text-warning' :
                  msg.message_type === 'response' ? 'bg-success-subtle text-success' :
                  'bg-info-subtle text-info'
                }`}>{msg.message_type}</span>
                <span className={msg.status === 'unread' ? 'text-white font-medium' : ''}>{msg.status}</span>
              </div>
            </div>
          ))}
          {messages.length === 0 && !loading && (
            <div className="text-center text-clawd-text-dim py-8">No agent messages yet</div>
          )}
          {loading && (
            <div className="text-center text-clawd-text-dim py-8">Loading messages...</div>
          )}
        </div>
      )}

      {/* Knowledge tab */}
      {activeTab === 'knowledge' && (
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {knowledgeItems.map(item => (
            <div key={item.id} className="p-3 rounded bg-clawd-surface/50 border border-clawd-border/50">
              <div className="flex items-center justify-between text-xs text-clawd-text-dim">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.knowledge_type === 'warning' ? 'bg-warning-subtle text-warning' :
                    item.knowledge_type === 'lesson' ? 'bg-success-subtle text-success' :
                    item.knowledge_type === 'pattern' ? 'bg-info-subtle text-info' :
                    'bg-clawd-surface text-clawd-text-dim'
                  }`}>
                    {item.knowledge_type}
                  </span>
                  <span className="text-info font-medium">{item.publisher_agent}</span>
                </div>
                <span>{formatTimeAgo(item.created_at)}</span>
              </div>
              <div className="text-sm text-clawd-text mt-1.5 font-medium">{item.topic}</div>
              <div className="text-xs text-clawd-text-dim mt-1 line-clamp-3">{item.body}</div>
              {item.tags && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(() => {
                    try {
                      const tags = JSON.parse(item.tags);
                      return Array.isArray(tags) ? tags.map((tag: string, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 text-xs rounded bg-clawd-border/50 text-clawd-text-dim">
                          {tag}
                        </span>
                      )) : null;
                    } catch { return null; }
                  })()}
                </div>
              )}
            </div>
          ))}
          {knowledgeItems.length === 0 && !knowledgeLoading && (
            <div className="text-center text-clawd-text-dim py-8">
              <div className="text-lg mb-1">No shared knowledge yet</div>
              <div className="text-xs">Agents publish findings via: froggo-db knowledge-publish</div>
            </div>
          )}
          {knowledgeLoading && (
            <div className="text-center text-clawd-text-dim py-8">Loading knowledge...</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DMFeed;
