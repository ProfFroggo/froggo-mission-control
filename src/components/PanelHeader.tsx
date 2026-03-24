/**
 * PanelHeader.tsx
 *
 * Standardized panel header component for consistent layout across all panels.
 * Provides consistent spacing, typography, and action button placement.
 */

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button, IconButton, Spinner, Badge } from '@radix-ui/themes';

interface PanelHeaderAction {
  icon?: LucideIcon | ReactNode;
  label?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  kbd?: string; // Keyboard shortcut hint
}

interface PanelHeaderProps {
  // Title
  icon?: LucideIcon | ReactNode;
  title: string;
  subtitle?: string | ReactNode;

  // Stats/Badges
  badge?: string | number;
  stats?: { label: string; value: string | number; color?: string }[];

  // Actions
  actions?: PanelHeaderAction[];
  children?: ReactNode; // For custom content (filters, search, etc.)

  // Styling
  variant?: 'default' | 'compact' | 'large';
  border?: boolean;
  gradient?: boolean;
}

export default function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  stats,
  actions,
  children,
  variant = 'default',
  border = true,
  gradient = false,
}: PanelHeaderProps) {
  return (
    <div
      className={`
        flex items-center justify-between px-4 py-3
        ${border ? 'border-b border-mission-control-border' : ''}
        ${gradient ? 'bg-gradient-to-r from-mission-control-surface to-mission-control-bg' : 'bg-mission-control-surface'}
      `}
    >
      {/* Left: Icon + Title + Subtitle + Badge */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && (
          <div className="flex-shrink-0">
            {typeof Icon === 'function' ? (
              <Icon size={variant === 'compact' ? 16 : variant === 'large' ? 24 : 20} className="text-mission-control-accent" />
            ) : (
              Icon
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-mission-control-text truncate">{title}</h2>
            {badge !== undefined && (
              <Badge color="violet" variant="soft" size="1">
                {badge}
              </Badge>
            )}
          </div>
          {subtitle && (
            <div className="text-xs text-mission-control-text-dim mt-0.5">
              {subtitle}
            </div>
          )}
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-mission-control-text-dim mt-0.5 tabular-nums font-mono">
              {stats.map((stat) => (
                <div key={stat.label} className="flex items-center gap-1">
                  <span className={stat.color || 'text-mission-control-text'}>{stat.value}</span>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      {((actions && actions.length > 0) || children) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions && actions.map((action, index) => {
            const ActionIcon = typeof action.icon === 'function' ? action.icon as LucideIcon : null;
            const radixVariant = action.variant === 'primary' ? 'solid' : action.variant === 'ghost' ? 'ghost' : 'surface';
            const radixColor = action.variant === 'primary' ? 'violet' : 'gray';

            // Icon-only button
            if (!action.label && ActionIcon) {
              return (
                <IconButton
                  key={index}
                  variant="ghost"
                  color="gray"
                  size="1"
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  aria-label={action.kbd || `action-${index}`}
                >
                  {action.loading ? <Spinner size="1" /> : <ActionIcon size={14} />}
                </IconButton>
              );
            }

            return (
              <Button
                key={action.label || `action-${index}`}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                variant={radixVariant as 'solid' | 'ghost' | 'surface'}
                color={radixColor as 'violet' | 'gray'}
                size="1"
              >
                {action.loading ? (
                  <Spinner size="1" />
                ) : ActionIcon ? (
                  <ActionIcon size={14} />
                ) : (
                  action.icon as ReactNode
                )}
                {action.label && <span>{action.label}</span>}
                {action.kbd && (
                  <kbd className="px-1 py-0.5 bg-mission-control-text/20 rounded text-xs font-mono">
                    {action.kbd}
                  </kbd>
                )}
              </Button>
            );
          })}
          {children}
        </div>
      )}
    </div>
  );
}
