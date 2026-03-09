/**
 * LoadingStates.tsx
 * 
 * Reusable loading components for consistent UX across the dashboard.
 * Provides spinners, skeletons, and loading button states.
 */

import { Loader2 } from 'lucide-react';
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
  return (
    <Loader2 
      size={size} 
      className={`animate-spin text-mission-control-accent ${className}`} 
    />
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
  const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-mission-control-accent focus:ring-offset-2 focus:ring-offset-mission-control-bg disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-mission-control-accent text-white hover:opacity-90',
    secondary: 'bg-mission-control-surface border border-mission-control-border text-mission-control-text hover:border-mission-control-accent',
    danger: 'bg-error text-white hover:bg-error-hover',
    ghost: 'text-mission-control-text hover:bg-mission-control-surface',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
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
      className={`${width} ${height} ${roundedStyles[rounded]} bg-mission-control-border animate-pulse ${className}`}
    />
  );
}

// Task Card Skeleton
export function TaskCardSkeleton() {
  return (
    <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Skeleton height="h-5" width="w-3/4" />
        <Skeleton height="h-5" width="w-5" rounded="sm" />
      </div>
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-2/3" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton height="h-6" width="w-16" rounded="full" />
        <Skeleton height="h-6" width="w-20" rounded="full" />
      </div>
    </div>
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
    <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton height="h-12" width="w-12" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton height="h-5" width="w-32" />
          <Skeleton height="h-3" width="w-24" />
        </div>
      </div>
      <Skeleton height="h-3" width="w-full" />
      <Skeleton height="h-3" width="w-4/5" />
    </div>
  );
}

// Session Card Skeleton
export function SessionCardSkeleton() {
  return (
    <div className="bg-mission-control-surface rounded-lg border border-mission-control-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton height="h-8" width="w-8" rounded="full" />
        <div className="flex-1 space-y-1">
          <Skeleton height="h-4" width="w-32" />
          <Skeleton height="h-3" width="w-24" />
        </div>
      </div>
    </div>
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
    <div className={`${containerClass} bg-mission-control-bg/80 backdrop-blur-sm flex items-center justify-center`}>
      <div className="bg-mission-control-surface border border-mission-control-border rounded-lg p-6 flex flex-col items-center gap-3 shadow-xl">
        <Spinner size={32} />
        <p className="text-mission-control-text font-medium">{message}</p>
      </div>
    </div>
  );
}

// ============================================================================
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
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-mission-control-text">{label}</span>}
          {showPercentage && <span className="text-sm text-mission-control-text-dim">{clampedProgress}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-mission-control-border rounded-full overflow-hidden">
        <div
          className="h-full bg-mission-control-accent transition-all duration-300 ease-out"
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
  const sizeMap = { sm: 12, md: 16, lg: 20 };
  const textSizeMap = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

  return (
    <div className="flex items-center gap-2">
      <Spinner size={sizeMap[size]} />
      {text && <span className={`text-mission-control-text-dim ${textSizeMap[size]}`}>{text}</span>}
    </div>
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
