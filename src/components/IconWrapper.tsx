import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Icon Size Scale (Design System)
 * - xs:  12px - Inline badges, priority indicators, subtasks
 * - sm:  16px - Default UI icons (buttons, inputs, status)
 * - md:  20px - Section headers, prominent actions
 * - lg:  24px - Modal headers, panel titles
 * - xl:  32px - Large cards, feature displays
 * - 2xl: 48px - Hero/empty states, illustrations
 */
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const iconSizeMap: Record<IconSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

interface IconWrapperProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
  /** Custom pixel size (overrides size prop) */
  customSize?: number;
}

/**
 * IconWrapper - Consistent icon rendering with standardized sizes
 * 
 * Usage:
 * ```tsx
 * <IconWrapper icon={Plus} size="sm" />
 * <IconWrapper icon={AlertTriangle} size="md" className="text-error" />
 * ```
 */
export function IconWrapper({ icon: Icon, size = 'sm', className = '', customSize }: IconWrapperProps) {
  const pixelSize = customSize || iconSizeMap[size];
  
  return (
    <Icon 
      size={pixelSize} 
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}

interface IconTextProps {
  icon: LucideIcon;
  children: React.ReactNode;
  iconSize?: IconSize;
  spacing?: 'tight' | 'normal' | 'loose';
  className?: string;
  iconClassName?: string;
}

/**
 * IconText - Icon + Text combination with consistent alignment and spacing
 * 
 * Usage:
 * ```tsx
 * <IconText icon={Plus} iconSize="sm">Add Task</IconText>
 * <IconText icon={User} spacing="tight" iconClassName="text-info">3 users</IconText>
 * ```
 */
export function IconText({ 
  icon: Icon, 
  children, 
  iconSize = 'sm', 
  spacing = 'normal',
  className = '',
  iconClassName = ''
}: IconTextProps) {
  const spacingClass = {
    tight: 'icon-text-tight',
    normal: 'icon-text',
    loose: 'icon-text-loose',
  }[spacing];
  
  return (
    <span className={`${spacingClass} ${className}`}>
      <IconWrapper icon={Icon} size={iconSize} className={iconClassName} />
      {children}
    </span>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  iconSize?: IconSize;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  children?: React.ReactNode;
  iconClassName?: string;
}

/**
 * IconButton - Consistent icon button with proper centering and sizing
 * 
 * Usage:
 * ```tsx
 * <IconButton icon={Plus} />
 * <IconButton icon={Trash2} variant="danger" size="sm" />
 * <IconButton icon={Play} iconSize="md">Start</IconButton>
 * ```
 */
export function IconButton({ 
  icon: Icon, 
  size = 'md',
  iconSize = 'sm',
  variant = 'default',
  children,
  className = '',
  iconClassName = '',
  ...props 
}: IconButtonProps) {
  const sizeClass = {
    sm: 'icon-btn-sm',
    md: 'icon-btn',
    lg: 'icon-btn-lg',
  }[size];
  
  const variantClass = {
    default: '',
    primary: 'bg-clawd-accent text-white hover:bg-clawd-accent/90',
    danger: 'text-error hover:bg-error-subtle',
    ghost: 'hover:bg-transparent hover:text-clawd-accent',
  }[variant];
  
  return (
    <button 
      className={`${children ? 'icon-text' : sizeClass} ${variantClass} ${className}`}
      {...props}
    >
      <IconWrapper icon={Icon} size={iconSize} className={iconClassName} />
      {children}
    </button>
  );
}

interface IconBadgeProps {
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  iconSize?: IconSize;
  className?: string;
  iconClassName?: string;
}

/**
 * IconBadge - Circular icon container for badges and avatars
 * 
 * Usage:
 * ```tsx
 * <IconBadge icon={User} className="bg-info-subtle text-info" />
 * <IconBadge icon={AlertTriangle} size="lg" iconSize="md" className="bg-error-subtle" />
 * ```
 */
export function IconBadge({ 
  icon: Icon, 
  size = 'md',
  iconSize = 'sm',
  className = '',
  iconClassName = ''
}: IconBadgeProps) {
  const sizeClass = {
    sm: 'icon-badge-sm',
    md: 'icon-badge',
    lg: 'icon-badge-lg',
  }[size];
  
  return (
    <div className={`${sizeClass} ${className}`}>
      <IconWrapper icon={Icon} size={iconSize} className={iconClassName} />
    </div>
  );
}

export default IconWrapper;
