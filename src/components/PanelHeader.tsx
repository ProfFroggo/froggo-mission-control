/**
 * PanelHeader.tsx
 *
 * Canonical panel header — matches the Library panel reference implementation.
 *
 * Default layout: icon in accent-tinted box + bold title + dimmed subtitle.
 * Actions render on the right side of the header row.
 *
 * Usage with tabs below the header:
 *   Wrap <PanelHeader> + <TabNav> in a single
 *   `<div className="border-b border-mission-control-border bg-mission-control-surface">`
 *   and pass `border={false}` to PanelHeader.
 *
 * Usage without tabs:
 *   Use <PanelHeader> standalone — it renders its own border-b by default.
 */

import React, { ReactNode, isValidElement } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button, IconButton, Spinner, Badge } from '@radix-ui/themes';

/** Renders an icon prop that may be a Lucide component (function or forwardRef object) or a pre-rendered ReactNode. */
function renderIcon(Icon: LucideIcon | ReactNode, size: number, className: string) {
  if (!Icon) return null;
  if (isValidElement(Icon)) return Icon;
  // forwardRef icons have typeof === 'object', not 'function'
  return React.createElement(Icon as React.ElementType, { size, className });
}

interface PanelHeaderAction {
  icon?: LucideIcon | ReactNode;
  label?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  kbd?: string;
}

interface PanelHeaderProps {
  icon?: LucideIcon | ReactNode;
  title: string;
  subtitle?: string | ReactNode;
  badge?: string | number;
  stats?: { label: string; value: string | number; color?: string }[];
  actions?: PanelHeaderAction[];
  children?: ReactNode;
  /** Pass false when tabs follow below — caller provides the border-b wrapper. */
  border?: boolean;
  /** compact variant keeps the old tight style (px-4 py-3, small text) for modals/sidebars. */
  variant?: 'default' | 'compact';
}

export default function PanelHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  stats,
  actions,
  children,
  border = true,
  variant = 'default',
}: PanelHeaderProps) {
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center justify-between px-4 py-3 bg-mission-control-surface${border ? ' border-b border-mission-control-border' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {Icon && (
            <div className="flex-shrink-0">
              {renderIcon(Icon, 16, 'text-mission-control-accent')}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-mission-control-text truncate">{title}</h2>
              {badge !== undefined && (
                <Badge color="violet" variant="soft" size="1">{badge}</Badge>
              )}
            </div>
            {subtitle && (
              <div className="text-xs text-mission-control-text-dim mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        {((actions && actions.length > 0) || children) && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {renderActions(actions)}
            {children}
          </div>
        )}
      </div>
    );
  }

  // Default: Library-style header
  return (
    <div
      className={`flex items-start justify-between p-6 pb-4 bg-mission-control-surface${border ? ' border-b border-mission-control-border' : ''}`}
    >
      {/* Left: icon-in-box + title + subtitle */}
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-2 bg-mission-control-accent/20 rounded-lg flex-shrink-0">
            {renderIcon(Icon, 24, 'text-mission-control-accent')}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-mission-control-text">{title}</h2>
            {badge !== undefined && (
              <Badge color="violet" variant="soft" size="2">{badge}</Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-mission-control-text-dim mt-0.5">{subtitle}</p>
          )}
          {stats && stats.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-mission-control-text-dim mt-1 tabular-nums font-mono">
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

      {/* Right: actions */}
      {((actions && actions.length > 0) || children) && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-4">
          {renderActions(actions)}
          {children}
        </div>
      )}
    </div>
  );
}

function renderActions(actions?: PanelHeaderAction[]) {
  if (!actions) return null;
  return actions.map((action, index) => {
    const ActionIcon = (action.icon && !isValidElement(action.icon)) ? action.icon as LucideIcon : null;
    const radixVariant = action.variant === 'primary' ? 'solid' : action.variant === 'ghost' ? 'ghost' : 'surface';
    const radixColor = action.variant === 'primary' ? 'violet' : 'gray';

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
  });
}
