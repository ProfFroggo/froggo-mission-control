/**
 * IconBadge Component
 * A reusable badge component for displaying icons with consistent styling and alignment
 */

import type React from 'react';
import { LucideIcon } from 'lucide-react';
import { Box } from '@radix-ui/themes';

interface IconBadgeProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: LucideIcon | React.ComponentType<any>;
  size?: number;
  color?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export default function IconBadge({ 
  icon: Icon, 
  size = 18, 
  color = 'bg-mission-control-bg/10 text-mission-control-text-dim',
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
    <Box
      flexShrink="0"
      className={`p-2 ${roundedClass} ${color} inline-flex items-center justify-center ${className}`}
      style={{
        minWidth: `${minDimension}px`,
        minHeight: `${minDimension}px`,
        width: `${minDimension}px`,
        height: `${minDimension}px`
      }}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    >
      <Icon size={size} className="flex-shrink-0" aria-hidden="true" />
    </Box>
  );
}

/**
 * Preset badge configurations for common use cases
 */
export const BadgePresets = {
  // Notification types
  taskComplete: { color: 'text-[var(--color-success)] bg-[var(--color-success)]/10' },
  taskDeadline: { color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10' },
  agentUpdate: { color: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle' },
  messageArrival: { color: 'text-[var(--color-info)] bg-[var(--color-info)]/10' },
  approvalPending: { color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10' },
  calendarEvent: { color: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle' },
  systemAlert: { color: 'text-[var(--color-error)] bg-[var(--color-error)]/10' },
  skillLearned: { color: 'text-[var(--color-info)] bg-[var(--color-info)]/10' },
  error: { color: 'text-[var(--color-error)] bg-[var(--color-error)]/10' },
  
  // Approval types
  tweet: { color: 'text-[var(--color-info)] bg-[var(--color-info)]/10' },
  reply: { color: 'text-[var(--color-info)] bg-[var(--color-info)]/10' },
  email: { color: 'text-[var(--color-success)] bg-[var(--color-success)]/10' },
  message: { color: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle' },
  task: { color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10' },
  action: { color: 'text-[var(--color-success)] bg-[var(--color-success)]/10' },
  
  // Channels - using CSS custom properties for theme consistency
  discord: { color: 'text-[var(--channel-discord)] bg-[var(--channel-discord-bg)]' },
  telegram: { color: 'text-[var(--channel-telegram)] bg-[var(--channel-telegram-bg)]' },
  whatsapp: { color: 'text-[var(--channel-whatsapp)] bg-[var(--channel-whatsapp-bg)]' },
  webchat: { color: 'text-[var(--color-review)] bg-[var(--color-review)]-subtle' },
  agents: { color: 'text-[var(--color-warning)] bg-[var(--color-warning)]/10' },
} as const;
