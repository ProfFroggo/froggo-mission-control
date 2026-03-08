/**
 * EmptyState Component
 * 
 * A reusable empty state component for consistent UX across the dashboard.
 * Provides visual feedback when there's no content to display.
 * 
 * Features:
 * - Customizable icon (Lucide icon component) OR preset types
 * - Title and description text
 * - Optional action button (config object or React element)
 * - Uses design system tokens for consistent styling
 * - Responsive and accessible
 * 
 * Usage with preset type:
 * ```tsx
 * <EmptyState
 *   type="inbox"
 *   description="Custom description override"
 *   action={{ label: "Action", onClick: handleClick }}
 * />
 * ```
 * 
 * Usage with custom props:
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No messages yet"
 *   description="Your inbox is empty."
 *   action={{ label: "Send message", onClick: handleSend }}
 * />
 * ```
 */

import { LucideIcon, Inbox, CheckCircle, Search, FolderOpen, Bell, Layout, Wallet, Package } from 'lucide-react';
import { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStateBaseProps {
  /** Descriptive text explaining the empty state (overrides preset) */
  description?: string;
  /** Optional action button configuration or React element */
  action?: EmptyStateAction | ReactNode;
  /** Optional compact variant for smaller spaces */
  compact?: boolean;
  /** Optional additional CSS classes */
  className?: string;
}

interface EmptyStateWithType extends EmptyStateBaseProps {
  /** Preset type for common empty state scenarios */
  type: 'inbox' | 'tasks' | 'search' | 'files' | 'notifications' | 'kanban' | 'finance' | 'generic';
  icon?: never;
  title?: never;
}

interface EmptyStateWithIcon extends EmptyStateBaseProps {
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  type?: never;
}

type EmptyStateProps = EmptyStateWithType | EmptyStateWithIcon;

// Preset configurations
const presets: Record<string, { icon: LucideIcon; title: string; description: string }> = {
  inbox: {
    icon: Inbox,
    title: 'No messages yet',
    description: 'Your inbox is empty. New messages will appear here.',
  },
  tasks: {
    icon: CheckCircle,
    title: 'No tasks yet',
    description: "You don't have any tasks assigned. New tasks will appear here.",
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: "Try adjusting your search terms or filters to find what you're looking for.",
  },
  files: {
    icon: FolderOpen,
    title: 'No files yet',
    description: 'Your library is empty. Upload files to see them here.',
  },
  notifications: {
    icon: Bell,
    title: 'No notifications',
    description: "You're all caught up! New notifications will appear here.",
  },
  kanban: {
    icon: Layout,
    title: 'No items',
    description: 'This column is empty. Drag items here or create new ones.',
  },
  finance: {
    icon: Wallet,
    title: 'No transactions yet',
    description: 'Your transaction history is empty. Transactions will appear here.',
  },
  generic: {
    icon: Package,
    title: 'Nothing here yet',
    description: 'This area is currently empty. Content will appear here when available.',
  },
};

export default function EmptyState(props: EmptyStateProps) {
  // Determine if using preset type or custom props
  const isPreset = 'type' in props && props.type !== undefined;
  
  const {
    description,
    action,
    compact = false,
    className = '',
  } = props;

  // Get icon and title from preset or props
  const Icon = isPreset ? presets[props.type].icon : props.icon;
  const title = isPreset ? presets[props.type].title : props.title;
  const desc = description || (isPreset ? presets[props.type].description : undefined);

  const baseClasses = 'empty-state';
  const compactClasses = compact 
    ? 'py-8 px-4' 
    : 'py-16 px-8';

  // Render action button or element
  const renderAction = (): React.ReactElement | null => {
    if (!action) return null;
    
    // If action is a React element, render it directly
    if (typeof action === 'object' && '$$typeof' in action) {
      return action as React.ReactElement;
    }
    
    // Otherwise, it's an EmptyStateAction config
    const actionConfig = action as EmptyStateAction;
    return (
      <button
        onClick={actionConfig.onClick}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          actionConfig.variant === 'secondary'
            ? 'bg-mission-control-border text-mission-control-text hover:bg-mission-control-border/80'
            : 'bg-mission-control-accent text-white hover:bg-mission-control-accent/90'
        }`}
      >
        {actionConfig.label}
      </button>
    );
  };

  return (
    <div 
      className={`${baseClasses} ${compactClasses} ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Icon Container */}
      <div className="empty-state-icon">
        <Icon 
          size={compact ? 24 : 32} 
          className="text-mission-control-text-dim"
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 className="empty-state-title">
        {title}
      </h3>

      {/* Description */}
      {desc && (
        <p className="empty-state-description">
          {desc}
        </p>
      )}

      {/* Action */}
      {renderAction()}
    </div>
  );
}

/**
 * Pre-configured empty state presets for common scenarios
 * @deprecated Use the type prop instead
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
