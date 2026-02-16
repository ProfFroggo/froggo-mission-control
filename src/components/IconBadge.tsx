/**
 * IconBadge Component
 * A reusable badge component for displaying icons with consistent styling and alignment
 */

import { LucideIcon } from 'lucide-react';

interface IconBadgeProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export default function IconBadge({ 
  icon: Icon, 
  size = 18, 
  color = 'bg-clawd-bg0/10 text-clawd-text-dim',
  rounded = 'lg',
  className = ''
}: IconBadgeProps) {
  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full'
  }[rounded];

  // Calculate min dimensions based on icon size + padding
  const minDimension = size + 16; // size + (2 * 8px padding)

  return (
    <div 
      className={`p-2 ${roundedClass} ${color} flex-shrink-0 inline-flex items-center justify-center ${className}`}
      style={{ 
        minWidth: `${minDimension}px`, 
        minHeight: `${minDimension}px`,
        // Remove fit-content to prevent layout shifts
        width: `${minDimension}px`,
        height: `${minDimension}px`
      }}
    >
      <Icon size={size} className="flex-shrink-0" />
    </div>
  );
}

/**
 * Preset badge configurations for common use cases
 */
export const BadgePresets = {
  // Notification types
  taskComplete: { color: 'text-success bg-success-subtle' },
  taskDeadline: { color: 'text-orange-400 bg-orange-500/10' },
  agentUpdate: { color: 'text-review bg-purple-500/10' },
  messageArrival: { color: 'text-info bg-info-subtle' },
  approvalPending: { color: 'text-warning bg-yellow-500/10' },
  calendarEvent: { color: 'text-pink-400 bg-pink-500/10' },
  systemAlert: { color: 'text-error bg-error-subtle' },
  skillLearned: { color: 'text-cyan-400 bg-cyan-500/10' },
  error: { color: 'text-error bg-error-subtle' },
  
  // Approval types
  tweet: { color: 'text-sky-400 bg-sky-500/20' },
  reply: { color: 'text-info bg-blue-500/20' },
  email: { color: 'text-success bg-green-500/20' },
  message: { color: 'text-review bg-purple-500/20' },
  task: { color: 'text-warning bg-yellow-500/20' },
  action: { color: 'text-success bg-green-500/20' },
  
  // Channels - using CSS custom properties for theme consistency
  discord: { color: 'text-[var(--channel-discord)] bg-[var(--channel-discord-bg)]' },
  telegram: { color: 'text-[var(--channel-telegram)] bg-[var(--channel-telegram-bg)]' },
  whatsapp: { color: 'text-[var(--channel-whatsapp)] bg-[var(--channel-whatsapp-bg)]' },
  webchat: { color: 'text-review bg-purple-500/20' },
  agents: { color: 'text-orange-400 bg-orange-500/20' },
} as const;
