/**
 * EmptyState Component
 *
 * A reusable empty state component for consistent UX across the dashboard.
 * Migrated to Radix Themes layout primitives.
 */

import { LucideIcon, Inbox, CheckCircle, Search, FolderOpen, Bell, Layout, Wallet, Package } from 'lucide-react';
import { ReactNode } from 'react';
import { Flex, Heading, Text, Button } from '@radix-ui/themes';

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

export default function EmptyState(props: EmptyStateProps) {
  const isPreset = 'type' in props && props.type !== undefined;

  const {
    description,
    action,
    size,
    compact = false,
    className = '',
  } = props;

  const effectiveSize: 'sm' | 'md' | 'lg' = size ?? (compact ? 'sm' : 'md');

  const Icon = isPreset ? presets[props.type].icon : props.icon;
  const title = isPreset ? presets[props.type].title : props.title;
  const desc = description || (isPreset ? presets[props.type].description : undefined);

  const paddingClasses = PADDING_CLASSES[effectiveSize];
  const iconSize = ICON_SIZES[effectiveSize];
  const titleSize = effectiveSize === 'sm' ? '3' : effectiveSize === 'lg' ? '5' : '4';

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
        color={actionConfig.variant === 'secondary' ? 'gray' : 'grass'}
        size="2"
      >
        {actionConfig.label}
      </Button>
    );
  };

  return (
    <Flex
      direction="column"
      align="center"
      gap="3"
      className={`empty-state ${paddingClasses} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="empty-state-icon">
        <Icon
          size={iconSize}
          className="text-mission-control-text-dim/40"
          aria-hidden="true"
        />
      </div>

      <Heading size={titleSize as '3' | '4' | '5'} color="gray" className="empty-state-title">
        {title}
      </Heading>

      {desc && (
        <Text size="2" color="gray" align="center" className="empty-state-description">
          {desc}
        </Text>
      )}

      {renderAction()}
    </Flex>
  );
}

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
