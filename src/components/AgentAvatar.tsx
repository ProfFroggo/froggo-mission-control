import { useState, useRef, useEffect, useCallback } from 'react';
import { getAgentTheme } from '../utils/agentThemes';

interface AgentAvatarProps {
  agentId: string;
  agentName?: string;
  fallbackEmoji?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  /** Show colored ring around avatar */
  ring?: boolean;
  /** Agent status: active (green pulse), paused (orange pulse), blocked (red), idle (grey) */
  status?: 'active' | 'paused' | 'blocked' | 'idle';
}

const sizeMap = {
  xs:  { container: 'w-5 h-5',   text: 'text-[9px]',  ring: 'ring-1' },
  sm:  { container: 'w-7 h-7',   text: 'text-xs',      ring: 'ring-1' },
  md:  { container: 'w-9 h-9',   text: 'text-sm',      ring: 'ring-2' },
  lg:  { container: 'w-12 h-12', text: 'text-lg',      ring: 'ring-2' },
  xl:  { container: 'w-16 h-16', text: 'text-xl',      ring: 'ring-2' },
  '2xl': { container: 'w-20 h-20', text: 'text-3xl',   ring: 'ring-3' },
};

// Retry delays (ms) after a 404 — covers the window where the agent was
// just hired but avatar generation hasn't saved the file yet.
const RETRY_DELAYS = [2000, 5000, 10000];

/** Derive 1-2 character initials from agent name or id */
function getInitials(name?: string, id?: string): string {
  const source = name || id || '?';
  const parts = source.replace(/[-_]/g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function AgentAvatar({ agentId, agentName, fallbackEmoji, size = 'md', className = '', ring = false, status }: AgentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const theme = getAgentTheme(agentId);
  const s = sizeMap[size];
  const hasPic = !imgError;

  const handleImgError = useCallback(() => {
    if (retryCount < RETRY_DELAYS.length) {
      retryTimer.current = setTimeout(() => {
        setRetryCount(n => n + 1);
        setImgError(false);
      }, RETRY_DELAYS[retryCount]);
    } else {
      setImgError(true);
    }
  }, [retryCount]);

  useEffect(() => {
    return () => { if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, []);

  // Status-based ring styles
  const statusRing = status ? (() => {
    switch (status) {
      case 'active':
        return `ring-2 ring-success animate-pulse`;
      case 'paused':
        return `ring-2 ring-warning animate-pulse`;
      case 'blocked':
        return `ring-2 ring-error`;
      case 'idle':
        return `ring-1 ring-mission-control-border`;
      default:
        return '';
    }
  })() : '';

  const initials = getInitials(agentName, agentId);

  return (
    <div className={`${s.container} relative rounded-full overflow-hidden flex-shrink-0 ${ring ? `ring ${s.ring} ${theme.ring}` : statusRing} ${className}`}>
      {hasPic ? (
        <img
          src={`/api/agents/${agentId}/avatar?v=${agentId}-${Math.floor(Date.now() / 60000)}-${retryCount}`}
          alt={`${agentName || agentId} avatar`}
          className="w-full h-full object-cover"
          onError={handleImgError}
        />
      ) : (
        <span
          className={`absolute inset-0 flex items-center justify-center ${s.text} font-semibold ${theme.text}`}
          style={{ backgroundColor: theme.color + '22' }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
