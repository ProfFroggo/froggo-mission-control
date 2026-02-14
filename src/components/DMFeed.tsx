import React, { useState, useEffect } from 'react';

interface DMMessage {
  id: number;
  correlation_id: string;
  from_agent: string;
  to_agent: string;
  message_type: string;
  subject: string;
  body: string;
  status: string;
  created_at: number;
  read_at: number | null;
}

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
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        if (!(window as any).clawdbot?.getDMHistory) {
          setMessages([]);
          setLoading(false);
          return; // IPC not available (web mode)
        }
        const msgs = await (window as any).clawdbot.getDMHistory({ limit: 50 });
        setMessages(msgs || []);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch DM history:', err);
        setMessages([]);
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-300">Agent Messages</h3>
        <span className="text-xs text-gray-500">{messages.length} messages</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {messages.map(msg => (
          <div key={msg.id} className="p-2 rounded bg-gray-800/50 border border-gray-700/50">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                <span className="text-info font-medium">{msg.from_agent}</span>
                <span className="mx-1">→</span>
                <span className="text-success font-medium">{msg.to_agent}</span>
              </span>
              <span>{formatTimeAgo(msg.created_at)}</span>
            </div>
            <div className="text-sm text-gray-200 mt-1 font-medium">{msg.subject}</div>
            <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{msg.body}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span className={`px-1.5 py-0.5 rounded ${
                msg.message_type === 'request' ? 'bg-yellow-900/30 text-warning' :
                msg.message_type === 'response' ? 'bg-green-900/30 text-success' :
                'bg-blue-900/30 text-info'
              }`}>{msg.message_type}</span>
              <span className={msg.status === 'unread' ? 'text-white font-medium' : ''}>{msg.status}</span>
            </div>
          </div>
        ))}
        {messages.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">No agent messages yet</div>
        )}
        {loading && (
          <div className="text-center text-gray-500 py-8">Loading messages...</div>
        )}
      </div>
    </div>
  );
};

export default DMFeed;
