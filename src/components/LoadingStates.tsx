/**
 * LoadingStates.tsx
 *
 * Reusable loading components for consistent UX across the dashboard.
 * Provides spinners, skeletons, and loading button states.
 * Migrated to Radix Themes primitives.
 */

import { Spinner as RadixSpinner, Button, Flex, Text, Box } from '@radix-ui/themes';
import { ReactNode } from 'react';
import EmptyState from './EmptyState';

export { EmptyState };

// ============================================================================
// Spinner - For inline loading indicators
// ============================================================================

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 16, className = '' }: SpinnerProps) {
  const radixSize = size <= 14 ? '1' : size <= 20 ? '2' : '3';
  return (
    <RadixSpinner size={radixSize as '1' | '2' | '3'} className={`text-mission-control-accent ${className}`} />
  );
}

// ============================================================================
// Loading Button - Button with loading state
// ============================================================================

interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  icon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({
  loading = false,
  disabled = false,
  onClick,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  type = 'button',
}: LoadingButtonProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-1' : size === 'lg' ? 'text-base px-4 py-2.5' : 'text-sm px-3 py-1.5';

  if (variant === 'ghost') {
    return (
      <button
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium text-mission-control-text-dim hover:text-mission-control-text hover:bg-mission-control-border/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${className}`}
      >
        {loading ? (
          <>
            <Spinner size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  }

  const radixVariant = variant === 'primary' ? 'solid' : variant === 'danger' ? 'solid' : 'surface';
  const radixColor = variant === 'danger' ? 'red' : variant === 'primary' ? 'grass' : 'gray';
  const radixSize = size === 'sm' ? '1' : size === 'lg' ? '3' : '2';

  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      variant={radixVariant as 'solid' | 'surface'}
      color={radixColor as 'red' | 'grass' | 'gray'}
      size={radixSize as '1' | '2' | '3'}
      className={className}
    >
      {loading ? (
        <>
          <Spinner size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
          <span>Loading...</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  );
}

// ============================================================================
// Skeleton Screens - For data loading placeholders
// ============================================================================

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ className = '', width = 'w-full', height = 'h-4', rounded = 'md' }: SkeletonProps) {
  const roundedStyles = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return (
    <div
      className={`${width} ${height} ${roundedStyles[rounded]} bg-mission-control-border/30 animate-pulse ${className}`}
    />
  );
}

// Task Card Skeleton
export function TaskCardSkeleton() {
  return (
    <Box p="3" className="bg-mission-control-surface rounded-lg border border-mission-control-border space-y-3">
      <Flex align="start" justify="between" gap="2">
        <Skeleton height="h-5" width="w-3/4" />
        <Skeleton height="h-5" width="w-5" rounded="sm" />
      </Flex>
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-2/3" />
      <Flex align="center" gap="2" pt="2">
        <Skeleton height="h-6" width="w-16" rounded="full" />
        <Skeleton height="h-6" width="w-20" rounded="full" />
      </Flex>
    </Box>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-b border-mission-control-border">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height="h-4" width={i === 0 ? 'w-3/4' : 'w-1/2'} />
        </td>
      ))}
    </tr>
  );
}

// Agent Card Skeleton
export function AgentCardSkeleton() {
  return (
    <Box p="4" className="bg-mission-control-surface rounded-lg border border-mission-control-border space-y-3">
      <Flex align="center" gap="3">
        <Skeleton height="h-12" width="w-12" rounded="full" />
        <Box flexGrow="1" className="space-y-2">
          <Skeleton height="h-5" width="w-32" />
          <Skeleton height="h-3" width="w-24" />
        </Box>
      </Flex>
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-4/5" />
    </Box>
  );
}

// Session Card Skeleton
export function SessionCardSkeleton() {
  return (
    <Box p="3" className="bg-mission-control-surface rounded-lg border border-mission-control-border space-y-2">
      <Flex align="center" gap="2">
        <Skeleton height="h-8" width="w-8" rounded="full" />
        <Box flexGrow="1" className="space-y-1">
          <Skeleton height="h-4" width="w-32" />
          <Skeleton height="h-3" width="w-24" />
        </Box>
      </Flex>
    </Box>
  );
}

// ============================================================================
// Loading Overlay - For full-screen or panel loading
// ============================================================================

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingOverlay({ message = 'Loading...', fullScreen = false }: LoadingOverlayProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 z-50'
    : 'absolute inset-0';

  return (
    <Flex align="center" justify="center" className={`${containerClass} bg-mission-control-bg/80`}>
      <Flex direction="column" align="center" gap="3" p="5" className="bg-mission-control-surface border border-mission-control-border rounded-xl shadow-lg">
        <RadixSpinner size="3" className="text-mission-control-accent" />
        <Text size="2" weight="medium" className="text-mission-control-text-dim">{message}</Text>
      </Flex>
    </Flex>
  );
}

// ============================================================================
// Progress Bar - For long-running operations
// ============================================================================

interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({ progress, label, showPercentage = true, className = '' }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <Flex justify="between" align="center" mb="2">
          {label && <Text size="2">{label}</Text>}
          {showPercentage && <Text size="2" color="gray">{clampedProgress}%</Text>}
        </Flex>
      )}
      <div className="w-full h-2 bg-mission-control-border rounded-full overflow-hidden">
        <div
          className="h-full bg-mission-control-accent transition-colors duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Inline Loader - For small inline loading states
// ============================================================================

interface InlineLoaderProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function InlineLoader({ text, size = 'md' }: InlineLoaderProps) {
  const radixSize = size === 'sm' ? '1' : size === 'lg' ? '3' : '2';
  const textSizeMap = { sm: '1' as const, md: '2' as const, lg: '3' as const };

  return (
    <Flex align="center" gap="2" className="text-xs text-mission-control-text-dim">
      <RadixSpinner size={radixSize as '1' | '2' | '3'} className="text-mission-control-accent" />
      {text && <Text size={textSizeMap[size]} className="text-mission-control-text-dim">{text}</Text>}
    </Flex>
  );
}

// ============================================================================
// Pulsing Dot - For real-time activity indicators
// ============================================================================

interface PulsingDotProps {
  color?: string;
  size?: number;
}

export function PulsingDot({ color = 'bg-mission-control-accent', size = 8 }: PulsingDotProps) {
  return (
    <span className="relative flex">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} style={{ width: size, height: size }} />
      <span className={`relative inline-flex rounded-full ${color}`} style={{ width: size, height: size }} />
    </span>
  );
}
