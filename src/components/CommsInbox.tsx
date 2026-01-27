import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, MessageSquare, Send, Check, X, Edit, RefreshCw, Clock, Sparkles, FileText, Phone, MessageCircle, Gamepad2, Twitter, AlertTriangle } from 'lucide-react';

// Cache configuration
const CACHE_KEY = 'comms-inbox-cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheData {
  timestamp: number;
  messages: Message[];
}

function getCache(): CacheData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CacheData;
    return data;
  } catch {
    return null;
  }
}

function setCache(messages: Message[]): void {
  try {
    const data: CacheData = { timestamp: Date.now(), messages };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[CommsInbox] Failed to write cache:', e);
  }
}

function isCacheValid(cache: CacheData | null): boolean {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL_MS;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

interface Message {
  id: string;
  platform: 'email' | 'whatsapp' | 'telegram' | 'discord' | 'twitter';
  from?: string;
  name?: string;
  preview: string;
  timestamp: string;
  relativeTime: string;
  hasReply?: boolean;
  suggestedReply?: string;
}

interface ReplyDraft {
  id: string;
  platform: string;
  to: string;
  originalMessage: string;
  suggestedReply: string;
  status: 'pending' | 'editing' | 'approved' | 'sent';
}

const platformColors: Record<string, string> = {
  email: 'text-orange-400 bg-orange-400/10',
  whatsapp: 'text-green-400 bg-green-400/10',
  telegram: 'text-blue-400 bg-blue-400/10',
  discord: 'text-indigo-400 bg-indigo-400/10',
  twitter: 'text-sky-400 bg-sky-400/10',
};

const platformLabels: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  discord: 'Discord',
  twitter: 'X DMs',
};

const PlatformIcon = ({ platform, size = 14 }: { platform: string; size?: number }) => {
  switch (platform) {
    case 'email': return <Mail size={size} />;
    case 'whatsapp': return <MessageCircle size={size} />;
    case 'telegram': return <Send size={size} />;
    case 'discord': return <Gamepad2 size={size} />;
    case 'twitter': return <Twitter size={size} />;
    default: return <MessageSquare size={size} />;
  }
};

interface ContextMessage {
  sender: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
}

function MessageModal({ message, isOpen, onClose, onSendReply, onScheduleReply }: {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
  onSendReply: (message: Message, reply: string) => void;
  onScheduleReply: (message: Message, reply: string, when: string) => void;
}) {
  const [reply, setReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);
  const [contextMessages, setContextMessages] = useState<ContextMessage[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [emailBody, setEmailBody] = useState('');

  // Load message context when modal opens
  useEffect(() => {
    if (isOpen && message) {
      if (message.platform === 'email') {
        loadEmailBody();
      } else {
        loadContext();
      }
      if (!hasGenerated) {
        generateReply();
      }
    }
    if (!isOpen) {
      setReply('');
      setHasGenerated(false);
      setShowSchedule(false);
      setContextMessages([]);
      setEmailBody('');
    }
  }, [isOpen, message]);

  const loadEmailBody = async () => {
    if (!message) return;
    setLoadingContext(true);
    try {
      const emailId = message.id.replace('email-', '');
      const result = await (window as any).clawdbot?.email?.body(emailId);
      if (result?.success && result.body) {
        setEmailBody(result.body);
      }
    } catch (e) {
      console.error('Failed to load email body:', e);
    } finally {
      setLoadingContext(false);
    }
  };

  const loadContext = async () => {
    if (!message) return;
    setLoadingContext(true);
    try {
      // Fetch recent messages for context
      const result = await (window as any).clawdbot?.messages?.context(message.id, message.platform, 5);
      if (result?.success && result.messages) {
        setContextMessages(result.messages);
      }
    } catch (e) {
      console.error('Failed to load context:', e);
    } finally {
      setLoadingContext(false);
    }
  };

  const generateReply = async () => {
    if (!message) return;
    setGenerating(true);
    setHasGenerated(true);
    // TODO: Call actual AI to generate reply
    await new Promise(resolve => setTimeout(resolve, 800));
    // Generate contextual reply based on message content
    const greetings = ['Hi', 'Hey', 'Hello'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    const responses = [
      `${greeting} ${(message.name || message.from || 'there').split(' ')[0]}! Thanks for your message. I'll get back to you on this shortly.`,
      `${greeting}! Got your message about "${message.preview.slice(0, 30)}...". Let me look into it and follow up.`,
      `Thanks for reaching out! I've noted this and will respond properly soon.`,
    ];
    setReply(responses[Math.floor(Math.random() * responses.length)]);
    setGenerating(false);
  };

  if (!isOpen || !message) return null;

  const handleGenerateReply = async () => {
    await generateReply();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${platformColors[message.platform]}`}>
              <PlatformIcon platform={message.platform} size={12} />
              {platformLabels[message.platform]}
            </span>
            <span className="font-semibold">{message.name || message.from || 'Unknown'}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-clawd-border rounded-lg">
            <X size={16} />
          </button>
        </div>

        {/* Message Context */}
        {/* Content Section - Email body or Chat context */}
        <div className={`p-4 border-b border-clawd-border overflow-y-auto ${message.platform === 'email' ? 'max-h-96' : 'max-h-64'}`}>
          {loadingContext ? (
            <div className="text-center text-clawd-text-dim text-sm py-2">Loading...</div>
          ) : message.platform === 'email' && emailBody ? (
            <div className="bg-clawd-bg rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-sans">{emailBody}</pre>
            </div>
          ) : contextMessages.length > 0 ? (
            <div className="space-y-3">
              {contextMessages.map((ctx, i) => (
                <div key={i} className={`flex flex-col ${ctx.fromMe ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-2 ${ctx.fromMe ? 'bg-clawd-accent/20' : 'bg-clawd-bg'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{ctx.fromMe ? 'You' : ctx.sender}</span>
                      <span className="text-xs text-clawd-text-dim">{ctx.timestamp}</span>
                    </div>
                    <p className="text-sm">{ctx.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-clawd-bg rounded-lg p-3">
              <div className="text-xs text-clawd-text-dim mb-1">{message.relativeTime}</div>
              <p className="text-sm">{message.preview}</p>
            </div>
          )}
        </div>

        {/* Reply Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Your Reply</span>
            <button
              onClick={handleGenerateReply}
              disabled={generating}
              className="flex items-center gap-1 text-xs text-clawd-accent hover:text-clawd-accent/80 disabled:opacity-50"
            >
              <Sparkles size={12} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply..."
            className="w-full h-32 bg-clawd-bg border border-clawd-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-clawd-accent"
          />

          {/* Schedule Options */}
          {showSchedule && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-clawd-text-dim">Schedule for:</span>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-clawd-bg border border-clawd-border rounded px-2 py-1 text-sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { onSendReply(message, reply); onClose(); }}
              disabled={!reply.trim()}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2"
            >
              <Send size={14} /> Send Now
            </button>
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="bg-clawd-border hover:bg-clawd-border/80 rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2"
            >
              <Clock size={14} /> Schedule
            </button>
            {showSchedule && scheduleTime && (
              <button
                onClick={() => { onScheduleReply(message, reply, scheduleTime); onClose(); }}
                disabled={!reply.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm"
              >
                Confirm Schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageCard({ message, onClick }: { message: Message; onClick: (m: Message) => void }) {
  const senderName = message.name || message.from || 'Unknown';
  return (
    <div 
      onClick={() => onClick(message)}
      className="bg-clawd-bg border border-clawd-border rounded-lg p-3 mb-2 hover:border-clawd-accent/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-sm text-clawd-accent">{senderName}</span>
        <span className="text-xs text-clawd-text-dim">{message.relativeTime}</span>
      </div>
      <p className="text-sm text-clawd-text-dim line-clamp-2">{message.preview}</p>
    </div>
  );
}

function ReplyCard({ draft, onApprove, onEdit, onReject }: { 
  draft: ReplyDraft; 
  onApprove: () => void;
  onEdit: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-clawd-bg border border-clawd-border rounded-lg p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${platformColors[draft.platform]}`}>
          <PlatformIcon platform={draft.platform} size={12} />
          {platformLabels[draft.platform]}
        </span>
        <span className="text-xs text-clawd-text-dim">To: {draft.to}</span>
      </div>
      <p className="text-xs text-clawd-text-dim mb-2 line-clamp-1">Re: {draft.originalMessage}</p>
      <div className="bg-clawd-surface border border-clawd-border rounded p-2 mb-2">
        <p className="text-sm">{draft.suggestedReply}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="flex-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded px-2 py-1 text-xs flex items-center justify-center gap-1"
        >
          <Check size={12} /> Send
        </button>
        <button
          onClick={onEdit}
          className="flex-1 bg-clawd-border hover:bg-clawd-border/80 rounded px-2 py-1 text-xs flex items-center justify-center gap-1"
        >
          <Edit size={12} /> Edit
        </button>
        <button
          onClick={onReject}
          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded px-2 py-1 text-xs"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function ColumnHeader({ title, icon, count, onRefresh }: { title: string; icon?: React.ReactNode; count: number; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-clawd-text-dim">{icon}</span>}
        <h3 className="font-semibold text-sm">{title}</h3>
        {count > 0 && (
          <span className="bg-clawd-accent/20 text-clawd-accent text-xs px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
      </div>
      <button onClick={onRefresh} className="text-clawd-text-dim hover:text-clawd-text">
        <RefreshCw size={14} />
      </button>
    </div>
  );
}

export default function CommsInbox() {
  const [replyDrafts, setReplyDrafts] = useState<ReplyDraft[]>([]);
  const [emails, setEmails] = useState<Message[]>([]);
  const [whatsapp, setWhatsapp] = useState<Message[]>([]);
  const [telegram, setTelegram] = useState<Message[]>([]);
  const [discord, setDiscord] = useState<Message[]>([]);
  const [urgent, setUrgent] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Background refresh indicator
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const isMounted = useRef(true);

  // Apply messages to state (shared between cache and fresh load)
  const applyMessages = useCallback((msgs: Message[]) => {
    setEmails(msgs.filter(m => m.platform === 'email'));
    setWhatsapp(msgs.filter(m => m.platform === 'whatsapp'));
    setTelegram(msgs.filter(m => m.platform === 'telegram'));
    setDiscord(msgs.filter(m => m.platform === 'discord'));
    // Mark messages as urgent based on keywords or flags
    const urgentKeywords = ['urgent', 'asap', 'important', 'emergency', 'critical', 'help', 'now'];
    const urgentMsgs = msgs.filter(m => 
      urgentKeywords.some(kw => m.preview.toLowerCase().includes(kw))
    );
    setUrgent(urgentMsgs);
  }, []);

  // Fetch fresh data from backend
  const fetchMessages = useCallback(async (): Promise<Message[] | null> => {
    console.log('[CommsInbox] Fetching fresh messages...');
    try {
      const result = await (window as any).clawdbot?.messages?.recent(30);
      if (result?.success && result.chats) {
        const msgs = result.chats as Message[];
        console.log('[CommsInbox] Fetched messages:', {
          total: msgs.length,
          emails: msgs.filter(m => m.platform === 'email').length,
          whatsapp: msgs.filter(m => m.platform === 'whatsapp').length,
          telegram: msgs.filter(m => m.platform === 'telegram').length,
        });
        return msgs;
      }
    } catch (e) {
      console.error('[CommsInbox] Failed to fetch messages:', e);
    }
    return null;
  }, []);

  // Load messages with stale-while-revalidate strategy
  const loadMessages = useCallback(async (forceRefresh = false) => {
    const cache = getCache();
    const hasValidCache = isCacheValid(cache);

    // If we have valid cache and not forcing refresh, use it and refresh in background
    if (hasValidCache && cache && !forceRefresh) {
      console.log('[CommsInbox] Using cached data, age:', Math.round((Date.now() - cache.timestamp) / 1000), 's');
      applyMessages(cache.messages);
      setLastUpdated(cache.timestamp);
      setLoading(false);
      
      // Background refresh if cache is older than 1 minute
      if (Date.now() - cache.timestamp > 60 * 1000) {
        setRefreshing(true);
        const fresh = await fetchMessages();
        if (fresh && isMounted.current) {
          applyMessages(fresh);
          setCache(fresh);
          setLastUpdated(Date.now());
          setRefreshing(false);
        }
      }
      return;
    }

    // No valid cache or force refresh - show loading state
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // If we have stale cache, show it while loading
    if (cache && !hasValidCache && !forceRefresh) {
      console.log('[CommsInbox] Using stale cache while fetching...');
      applyMessages(cache.messages);
      setLastUpdated(cache.timestamp);
    }

    const msgs = await fetchMessages();
    if (!isMounted.current) return;

    if (msgs) {
      applyMessages(msgs);
      setCache(msgs);
      setLastUpdated(Date.now());
    }
    setLoading(false);
    setRefreshing(false);
  }, [applyMessages, fetchMessages]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    loadMessages(true);
  }, [loadMessages]);

  useEffect(() => {
    isMounted.current = true;
    loadMessages();
    return () => { isMounted.current = false; };
  }, [loadMessages]);

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
  };

  const handleSendReply = (message: Message, reply: string) => {
    // TODO: Actually send via wacli/tgcli/etc
    const recipient = message.name || message.from || 'Unknown';
    console.log('Sending reply:', { platform: message.platform, to: recipient, reply });
    // For now, just show it was "sent"
    alert(`Reply sent to ${recipient} via ${message.platform}!`);
  };

  const handleScheduleReply = (message: Message, reply: string, when: string) => {
    // Add to reply drafts as scheduled
    const draft: ReplyDraft = {
      id: `draft-${Date.now()}`,
      platform: message.platform,
      to: message.from,
      originalMessage: message.preview,
      suggestedReply: reply,
      status: 'pending',
    };
    setReplyDrafts([draft, ...replyDrafts]);
    console.log('Scheduled reply:', { platform: message.platform, to: message.from, reply, when });
  };

  const handleApprove = (id: string) => {
    const draft = replyDrafts.find(d => d.id === id);
    if (draft) {
      // TODO: Send the reply
      console.log('Sending approved reply:', draft);
      alert(`Reply sent to ${draft.to} via ${draft.platform}!`);
    }
    setReplyDrafts(replyDrafts.filter(d => d.id !== id));
  };

  const handleReject = (id: string) => {
    setReplyDrafts(replyDrafts.filter(d => d.id !== id));
  };

  return (
    <div className="h-full p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold flex items-center gap-2"><Mail size={24} /> Communications Inbox</h1>
          {lastUpdated && (
            <span className="text-xs text-clawd-text-dim">
              {refreshing ? 'Updating...' : `Updated ${formatRelativeTime(lastUpdated)}`}
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:bg-clawd-border disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
          Refresh All
        </button>
      </div>

      <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[calc(100%-60px)] overflow-hidden">
        {/* Left side: 2 tall columns */}
        {/* Reply Queue - Tall */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-3 overflow-y-auto row-span-2">
          <ColumnHeader title="Reply Queue" icon={<FileText size={16} />} count={replyDrafts.length} onRefresh={() => {}} />
          {replyDrafts.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No pending replies</p>
          ) : (
            replyDrafts.map(draft => (
              <ReplyCard
                key={draft.id}
                draft={draft}
                onApprove={() => handleApprove(draft.id)}
                onEdit={() => {}}
                onReject={() => handleReject(draft.id)}
              />
            ))
          )}
        </div>

        {/* Email - Tall */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-3 overflow-y-auto row-span-2">
          <ColumnHeader title="Email" icon={<Mail size={16} />} count={emails.length} onRefresh={handleRefresh} />
          {emails.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No emails</p>
          ) : (
            emails.map(msg => (
              <MessageCard key={msg.id} message={msg} onClick={handleMessageClick} />
            ))
          )}
        </div>

        {/* Right side: 2x2 grid */}
        {/* WhatsApp - Top Left */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-3 overflow-y-auto">
          <ColumnHeader title="WhatsApp" icon={<MessageCircle size={16} />} count={whatsapp.length} onRefresh={handleRefresh} />
          {whatsapp.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No messages</p>
          ) : (
            whatsapp.map(msg => (
              <MessageCard key={msg.id} message={msg} onClick={handleMessageClick} />
            ))
          )}
        </div>

        {/* Telegram - Top Right */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-3 overflow-y-auto">
          <ColumnHeader title="Telegram" icon={<Send size={16} />} count={telegram.length} onRefresh={handleRefresh} />
          {telegram.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No messages</p>
          ) : (
            telegram.map(msg => (
              <MessageCard key={msg.id} message={msg} onClick={handleMessageClick} />
            ))
          )}
        </div>

        {/* Discord - Bottom Left */}
        <div className="bg-clawd-surface border border-clawd-border rounded-xl p-3 overflow-y-auto">
          <ColumnHeader title="Discord" icon={<Gamepad2 size={16} />} count={discord.length} onRefresh={handleRefresh} />
          {discord.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No messages</p>
          ) : (
            discord.map(msg => (
              <MessageCard key={msg.id} message={msg} onClick={handleMessageClick} />
            ))
          )}
        </div>

        {/* Urgent - Bottom Right */}
        <div className="bg-clawd-surface border border-red-500/30 rounded-xl p-3 overflow-y-auto">
          <ColumnHeader title="Urgent" icon={<AlertTriangle size={16} className="text-red-400" />} count={urgent.length} onRefresh={handleRefresh} />
          {urgent.length === 0 ? (
            <p className="text-sm text-clawd-text-dim text-center py-4">No urgent messages</p>
          ) : (
            urgent.map(msg => (
              <MessageCard key={msg.id} message={msg} onClick={handleMessageClick} />
            ))
          )}
        </div>
      </div>

      {/* Message Modal */}
      <MessageModal
        message={selectedMessage}
        isOpen={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        onSendReply={handleSendReply}
        onScheduleReply={handleScheduleReply}
      />
    </div>
  );
}
