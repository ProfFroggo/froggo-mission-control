import { useState } from 'react';
import { MessageCircle, Star, ChevronRight, User, Mail, Reply } from 'lucide-react';
import ThreadView from './ThreadView';

interface ThreadMetadata {
  thread_id: string;
  platform: string;
  subject?: string;
  participants: string[];
  message_count: number;
  last_activity: string;
  unread_count: number;
  unreplied_count: number;
  has_starred: boolean;
  root_message_id?: string;
  root_preview?: string;
  sender?: string;
  sender_name?: string;
}

interface ThreadListItemProps {
  thread: ThreadMetadata;
  onClick?: (threadId: string) => void;
  onToggleStar?: (threadId: string) => void;
  onMarkRead?: (threadId: string, isRead: boolean) => void;
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`;
  
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ThreadListItem({
  thread,
  onClick,
  onToggleStar,
  onMarkRead,
}: ThreadListItemProps) {
  const [showModal, setShowModal] = useState(false);
  const hasUnread = thread.unread_count > 0;

  const handleClick = () => {
    if (onClick) {
      onClick(thread.thread_id);
    } else {
      setShowModal(true);
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.(thread.thread_id);
  };

  const handleMarkReadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(thread.thread_id, hasUnread);
  };

  // Get participants display
  const participantsDisplay = thread.participants
    .map((p) => {
      // Extract name from email if needed
      const match = p.match(/^(.+?)\s*<.*>$/);
      return match ? match[1] : p;
    })
    .join(', ');

  return (
    <>
      <div
        onClick={handleClick}
        className={`bg-clawd-bg border rounded-lg p-3 mb-2 cursor-pointer transition-all hover:border-clawd-accent/50 ${
          hasUnread ? 'border-clawd-accent/30 bg-clawd-accent/5' : 'border-clawd-border'
        }`}
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Unread indicator */}
            {hasUnread && <div className="w-2 h-2 bg-clawd-accent rounded-full flex-shrink-0 mt-1" />}

            {/* Thread icon + participant count */}
            <div className="flex items-center gap-1 text-clawd-text-dim flex-shrink-0">
              <MessageCircle size={14} />
              <span className="text-xs">{thread.message_count}</span>
              {thread.unreplied_count > 0 && (
                <div className="relative ml-1" title={`${thread.unreplied_count} awaiting reply`}>
                  <Reply size={14} className="text-warning" />
                </div>
              )}
            </div>

            {/* Sender/participants */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <User size={14} className="text-clawd-text-dim flex-shrink-0" />
              <span className="text-sm font-semibold text-clawd-accent truncate">
                {thread.sender_name || participantsDisplay || 'Unknown'}
              </span>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {/* Star button */}
            <button
              onClick={handleStarClick}
              className={`p-1 rounded hover:bg-clawd-border transition-colors ${
                thread.has_starred ? 'text-warning' : 'text-clawd-text-dim'
              }`}
              title={thread.has_starred ? 'Unstar' : 'Star'}
            >
              <Star size={14} fill={thread.has_starred ? 'currentColor' : 'none'} />
            </button>

            {/* Mark read/unread */}
            <button
              onClick={handleMarkReadClick}
              className="p-1 rounded hover:bg-clawd-border text-clawd-text-dim transition-colors"
              title={hasUnread ? 'Mark as read' : 'Mark as unread'}
            >
              <Mail size={14} />
            </button>

            {/* Timestamp */}
            <span className="text-xs text-clawd-text-dim whitespace-nowrap">
              {formatRelativeTime(thread.last_activity)}
            </span>

            {/* Expand arrow */}
            <ChevronRight size={14} className="text-clawd-text-dim" />
          </div>
        </div>

        {/* Subject/preview line */}
        <div className="flex flex-col gap-1">
          {thread.subject && (
            <div className="text-sm font-medium truncate">{thread.subject}</div>
          )}
          {thread.root_preview && (
            <p className="text-sm text-clawd-text-dim line-clamp-2">{thread.root_preview}</p>
          )}
        </div>

        {/* Status badges */}
        {(hasUnread || thread.unreplied_count > 0) && (
          <div className="mt-2 flex gap-2">
            {hasUnread && (
              <span className="inline-flex items-center gap-1 text-xs bg-clawd-accent/20 text-clawd-accent px-2 py-0.5 rounded-full">
                {thread.unread_count} unread
              </span>
            )}
            {thread.unreplied_count > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-orange-500/20 text-warning px-2 py-0.5 rounded-full">
                {thread.unreplied_count} awaiting reply
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thread view modal */}
      {showModal && (
        <div
          className="fixed inset-0 modal-backdrop flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-clawd-surface rounded-2xl border border-clawd-border w-full max-w-4xl h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ThreadView
              threadId={thread.thread_id}
              metadata={thread}
              onClose={() => setShowModal(false)}
              onToggleStar={(msgId) => {
                // TODO: Implement message-level star toggle
              }}
              onMarkRead={(msgId, isRead) => {
                // TODO: Implement message-level read toggle
              }}
              onReply={(threadId, message) => {
                // TODO: Implement reply functionality
                setShowModal(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
