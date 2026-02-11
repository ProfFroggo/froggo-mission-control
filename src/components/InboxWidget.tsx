import { useEffect, useState } from 'react';
import { Inbox, AlertCircle } from 'lucide-react';

interface InboxItem {
  id: string;
  status: string;
  createdAt: number;
}

export default function InboxWidget() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).clawdbot?.inbox?.list();
      if (result?.success && Array.isArray(result.items)) {
        // Count pending/unread items
        const pending = result.items.filter(
          (item: InboxItem) => item.status === 'pending'
        );
        setUnreadCount(pending.length);
      } else {
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('[InboxWidget] Load error:', err);
      setError('Failed to load');
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInbox();
    // Refresh every 30 seconds
    const interval = setInterval(loadInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && unreadCount === 0) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 w-8 bg-clawd-border/50 rounded-full mb-4" />
        <div className="h-12 bg-clawd-border/50 rounded mb-2" />
        <div className="h-4 bg-clawd-border/50 rounded w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Inbox 
          size={28} 
          className={unreadCount > 0 ? 'text-blue-400' : 'text-clawd-text-dim'} 
        />
        {unreadCount > 0 && (
          <span className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-full animate-pulse shadow-lg">
            {unreadCount}
          </span>
        )}
      </div>
      
      <div className="text-5xl font-bold mb-2 bg-gradient-to-br from-clawd-text to-blue-400 bg-clip-text text-transparent">
        {unreadCount}
      </div>
      
      <div className="text-sm font-medium text-clawd-text-dim mb-3">
        Unread Inbox
      </div>
      
      {unreadCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-blue-400 font-medium">
          <Inbox size={14} />
          Needs attention
        </div>
      )}
      
      {unreadCount === 0 && (
        <div className="text-xs text-green-400">
          All caught up!
        </div>
      )}
    </div>
  );
}
