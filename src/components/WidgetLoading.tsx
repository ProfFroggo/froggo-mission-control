/**
 * WidgetLoading Component
 * 
 * Standardized loading states for dashboard widgets.
 * Provides consistent loading UI across all widget components.
 * 
 * Usage:
 * ```tsx
 * // Widget skeleton (default)
 * <WidgetLoading />
 * 
 * // Widget skeleton with custom line count
 * <WidgetLoading lines={5} />
 * 
 * // Compact version for smaller widgets
 * <WidgetLoading compact />
 * 
 * // Full widget loader with spinner
 * <WidgetLoading variant="spinner" title="Loading stats..." />
 * ```
 */

import { Skeleton, SkeletonText } from './Skeleton';
import { Spinner } from './LoadingStates';
import { LucideIcon } from 'lucide-react';

interface WidgetLoadingProps {
  /** Visual variant - skeleton or spinner */
  variant?: 'skeleton' | 'spinner';
  /** Number of skeleton lines (for skeleton variant) */
  lines?: number;
  /** Loading message (for spinner variant) */
  title?: string;
  /** Icon to show with loading message */
  icon?: LucideIcon;
  /** Compact mode for smaller widgets */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Standard widget loading component
 */
export default function WidgetLoading({
  variant = 'skeleton',
  lines = 4,
  title = 'Loading...',
  icon: Icon,
  compact = false,
  className = ''
}: WidgetLoadingProps) {
  if (variant === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
        {Icon && <Icon size={compact ? 24 : 32} className="text-mission-control-text-dim mb-3 opacity-50" />}
        <Spinner size={compact ? 16 : 24} />
        <p className={`text-mission-control-text-dim mt-3 ${compact ? 'text-xs' : 'text-sm'}`}>
          {title}
        </p>
      </div>
    );
  }

  // Skeleton variant (default)
  return (
    <div className={`p-4 space-y-3 ${className}`}>
      {/* Header skeleton */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-lg`} />
        <Skeleton className={`h-${compact ? '4' : '5'} w-1/3`} />
      </div>
      
      {/* Content skeleton lines */}
      <SkeletonText lines={lines} />
      
      {/* Footer/action skeleton */}
      {!compact && (
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      )}
    </div>
  );
}

/**
 * Widget header skeleton - for widgets with just header loading
 */
export function WidgetHeaderSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 p-4 border-b border-mission-control-border ${className}`}>
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-16 ml-auto" />
    </div>
  );
}

/**
 * Widget list skeleton - for widgets that display lists
 */
export function WidgetListSkeleton({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-2 p-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Widget card skeleton - for card-style widgets
 */
export function WidgetCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-2/3 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}

/**
 * Widget stats skeleton - for stats/metrics widgets
 */
export function WidgetStatsSkeleton({ items = 4, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`p-4 space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-12 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * Preset loading configurations for common widget types
 */
export const WidgetLoadingPresets = {
  /** Calendar widget loading state */
  calendar: {
    variant: 'spinner' as const,
    title: 'Loading calendar...',
    icon: 'Calendar'
  },
  
  /** Email widget loading state */
  email: {
    variant: 'spinner' as const,
    title: 'Checking inboxes...',
    icon: 'Mail'
  },
  
  /** Inbox widget loading state */
  inbox: {
    variant: 'skeleton' as const,
    lines: 3
  },
  
  /** Health status widget loading state */
  health: {
    variant: 'spinner' as const,
    title: 'Checking status...',
    compact: true
  },
  
  /** Weather widget loading state */
  weather: {
    variant: 'spinner' as const,
    title: 'Loading weather...',
    icon: 'Cloud'
  },
  
  /** Stats widget loading state */
  stats: {
    variant: 'skeleton' as const,
    lines: 4
  },
  
  /** Generic widget loading state */
  generic: {
    variant: 'skeleton' as const,
    lines: 3
  }
};
