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
  taskComplete: { color: 'text-green-400 bg-green-500/10' },
  taskDeadline: { color: 'text-orange-400 bg-orange-500/10' },
  agentUpdate: { color: 'text-purple-400 bg-purple-500/10' },
  messageArrival: { color: 'text-blue-400 bg-blue-500/10' },
  approvalPending: { color: 'text-yellow-400 bg-yellow-500/10' },
  calendarEvent: { color: 'text-pink-400 bg-pink-500/10' },
  systemAlert: { color: 'text-red-400 bg-red-500/10' },
  skillLearned: { color: 'text-cyan-400 bg-cyan-500/10' },
  error: { color: 'text-red-400 bg-red-500/10' },
  
  // Approval types
  tweet: { color: 'text-sky-400 bg-sky-500/20' },
  reply: { color: 'text-blue-400 bg-blue-500/20' },
  email: { color: 'text-green-400 bg-green-500/20' },
  message: { color: 'text-purple-400 bg-purple-500/20' },
  task: { color: 'text-yellow-400 bg-yellow-500/20' },
  action: { color: 'text-green-400 bg-green-500/20' },
  
  // Channels
  discord: { color: 'text-[#5865F2] bg-[#5865F2]/20' },
  telegram: { color: 'text-[#229ED9] bg-[#229ED9]/20' },
  whatsapp: { color: 'text-[#25D366] bg-[#25D366]/20' },
  webchat: { color: 'text-purple-400 bg-purple-500/20' },
  agents: { color: 'text-orange-400 bg-orange-500/20' },
} as const;
