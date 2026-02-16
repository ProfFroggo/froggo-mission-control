/**
 * EmptyState Component
 * 
 * A reusable empty state component for consistent UX across the dashboard.
 * Provides visual feedback when there's no content to display.
 * 
 * Features:
 * - Customizable icon (Lucide icon component)
 * - Title and description text
 * - Optional action button
 * - Uses design system tokens for consistent styling
 * - Responsive and accessible
 * 
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No messages yet"
 *   description="Your inbox is empty. New messages will appear here."
 *   action={{
 *     label: "Send message",
 *     onClick: () => handleSendMessage()
 *   }}
 * />
 * ```
 */

import { LucideIcon } from 'lucide-react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateProps {
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  /** Descriptive text explaining the empty state */
  description?: string;
  /** Optional action button configuration */
  action?: EmptyStateAction;
  /** Optional compact variant for smaller spaces */
  compact?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className = ''
}: EmptyStateProps) {
  const baseClasses = 'empty-state';
  const compactClasses = compact 
    ? 'py-8 px-4' 
    : 'py-16 px-8';

  return (
    <div className={`${baseClasses} ${compactClasses} ${className}`}>
      {/* Icon Container */}
      <div className="empty-state-icon">
        <Icon 
          size={compact ? 24 : 32} 
          className="text-clawd-text-dim"
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 className="empty-state-title">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="empty-state-description">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            action.variant === 'secondary'
              ? 'bg-clawd-border text-clawd-text hover:bg-clawd-border/80'
              : 'bg-clawd-accent text-white hover:bg-clawd-accent/90'
          }`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Pre-configured empty state presets for common scenarios
 */
export const EmptyStatePresets = {
  /** Empty inbox/messages */
  inbox: {
    icon: 'Inbox',
    title: 'No messages yet',
    description: 'Your inbox is empty. New messages will appear here.'
  },
  
  /** Empty tasks list */
  tasks: {
    icon: 'CheckCircle',
    title: 'No tasks yet',
    description: 'You don\'t have any tasks assigned. New tasks will appear here.'
  },
  
  /** Empty search results */
  search: {
    icon: 'Search',
    title: 'No results found',
    description: 'Try adjusting your search terms or filters to find what you\'re looking for.'
  },
  
  /** Empty library/files */
  library: {
    icon: 'FolderOpen',
    title: 'No files yet',
    description: 'Your library is empty. Upload files to see them here.'
  },
  
  /** Empty notifications */
  notifications: {
    icon: 'Bell',
    title: 'No notifications',
    description: 'You\'re all caught up! New notifications will appear here.'
  },
  
  /** Empty kanban column */
  kanban: {
    icon: 'Layout',
    title: 'No items',
    description: 'This column is empty. Drag items here or create new ones.'
  },
  
  /** Empty finance/transactions */
  finance: {
    icon: 'Wallet',
    title: 'No transactions yet',
    description: 'Your transaction history is empty. Transactions will appear here.'
  },
  
  /** Generic empty state */
  generic: {
    icon: 'Package',
    title: 'Nothing here yet',
    description: 'This area is currently empty. Content will appear here when available.'
  }
} as const;

export type EmptyStatePreset = keyof typeof EmptyStatePresets;
