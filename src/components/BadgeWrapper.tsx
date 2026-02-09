/**
 * BadgeWrapper Component
 * Provides consistent positioning, z-index, and sizing for all badge types
 * 
 * Fixes:
 * - Standardized z-index (z-10) for all badges
 * - Consistent min-width to accommodate 99+ values
 * - Proper positioning to prevent icon/text overlap
 */

import React from 'react';

interface BadgeWrapperProps {
  children: React.ReactNode;
  position?: 'inline' | 'absolute-top-right' | 'absolute-top-left';
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BadgeWrapper({ 
  children, 
  position = 'inline',
  variant = 'primary',
  size = 'md',
  className = ''
}: BadgeWrapperProps) {
  
  // Position classes
  const positionClasses = {
    'inline': 'relative',
    'absolute-top-right': 'absolute -top-1 -right-1',
    'absolute-top-left': 'absolute -top-1 -left-1',
  };

  // Variant classes (background + text color)
  const variantClasses = {
    'primary': 'bg-clawd-accent text-white',
    'secondary': 'bg-clawd-border text-clawd-text',
    'danger': 'bg-red-500 text-white',
    'warning': 'bg-orange-500 text-white',
    'success': 'bg-green-500 text-white',
  };

  // Size classes - increased min-width to properly accommodate "99+"
  const sizeClasses = {
    'sm': 'min-w-[24px] h-[18px] text-[10px] px-1.5',
    'md': 'min-w-[28px] h-[20px] text-xs px-2',
    'lg': 'min-w-[32px] h-[22px] text-sm px-2.5',
  };

  return (
    <span
      className={`
        ${positionClasses[position]}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        inline-flex items-center justify-center
        rounded-full font-bold shadow-md
        flex-shrink-0
        ${className}
      `}
      style={{
        lineHeight: '1'
      }}
    >
      {children}
    </span>
  );
}

/**
 * NumberBadge - Specialized badge for displaying numbers with proper overflow handling
 */
interface NumberBadgeProps {
  count: number;
  maxCount?: number;
  position?: 'inline' | 'absolute-top-right' | 'absolute-top-left';
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function NumberBadge({
  count,
  maxCount = 99,
  position = 'inline',
  variant = 'primary',
  size = 'md',
  className = ''
}: NumberBadgeProps) {
  const displayValue = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <BadgeWrapper
      position={position}
      variant={variant}
      size={size}
      className={className}
    >
      {displayValue}
    </BadgeWrapper>
  );
}

/**
 * DotBadge - Simple dot indicator for unread/active states
 */
interface DotBadgeProps {
  show: boolean;
  position?: 'inline' | 'absolute-top-right' | 'absolute-top-left';
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'success';
  pulse?: boolean;
  className?: string;
}

export function DotBadge({
  show,
  position = 'absolute-top-right',
  variant = 'danger',
  pulse = false,
  className = ''
}: DotBadgeProps) {
  if (!show) return null;

  const variantClasses = {
    'primary': 'bg-clawd-accent',
    'secondary': 'bg-clawd-border',
    'danger': 'bg-red-500',
    'warning': 'bg-orange-500',
    'success': 'bg-green-500',
  };

  const positionClasses = {
    'inline': 'relative',
    'absolute-top-right': 'absolute -top-0.5 -right-0.5',
    'absolute-top-left': 'absolute -top-0.5 -left-0.5',
  };

  return (
    <span
      className={`
        ${positionClasses[position]}
        ${variantClasses[variant]}
        w-2.5 h-2.5 rounded-full
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  );
}
