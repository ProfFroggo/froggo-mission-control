import { useState, useEffect } from 'react';
import { MessageSquare, Search, Filter, RefreshCw, Clock, ArrowRight, ChevronDown, X } from 'lucide-react';
import { useStore } from '../store/store';

type ChannelFilter = 'all' | 'whatsapp' | 'telegram' | 'discord' | 'webchat' | 'agents';

const CHANNELS: { id: ChannelFilter; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: '📋', color: 'text-clawd-text' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'text-green-400' },
  { id: 'telegram', label: 'Telegram', icon: '✈️', color: 'text-blue-400' },
  { id: 'discord', label: 'Discord', icon: '🎮', color: 'text-purple-400' },
  { id: 'webchat', label: 'Webchat', icon: '💻', color: 'text-gray-400' },
  { id: 'agents', label: 'Agents', icon: '🤖', color: 'text-yellow-400' },
];

export default function SessionsFilter() {
  const { sessions, fetchSessions, connected } = useStore();
  const [filter, setFilter] = useState<ChannelFilter>('all');
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (connected) {
      fetchSessions();
      const interval = setInterval(fetchSessions, 30000);
      return () => clearInterval(interval);
    }
  }, [connected, fetchSessions]);

  const getSessionChannel = (session: any): ChannelFilter => {
    const key = session.key || '';
    const channel = session.channel || '';
    
    if (channel === 'whatsapp' || key.includes('whatsapp')) return 'whatsapp';
    if (channel === 'telegram' || key.includes('telegram')) return 'telegram';
    if (channel === 'discord' || key.includes('discord')) return 'discord';
    if (key.includes('subagent') || key.includes('agent') || key.includes('cron')) return 'agents';
    return 'webchat';
  };

  const filteredSessions = sessions.filter((s: any) => {
    // Channel filter
    if (filter !== 'all' && getSessionChannel(s) !== filter) return false;
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const key = (s.key || '').toLowerCase();
      const channel = (s.channel || '').toLowerCase();
      return key.includes(searchLower) || channel.includes(searchLower);
    }
    
    return true;
  });

  const channelCounts = CHANNELS.map(ch => ({
    ...ch,
    count: ch.id === 'all' 
      ? sessions.length 
      : sessions.filter((s: any) => getSessionChannel(s) === ch.id).length
  }));

  const formatTimeAgo = (ts: number) => {
    if (!ts) return 'unknown';
    const diff = Date.now() - ts;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  const getSessionName = (session: any) => {
    const key = session.key || '';
    const parts = key.split(':');
    const last = parts[parts.length - 1];
    if (last.includes('-') && last.length > 20) {
      return last.slice(0, 12) + '...';
    }
    return last || session.channel || 'Unknown';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-clawd-border bg-clawd-surface">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare size={20} />
            Sessions
            <span className="text-sm font-normal text-clawd-text-dim">
              ({filteredSessions.length})
            </span>
          </h2>
          <button
            onClick={fetchSessions}
            className="p-2 hover:bg-clawd-border rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-clawd-text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full bg-clawd-bg border border-clawd-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-clawd-accent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-clawd-text-dim hover:text-clawd-text"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Channel Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {channelCounts.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setFilter(ch.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                filter === ch.id
                  ? 'bg-clawd-accent text-white'
                  : 'bg-clawd-border text-clawd-text-dim hover:text-clawd-text'
              }`}
            >
              <span>{ch.icon}</span>
              <span>{ch.label}</span>
              {ch.count > 0 && (
                <span className={`text-xs px-1.5 rounded-full ${
                  filter === ch.id ? 'bg-white/20' : 'bg-clawd-bg'
                }`}>
                  {ch.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-clawd-text-dim">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-50" />
            <p>{search || filter !== 'all' ? 'No matching sessions' : 'No active sessions'}</p>
          </div>
        ) : (
          <div className="divide-y divide-clawd-border">
            {filteredSessions.map((session: any) => {
              const channel = getSessionChannel(session);
              const channelInfo = CHANNELS.find(c => c.id === channel) || CHANNELS[0];
              const isActive = Date.now() - (session.updatedAt || 0) < 300000;
              
              return (
                <div
                  key={session.key}
                  className="p-4 hover:bg-clawd-bg/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{channelInfo.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-500'}`} />
                        <span className="font-medium truncate">{getSessionName(session)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-clawd-text-dim">
                        <span className={`px-2 py-0.5 rounded-full ${channelInfo.color} bg-clawd-border`}>
                          {channelInfo.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {formatTimeAgo(session.updatedAt)}
                        </span>
                        <span>{(session.totalTokens || 0).toLocaleString()} tokens</span>
                      </div>
                      {session.model && (
                        <div className="text-xs text-clawd-text-dim mt-1 truncate">
                          {session.model.split('/').pop()}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={16} className="text-clawd-text-dim opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
