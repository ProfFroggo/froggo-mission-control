import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, MessageSquare, Send, Check, X, Edit, RefreshCw, Clock, Sparkles, FileText, MessageCircle, Gamepad2, AlertTriangle, Star, Archive, ArchiveRestore, CheckSquare, Trash2, MailOpen, TrendingUp } from 'lucide-react';
import InboxFilter, { FilterCriteria } from './InboxFilter';
import { PriorityIndicator, PriorityExplanation, usePriorityData } from './PriorityInbox';

// X logo component
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

// Bulk Actions Toolbar
function BulkActionsToolbar({ 
  selectedCount, 
  onMarkRead, 
  onMarkUnread, 
  onArchive, 
  onDelete, 
  onSelectAll,
  onClearSelection 
}: {
  selectedCount: number;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-clawd-surface border-2 border-clawd-accent rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 z-50 animate-slide-up">
      <div className="flex items-center gap-2 border-r border-clawd-border pr-4">
        <CheckSquare size={16} className="text-clawd-accent" />
        <span className="font-semibold">{selectedCount} selected</span>
      </div>
      
      <button
        onClick={onSelectAll}
        className="text-sm text-clawd-text-dim hover:text-clawd-accent transition-colors"
      >
        Select All
      </button>
      
      <div className="flex gap-2">
        <button
          onClick={onMarkRead}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
          title="Mark as read"
        >
          <MailOpen size={16} />
          <span className="text-sm font-medium">Read</span>
        </button>
        
        <button
          onClick={onMarkUnread}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
          title="Mark as unread"
        >
          <Mail size={16} />
          <span className="text-sm font-medium">Unread</span>
        </button>
        
        <button
          onClick={onArchive}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded-lg transition-colors"
          title="Archive"
        >
          <Archive size={16} />
          <span className="text-sm font-medium">Archive</span>
        </button>
        
        <button
          onClick={onDelete}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 size={16} />
          <span className="text-sm font-medium">Delete</span>
        </button>
      </div>
      
      <button
        onClick={onClearSelection}
        className="ml-2 p-2 hover:bg-clawd-border rounded-lg transition-colors"
        title="Clear selection (Esc)"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Cache configuration
const CACHE_KEY = 'comms-inbox-cache';
const CACHE_TTL_MS = 20 * 1000; // 20 seconds - keep inbox live

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
  priorityScore?: number;
  priorityLevel?: 'critical' | 'high' | 'normal' | 'low';
  priorityExplanation?: any[];
  senderImportance?: number;
  senderReplyRate?: number;
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
    case 'twitter': return <XIcon size={size} />;
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

  const generateReply = async (tone?: 'formal' | 'casual' | 'auto') => {
    if (!message) return;
    setGenerating(true);
    setHasGenerated(true);

    try {
      // Build thread context from loaded context messages + current message
      const threadMessages: Array<{role: string, content: string}> = [];
      
      if (contextMessages.length > 0) {
        for (const ctx of contextMessages) {
          threadMessages.push({
            role: ctx.sender || 'them',
            content: ctx.text || '',
          });
        }
      }
      
      // Add the current message
      threadMessages.push({
        role: message.name || message.from || 'them',
        content: emailBody || message.preview || '',
      });

      // Call AI to generate reply
      const result = await (window as any).clawdbot?.ai?.generateReply({
        threadMessages,
        platform: message.platform,
        recipientName: message.name || message.from,
        tone: tone || 'auto',
      });

      if (result?.success && result.draft) {
        setReply(result.draft);
      } else {
        // Fallback to simple template on error
        console.warn('[CommsInbox] AI reply failed:', result?.error);
        const name = (message.name || message.from || 'there').split(' ')[0];
        setReply(`Hi ${name}, thanks for your message. Let me get back to you on this shortly.`);
      }
    } catch (e) {
      console.error('[CommsInbox] AI reply generation error:', e);
      const name = (message.name || message.from || 'there').split(' ')[0];
      setReply(`Hi ${name}, thanks for your message. Let me get back to you on this shortly.`);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen || !message) return null;

  const handleGenerateReply = async () => {
    await generateReply();
  };

  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b border-clawd-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${platformColors[message.platform]}`}>
              <PlatformIcon platform={message.platform} size={14} />
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
              <Sparkles size={14} className={generating ? 'animate-spin' : ''} />
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

function MessageCard({ 
  message, 
  onClick, 
  onToggleStar, 
  onMarkRead,
  onArchive,
  isArchived = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect
}: { 
  message: Message; 
  onClick: (m: Message) => void;
  onToggleStar?: (id: string) => void;
  onMarkRead?: (id: string, isRead: boolean) => void;
  onArchive?: (id: string, archive: boolean) => void;
  isArchived?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const senderName = message.name || message.from || 'Unknown';
  const isUnread = !(message as any).is_read;
  const isStarred = (message as any).is_starred;
  const priorityLevel = message.priorityLevel || 'normal';
  const priorityScore = message.priorityScore;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.(message.id);
  };

  const handleReadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(message.id, !isUnread);
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.(message.id, !isArchived);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(message.id);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelect?.(message.id);
    } else {
      onClick(message);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`bg-clawd-bg border rounded-lg p-3 mb-2 hover:border-clawd-accent/50 transition-colors cursor-pointer ${
        isUnread ? 'border-clawd-accent/30 bg-clawd-accent/5' : 'border-clawd-border'
      } ${isArchived ? 'opacity-70' : ''} ${isSelected ? 'ring-2 ring-clawd-accent bg-clawd-accent/10' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect?.(message.id)}
              onClick={handleCheckboxClick}
              className="flex-shrink-0 w-4 h-4 rounded border-clawd-border bg-clawd-bg checked:bg-clawd-accent cursor-pointer"
            />
          )}
          {isUnread && !selectionMode && <div className="w-2 h-2 bg-clawd-accent rounded-full flex-shrink-0" />}
          <span className="font-semibold text-sm text-clawd-accent truncate">{senderName}</span>
          {isArchived && <span className="text-xs text-clawd-text-dim">📦</span>}
          {priorityLevel && (
            <PriorityIndicator 
              level={priorityLevel} 
              score={priorityScore}
              size="xs"
              showLabel={false}
            />
          )}
        </div>
        {!selectionMode && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {message.priorityExplanation && (
              <PriorityExplanation 
                explanation={message.priorityExplanation}
                senderStats={message.senderImportance ? {
                  importance: message.senderImportance,
                  replyRate: message.senderReplyRate || 0,
                  avgResponseTime: 0
                } : undefined}
              />
            )}
            <button
              onClick={handleStarClick}
              className={`p-1 rounded hover:bg-clawd-border ${isStarred ? 'text-yellow-400' : 'text-clawd-text-dim'}`}
              title={isStarred ? 'Unstar' : 'Star'}
            >
              <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleReadClick}
              className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim"
              title={isUnread ? 'Mark as read' : 'Mark as unread'}
            >
              <Mail size={14} />
            </button>
            <button
              onClick={handleArchiveClick}
              className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim"
              title={isArchived ? 'Unarchive' : 'Archive'}
            >
              {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
            <span className="text-xs text-clawd-text-dim ml-1">{message.relativeTime}</span>
          </div>
        )}
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
          <PlatformIcon platform={draft.platform} size={14} />
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
          <Check size={14} /> Send
        </button>
        <button
          onClick={onEdit}
          className="flex-1 bg-clawd-border hover:bg-clawd-border/80 rounded px-2 py-1 text-xs flex items-center justify-center gap-1"
        >
          <Edit size={14} /> Edit
        </button>
        <button
          onClick={onReject}
          className="bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded px-2 py-1 text-xs"
        >
          <X size={14} />
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
          <span className="bg-clawd-accent/20 text-clawd-accent text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
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
  const [allMessages, setAllMessages] = useState<Message[]>([]); // Store all messages
  const [emails, setEmails] = useState<Message[]>([]);
  const [whatsapp, setWhatsapp] = useState<Message[]>([]);
  const [telegram, setTelegram] = useState<Message[]>([]);
  const [discord, setDiscord] = useState<Message[]>([]);
  const [urgent, setUrgent] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Background refresh indicator
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [showArchived, setShowArchived] = useState(false); // Toggle for showing archived conversations
  const [archivedSet, setArchivedSet] = useState<Set<string>>(new Set()); // Track which messages are archived
  const isMounted = useRef(true);
  
  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  
  // Priority system
  const [sortByPriority, setSortByPriority] = useState(true); // Default to priority sorting
  const priorityData = usePriorityData();

  // Filter messages based on criteria
  const applyFilters = useCallback((msgs: Message[], criteria: FilterCriteria): Message[] => {
    let filtered = [...msgs];

    // Platform filter
    if (criteria.platforms && criteria.platforms.length > 0) {
      filtered = filtered.filter(m => criteria.platforms!.includes(m.platform));
    }

    // Sender filter
    if (criteria.senders && criteria.senders.length > 0) {
      filtered = filtered.filter(m => 
        criteria.senders!.some(sender => 
          (m.from && m.from.toLowerCase().includes(sender.toLowerCase())) ||
          (m.name && m.name.toLowerCase().includes(sender.toLowerCase()))
        )
      );
    }

    // Flag filters
    if (criteria.flags) {
      if (criteria.flags.unread) {
        filtered = filtered.filter(m => !(m as any).is_read);
      }
      if (criteria.flags.starred) {
        filtered = filtered.filter(m => (m as any).is_starred);
      }
      if (criteria.flags.hasAttachment) {
        filtered = filtered.filter(m => (m as any).has_attachment);
      }
      if (criteria.flags.urgent) {
        const urgentKeywords = ['urgent', 'asap', 'important', 'emergency', 'critical', 'help', 'now'];
        filtered = filtered.filter(m => 
          urgentKeywords.some(kw => m.preview.toLowerCase().includes(kw))
        );
      }
    }

    // Text search (simple client-side for now)
    if (criteria.search) {
      const searchLower = criteria.search.toLowerCase();
      filtered = filtered.filter(m => 
        m.preview.toLowerCase().includes(searchLower) ||
        (m.name && m.name.toLowerCase().includes(searchLower)) ||
        (m.from && m.from.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  }, []);

  // Apply messages to state (shared between cache and fresh load)
  const applyMessages = useCallback((msgs: Message[]) => {
    // Recalculate relativeTime from timestamps (cached values go stale)
    const refreshed = msgs.map(m => ({
      ...m,
      relativeTime: m.timestamp ? formatRelativeTime(new Date(m.timestamp).getTime()) : m.relativeTime,
    }));
    setAllMessages(refreshed);
    
    // Apply current filters
    let filtered = applyFilters(refreshed, filterCriteria);
    
    // Sort by priority if enabled
    if (sortByPriority) {
      filtered = [...filtered].sort((a, b) => {
        const scoreA = a.priorityScore || 50;
        const scoreB = b.priorityScore || 50;
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher priority first
        }
        // Tie-breaker: use timestamp
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    }
    
    setFilteredMessages(filtered);

    setEmails(filtered.filter(m => m.platform === 'email'));
    setWhatsapp(filtered.filter(m => m.platform === 'whatsapp'));
    setTelegram(filtered.filter(m => m.platform === 'telegram'));
    setDiscord(filtered.filter(m => m.platform === 'discord'));
    
    // Mark messages as urgent based on keywords or flags
    const urgentKeywords = ['urgent', 'asap', 'important', 'emergency', 'critical', 'help', 'now'];
    const urgentMsgs = filtered.filter(m => 
      urgentKeywords.some(kw => m.preview.toLowerCase().includes(kw))
    );
    setUrgent(urgentMsgs);
  }, [filterCriteria, applyFilters, sortByPriority]);

  // Helper to create session key from message
  const getSessionKey = useCallback((message: Message): string => {
    return `${message.platform}:${message.from || message.name}`;
  }, []);

  // Archive/unarchive handler
  const handleArchive = useCallback(async (messageId: string, shouldArchive: boolean) => {
    console.log('[CommsInbox] Archive:', messageId, shouldArchive);
    
    // Find the message to get session key
    const message = allMessages.find(m => m.id === messageId);
    if (!message) {
      console.error('[CommsInbox] Message not found:', messageId);
      return;
    }
    
    const sessionKey = getSessionKey(message);
    
    try {
      if (shouldArchive) {
        const result = await (window as any).clawdbot?.conversations?.archive(sessionKey);
        if (result?.success) {
          setArchivedSet(prev => new Set(prev).add(sessionKey));
          console.log('[CommsInbox] Archived:', sessionKey);
        }
      } else {
        const result = await (window as any).clawdbot?.conversations?.unarchive(sessionKey);
        if (result?.success) {
          setArchivedSet(prev => {
            const next = new Set(prev);
            next.delete(sessionKey);
            return next;
          });
          console.log('[CommsInbox] Unarchived:', sessionKey);
        }
      }
      
      // Refresh messages to reflect changes
      loadMessages(true);
    } catch (e) {
      console.error('[CommsInbox] Archive error:', e);
    }
  }, [allMessages, getSessionKey]);

  // Fetch fresh data from backend (now uses froggo-db cache on backend)
  const fetchMessages = useCallback(async (): Promise<{ messages: Message[] | null; fromCache: boolean }> => {
    console.log('[CommsInbox] Fetching messages...', 'showArchived:', showArchived);
    try {
      // FIXED: Increased limit from 30 to 500 to show more messages
      const result = await (window as any).clawdbot?.messages?.recent(500, showArchived);
      if (result?.success && result.chats) {
        const msgs = result.chats as Message[];
        console.log('[CommsInbox] Got messages:', {
          total: msgs.length,
          fromCache: result.fromCache || false,
          cacheAge: result.cacheAge,
          stale: result.stale,
        });
        return { messages: msgs, fromCache: result.fromCache || false };
      }
    } catch (e) {
      console.error('[CommsInbox] Failed to fetch messages:', e);
    }
    return { messages: null, fromCache: false };
  }, [showArchived]);

  // Load messages - backend now handles froggo-db caching
  const loadMessages = useCallback(async (forceRefresh = false) => {
    // Check local cache first for instant UI
    const localCache = getCache();
    const hasValidLocalCache = isCacheValid(localCache);

    // If we have valid local cache and not forcing refresh, show it immediately
    if (hasValidLocalCache && localCache && !forceRefresh) {
      console.log('[CommsInbox] Using local cache, age:', Math.round((Date.now() - localCache.timestamp) / 1000), 's');
      applyMessages(localCache.messages);
      setLastUpdated(localCache.timestamp);
      setFromCache(true);
      setLoading(false);
      
      // Background refresh if local cache is older than 15 seconds
      if (Date.now() - localCache.timestamp > 15 * 1000) {
        setRefreshing(true);
        const { messages, fromCache: backendCache } = await fetchMessages();
        if (messages && isMounted.current) {
          applyMessages(messages);
          setCache(messages);
          setLastUpdated(Date.now());
          setFromCache(backendCache);
          setRefreshing(false);
        }
      }
      return;
    }

    // No valid local cache or force refresh - show loading state
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // If we have stale local cache, show it while loading
    if (localCache && !hasValidLocalCache && !forceRefresh) {
      console.log('[CommsInbox] Using stale local cache while fetching...');
      applyMessages(localCache.messages);
      setLastUpdated(localCache.timestamp);
    }

    const { messages, fromCache: backendCache } = await fetchMessages();
    if (!isMounted.current) return;

    if (messages) {
      applyMessages(messages);
      setCache(messages); // Also update local cache
      setLastUpdated(Date.now());
      setFromCache(backendCache);
    }
    setLoading(false);
    setRefreshing(false);
  }, [applyMessages, fetchMessages]);

  // Manual refresh handler
  const handleRefresh = useCallback(() => {
    loadMessages(true);
  }, [loadMessages]);

  // Check for historical data on first mount
  useEffect(() => {
    (async () => {
      try {
        const historyCheck = await (window as any).clawdbot?.inbox?.checkHistory?.();
        if (historyCheck?.needsBackfill) {
          console.log('[CommsInbox] First launch detected - triggering historical backfill...');
          await (window as any).clawdbot?.inbox?.triggerBackfill?.(60);
          // Show a notification that backfill is running
          console.log('[CommsInbox] Historical backfill started in background');
        } else {
          console.log('[CommsInbox] Historical data already loaded:', historyCheck);
        }
      } catch (e) {
        console.error('[CommsInbox] Failed to check historical data:', e);
      }
    })();
  }, []); // Run only once on mount

  useEffect(() => {
    isMounted.current = true;
    loadMessages();
    return () => { isMounted.current = false; };
  }, [loadMessages]);

  // Reload messages when showArchived toggle changes
  useEffect(() => {
    if (isMounted.current) {
      loadMessages(true);
    }
  }, [showArchived]);

  // Auto-refresh polling (every 30 seconds)
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
    
    const intervalId = setInterval(() => {
      if (isMounted.current && !loading && !refreshing) {
        console.log('[CommsInbox] Auto-refreshing messages...');
        loadMessages(true);
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [loadMessages, loading, refreshing]);

  const handleMessageClick = (message: Message) => {
    setSelectedMessage(message);
  };

  const handleSendReply = async (message: Message, reply: string) => {
    const recipient = message.from || message.name || 'Unknown';
    console.log('Sending reply:', { platform: message.platform, to: recipient, reply });
    
    try {
      const result = await (window as any).clawdbot?.messages?.send?.(message.platform, recipient, reply);
      if (result?.success) {
        // Show success toast or notification
        console.log('Reply sent successfully:', result);
        alert(`✅ Reply sent to ${message.name || recipient} via ${message.platform}!`);
      } else {
        console.error('Send failed:', result?.error);
        alert(`❌ Failed to send: ${result?.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error('Send error:', e);
      alert(`❌ Error sending reply: ${e.message}`);
    }
  };

  const handleScheduleReply = (message: Message, reply: string, when: string) => {
    // Add to reply drafts as scheduled
    const draft: ReplyDraft = {
      id: `draft-${Date.now()}`,
      platform: message.platform,
      to: message.from || 'Unknown',
      originalMessage: message.preview,
      suggestedReply: reply,
      status: 'pending',
    };
    setReplyDrafts([draft, ...replyDrafts]);
    console.log('Scheduled reply:', { platform: message.platform, to: message.from, reply, when });
  };

  const handleApprove = async (id: string) => {
    const draft = replyDrafts.find(d => d.id === id);
    if (draft) {
      console.log('Sending approved reply:', draft);
      try {
        const result = await (window as any).clawdbot?.messages?.send?.(draft.platform, draft.to, draft.suggestedReply);
        if (result?.success) {
          console.log('Reply sent successfully:', result);
          alert(`✅ Reply sent to ${draft.to} via ${draft.platform}!`);
        } else {
          console.error('Send failed:', result?.error);
          alert(`❌ Failed to send: ${result?.error || 'Unknown error'}`);
        }
      } catch (e: any) {
        console.error('Send error:', e);
        alert(`❌ Error sending reply: ${e.message}`);
      }
    }
    setReplyDrafts(replyDrafts.filter(d => d.id !== id));
  };

  const handleReject = (id: string) => {
    setReplyDrafts(replyDrafts.filter(d => d.id !== id));
  };

  const handleFilterChange = useCallback((criteria: FilterCriteria) => {
    setFilterCriteria(criteria);
    
    // Reapply filters to all messages
    const filtered = applyFilters(allMessages, criteria);
    setFilteredMessages(filtered);

    setEmails(filtered.filter(m => m.platform === 'email'));
    setWhatsapp(filtered.filter(m => m.platform === 'whatsapp'));
    setTelegram(filtered.filter(m => m.platform === 'telegram'));
    setDiscord(filtered.filter(m => m.platform === 'discord'));
    
    const urgentKeywords = ['urgent', 'asap', 'important', 'emergency', 'critical', 'help', 'now'];
    const urgentMsgs = filtered.filter(m => 
      urgentKeywords.some(kw => m.preview.toLowerCase().includes(kw))
    );
    setUrgent(urgentMsgs);
  }, [allMessages, applyFilters]);

  const toggleStar = async (messageId: string) => {
    try {
      const result = await (window as any).clawdbot?.inbox?.toggleStar?.(messageId);
      if (result?.success) {
        // Update local state
        const updated = allMessages.map(m => 
          m.id === messageId ? { ...m, is_starred: result.is_starred } : m
        );
        applyMessages(updated);
      }
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  };

  const markRead = async (messageId: string, isRead: boolean = true) => {
    try {
      const result = await (window as any).clawdbot?.inbox?.markRead?.(messageId, isRead);
      if (result?.success) {
        // Update local state
        const updated = allMessages.map(m => 
          m.id === messageId ? { ...m, is_read: isRead } : m
        );
        applyMessages(updated);
      }
    } catch (e) {
      console.error('Failed to mark read:', e);
    }
  };

  // Bulk action handlers
  const toggleSelection = (messageId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedIds(newSelected);
    setSelectionMode(newSelected.size > 0);
  };

  const selectAll = () => {
    const allIds = new Set(filteredMessages.map(m => m.id));
    setSelectedIds(allIds);
    setSelectionMode(true);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const bulkMarkRead = async (isRead: boolean) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await markRead(id, isRead);
    }
    clearSelection();
  };

  const bulkArchive = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const message = allMessages.find(m => m.id === id);
      if (message) {
        await handleArchive(id, true);
      }
    }
    clearSelection();
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} conversation(s)? This cannot be undone.`)) {
      return;
    }
    
    const ids = Array.from(selectedIds);
    try {
      for (const id of ids) {
        await (window as any).clawdbot?.inbox?.delete?.(id);
      }
      // Remove from local state
      const updated = allMessages.filter(m => !ids.includes(m.id));
      applyMessages(updated);
      clearSelection();
    } catch (e) {
      console.error('Failed to delete messages:', e);
    }
  };

  // Keyboard shortcuts for bulk actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        selectAll();
      }
      // Escape to clear selection
      if (e.key === 'Escape' && selectionMode) {
        e.preventDefault();
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredMessages, selectionMode]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Filter Bar */}
      <InboxFilter
        onFilterChange={handleFilterChange}
        totalMessages={allMessages.length}
        filteredCount={filteredMessages.length}
      />

      <div className="flex-1 p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold flex items-center gap-2"><Mail size={24} /> Communications Inbox</h1>
            {lastUpdated && (
              <span className="text-xs text-clawd-text-dim flex items-center gap-1">
                {refreshing ? 'Updating...' : `Updated ${formatRelativeTime(lastUpdated)}`}
                {fromCache && !refreshing && <span className="text-clawd-accent/60">(cached)</span>}
              </span>
            )}
            {priorityData.stats && (
              <span className="text-xs text-clawd-accent flex items-center gap-1">
                <TrendingUp size={14} />
                {priorityData.stats.critical + priorityData.stats.high} priority
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortByPriority(!sortByPriority)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                sortByPriority 
                  ? 'bg-clawd-accent/20 border-clawd-accent text-clawd-accent' 
                  : 'bg-clawd-surface border-clawd-border hover:bg-clawd-border'
              }`}
              title="Toggle priority sorting"
            >
              <TrendingUp size={14} />
              {sortByPriority ? 'Priority' : 'Time'}
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                showArchived 
                  ? 'bg-clawd-accent/20 border-clawd-accent text-clawd-accent' 
                  : 'bg-clawd-surface border-clawd-border hover:bg-clawd-border'
              }`}
            >
              {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 px-3 py-1.5 bg-clawd-surface border border-clawd-border rounded-lg text-sm hover:bg-clawd-border disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
              Refresh All
            </button>
          </div>
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
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onClick={handleMessageClick}
                onToggleStar={toggleStar}
                onMarkRead={markRead}
                onArchive={handleArchive}
                isArchived={archivedSet.has(getSessionKey(msg))}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelection}
              />
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
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onClick={handleMessageClick}
                onToggleStar={toggleStar}
                onMarkRead={markRead}
                onArchive={handleArchive}
                isArchived={archivedSet.has(getSessionKey(msg))}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelection}
              />
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
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onClick={handleMessageClick}
                onToggleStar={toggleStar}
                onMarkRead={markRead}
                onArchive={handleArchive}
                isArchived={archivedSet.has(getSessionKey(msg))}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelection}
              />
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
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onClick={handleMessageClick}
                onToggleStar={toggleStar}
                onMarkRead={markRead}
                onArchive={handleArchive}
                isArchived={archivedSet.has(getSessionKey(msg))}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelection}
              />
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
              <MessageCard 
                key={msg.id} 
                message={msg} 
                onClick={handleMessageClick}
                onToggleStar={toggleStar}
                onMarkRead={markRead}
                onArchive={handleArchive}
                isArchived={archivedSet.has(getSessionKey(msg))}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(msg.id)}
                onToggleSelect={toggleSelection}
              />
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
        
        {/* Bulk Actions Toolbar */}
        {selectionMode && (
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            onMarkRead={() => bulkMarkRead(true)}
            onMarkUnread={() => bulkMarkRead(false)}
            onArchive={bulkArchive}
            onDelete={bulkDelete}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
          />
        )}
      </div>
    </div>
  );
}
