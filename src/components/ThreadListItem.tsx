import { useState, memo, useCallback } from 'react';
import { MessageCircle, Star, Mail, Reply } from 'lucide-react';
import { Flex } from '@radix-ui/themes';
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

const ThreadListItem = memo(function ThreadListItem({
  thread,
  onClick,
  onToggleStar,
  onMarkRead,
}: ThreadListItemProps) {
  const [showModal, setShowModal] = useState(false);
  const hasUnread = thread.unread_count > 0;

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(thread.thread_id);
    } else {
      setShowModal(true);
    }
  }, [onClick, thread.thread_id]);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.(thread.thread_id);
  }, [onToggleStar, thread.thread_id]);

  const handleMarkReadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead?.(thread.thread_id, hasUnread);
  }, [onMarkRead, thread.thread_id, hasUnread]);

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
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }}}
        role="button"
        tabIndex={0}
        className={`group flex items-start gap-3 px-4 py-3 border-b border-mission-control-border/40 cursor-pointer hover:bg-mission-control-border/10 transition-colors ${
          hasUnread ? 'bg-mission-control-surface/30' : ''
        }`}
      >
        {/* Unread dot — always takes space to keep alignment */}
        <div className="mt-1.5 flex-shrink-0 w-1.5">
          {hasUnread && <div className="w-1.5 h-1.5 rounded-full bg-mission-control-accent" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Top row: sender + timestamp */}
          <Flex align="center" gap="2" className="mb-0.5">
            <span className={`text-sm flex-1 min-w-0 truncate ${hasUnread ? 'font-bold text-mission-control-text' : 'font-semibold text-mission-control-text'}`}>
              {thread.sender_name || participantsDisplay || 'Unknown'}
            </span>
            {thread.unreplied_count > 0 && (
              <span className="flex-shrink-0 text-[var(--color-warning)]" title={`${thread.unreplied_count} awaiting reply`}>
                <Reply size={10} />
              </span>
            )}
            <span className="text-[10px] tabular-nums text-mission-control-text-dim flex-shrink-0">
              {formatRelativeTime(thread.last_activity)}
            </span>
          </Flex>

          {/* Subject line */}
          {thread.subject && (
            <div className={`text-sm truncate ${hasUnread ? 'font-semibold text-mission-control-text' : 'text-mission-control-text'}`}>
              {thread.subject}
            </div>
          )}

          {/* Preview */}
          {thread.root_preview && (
            <p className="text-xs text-mission-control-text-dim line-clamp-1 mt-0.5">{thread.root_preview}</p>
          )}

          {/* Meta row: message count + badges */}
          <div className="flex items-center gap-1.5 mt-1">
            {thread.message_count > 1 && (
              <span className="flex items-center gap-0.5 text-xs tabular-nums text-mission-control-text-dim bg-mission-control-border/60 rounded px-1 py-0.5">
                <MessageCircle size={9} /> {thread.message_count}
              </span>
            )}
            {thread.unread_count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold tabular-nums bg-mission-control-accent text-white rounded-full flex-shrink-0">
                {thread.unread_count > 99 ? '99+' : thread.unread_count}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons — show on hover */}
        <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleStarClick}
            title={thread.has_starred ? 'Unstar' : 'Star'}
            aria-label={thread.has_starred ? 'Unstar' : 'Star'}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-md hover:bg-mission-control-border/40 transition-colors ${thread.has_starred ? 'text-[var(--color-warning)] opacity-100' : 'text-mission-control-text-dim'}`}
          >
            <Star size={12} fill={thread.has_starred ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={handleMarkReadClick}
            title={hasUnread ? 'Mark as read' : 'Mark as unread'}
            aria-label={hasUnread ? 'Mark as read' : 'Mark as unread'}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors"
          >
            <Mail size={12} />
          </button>
        </div>
      </div>

      {/* Thread view modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowModal(false); } }}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        >
          <div
            className="bg-mission-control-surface rounded-2xl border border-mission-control-border w-full max-w-4xl h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            <ThreadView
              threadId={thread.thread_id}
              metadata={thread}
              onClose={() => setShowModal(false)}
              onToggleStar={(_msgId) => {
                // FUTURE: Implement message-level star toggle with backend API
              }}
              onMarkRead={(_msgId, _isRead) => {
                // FUTURE: Implement message-level read toggle with backend API
              }}
              onReply={(_threadId, _message) => {
                // FUTURE: Implement reply functionality with backend API
                setShowModal(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
});

export default ThreadListItem;
