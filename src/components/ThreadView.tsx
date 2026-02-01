import { useState, useEffect } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Star, Mail, Check, User, Paperclip } from 'lucide-react';
import { useUserSettings } from '../store/userSettings';

interface ThreadMessage {
  id: string;
  platform: string;
  sender: string;
  sender_name?: string;
  preview: string;
  full_content?: string;
  timestamp: string;
  is_thread_root: boolean;
  is_read: boolean;
  is_starred: boolean;
  has_attachment: boolean;
  subject?: string;
}

interface ThreadMetadata {
  thread_id: string;
  platform: string;
  subject?: string;
  participants: string[];
  message_count: number;
  last_activity: string;
  unread_count: number;
  has_starred: boolean;
}

interface ThreadViewProps {
  threadId: string;
  metadata?: ThreadMetadata;
  onClose?: () => void;
  onToggleStar?: (messageId: string) => void;
  onMarkRead?: (messageId: string, isRead: boolean) => void;
  onReply?: (threadId: string, message: string) => void;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function ThreadMessage({ 
  message, 
  isMe, 
  onToggleStar, 
  onMarkRead 
}: { 
  message: ThreadMessage; 
  isMe: boolean;
  onToggleStar?: (id: string) => void;
  onMarkRead?: (id: string, isRead: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayName = message.sender_name || message.sender;
  const hasFullContent = message.full_content && message.full_content !== message.preview;

  return (
    <div className={`flex ${isMe ? 'flex-row-reverse' : ''} gap-3 mb-4 group`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-8">
        {isMe ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-clawd-accent to-purple-500 flex items-center justify-center text-white text-xs font-semibold shadow-sm ring-2 ring-white/20">
            K
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm ring-2 ring-white/20">
            <User size={14} className="text-white" />
          </div>
        )}
      </div>

      {/* Message content */}
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[70%] min-w-[120px]`}>
        {/* Sender name and timestamp */}
        <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
          <span className={`text-xs font-medium ${isMe ? 'text-clawd-accent' : 'text-indigo-600'}`}>
            {isMe ? 'You' : displayName}
          </span>
          <span className="text-[10px] text-clawd-text-dim/70">
            {formatMessageTime(message.timestamp)}
          </span>
          {message.is_starred && (
            <Star size={10} className="text-yellow-500 fill-yellow-500" />
          )}
        </div>

        {/* Message bubble with actions */}
        <div className="relative w-full">
          {/* Message actions bar */}
          <div className={`absolute ${isMe ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200`}>
            {onToggleStar && (
              <button
                onClick={() => onToggleStar(message.id)}
                className={`p-1.5 rounded-lg transition-all ${
                  message.is_starred
                    ? 'bg-yellow-100 text-yellow-600 shadow-sm'
                    : 'bg-clawd-surface/90 backdrop-blur-sm text-clawd-text-dim hover:text-yellow-600 hover:bg-yellow-50 border border-clawd-border'
                }`}
                title={message.is_starred ? 'Unstar' : 'Star'}
              >
                <Star size={14} fill={message.is_starred ? 'currentColor' : 'none'} />
              </button>
            )}
            {!isMe && onMarkRead && (
              <button
                onClick={() => onMarkRead(message.id, !message.is_read)}
                className="p-1.5 rounded-lg bg-clawd-surface/90 backdrop-blur-sm text-clawd-text-dim hover:text-clawd-text hover:bg-clawd-border border border-clawd-border transition-all"
                title={message.is_read ? 'Mark unread' : 'Mark read'}
              >
                {message.is_read ? <Mail size={14} /> : <Check size={14} />}
              </button>
            )}
          </div>

          {/* Message bubble */}
          <div
            className={`px-4 py-3 transition-all ${
              isMe
                ? 'bg-gradient-to-br from-clawd-accent to-purple-500 text-white shadow-md rounded-2xl rounded-tr-sm'
                : 'bg-clawd-surface/90 backdrop-blur-sm border border-clawd-border/60 shadow-sm hover:shadow-md rounded-2xl rounded-tl-sm'
            } ${!message.is_read && !isMe ? 'ring-2 ring-clawd-accent/30' : ''}`}
          >
            {/* Subject (for thread root) */}
            {message.is_thread_root && message.subject && (
              <div className={`text-sm font-semibold mb-2 pb-2 ${
                isMe ? 'border-b border-white/20' : 'border-b border-clawd-border'
              }`}>
                {message.subject}
              </div>
            )}

            {/* Message content */}
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {expanded || !hasFullContent ? (
                message.full_content || message.preview
              ) : (
                message.preview
              )}
            </div>

            {/* Expand/collapse for long messages */}
            {hasFullContent && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`text-xs mt-3 flex items-center gap-1 transition-opacity ${
                  isMe ? 'opacity-80 hover:opacity-100' : 'text-clawd-text-dim hover:text-clawd-text'
                }`}
              >
                {expanded ? (
                  <>
                    <ChevronUp size={14} /> Show less
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Show more
                  </>
                )}
              </button>
            )}

            {/* Attachments indicator */}
            {message.has_attachment && (
              <div className={`flex items-center gap-1.5 mt-2 pt-2 text-xs ${
                isMe ? 'border-t border-white/20 opacity-90' : 'border-t border-clawd-border text-clawd-text-dim'
              }`}>
                <Paperclip size={14} />
                <span>Has attachment</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadView({
  threadId,
  metadata,
  onClose,
  onToggleStar,
  onMarkRead,
  onReply,
}: ThreadViewProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // Load thread messages
  useEffect(() => {
    const loadThread = async () => {
      setLoading(true);
      try {
        const result = await (window as any).clawdbot?.inbox?.getThread?.(threadId);
        if (result?.success && result.messages) {
          setMessages(result.messages);
        }
      } catch (e) {
        console.error('[ThreadView] Failed to load thread:', e);
      } finally {
        setLoading(false);
      }
    };

    loadThread();
  }, [threadId]);

  const handleReply = async () => {
    if (!replyText.trim() || sending) return;

    setSending(true);
    try {
      if (onReply) {
        await onReply(threadId, replyText);
        setReplyText('');
      }
    } catch (e) {
      console.error('[ThreadView] Failed to send reply:', e);
    } finally {
      setSending(false);
    }
  };

  const { email: myEmail, phone: myPhone } = useUserSettings();

  return (
    <div className="flex flex-col h-full bg-clawd-bg">
      {/* Thread header */}
      <div className="p-4 border-b border-clawd-border bg-clawd-surface flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle size={16} className="text-clawd-accent flex-shrink-0" />
            <h3 className="font-semibold text-sm truncate">
              {metadata?.subject || `Thread on ${metadata?.platform}`}
            </h3>
            {(metadata?.unread_count ?? 0) > 0 && (
              <span className="bg-clawd-accent text-white text-xs px-2 py-0.5 rounded-full">
                {metadata?.unread_count} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-clawd-text-dim">
            <span>{metadata?.message_count} messages</span>
            {metadata?.participants && (
              <>
                <span>•</span>
                <span>{metadata.participants.length} participants</span>
              </>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-2 px-3 py-1 text-sm text-clawd-text-dim hover:text-clawd-text transition-colors"
          >
            Close
          </button>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-clawd-text-dim py-8">Loading thread...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-clawd-text-dim py-8">No messages in this thread</div>
        ) : (
          <>
            {messages.map((msg) => {
              // Determine if message is from me
              const isMe =
                msg.sender === myEmail ||
                msg.sender === myPhone ||
                msg.sender_name === 'You';

              return (
                <ThreadMessage
                  key={msg.id}
                  message={msg}
                  isMe={isMe}
                  onToggleStar={onToggleStar}
                  onMarkRead={onMarkRead}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Reply input */}
      {onReply && (
        <div className="p-4 border-t border-clawd-border bg-clawd-surface">
          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleReply();
                }
              }}
              placeholder="Type your reply... (⌘↵ to send)"
              className="flex-1 bg-clawd-bg border border-clawd-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-clawd-accent"
              rows={3}
            />
            <button
              onClick={handleReply}
              disabled={!replyText.trim() || sending}
              className="px-4 py-2 bg-clawd-accent text-white rounded-lg hover:bg-clawd-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium self-end"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
          <div className="text-xs text-clawd-text-dim mt-2">
            Press ⌘+Enter to send
          </div>
        </div>
      )}
    </div>
  );
}
