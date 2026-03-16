/**
 * PanelHeader.tsx
 * 
 * Standardized panel header component for consistent layout across all panels.
 * Provides consistent spacing, typography, and action button placement.
 */

import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

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
  // Variant-specific spacing
  const variantStyles = {
    compact: 'p-3',
    default: 'p-4',
    large: 'p-6',
  };

  const titleStyles = {
    compact: 'text-heading-3',
    default: 'text-heading-2',
    large: 'text-heading-1',
  };

  const subtitleStyles = {
    compact: 'text-caption',
    default: 'text-secondary',
    large: 'text-body',
  };

  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${border ? 'border-b border-mission-control-border' : ''}
        ${gradient ? 'bg-gradient-to-r from-mission-control-surface to-mission-control-bg' : 'bg-mission-control-surface'}
      `}
    >
      {/* Title Row */}
      <div className="flex items-center justify-between gap-4 mb-2">
        {/* Left: Title & Icon */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon */}
          {Icon && (
            <div className="flex-shrink-0">
              {typeof Icon === 'function' ? (
                <Icon size={variant === 'compact' ? 20 : variant === 'large' ? 28 : 24} className="text-mission-control-accent" />
              ) : (
                Icon
              )}
            </div>
          )}

          {/* Title & Subtitle */}
          <div className="min-w-0 flex-1">
            <h1 className={`${titleStyles[variant]} truncate flex items-center gap-2`}>
              {title}
              {badge !== undefined && (
                <span className="px-2 py-0.5 bg-mission-control-accent/20 text-mission-control-accent rounded-full text-sm font-normal">
                  {badge}
                </span>
              )}
            </h1>
            {subtitle && (
              <div className={`${subtitleStyles[variant]} mt-0.5`}>
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions.map((action, index) => {
              const ActionIcon = typeof action.icon === 'function' ? action.icon : null;

              return (
                <button
                  key={action.label || `action-${index}`}
                  onClick={action.onClick}
                  disabled={action.disabled || action.loading}
                  className={`
                    inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium
                    transition-all duration-150 active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${
                      action.variant === 'primary'
                        ? 'bg-mission-control-accent text-white hover:bg-mission-control-accent/90 shadow-glow'
                        : action.variant === 'ghost'
                        ? 'hover:bg-mission-control-border text-mission-control-text'
                        : 'bg-mission-control-bg border border-mission-control-border hover:border-mission-control-accent/50 text-mission-control-text'
                    }
                  `}
                >
                  {action.loading ? (
                    <div className="animate-spin">⏳</div>
                  ) : ActionIcon ? (
                    <ActionIcon size={16} className="flex-shrink-0" />
                  ) : (
                    action.icon as ReactNode
                  )}
                  {action.label && <span>{action.label}</span>}
                  {action.kbd && (
                    <kbd className="px-1.5 py-0.5 bg-mission-control-text/20 rounded text-xs">
                      {action.kbd}
                    </kbd>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Row (if provided) */}
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-mission-control-text-dim">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5">
              <span className={stat.color || 'text-mission-control-text'}>{stat.value}</span>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Custom Content (filters, search, etc.) */}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
