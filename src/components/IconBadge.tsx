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
  color = 'bg-clawd-bg/10 text-clawd-text-dim',
  rounded = 'lg',
  className = '',
  'aria-label': ariaLabel
}: IconBadgeProps & { 'aria-label'?: string }) {
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
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <Icon size={size} className="flex-shrink-0" aria-hidden="true" />
    </div>
  );
}

/**
 * Preset badge configurations for common use cases
 */
export const BadgePresets = {
  // Notification types
  taskComplete: { color: 'text-success bg-success-subtle' },
  taskDeadline: { color: 'text-warning bg-warning-subtle' },
  agentUpdate: { color: 'text-review bg-review-subtle' },
  messageArrival: { color: 'text-info bg-info-subtle' },
  approvalPending: { color: 'text-warning bg-warning-subtle' },
  calendarEvent: { color: 'text-review bg-review-subtle' },
  systemAlert: { color: 'text-error bg-error-subtle' },
  skillLearned: { color: 'text-info bg-info-subtle' },
  error: { color: 'text-error bg-error-subtle' },
  
  // Approval types
  tweet: { color: 'text-info bg-info-subtle' },
  reply: { color: 'text-info bg-info-subtle' },
  email: { color: 'text-success bg-success-subtle' },
  message: { color: 'text-review bg-review-subtle' },
  task: { color: 'text-warning bg-warning-subtle' },
  action: { color: 'text-success bg-success-subtle' },
  
  // Channels - using CSS custom properties for theme consistency
  discord: { color: 'text-[var(--channel-discord)] bg-[var(--channel-discord-bg)]' },
  telegram: { color: 'text-[var(--channel-telegram)] bg-[var(--channel-telegram-bg)]' },
  whatsapp: { color: 'text-[var(--channel-whatsapp)] bg-[var(--channel-whatsapp-bg)]' },
  webchat: { color: 'text-review bg-review-subtle' },
  agents: { color: 'text-warning bg-warning-subtle' },
} as const;
