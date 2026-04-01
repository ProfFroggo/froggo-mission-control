/**
 * EmptyState Component
 *
 * A reusable empty state component for consistent UX across the dashboard.
 * Migrated to Radix Themes layout primitives.
 */

import React from 'react';
import { LucideIcon, Inbox, CheckCircle, Search, FolderOpen, Bell, Layout, Wallet, Package, AlertCircle } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@radix-ui/themes';

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
  /** Size variant controlling icon size and padding. Overrides compact. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional compact variant for smaller spaces. Prefer size='sm' for new usage. */
  compact?: boolean;
  /**
   * Visual tier:
   * - 'default' (local empty — filtered/contextual, items exist elsewhere)
   * - 'global' (first-time — section has never had content)
   * - 'error' (load failure — something went wrong)
   */
  variant?: 'default' | 'global' | 'error';
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

const ICON_SIZES: Record<'sm' | 'md' | 'lg', number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const PADDING_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'py-8 px-4',
  md: 'py-12 px-8',
  lg: 'py-16 px-8',
};

const EmptyState = React.memo(function EmptyState(props: EmptyStateProps) {
  const isPreset = 'type' in props && props.type !== undefined;

  const {
    description,
    action,
    size,
    compact = false,
    variant = 'default',
    className = '',
  } = props;

  const effectiveSize: 'sm' | 'md' | 'lg' = size ?? (compact ? 'sm' : 'md');

  // Error variant overrides icon/title to use AlertCircle + error colors
  const isError = variant === 'error';
  const Icon = isError ? AlertCircle : (isPreset ? presets[props.type].icon : props.icon);
  const title = isError
    ? (('icon' in props && props.title) || (isPreset ? presets[props.type].title : 'Something went wrong'))
    : (isPreset ? presets[props.type].title : (props as any).title);
  const desc = description || (isPreset ? presets[props.type].description : undefined);

  const iconSize = ICON_SIZES[effectiveSize];

  // Render action button or element
  const renderAction = (): React.ReactElement | null => {
    if (!action) return null;

    if (typeof action === 'object' && '$$typeof' in (action as object)) {
      return action as React.ReactElement;
    }

    const actionConfig = action as EmptyStateAction;
    return (
      <Button
        onClick={actionConfig.onClick}
        variant={actionConfig.variant === 'secondary' ? 'surface' : 'soft'}
        color={isError ? 'red' : actionConfig.variant === 'secondary' ? 'gray' : 'violet'}
        size="2"
      >
        {actionConfig.label}
      </Button>
    );
  };

  // Tier-specific styling
  const wrapperClass = variant === 'global'
    ? `rounded-xl border border-mission-control-accent/20 bg-mission-control-accent/5`
    : variant === 'error'
    ? `rounded-xl border border-error-border bg-error-subtle`
    : '';

  const iconClass = isError
    ? 'text-error opacity-70'
    : variant === 'global'
    ? 'text-mission-control-accent opacity-60'
    : 'text-mission-control-text-dim opacity-40';

  const titleClass = isError ? 'text-error' : 'text-mission-control-text';
  const descClass = isError ? 'text-error/70' : 'text-mission-control-text-dim';

  const containerSize = effectiveSize === 'sm' ? 'w-10 h-10' : effectiveSize === 'lg' ? 'w-14 h-14' : 'w-12 h-12';
  const containerIconSize = effectiveSize === 'sm' ? iconSize - 8 : iconSize - 16;

  return (
    <div
      className={`flex flex-col items-center justify-center h-full py-16 gap-3 text-center px-6 ${wrapperClass} ${className}`}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div
          className={`${containerSize} rounded-xl flex items-center justify-center ${
            isError
              ? 'bg-error/10'
              : variant === 'global'
              ? 'bg-mission-control-accent/10'
              : 'bg-mission-control-border/30'
          }`}
        >
          <Icon
            size={containerIconSize}
            className={iconClass}
            aria-hidden="true"
          />
        </div>
      )}

      <p className={`text-sm font-semibold mt-3 ${titleClass}`}>{title}</p>

      {desc && (
        <p className={`text-xs mt-1 max-w-[240px] text-center ${descClass}`}>{desc}</p>
      )}

      {renderAction()}
    </div>
  );
});

export default EmptyState;

/**
 * Pre-configured empty state presets for common scenarios
 * @deprecated Use the type prop instead
 */
export const EmptyStatePresets = {
  inbox: {
    icon: 'Inbox',
    title: 'No messages yet',
    description: 'Your inbox is empty. New messages will appear here.',
  },
  tasks: {
    icon: 'CheckCircle',
    title: 'No tasks yet',
    description: "You don't have any tasks assigned. New tasks will appear here.",
  },
  search: {
    icon: 'Search',
    title: 'No results found',
    description: "Try adjusting your search terms or filters to find what you're looking for.",
  },
  library: {
    icon: 'FolderOpen',
    title: 'No files yet',
    description: 'Your library is empty. Upload files to see them here.',
  },
  notifications: {
    icon: 'Bell',
    title: 'No notifications',
    description: "You're all caught up! New notifications will appear here.",
  },
  kanban: {
    icon: 'Layout',
    title: 'No items',
    description: 'This column is empty. Drag items here or create new ones.',
  },
  finance: {
    icon: 'Wallet',
    title: 'No transactions yet',
    description: 'Your transaction history is empty. Transactions will appear here.',
  },
  generic: {
    icon: 'Package',
    title: 'Nothing here yet',
    description: 'This area is currently empty. Content will appear here when available.',
  },
} as const;

export type EmptyStatePreset = keyof typeof EmptyStatePresets;
