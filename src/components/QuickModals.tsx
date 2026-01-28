import { useState, useEffect } from 'react';
import { X, Calendar, Mail, MessageSquare, RefreshCw, ExternalLink, Clock, MapPin, Users, AlertCircle } from 'lucide-react';

// X logo component
const XLogo = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Calendar Modal
export function CalendarModal({ isOpen, onClose }: ModalProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).clawdbot?.calendar?.events('kevin.macarthur@bitso.com', 3);
      if (result?.success && result.events?.events) {
        setEvents(result.events.events.map((e: any) => ({
          id: e.id,
          title: e.summary || 'Untitled',
          start: e.start?.dateTime || e.start?.date || '',
          end: e.end?.dateTime || e.end?.date || '',
          location: e.location || '',
          isAllDay: !!e.start?.date && !e.start?.dateTime,
        })));
      }
    } catch (e) {
      setError('Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchEvents();
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatTime = (iso: string, isAllDay?: boolean) => {
    if (isAllDay) return 'All day';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  // Group by date
  const grouped = events.reduce((acc, e) => {
    const key = formatDate(e.start);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar size={20} className="text-blue-400" />
            Calendar - Next 3 Days
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchEvents} className="p-2 hover:bg-clawd-border rounded-lg" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-clawd-text-dim">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">No events</div>
          ) : (
            Object.entries(grouped).map(([date, dateEvents]) => (
              <div key={date}>
                <div className="px-4 py-2 text-xs font-medium text-clawd-text-dim bg-clawd-bg/50">{date}</div>
                {(dateEvents as any[]).map((event: any) => (
                  <div key={event.id} className="p-4 border-b border-clawd-border/50 hover:bg-clawd-bg/30">
                    <div className="font-medium">{event.title}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-clawd-text-dim">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTime(event.start, event.isAllDay)}
                        {event.end && !event.isAllDay && ` - ${formatTime(event.end)}`}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Email Modal
export function EmailModal({ isOpen, onClose }: ModalProps) {
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ACCOUNTS = [
    { email: 'kevin.macarthur@bitso.com', label: 'Bitso' },
    { email: 'kevin@carbium.io', label: 'Carbium' },
  ];

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);
    try {
      const allEmails: any[] = [];
      for (const acc of ACCOUNTS) {
        const result = await (window as any).clawdbot?.email?.unread(acc.email);
        const threads = result?.emails?.threads || result?.emails || [];
        threads.slice(0, 5).forEach((t: any) => {
          allEmails.push({
            id: t.id,
            from: t.from || t.messages?.[0]?.from || 'Unknown',
            subject: t.subject || t.messages?.[0]?.subject || 'No subject',
            snippet: t.snippet || '',
            date: t.date || t.internalDate,
            account: acc.label,
          });
        });
      }
      setEmails(allEmails);
    } catch (e) {
      setError('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchEmails();
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Mail size={20} className="text-green-400" />
            Unread Emails
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchEmails} className="p-2 hover:bg-clawd-border rounded-lg" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-clawd-text-dim">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : emails.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">No unread emails</div>
          ) : (
            emails.map((email) => (
              <div key={email.id} className="p-4 border-b border-clawd-border/50 hover:bg-clawd-bg/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-1.5 py-0.5 bg-clawd-border rounded">{email.account}</span>
                  <span className="text-xs text-clawd-text-dim truncate">{email.from}</span>
                </div>
                <div className="font-medium truncate">{email.subject}</div>
                <div className="text-xs text-clawd-text-dim truncate mt-1">{email.snippet}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// X Mentions Modal
export function MentionsModal({ isOpen, onClose }: ModalProps) {
  const [mentions, setMentions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMentions = async () => {
    setLoading(true);
    setError(null);
    try {
      const clawdbot = (window as any).clawdbot;
      if (!clawdbot?.twitter?.mentions) {
        setError('X API not available');
        setLoading(false);
        return;
      }
      
      const result = await clawdbot.twitter.mentions();
      console.log('[Mentions] Result:', result);
      
      if (result?.success) {
        // Handle both JSON and raw output from bird CLI
        let data = result.mentions || [];
        if (!Array.isArray(data)) data = [];
        
        if (data.length === 0 && result.raw) {
          // Parse raw text output if JSON failed
          const lines = (result.raw || '').split('\n').filter((l: string) => l && l.trim());
          data = lines.map((line: string, i: number) => ({ id: i, text: line }));
        }
        
        setMentions(data);
      } else {
        setError(result?.error || 'Could not load mentions');
      }
    } catch (e: any) {
      console.error('[Mentions] Error:', e);
      setError(e?.message || 'Failed to load mentions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchMentions();
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <XLogo size={20} className="text-white" />
            X Mentions
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchMentions} className="p-2 hover:bg-clawd-border rounded-lg" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-clawd-text-dim">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-clawd-text-dim">
              <AlertCircle size={24} className="mx-auto mb-2 text-yellow-400" />
              <p>{error}</p>
              <p className="text-xs mt-2">X API may need setup</p>
            </div>
          ) : mentions.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">No recent mentions</div>
          ) : (
            mentions.map((tweet: any, i) => (
              <div key={tweet.id || i} className="p-4 border-b border-clawd-border/50 hover:bg-clawd-bg/30">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">@{tweet.author?.username || tweet.author || tweet.user?.screen_name || 'unknown'}</span>
                  {tweet.author?.name && <span className="text-xs text-clawd-text-dim">({tweet.author.name})</span>}
                </div>
                <div className="text-sm">{tweet.text || tweet.full_text}</div>
                {tweet.createdAt && <div className="text-xs text-clawd-text-dim mt-1">{tweet.createdAt}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Platform icon component
function PlatformIcon({ platform }: { platform: string }) {
  switch (platform) {
    case 'whatsapp':
      return (
        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">W</span>
      );
    case 'telegram':
      return (
        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">T</span>
      );
    case 'discord':
      return (
        <span className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">D</span>
      );
    default:
      return <MessageSquare size={16} className="text-clawd-text-dim" />;
  }
}

// Messages Modal
export function MessagesModal({ isOpen, onClose }: ModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await (window as any).clawdbot?.messages?.recent(10);
      if (result?.success) {
        setMessages(result.chats || []);
      } else {
        setError(result?.error || 'Could not load messages');
      }
    } catch (e) {
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchMessages();
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-400" />
            Recent Messages
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchMessages} className="p-2 hover:bg-clawd-border rounded-lg" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-lg">
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-clawd-text-dim">Loading...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-400">{error}</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-clawd-text-dim">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
              <p>No recent messages</p>
              <p className="text-xs mt-2">WhatsApp/Telegram integration needed</p>
            </div>
          ) : (
            messages.map((msg: any, i) => (
              <div key={msg.id || i} className="p-4 border-b border-clawd-border/50 hover:bg-clawd-bg/30">
                <div className="flex items-start gap-3">
                  <PlatformIcon platform={msg.platform} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{msg.name}</span>
                      <span className="text-xs text-clawd-text-dim whitespace-nowrap">{msg.relativeTime}</span>
                    </div>
                    <div className="text-sm text-clawd-text-dim truncate mt-0.5">
                      {msg.fromMe && <span className="text-clawd-text-dim mr-1">You:</span>}
                      {msg.preview || <span className="italic opacity-50">(no preview)</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
