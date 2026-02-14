import { Mail, MessageCircle } from 'lucide-react';

interface ReadStateBadgeProps {
  unreadCount?: number;
  unrepliedCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showZero?: boolean;
}

export function ReadStateBadge({ 
  unreadCount = 0, 
  unrepliedCount = 0, 
  size = 'md',
  showZero = false 
}: ReadStateBadgeProps) {
  const hasUnread = unreadCount > 0;
  const hasUnreplied = unrepliedCount > 0;
  
  // Don't render if no counts and showZero is false
  if (!showZero && !hasUnread && !hasUnreplied) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1.5 min-w-[3rem]',
    md: 'text-sm px-2 py-1 gap-1.5 min-w-[3.5rem]',
    lg: 'text-base px-3 py-1.5 gap-1.5 min-w-[4rem]',
  };

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  };

  return (
    <div className="inline-flex items-center gap-1.5 flex-shrink-0">
      {/* Unread badge */}
      {(hasUnread || showZero) && (
        <div className={`
          inline-flex items-center justify-center rounded-full flex-shrink-0
          ${hasUnread ? 'bg-info-subtle text-info font-semibold' : 'bg-clawd-border text-clawd-text-dim'}
          ${sizeClasses[size]}
        `}>
          <Mail size={iconSizes[size]} className="flex-shrink-0" />
          <span className="flex-shrink-0 min-w-[1.5ch] text-center tabular-nums">{unreadCount}</span>
        </div>
      )}
      
      {/* Unreplied badge */}
      {(hasUnreplied || showZero) && (
        <div className={`
          inline-flex items-center justify-center rounded-full flex-shrink-0
          ${hasUnreplied ? 'bg-orange-500/20 text-orange-400 font-semibold' : 'bg-clawd-border text-clawd-text-dim'}
          ${sizeClasses[size]}
        `}>
          <MessageCircle size={iconSizes[size]} className="flex-shrink-0" />
          <span className="flex-shrink-0 min-w-[1.5ch] text-center tabular-nums">{unrepliedCount}</span>
        </div>
      )}
    </div>
  );
}

interface UnreadDotProps {
  show: boolean;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function UnreadDot({ show, size = 'md', pulse = false }: UnreadDotProps) {
  if (!show) return null;

  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div className={`
      rounded-full bg-blue-500 flex-shrink-0
      ${sizeClasses[size]}
      ${pulse ? 'animate-pulse' : ''}
    `} />
  );
}

interface UnrepliedIndicatorProps {
  show: boolean;
  count?: number;
  compact?: boolean;
}

export function UnrepliedIndicator({ show, count, compact = false }: UnrepliedIndicatorProps) {
  if (!show) return null;

  if (compact) {
    return (
      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium flex-shrink-0 whitespace-nowrap">
      <MessageCircle size={14} className="flex-shrink-0" />
      {count !== undefined && <span className="flex-shrink-0">Awaiting reply</span>}
    </div>
  );
}
