import { useState } from 'react';
import { getAgentTheme } from '../utils/agentThemes';

interface AgentAvatarProps {
  agentId: string;
  fallbackEmoji?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  /** Show colored ring around avatar */
  ring?: boolean;
  /** Agent status: active (green pulse), paused (orange pulse), blocked (red), idle (grey) */
  status?: 'active' | 'paused' | 'blocked' | 'idle';
}

const sizeMap = {
  xs:  { container: 'w-5 h-5',   text: 'text-xs',   ring: 'ring-1' },
  sm:  { container: 'w-7 h-7',   text: 'text-sm',   ring: 'ring-1' },
  md:  { container: 'w-9 h-9',   text: 'text-lg',   ring: 'ring-2' },
  lg:  { container: 'w-12 h-12', text: 'text-2xl',  ring: 'ring-2' },
  xl:  { container: 'w-16 h-16', text: 'text-3xl',  ring: 'ring-2' },
  '2xl': { container: 'w-20 h-20', text: 'text-5xl', ring: 'ring-3' },
};

export default function AgentAvatar({ agentId, fallbackEmoji, size = 'md', className = '', ring = false, status }: AgentAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const theme = getAgentTheme(agentId);
  const s = sizeMap[size];
  const hasPic = theme.pic && !imgError;

  // Status-based ring styles
  const statusRing = status ? (() => {
    switch (status) {
      case 'active':
        return `ring-2 ring-green-400 animate-pulse`;
      case 'paused':
        return `ring-2 ring-orange-400 animate-pulse`;
      case 'blocked':
        return `ring-2 ring-red-400`;
      case 'idle':
        return `ring-1 ring-gray-600`;
      default:
        return '';
    }
  })() : '';

  return (
    <div className={`${s.container} relative rounded-full overflow-hidden flex-shrink-0 ${ring ? `ring ${s.ring} ${theme.ring}` : statusRing} ${className}`}>
      {hasPic ? (
        <img
          src={`./agent-profiles/${theme.pic}`}
          alt={agentId}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={`absolute inset-0 flex items-center justify-center ${s.text} ${theme.bg}`}>
          {fallbackEmoji || '🤖'}
        </span>
      )}
    </div>
  );
}
